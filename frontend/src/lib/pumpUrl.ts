/** Pump.fun URL helpers — no SDK imports (safe for /token coming-soon). */

export const PUMP_PROGRAM_ID =
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

export function getPumpFunUrl(mint: string): string {
  return `https://pump.fun/coin/${mint}`;
}
