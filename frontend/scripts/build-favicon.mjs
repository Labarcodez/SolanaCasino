import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { orbitHubFaviconMarkup } from "./orbitHubMarkup.mjs";
import { hubGradDefsMarkup, orbitGradDefMarkup } from "./solanaLogoShared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const pngPath = path.join(publicDir, "solana-token.png");
const outPath = path.join(publicDir, "favicon.svg");

const ORBIT_RADIUS = 22;
const TOKEN_SIZE = 11;
const TOKEN_CONTAINER_R = 7.5;
const TOKEN_CLIP_R = TOKEN_SIZE / 2 - 0.5;
const TOKEN_OFFSET = TOKEN_SIZE / 2;

const b64 = fs.readFileSync(pngPath).toString("base64");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    ${hubGradDefsMarkup("hubGrad", "hubGradBlend")}
    ${orbitGradDefMarkup("orbitGrad")}
    <clipPath id="solClip">
      <circle cx="0" cy="0" r="${TOKEN_CLIP_R}"/>
    </clipPath>
  </defs>
  <rect width="64" height="64" rx="16" fill="#06070b"/>
  <circle cx="32" cy="32" r="${ORBIT_RADIUS}" stroke="url(#orbitGrad)" stroke-width="1.35"/>
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
      <g transform="translate(${ORBIT_RADIUS} 0)">
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to="-360"
            dur="8s"
            repeatCount="indefinite"
          />
          <circle r="${TOKEN_CONTAINER_R}" fill="#06070b" stroke="#03E1FF" stroke-width="0.85"/>
          <g clip-path="url(#solClip)">
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
    </g>
  </g>
</svg>
`;

fs.writeFileSync(outPath, svg);
console.log(`Wrote ${outPath} (${svg.length} bytes)`);
