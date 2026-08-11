import { execFileSync } from "child_process";

// Set VITE_API_BASE so the bundled SPA fetches against the local Hono server
// rather than resolving /api/* relative to views:// (which has no proxy).
process.env.VITE_API_BASE = "http://127.0.0.1:3001";

// Compile the Vite SPA to dist/ so ElectroBun can copy it into the app bundle.
execFileSync("bun", ["run", "build"], { stdio: "inherit", env: process.env });
