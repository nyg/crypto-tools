import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import type { ElectrobunConfig } from "electrobun/bun";

const packageJson = fileURLToPath(new URL("./package.json", import.meta.url));
const { version } = JSON.parse(readFileSync(packageJson, "utf-8")) as { version: string };

export default {
  app: {
    name: "Crypto Tools",
    identifier: "io.github.nyg.crypto-tools",
    version,
  },
  build: {
    mac: {
      // Generated from assets/icon.svg, see scripts/generate-icons.sh.
      icons: "assets/icon.iconset",
    },
    win: {
      icon: "assets/icon.ico",
    },
    mainProcess: "bun",
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
