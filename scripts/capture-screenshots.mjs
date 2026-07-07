import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = "/opt/cursor/artifacts/screenshots";
const BASE = process.env.SCREENSHOT_URL ?? "http://localhost:5173";

const shots = [
  { name: "01-landing-desktop", url: BASE, width: 1440, height: 900, fullPage: true },
  { name: "02-landing-mobile", url: BASE, width: 390, height: 844, fullPage: true },
  { name: "03-crash-game", url: `${BASE}/preview`, width: 1440, height: 900, fullPage: true },
  { name: "04-coinflip-game", url: `${BASE}/preview-coinflip`, width: 1440, height: 900, fullPage: true },
  { name: "05-crash-mobile", url: `${BASE}/preview`, width: 390, height: 844, fullPage: true },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
  });

  await page.goto(shot.url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);

  const file = path.join(OUT, `${shot.name}.png`);
  await page.screenshot({
    path: file,
    fullPage: shot.fullPage,
    type: "png",
  });
  console.log(`Saved ${file}`);
  await page.close();
}

// Production build served from backend
const prodUrl = "http://localhost:3001";
try {
  const res = await fetch(`${prodUrl}/api/health`);
  if (res.ok) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    await page.goto(prodUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    const file = path.join(OUT, "05-production-landing.png");
    await page.screenshot({ path: file, fullPage: true, type: "png" });
    console.log(`Saved ${file}`);
    await page.close();
  }
} catch {
  console.log("Production server not available, skipping prod screenshot");
}

await browser.close();
console.log("Done.");
