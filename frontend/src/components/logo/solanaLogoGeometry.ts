export const SOLANA_GREEN = "#14F195";
export const SOLANA_CYAN = "#03E1FF";
export const SOLANA_PURPLE = "#9945FF";

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
] as const;

export const HUB_BLEND_OPACITY = 0.52;
