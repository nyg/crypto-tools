/// <reference types="bun-types" />

const SEED_PATH = "src/server/data/xstocks.json";
const CONCURRENCY = 6;

type Listing = {
   name: string;
   exchange: string;
   type: "stock" | "etf";
   subtype: string;
};

type Seed = {
   generatedAt: string;
   source: string;
   listings: Record<string, Listing>;
};

const subtypeOverrides: Record<string, string> = {
   GLD: "commodity-trust",
   SLV: "commodity-trust",
   PALL: "commodity-trust",
   PPLT: "commodity-trust",
   FGDL: "commodity-trust",
   BITX: "leveraged",
   SOXL: "leveraged",
   TQQQ: "leveraged",
   SGOV: "bond",
   JPST: "bond",
   TBLL: "bond",
   JAAA: "bond",
   FAAA: "bond",
   FLBL: "bond",
   SATA: "preferred",
   STRC: "preferred",
};

const nameOverrides: Record<string, string> = {
   FLBL: "Franklin Senior Loan ETF",
   SATA: "Strive, Inc. Variable Rate Series A Perpetual Preferred Stock",
   STRC: "Strategy Inc. Variable Rate Series A Perpetual Stretch Preferred Stock",
};

async function fetchKrakenTickers(): Promise<string[]> {
   const response = await fetch("https://api.kraken.com/0/public/Assets?aclass=tokenized_asset");
   const { error, result } = await response.json() as {
      error: string[];
      result: Record<string, { altname?: string; status?: string }>;
   };

   if (error?.length) throw new Error(`Kraken API error: ${error.join(", ")}`);

   const altnames = new Set<string>();
   for (const asset of Object.values(result)) {
      if (asset.status === "enabled" && asset.altname) altnames.add(asset.altname);
   }

   return [...altnames].map(altname => altname.replace(/x$/, "")).sort();
}

async function resolve(ticker: string): Promise<Listing | null> {
   const response = await fetch(`https://stockanalysis.com/stocks/${ticker.toLowerCase()}/`, {
      headers: { "User-Agent": "Mozilla/5.0" },
   });

   if (!response.ok) return null;

   const body = await response.text();
   const type = response.url.includes("/etf/") ? "etf" : response.url.includes("/stocks/") ? "stock" : null;
   if (!type) return null;

   const heading = body.match(/<h1[^>]*>([^<]*)<\/h1>/);
   if (!heading) return null;

   const name = heading[1]
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim();

   if (!name) return null;

   return { name, exchange: "", type, subtype: "" };
}

async function inBatches<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
   const results: R[] = [];
   for (let index = 0; index < items.length; index += size) {
      results.push(...await Promise.all(items.slice(index, index + size).map(worker)));
   }
   return results;
}

const refreshAll = process.argv.includes("--all");

const seed = await Bun.file(SEED_PATH).json() as Seed;
const tickers = await fetchKrakenTickers();
const targets = refreshAll ? tickers : tickers.filter(ticker => !seed.listings[ticker]);

console.log(`Kraken lists ${tickers.length} tokenized assets; resolving ${targets.length}.`);

const resolved = await inBatches(targets, CONCURRENCY, async ticker => [ticker, await resolve(ticker)] as const);

const listings: Record<string, Listing> = refreshAll ? {} : { ...seed.listings };
const unresolved: string[] = [];

for (const [ticker, listing] of resolved) {
   if (!listing) {
      unresolved.push(ticker);
      continue;
   }
   listings[ticker] = {
      ...listing,
      name: nameOverrides[ticker] ?? listing.name,
      subtype: subtypeOverrides[ticker] ?? "",
   };
}

for (const ticker of Object.keys(listings)) {
   if (!tickers.includes(ticker)) {
      console.log(`Kraken no longer lists ${ticker}; leaving it in the seed.`);
   }
}

const sorted = Object.fromEntries(Object.keys(listings).sort().map(ticker => [ticker, listings[ticker]]));

const output: Seed = {
   generatedAt: new Date().toISOString().slice(0, 10),
   source: "stockanalysis.com",
   listings: sorted,
};

await Bun.write(SEED_PATH, `${JSON.stringify(output, null, 3)}\n`);

const stocks = Object.values(sorted).filter(listing => listing.type === "stock").length;
const etfs = Object.values(sorted).filter(listing => listing.type === "etf").length;

console.log(`Wrote ${Object.keys(sorted).length} listings to ${SEED_PATH} (${stocks} stocks, ${etfs} ETFs).`);
if (unresolved.length) {
   console.log(`Could not resolve, left for the app to classify: ${unresolved.join(", ")}`);
}
