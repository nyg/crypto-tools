/// <reference types="bun-types" />
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";

if (process.env.ELECTROBUN_OS !== "win") {
  process.exit(0);
}

const buildDir = process.env.ELECTROBUN_BUILD_DIR;
const appName = process.env.ELECTROBUN_APP_NAME;

if (!buildDir || !appName) {
  console.error("postbuild: ELECTROBUN_BUILD_DIR or ELECTROBUN_APP_NAME is unset");
  process.exit(1);
}

const binDir = join(buildDir, appName, "bin");
const target = join(binDir, "bun.exe");

if (!existsSync(target)) {
  console.error(`postbuild: ${target} not found — Electrobun layout may have changed`);
  process.exit(1);
}

const rceditDir = dirname(require.resolve("rcedit/package.json"));
const rcedit = [join(rceditDir, "bin", "rcedit-x64.exe"), join(rceditDir, "bin", "rcedit.exe")]
  .find(existsSync);

if (!rcedit) {
  console.error("postbuild: rcedit not found under node_modules/rcedit/bin");
  process.exit(1);
}

const manifest = join(import.meta.dir, "..", "assets", "windows-dpi.manifest");

console.log(`postbuild: stamping a PerMonitorV2 manifest onto ${target}`);
execFileSync(rcedit, [target, "--application-manifest", manifest], { stdio: "inherit" });
console.log("postbuild: manifest applied");
