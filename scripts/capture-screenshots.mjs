import { chromium } from "playwright";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = process.env.SCREENSHOT_OUT ?? path.join(process.cwd(), "screenshots");
const ARTIFACTS_OUT = "/opt/cursor/artifacts/screenshots";
const BASE = process.env.SCREENSHOT_URL ?? "http://localhost:5173";

const shots = [
  { name: "01-landing-desktop", url: `${BASE}/preview-landing`, width: 1440, height: 900, fullPage: true },
  { name: "02-landing-mobile", url: `${BASE}/preview-landing`, width: 390, height: 844, fullPage: true },
  { name: "03-auth-screen", url: `${BASE}/preview-auth`, width: 1440, height: 900, fullPage: true },
  { name: "04-crash-arena-desktop", url: `${BASE}/preview`, width: 1440, height: 900, fullPage: true },
  { name: "05-crash-arena-mobile", url: `${BASE}/preview`, width: 390, height: 844, fullPage: true },
  { name: "06-coinflip-desktop", url: `${BASE}/preview-coinflip`, width: 1440, height: 900, fullPage: true },
  { name: "07-coinflip-mobile", url: `${BASE}/preview-coinflip`, width: 390, height: 844, fullPage: true },
  { name: "08-profile-desktop", url: `${BASE}/preview-profile`, width: 1440, height: 900, fullPage: true },
  { name: "09-profile-mobile", url: `${BASE}/preview-profile`, width: 390, height: 844, fullPage: true },
  { name: "10-leaderboard-desktop", url: `${BASE}/preview-leaderboard`, width: 1440, height: 900, fullPage: true },
  { name: "11-fairness-desktop", url: `${BASE}/preview-fairness`, width: 1440, height: 900, fullPage: true },
  { name: "12-crash-arena-wide", url: `${BASE}/preview`, width: 1920, height: 1080, fullPage: false },
  { name: "13-limbo-desktop", url: `${BASE}/preview-limbo`, width: 1440, height: 900, fullPage: true },
  { name: "14-limbo-mobile", url: `${BASE}/preview-limbo`, width: 390, height: 844, fullPage: true },
  { name: "15-tournament-desktop", url: `${BASE}/preview-tournament`, width: 1440, height: 900, fullPage: true },
  { name: "16-admin-desktop", url: `${BASE}/preview-admin`, width: 1440, height: 900, fullPage: true },
];

await mkdir(OUT, { recursive: true });
await mkdir(ARTIFACTS_OUT, { recursive: true });

async function saveScreenshot(page, shot, fileName) {
  const repoFile = path.join(OUT, `${fileName}.png`);
  await page.screenshot({
    path: repoFile,
    fullPage: shot.fullPage ?? true,
    type: "png",
  });
  await copyFile(repoFile, path.join(ARTIFACTS_OUT, `${fileName}.png`));
  console.log(`Saved ${repoFile}`);
}

const browser = await chromium.launch({ headless: true });

for (const shot of shots) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
  });

  await page.goto(shot.url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);

  const file = path.join(OUT, `${shot.name}.png`);
  await saveScreenshot(page, shot, shot.name);
  await page.close();
}

const prodUrl = "http://localhost:3001";
try {
  const res = await fetch(`${prodUrl}/api/health`);
  if (res.ok) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    await page.goto(`${prodUrl}/`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    await saveScreenshot(page, { fullPage: true }, "17-production-landing");
    await page.close();
  }
} catch {
  console.log("Production server not available, skipping prod screenshot");
}

await browser.close();
console.log(`Done. Screenshots in ${OUT} and ${ARTIFACTS_OUT}`);
