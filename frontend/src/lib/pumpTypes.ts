/** Lightweight Pump.fun types — no SDK imports (safe for /token coming-soon). */

export interface PumpBondingCurveStats {
  progressPercent: number;
  marketCapSol: number;
  realSolReserves: number;
  isGraduated: boolean;
  exists: boolean;
}

export interface PumpTokenMetadata {
  name?: string;
  symbol?: string;
  image?: string;
  description?: string;
}

export interface CreatePumpTokenParams {
  name: string;
  symbol: string;
  uri: string;
  creator: string;
}
