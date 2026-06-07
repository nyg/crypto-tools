/// <reference types="bun-types" />
import { ApplicationMenu, BrowserWindow, Utils, app } from "electrobun/bun";
import { createApp } from "../server/app.js";

const PORT = 3001;
const DEV_SERVER_URL = "http://localhost:3000";
const VIEWS_URL = "views://main/index.html";

async function resolveUrl(): Promise<string> {
  if (app.channel !== "dev") {
    return VIEWS_URL;
  }
  try {
    await fetch(`${DEV_SERVER_URL}/`, { signal: AbortSignal.timeout(1000) });
    return DEV_SERVER_URL;
  } catch {
    return VIEWS_URL;
  }
}

async function main() {
  const url = await resolveUrl();

  const honoApp = createApp();

  Bun.serve({
    port: PORT,
    hostname: "127.0.0.1",
    fetch: honoApp.fetch,
    idleTimeout: 0,
  });

  console.log(`✓ API server listening on http://127.0.0.1:${PORT}`);

  const win = new BrowserWindow({ title: "CryptoTools", url, frame: { x: 0, y: 0, width: 1280, height: 900 } });

  // Open target="_blank" links in the default system browser instead of the WebView.
  (win.webview as any).on("new-window-open", (event: any) => {
    const detail = event?.data?.detail;
    const href: string | undefined = typeof detail === "string" ? detail : detail?.url;
    if (href) {
      Utils.openExternal(href);
    }
  });

  ApplicationMenu.setApplicationMenu([
    {
      label: "CryptoTools",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "showAll" },
        { type: "separator" },
        { role: "quit", accelerator: "CommandOrControl+Q" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "close", accelerator: "CommandOrControl+W" },
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "bringAllToFront" },
      ],
    },
  ]);
}

main();
