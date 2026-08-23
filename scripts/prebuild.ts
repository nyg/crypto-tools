/// <reference types="bun-types" />
import { $ } from "bun";

// Compile the Vite SPA to dist/ so ElectroBun can copy it into the app bundle.
await $`bun run build`;
