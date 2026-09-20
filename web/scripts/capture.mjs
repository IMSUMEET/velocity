import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA = path.resolve(__dirname, "../../docs/media");
const BASE = "http://127.0.0.1:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2];

async function screenshots(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();

  await p.goto(BASE);
  await p.getByText("Verdict").first().waitFor({ timeout: 15000 });
  await sleep(2500);
  await p.screenshot({ path: `${MEDIA}/shot_lab.png`, fullPage: true });

  await p.goto(`${BASE}/operations`);
  await sleep(4500);
  await p.screenshot({ path: `${MEDIA}/shot_operations.png`, fullPage: true });

  await p.goto(`${BASE}/fleet`);
  await sleep(3500);
  await p.screenshot({ path: `${MEDIA}/shot_fleet.png`, fullPage: true });

  await p.goto(`${BASE}/method`);
  await sleep(1500);
  await p.screenshot({ path: `${MEDIA}/shot_method.png`, fullPage: true });

  await ctx.close();
  console.log("screenshots done");
}

async function walkthrough(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${MEDIA}/video`, size: { width: 1280, height: 800 } },
  });
  const p = await ctx.newPage();

  // Lab
  await p.goto(BASE);
  await p.getByText("Verdict").first().waitFor({ timeout: 15000 });
  await sleep(2000);
  await p.getByRole("button", { name: /Run benchmark/ }).click();
  await sleep(2500);
  for (let i = 0; i < 9; i++) { await p.mouse.wheel(0, 90); await sleep(70); }
  await sleep(2500);
  await p.mouse.wheel(0, -900);
  await sleep(800);

  // Operations
  await p.getByRole("link", { name: "Operations" }).click();
  await sleep(4000);
  await p.getByRole("button", { name: "Batch Optimal" }).click();
  await sleep(4000);
  await p.getByRole("button", { name: "2×" }).click();
  await sleep(4000);

  // Fleet
  await p.getByRole("link", { name: "Fleet & Orders" }).click();
  await sleep(2500);
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 90); await sleep(80); }
  await sleep(1500);

  await ctx.close();
  console.log("walkthrough done");
}

const browser = await chromium.launch();
if (only !== "video") await screenshots(browser);
if (only !== "shots") await walkthrough(browser);
await browser.close();
console.log("ALL CAPTURE DONE");
