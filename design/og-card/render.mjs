// Renders card.html to the site's link-preview image (1200×630 JPEG).
//
//   node design/og-card/render.mjs [output-path]
//
// Default output is public/og-image.jpg. Zero dependencies: drives a local
// headless Chrome over the DevTools Protocol with Node 22's built-in WebSocket.
// Set CHROME_PATH if Chrome isn't in the default location.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(here, "../../public/og-image.jpg"));
const WIDTH = 1200;
const HEIGHT = 630;

const chromePath =
  process.env.CHROME_PATH ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find(existsSync);
if (!chromePath) throw new Error("Chrome not found — set CHROME_PATH");

const profileDir = mkdtempSync(join(tmpdir(), "og-card-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  // Port 0 = let Chrome pick a free one, so we can never attach to (and
  // later Browser.close) some other Chrome that's already debugging on a
  // fixed port. The chosen port is read back from DevToolsActivePort.
  "--remote-debugging-port=0",
  `--user-data-dir=${profileDir}`,
  // card.html loads the font and portrait over file://
  "--allow-file-access-from-files",
  "--hide-scrollbars",
  "--no-first-run",
  "about:blank",
]);

try {
  const target = await pageTarget(await devtoolsPort());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });

  let seq = 0;
  const pending = new Map();
  const waiters = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method && waiters.has(msg.method)) {
      waiters.get(msg.method)();
      waiters.delete(msg.method);
    }
  };
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      const id = ++seq;
      pending.set(id, { ok, fail });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const once = (method) => new Promise((ok) => waiters.set(method, ok));

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
  });
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: pathToFileURL(join(here, "card.html")).href });
  await loaded;

  // Don't capture until Inter and the portrait are actually in — a silent
  // fallback font would otherwise ship without anyone noticing.
  const { result } = await send("Runtime.evaluate", {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      await document.fonts.ready;
      const img = document.querySelector("img");
      if (!img.complete) await new Promise((r) => (img.onload = r));
      return { inter: document.fonts.check('760 78px "Inter"'), img: img.naturalWidth };
    })()`,
  });
  if (!result.value.inter) throw new Error("Inter did not load");
  if (!result.value.img) throw new Error("portrait did not load");

  const shot = await send("Page.captureScreenshot", {
    format: "jpeg",
    quality: 88,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
  });
  const bytes = Buffer.from(shot.data, "base64");
  writeFileSync(out, bytes);
  console.log(`wrote ${out} (${Math.round(bytes.length / 1024)} KB)`);

  await send("Browser.close").catch(() => {});
  ws.close();
} finally {
  chrome.kill();
  await new Promise((r) => setTimeout(r, 300));
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5 });
}

// Chrome writes "<port>\n<browser ws path>" into this file in its own
// (fresh, per-run) profile once the debugging server is listening.
async function devtoolsPort() {
  const file = join(profileDir, "DevToolsActivePort");
  for (let i = 0; i < 100; i++) {
    try {
      const port = Number(readFileSync(file, "utf8").split("\n")[0]);
      if (port > 0) return port;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Chrome never reported its DevTools port");
}

async function pageTarget(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Chrome DevTools endpoint never came up");
}
