import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { orbitHubFaviconMarkup } from "./orbitHubMarkup.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const pngPath = path.join(publicDir, "solana-token.png");
const outPath = path.join(publicDir, "favicon.svg");

const ORBIT_RADIUS = 18;
const TOKEN_SIZE = 14;
const TOKEN_CLIP_R = TOKEN_SIZE / 2 - 0.5;
const TOKEN_OFFSET = TOKEN_SIZE / 2;

const b64 = fs.readFileSync(pngPath).toString("base64");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="g" x1="14" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
      <stop stop-color="#14F195"/>
      <stop offset="0.55" stop-color="#03E1FF"/>
      <stop offset="1" stop-color="#9945FF"/>
    </linearGradient>
    <linearGradient id="chipGrad" x1="22" y1="22" x2="42" y2="42" gradientUnits="userSpaceOnUse">
      <stop stop-color="#14F195"/>
      <stop offset="0.45" stop-color="#03E1FF"/>
      <stop offset="1" stop-color="#9945FF"/>
    </linearGradient>
    <radialGradient id="core" cx="32" cy="32" r="14" gradientUnits="userSpaceOnUse">
      <stop stop-color="#03E1FF" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#9945FF" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="solClip">
      <circle cx="0" cy="0" r="${TOKEN_CLIP_R}"/>
    </clipPath>
  </defs>
  <rect width="64" height="64" rx="16" fill="#06070b"/>
  <circle cx="32" cy="32" r="24" fill="url(#core)"/>
  <circle cx="32" cy="32" r="${ORBIT_RADIUS}" stroke="url(#g)" stroke-width="1.5" opacity="0.45"/>
  ${orbitHubFaviconMarkup()}
  <g transform="translate(32 32)">
    <g>
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0"
        to="360"
        dur="8s"
        repeatCount="indefinite"
      />
      <g transform="translate(${ORBIT_RADIUS} 0) rotate(90)" clip-path="url(#solClip)">
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
  </g>
</svg>
`;

fs.writeFileSync(outPath, svg);
console.log(`Wrote ${outPath} (${svg.length} bytes)`);
