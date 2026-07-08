export const SOLANA_GREEN = "#14F195";
export const SOLANA_CYAN = "#03E1FF";
export const SOLANA_PURPLE = "#9945FF";

/** Interleaved stops so all three Solana colors blend instead of banding. */
export const SOLANA_MIX_STOPS = [
  { offset: 0, color: SOLANA_GREEN },
  { offset: 0.12, color: SOLANA_CYAN },
  { offset: 0.24, color: SOLANA_PURPLE },
  { offset: 0.36, color: SOLANA_CYAN },
  { offset: 0.48, color: SOLANA_GREEN },
  { offset: 0.6, color: SOLANA_PURPLE },
  { offset: 0.72, color: SOLANA_CYAN },
  { offset: 0.84, color: SOLANA_GREEN },
  { offset: 1, color: SOLANA_PURPLE },
];

function stopsMarkup(stops) {
  return stops
    .map((stop) =>
      stop.offset === undefined
        ? `<stop stop-color="${stop.color}"/>`
        : `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`,
    )
    .join("\n      ");
}

export function linearGradDef(id, { x1, y1, x2, y2, rotate = 0, stops = SOLANA_MIX_STOPS } = {}) {
  const transform = rotate ? ` gradientTransform="rotate(${rotate} 32 32)"` : "";
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse"${transform}>
      ${stopsMarkup(stops)}
    </linearGradient>`;
}

export function hubGradDefsMarkup(primaryId = "hubGrad", blendId = "hubGradBlend") {
  return `${linearGradDef(primaryId, { x1: 32, y1: 10, x2: 32, y2: 54, rotate: 38 })}
    ${linearGradDef(blendId, { x1: 10, y1: 32, x2: 54, y2: 32, rotate: -42 })}`;
}

export function orbitGradDefMarkup(id = "orbitGrad") {
  return linearGradDef(id, { x1: 12, y1: 12, x2: 52, y2: 52, rotate: 18 });
}
