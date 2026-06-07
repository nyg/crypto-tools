/// <reference types="bun-types" />
import { $ } from "bun";
import { existsSync } from "fs";

// This hook runs after ElectroBun assembles the self-extracting .app bundle,
// before the DMG is created. We apply an ad-hoc signature so macOS does not
// report the app as "damaged" when Gatekeeper encounters a linker-signed
// binary inside an otherwise unsigned bundle.
//
// This is only a local/ad-hoc signature. For notarized distribution, set
// `build.mac.codesign = true` and provide ELECTROBUN_DEVELOPER_ID.

const os = process.env.ELECTROBUN_OS;
if (os !== "macos") {
  process.exit(0);
}

const bundlePath = process.env.ELECTROBUN_WRAPPER_BUNDLE_PATH;
if (!bundlePath || !existsSync(bundlePath)) {
  console.error(`postwrap: bundle not found at ${bundlePath ?? "(unset)"}`);
  process.exit(1);
}

console.log(`postwrap: ad-hoc signing ${bundlePath}`);
await $`codesign --sign - --deep --force ${bundlePath}`;
console.log("postwrap: signing complete");
