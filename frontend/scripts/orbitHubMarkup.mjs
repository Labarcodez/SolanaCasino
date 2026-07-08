const CHIP_R = 10;
const CHIP_TICK_INNER = 8.2;
const CHIP_TICK_OUTER = 10;
const TICK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function orbitHubFaviconMarkup() {
  const ticks = TICK_ANGLES.map(
    (angle) => `
      <g transform="rotate(${angle})">
        <line x1="0" y1="${-CHIP_TICK_INNER}" x2="0" y2="${-CHIP_TICK_OUTER}" stroke="#14F195" stroke-width="1.15" stroke-linecap="round" opacity="0.9"/>
      </g>`,
  ).join("");

  return `
  <g transform="translate(32 32)">
    <circle r="${CHIP_R}" fill="url(#chipGrad)" stroke="#03E1FF" stroke-width="0.9"/>
    <circle r="6.8" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="0.75"/>
    <g>${ticks}</g>
    <text y="0.5" text-anchor="middle" dominant-baseline="middle" fill="#f6f8ff" font-size="9" font-weight="800" font-family="Outfit, sans-serif">O</text>
  </g>`;
}
