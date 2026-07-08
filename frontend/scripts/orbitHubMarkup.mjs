export const HUB_R = 15;
export const O_RING_R = 5.5;
export const O_RING_STROKE = 2.6;
export const O_INNER_R = O_RING_R - O_RING_STROKE / 2;
export const HUB_BLEND_OPACITY = 0.52;

function hubFillMarkup(r) {
  return `<circle r="${r}" fill="url(#hubGrad)"/>
    <circle r="${r}" fill="url(#hubGradBlend)" opacity="${HUB_BLEND_OPACITY}"/>`;
}

export function orbitHubFaviconMarkup() {
  return `
  <g transform="translate(32 32)">
    ${hubFillMarkup(HUB_R)}
    ${hubFillMarkup(O_INNER_R)}
    <circle r="${O_RING_R}" fill="none" stroke="#ffffff" stroke-width="${O_RING_STROKE}"/>
  </g>`;
}
