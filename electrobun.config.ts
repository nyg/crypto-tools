import { readFileSync } from "fs";
import type { ElectrobunConfig } from "electrobun/bun";

const { version } = JSON.parse(readFileSync("./package.json", "utf-8")) as { version: string };

export default {
  app: {
    name: "CryptoTools",
    identifier: "io.github.nyg.crypto-tools",
    version,
  },
  build: {
    mac: {
      // A real .iconset directory with PNG icons at all required sizes is
      // needed before distributing. Replace the placeholder in assets/icon.iconset/.
      icons: "assets/icon.iconset",
    },
    bun: {
      entrypoint: "src/electrobun/index.ts",
    },
    copy: {
      // These paths are populated by scripts.preBuild (runs `vite build`).
      // If you add other top-level files to dist/ (e.g. favicon.ico, manifest.json),
      // add them here too.
      "dist/index.html": "views/main/index.html",
      "dist/assets": "views/main/assets",
    },
    watchIgnore: ["dist/**"],
  },
  scripts: {
    preBuild: "scripts/prebuild.ts",
    postWrap: "scripts/postwrap.ts",
  },
} satisfies ElectrobunConfig;
