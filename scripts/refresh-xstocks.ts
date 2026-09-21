/// <reference types="bun-types" />

export {};

const SEED_PATH = "src/server/data/xstocks.json";
const PRODUCTS_PATH = "src/server/data/xstock-products.json";
const XSTOCKS_API = "https://api.xstocks.fi/api/v2/public/assets";
const BACKED_PRODUCTS = "https://assets.backed.fi/products";
const NASDAQ_DIRECTORY = "https://www.nasdaqtrader.com/dynamic/SymDir";

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

type Product = {
   symbol: string;
   isin: string;
   underlyingIsin: string;
   slug: string;
};

type Products = {
   generatedAt: string;
   source: string;
   products: Record<string, Product>;
};

type XStockAsset = {
   symbol: string;
   isin: string;
   underlyingIsin: string | null;
};

type XStockAssetPage = {
   nodes: XStockAsset[];
   page: { currentPage: number; hasNextPage: boolean };
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

const tickerOf = (altname: string) => altname.replace(/x$/, "");

async function fetchKrakenAltnames(): Promise<string[]> {
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

   return [...altnames].sort();
}

const securityClass =
   /\s+(?:New\s+)?(?:(?:Class|Series) [A-Z]\s+)?(?:Common Stock|Common Shares|Ordinary Shares|American Depositary Shares)\b.*$/i;

const cleanName = (name: string) => name
   .replace(/\s+-\s+.*$/, "")
   .replace(securityClass, "")
   .replace(/^(.*?),? \(The\)$/, "The $1")
   .trim();

async function fetchSymbolDirectory(): Promise<Map<string, Listing>> {
   const directory = new Map<string, Listing>();
   for (const [file, etfColumn] of [["nasdaqlisted.txt", 6], ["otherlisted.txt", 4]] as const) {
      const response = await fetch(`${NASDAQ_DIRECTORY}/${file}`);
      if (!response.ok) throw new Error(`${NASDAQ_DIRECTORY}/${file} answered ${response.status}`);

      const [, ...lines] = (await response.text()).trim().split(/\r?\n/);
      for (const line of lines) {
         const columns = line.split("|");
         const [symbol = "", name = ""] = columns;
         if (!symbol || !name || symbol.startsWith("File Creation Time")) continue;

         const type = columns[etfColumn] === "Y" ? "etf" : "stock";
         directory.set(symbol, { name: cleanName(name), exchange: "", type, subtype: "" });
      }
   }
   return directory;
}

async function fetchXStockAssets(): Promise<Map<string, XStockAsset>> {
   const assets = new Map<string, XStockAsset>();
   for (let page = 0; ; page++) {
      const response = await fetch(`${XSTOCKS_API}?page=${page}`);
      if (!response.ok) throw new Error(`xStocks API answered ${response.status} for page ${page}`);

      const { nodes, page: position } = await response.json() as XStockAssetPage;
      for (const asset of nodes) assets.set(asset.symbol, asset);
      if (!position.hasNextPage) break;
   }
   if (assets.size === 0) throw new Error(`${XSTOCKS_API} listed no xStocks`);
   return assets;
}

async function fetchProductSlugs(): Promise<Map<string, string>> {
   const slugs = new Map<string, string>();
   let query = "";
   do {
      const response = await fetch(`${BACKED_PRODUCTS}${query}`, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!response.ok) throw new Error(`${BACKED_PRODUCTS}${query} answered ${response.status}`);

      const body = await response.text();
      const rows = body.split('class="products-table-row w-dyn-item"').slice(1);
      for (const row of rows) {
         const slug = row.match(/href="\/products\/([^"]+)"/)?.[1];
         const symbol = row.match(/data-factsheet-symbol="([^"]+)"/)?.[1];
         if (slug && symbol) slugs.set(symbol, slug);
      }

      query = body.match(/<a href="(\?[^"]+)"[^>]*class="w-pagination-next/)?.[1] ?? "";
   } while (query);
   if (slugs.size === 0) throw new Error(`Found no products on ${BACKED_PRODUCTS}; has the page changed?`);
   return slugs;
}

async function writeIfChanged(path: string, content: Omit<Seed, "generatedAt"> | Omit<Products, "generatedAt">): Promise<boolean> {
   const file = Bun.file(path);
   if (await file.exists()) {
      const { generatedAt: _, ...previous } = await file.json() as Seed | Products;
      if (JSON.stringify(previous) === JSON.stringify(content)) return false;
   }
   const generatedAt = new Date().toISOString().slice(0, 10);
   await Bun.write(path, `${JSON.stringify({ generatedAt, ...content }, null, 3)}\n`);
   return true;
}

const refreshAll = process.argv.includes("--all");

const seed = await Bun.file(SEED_PATH).json() as Seed;
const altnames = await fetchKrakenAltnames();
const tickers = altnames.map(tickerOf);
const targets = refreshAll ? tickers : tickers.filter(ticker => !seed.listings[ticker]);

console.log(`Kraken lists ${tickers.length} tokenized assets; resolving ${targets.length}.`);

const directory = targets.length ? await fetchSymbolDirectory() : new Map<string, Listing>();

const listings: Record<string, Listing> = refreshAll ? {} : { ...seed.listings };
const sources = new Set(refreshAll ? [] : seed.source.split(", "));
const resolved: string[] = [];
const unresolved: string[] = [];

for (const ticker of targets) {
   const listing = directory.get(ticker);
   if (!listing) {
      unresolved.push(ticker);
      continue;
   }
   listings[ticker] = listing;
   resolved.push(ticker);
   sources.add("nasdaqtrader.com");
}

for (const [ticker, listing] of Object.entries(listings)) {
   listings[ticker] = {
      ...listing,
      name: nameOverrides[ticker] ?? listing.name,
      subtype: subtypeOverrides[ticker] ?? listing.subtype,
   };
}

for (const ticker of resolved) {
   const { name, type, subtype } = listings[ticker]!;
   console.log(`Resolved ${ticker}: ${name} (${type}${subtype ? `, ${subtype}` : ""}).`);
}

for (const ticker of Object.keys(listings)) {
   if (!tickers.includes(ticker)) {
      console.log(`Kraken no longer lists ${ticker}; leaving it in the seed.`);
   }
}

const sorted = Object.fromEntries(
  Object.entries(listings).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
);

const listingsChanged = await writeIfChanged(SEED_PATH, { source: [...sources].join(", "), listings: sorted });

const stocks = Object.values(sorted).filter(listing => listing.type === "stock").length;
const etfs = Object.values(sorted).filter(listing => listing.type === "etf").length;

console.log(`${Object.keys(sorted).length} listings (${stocks} stocks, ${etfs} ETFs), ${listingsChanged ? "written to" : "unchanged in"} ${SEED_PATH}.`);
if (unresolved.length) {
   console.log(`Could not resolve, left for the app to classify: ${unresolved.join(", ")}`);
}

const [assets, slugs] = await Promise.all([fetchXStockAssets(), fetchProductSlugs()]);

const products: Record<string, Product> = {};
const unissued: string[] = [];
const unpublished: string[] = [];

for (const altname of altnames) {
   const asset = assets.get(altname);
   if (!asset) {
      unissued.push(altname);
      continue;
   }
   const slug = slugs.get(altname) ?? "";
   if (!slug) unpublished.push(altname);
   products[tickerOf(altname)] = {
      symbol: asset.symbol,
      isin: asset.isin,
      underlyingIsin: asset.underlyingIsin ?? "",
      slug,
   };
}

const productsChanged = await writeIfChanged(PRODUCTS_PATH, { source: "api.xstocks.fi, assets.backed.fi", products });

console.log(`${Object.keys(products).length} xStock products, ${productsChanged ? "written to" : "unchanged in"} ${PRODUCTS_PATH}.`);
if (unissued.length) {
   console.log(`Not issued by Backed, so no ISIN or links: ${unissued.join(", ")}`);
}
if (unpublished.length) {
   console.log(`No product page on assets.backed.fi yet: ${unpublished.join(", ")}`);
}
