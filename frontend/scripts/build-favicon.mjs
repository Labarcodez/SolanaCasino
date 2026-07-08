import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const pngPath = path.join(publicDir, "solana-token.png");
const outPath = path.join(publicDir, "favicon.svg");

const TOKEN_SIZE = 14;
const TOKEN_CLIP_R = TOKEN_SIZE / 2 - 0.5;
const TOKEN_OFFSET = TOKEN_SIZE / 2;

const b64 = fs.readFileSync(pngPath).toString("base64");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="g" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
      <stop stop-color="#b794f6"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
    <radialGradient id="core" cx="32" cy="32" r="14" gradientUnits="userSpaceOnUse">
      <stop stop-color="#b794f6" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="solClip">
      <circle cx="0" cy="0" r="${TOKEN_CLIP_R}"/>
    </clipPath>
  </defs>
  <rect width="64" height="64" rx="16" fill="#06070b"/>
  <circle cx="32" cy="32" r="24" fill="url(#core)"/>
  <circle cx="32" cy="32" r="18" stroke="url(#g)" stroke-width="1.5" opacity="0.45"/>
  <circle cx="32" cy="32" r="8" fill="url(#g)" opacity="0.9"/>
  <circle cx="32" cy="32" r="3.5" fill="#00ffa3"/>
  <g>
    <animateTransform
      attributeName="transform"
      type="rotate"
      from="0 32 32"
      to="360 32 32"
      dur="8s"
      repeatCount="indefinite"
    />
    <g transform="translate(50 32)" clip-path="url(#solClip)">
      <image
        href="data:image/png;base64,${b64}"
        x="${-TOKEN_OFFSET}"
        y="${-TOKEN_OFFSET}"
        width="${TOKEN_SIZE}"
        height="${TOKEN_SIZE}"
        preserveAspectRatio="xMidYMid slice"
      />
    </g>
  </g>
</svg>
`;

fs.writeFileSync(outPath, svg);
console.log(`Wrote ${outPath} (${svg.length} bytes)`);
