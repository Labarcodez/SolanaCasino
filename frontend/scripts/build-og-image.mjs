import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const svgPath = path.join(publicDir, "og-image.svg");
const pngPath = path.join(publicDir, "og-image.png");

const svg = fs.readFileSync(svgPath, "utf8");
const fixed = svg.replace(
  /Crash.*?Provably Fair/,
  "Crash · Limbo · Coinflip · Provably Fair",
);
if (fixed !== svg) {
  fs.writeFileSync(svgPath, fixed);
}

try {
  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(fixed, {
    fitTo: { mode: "width", value: 1200 },
  });
  const pngData = resvg.render();
  fs.writeFileSync(pngPath, pngData.asPng());
  console.log(`Wrote ${pngPath} (${pngData.asPng().length} bytes)`);
} catch (err) {
  console.warn(
    "og-image.png not generated — run npm install in frontend for @resvg/resvg-js",
  );
  console.warn(err instanceof Error ? err.message : err);
}
