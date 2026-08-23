import { spawnSync } from "node:child_process";

// Compile the Vite SPA to dist/ so ElectroBun can copy it into the app bundle.
const { status, error } = spawnSync("bunx", ["vite", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (error) {
  console.error("prebuild: could not run `bunx vite build`:", error.message);
  process.exit(1);
}

if (status !== 0) {
  process.exit(status ?? 1);
}
