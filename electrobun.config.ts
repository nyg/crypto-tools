import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ElectrobunConfig } from "electrobun";

const packageJsonPath = fileURLToPath(new URL("./package.json", import.meta.url));
const { version } = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version: string };

export default {
  app: {
    name: "Crypto Tools",
    identifier: "io.github.nyg.crypto-tools",
    version,
  },
  build: {
    mainProcess: "bun",
    mac: {
      // Generated from assets/icon.svg, see scripts/generate-icons.sh.
      icons: "assets/icon.iconset",
      bundleCEF: false,
    },
    win: {
      icon: "assets/icon.ico",
      bundleCEF: false,
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
      "dist/favicon.ico": "views/main/favicon.ico",
      "dist/favicon.svg": "views/main/favicon.svg",
      "dist/apple-touch-icon.png": "views/main/apple-touch-icon.png",
    },
    watchIgnore: ["dist/**"],
  },
  scripts: {
    preBuild: "scripts/prebuild.ts",
    postWrap: "scripts/postwrap.ts",
  },
} satisfies ElectrobunConfig;
