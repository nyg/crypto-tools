# Auto-Update for CryptoTools (macOS & Windows)

## Executive Summary

Adding auto-update to this Electron app is **fully achievable for Windows** and **conditionally achievable for macOS**. The project already has `electron-builder` installed and a GitHub-based release workflow, so the foundation is almost entirely in place. The core requirement is `electron-updater` (a runtime companion to `electron-builder`) plus a `publish` configuration pointing at GitHub. The one major friction point is **macOS code signing**: `electron-updater` requires a valid Apple Developer ID signature to install updates on macOS; without it the updater will throw an error. Windows has no such hard requirement (users only get a SmartScreen warning with unsigned installers).

This report covers both paths: **Windows-only auto-update now** (zero cost, works today), and **full macOS + Windows auto-update** (requires Apple Developer account).

---

## How electron-updater Works

```
User's running app                      GitHub Releases
      │                                        │
      │  1. GET latest.yml / latest-mac.yml    │
      │ ──────────────────────────────────────▶│
      │  2. compare versions                   │
      │  3. if newer: download binary (zip/exe)│ ◀─────────────────
      │  4. verify SHA-512 hash                │
      │  5. install & restart                  │
```

electron-builder publishes two metadata files alongside each release[^1]:

| File | Platform | Used for |
|------|----------|----------|
| `latest.yml` | Windows (& Linux) | Version info + SHA-512 of the NSIS installer |
| `latest-mac.yml` | macOS | Version info + SHA-512 of the zip payload |

`electron-updater` fetches the appropriate file at startup (or on demand), compares the `version` field to `app.getVersion()`, and auto-downloads if there is a newer release. For macOS, the actual update payload is a **zip** of the `.app` bundle, not the `.dmg` — the DMG is only for first-time installation[^2].

---

## Current State of the Project

| Aspect | Current | Required for Auto-Update |
|--------|---------|--------------------------|
| `electron-builder` | ✅ `26.8.1` (devDep) | ✅ Already present |
| `electron-updater` | ❌ Not installed | Needs to be added as runtime `dependency` |
| `publish` config in `package.json` | ❌ Missing | Needs GitHub provider config |
| macOS build target | `dmg` only | Also needs `zip` for updater payload |
| macOS code signing | ❌ `CSC_IDENTITY_AUTO_DISCOVERY: false` | Required for macOS auto-update |
| Release workflow | Manual `gh release create` | Needs to upload `latest.yml`/`latest-mac.yml` |

- **`package.json`** (`build.electron:build` script)[^3]: currently uses `--publish never`
- **`electron/main.cjs`**[^4]: no updater code whatsoever
- **`.github/workflows/release.yml`**[^5]: 3-job structure (prepare → build → release), manually creates GitHub release, does **not** upload the metadata YAML files that `electron-updater` requires

---

## Required Changes

### 1. Install `electron-updater`

`electron-updater` must be a **runtime dependency** (not devDependency) because it runs inside the packaged app's main process. If placed in devDependencies it won't be bundled[^6].

```bash
pnpm add electron-updater
```

### 2. Add `publish` config to `package.json`

Add a `publish` key inside the existing `"build"` section[^1]:

```json
"build": {
  "appId": "com.nyg.crypto-tools",
  "productName": "CryptoTools",
  "publish": [
    {
      "provider": "github",
      "owner": "nyg",
      "repo": "crypto-tools"
    }
  ],
  "mac": {
    "target": [
      { "target": "dmg" },
      { "target": "zip" }
    ],
    "category": "public.app-category.finance"
  },
  "win": {
    "target": [{ "target": "nsis" }],
    "artifactName": "${productName}-${version}-setup.${ext}"
  }
  ...
}
```

The `zip` target is added to `mac` — this is the payload `electron-updater` actually downloads for macOS updates. The `dmg` stays for initial installation[^2].

### 3. Update `electron/main.cjs`

Add auto-update logic after the window is created. The check should be conditional on whether the app is packaged (avoids noise during `pnpm dev`)[^7]:

```js
'use strict'

const { app, BrowserWindow, dialog, utilityProcess } = require('electron')
const path = require('path')
const http = require('http')

// Only require electron-updater in packaged builds
let autoUpdater = null
if (app.isPackaged) {
   autoUpdater = require('electron-updater').autoUpdater
}

// ... (existing startNextServer, waitForServer, createWindow functions unchanged) ...

function setupAutoUpdater() {
   if (!autoUpdater) return

   autoUpdater.on('update-available', (info) => {
      dialog.showMessageBox({
         type: 'info',
         title: 'Update available',
         message: `Version ${info.version} is available and will be downloaded in the background.`,
         buttons: ['OK'],
      })
   })

   autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox({
         type: 'info',
         title: 'Update ready',
         message: 'A new version has been downloaded. The app will restart to apply the update.',
         buttons: ['Restart now', 'Later'],
      }).then(({ response }) => {
         if (response === 0) autoUpdater.quitAndInstall()
      })
   })

   autoUpdater.on('error', (err) => {
      console.error('[updater]', err.message)
   })

   // Check silently — no dialog if already up to date
   autoUpdater.checkForUpdatesAndNotify()
}

app.whenReady().then(async () => {
   startNextServer()
   try {
      await waitForServer()
      createWindow()
      setupAutoUpdater()   // ← add this line
   } catch (err) {
      // ... (existing error handling unchanged) ...
   }
})
```

### 4. Update the GitHub Actions release workflow

The current `release.yml` uploads only `.dmg`, `.exe`, and `.AppImage` artifacts. `electron-updater` also needs `latest.yml` and `latest-mac.yml` to be present on the GitHub release[^1].

**Minimal change** — update two sections of `.github/workflows/release.yml`:

**In the `build` job, widen the artifact upload path to include YAML files:**

```yaml
# Before:
- name: Upload artifacts
  uses: actions/upload-artifact@...
  with:
    name: dist-${{ matrix.platform }}
    path: |
      dist/*.dmg
      dist/*.exe
      dist/*.AppImage

# After:
- name: Upload artifacts
  uses: actions/upload-artifact@...
  with:
    name: dist-${{ matrix.platform }}
    path: |
      dist/*.dmg
      dist/*.exe
      dist/*.AppImage
      dist/*.yml        # ← add this; captures latest.yml and latest-mac.yml
```

**In the `release` job, add `*.yml` to the `gh release create` command:**

```yaml
# Before:
- name: Create GitHub release
  run: |
    gh release create "v${{ needs.prepare.outputs.release_version }}" \
      dist/*.dmg \
      dist/*.exe \
      dist/*.AppImage \
      --title "Release v${{ needs.prepare.outputs.release_version }}" \
      --verify-tag \
      --generate-notes

# After:
- name: Create GitHub release
  run: |
    gh release create "v${{ needs.prepare.outputs.release_version }}" \
      dist/*.dmg \
      dist/*.exe \
      dist/*.AppImage \
      dist/*.yml \        # ← add this line
      --title "Release v${{ needs.prepare.outputs.release_version }}" \
      --verify-tag \
      --generate-notes
```

`electron-builder` generates `latest.yml` (and `latest-mac.yml`) in `dist/` even with `--publish never`[^1]. By simply uploading them alongside the installers, `electron-updater` in any running instance of the app can find them.

---

## The macOS Code Signing Problem

This is the largest obstacle. macOS requires a valid **Apple Developer ID Application** certificate for:
1. Running the app without Gatekeeper quarantine prompts on other machines
2. `electron-updater` installing updates — it verifies the update payload's signature matches the running app's signature before applying

The current release workflow explicitly disables signing with `CSC_IDENTITY_AUTO_DISCOVERY: false`[^5], so the distributed DMGs are unsigned.

### Option A: Enable macOS Code Signing (full auto-update)

**Requirements:**
- Active **Apple Developer Program** membership (~$99/year)
- An **Apple Developer ID Application** certificate (not a Mac App Store cert)
- Optionally: **notarization** (required since macOS Catalina for Gatekeeper-free distribution)

**GitHub Actions setup:**

1. Export your certificate as a `.p12` file, base64-encode it, and store as `CSC_LINK` secret (base64 value) and `CSC_KEY_PASSWORD` secret in your repo settings.
2. For notarization, add secrets: `APPLE_ID`, `APPLE_ID_PASSWORD` (an App-Specific Password from appleid.apple.com), `APPLE_TEAM_ID`.
3. Update the build step in the workflow:

```yaml
- name: Build Electron app
  run: pnpm electron:build
  env:
    NEXT_TELEMETRY_DISABLED: 1
    # Remove CSC_IDENTITY_AUTO_DISCOVERY: false (or delete the whole env block)
    CSC_LINK: ${{ secrets.CSC_LINK }}               # base64-encoded .p12
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
    APPLE_ID: ${{ secrets.APPLE_ID }}               # for notarization
    APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

4. Add notarization config to `package.json` (electron-builder handles it automatically when the credentials are present and the `notarize` hook is configured, or you can use `@electron/notarize` as a `afterSign` hook).

With signing and notarization in place, macOS auto-update works identically to Windows.

### Option B: Windows-only auto-update (no signing needed, works today)

If you want to avoid the Apple Developer account overhead, auto-update can be **limited to Windows** by guarding the `setupAutoUpdater()` call:

```js
function setupAutoUpdater() {
   // macOS requires code signing for electron-updater to work
   // Skip auto-update on macOS until signing is configured
   if (!autoUpdater || process.platform === 'darwin') return

   // ... rest of auto-updater setup ...
}
```

macOS users would still get the app, but wouldn't receive in-app update notifications. You could replace the macOS path with a "check for updates" menu item that opens the GitHub releases page in the browser:

```js
if (process.platform === 'darwin') {
   // Open releases page for manual update
   require('electron').shell.openExternal(
      'https://github.com/nyg/crypto-tools/releases/latest'
   )
}
```

### Option C: Self-signed certificate (development/testing only)

For testing the update flow locally on macOS without a real Apple Developer account, a self-signed certificate can be created and trusted on the test machine. This is **not suitable for distribution** — users on other machines will get Gatekeeper blocks. This is only useful to verify your update logic works before investing in a Developer account.

---

## Platform Comparison

| Concern | Windows | macOS |
|---------|---------|-------|
| Code signing required for updater? | No (but SmartScreen warns) | **Yes** (hard requirement) |
| Works without signing? | ✅ Yes | ❌ No (updater throws) |
| Update payload format | NSIS `.exe` installer | `.zip` of `.app` bundle |
| Metadata file checked | `latest.yml` | `latest-mac.yml` |
| Restart mechanism | `autoUpdater.quitAndInstall()` | Same |
| Apple notarization required? | N/A | Yes (since macOS Catalina) |

---

## Full Implementation Summary

### Minimal (Windows auto-update only, no cost)

1. `pnpm add electron-updater` → adds to `dependencies`
2. Add `"publish"` config + `zip` target to `"build"` in `package.json`
3. Update `electron/main.cjs` with auto-update code, guarded `if (process.platform !== 'darwin')`
4. Update `.github/workflows/release.yml` to upload `dist/*.yml` as release assets
5. Remove `CSC_IDENTITY_AUTO_DISCOVERY: false` from the macOS build step (it doesn't affect Windows)

### Full (macOS + Windows auto-update, requires Apple Developer account)

All of the above, plus:

5. Obtain Apple Developer ID Application certificate
6. Add signing secrets to GitHub repo: `CSC_LINK`, `CSC_KEY_PASSWORD`
7. Add notarization secrets: `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`
8. Remove `CSC_IDENTITY_AUTO_DISCOVERY: false` from the workflow
9. Configure notarization hook in `package.json` or via `electron-builder` `afterSign` option
10. Remove the `process.platform !== 'darwin'` guard

---

## Confidence Assessment

**High confidence:**
- The `electron-updater` + GitHub provider pattern is well-documented and widely used. The described package changes, API calls, and workflow edits are accurate.
- The current workflow generating `latest.yml` files in `dist/` with `--publish never` is confirmed behavior of `electron-builder`.
- macOS code signing being a hard requirement for `electron-updater` is confirmed in both official docs and multiple community sources.

**Medium confidence:**
- The exact workflow YAML changes (paths, globbing) should be validated against the actual `dist/` output of a real build run to confirm file naming.
- `electron-updater` version compatibility: pairing with `electron-builder@26` should use `electron-updater@6.x`; verify with `pnpm info electron-updater versions` before installing.

**Assumptions made:**
- The GitHub repository `nyg/crypto-tools` is public (the free GitHub provider for `electron-updater` requires public repos, or a token for private ones).
- The project owner does not currently have an Apple Developer account.

---

## Footnotes

[^1]: electron-builder auto-update documentation and `latest.yml` / `latest-mac.yml` format — https://www.electron.build/auto-update

[^2]: For macOS, `electron-updater` downloads a `zip` payload (not `dmg`) to apply updates. The `dmg` target is for initial user download only. See electron-builder publish docs: https://www.electron.build/configuration/publish

[^3]: `/Users/user/Documents/dev/js/crypto-tools/package.json:30` — `"electron:build": "next build && node scripts/copy-static.cjs && electron-builder --publish never"` and `package.json:72-119` for the full `build` config with no `publish` key.

[^4]: `/Users/user/Documents/dev/js/crypto-tools/electron/main.cjs` — entire file; no reference to `electron-updater`.

[^5]: `/Users/user/Documents/dev/js/crypto-tools/.github/workflows/release.yml:116-117` — `CSC_IDENTITY_AUTO_DISCOVERY: false` disables macOS code signing. Line `151-159` — `gh release create` uploads only `.dmg`, `.exe`, `.AppImage`, not the `.yml` metadata files.

[^6]: `electron-updater` must be in `dependencies` (not `devDependencies`) because it is required at runtime inside the packaged app's main process. `devDependencies` are pruned by `electron-builder` during packaging. See: https://www.electron.build/tutorials/two-package-structure

[^7]: `electron-updater` API — `autoUpdater.checkForUpdatesAndNotify()` method; event names `update-available`, `update-downloaded`, `error`. See: https://www.electron.build/auto-update#AppUpdater-Events
