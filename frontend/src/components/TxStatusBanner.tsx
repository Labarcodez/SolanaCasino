import type { WalletActionPhase } from "../hooks/useCasinoUser";
import { solscanTxUrl } from "../lib/utils";

export type TxFlow = "deposit" | "withdraw" | "idle";

interface TxStatusBannerProps {
  phase: WalletActionPhase;
  flow: TxFlow;
  signature?: string | null;
  amountSol?: number | null;
}

const PHASE_COPY: Record<
  WalletActionPhase,
  Record<Exclude<TxFlow, "idle">, string>
> = {
  idle: {
    deposit: "",
    withdraw: "",
  },
  signing: {
    deposit: "Approve the deposit in your wallet…",
    withdraw: "Approve the withdrawal in your wallet…",
  },
  confirming: {
    deposit: "Confirming on Solana — balance updates when finalized",
    withdraw: "Sending SOL — balance updates when confirmed",
  },
};

export function TxStatusBanner({
  phase,
  flow,
  signature,
  amountSol,
}: TxStatusBannerProps) {
  if (phase === "idle" || flow === "idle") return null;

  const message = PHASE_COPY[phase][flow];
  const step =
    phase === "signing" ? 1 : phase === "confirming" ? 2 : 0;

  return (
    <div
      className={`tx-status-banner tx-status-banner--${phase}`}
      role="status"
      aria-live="polite"
      data-testid="tx-status-banner"
    >
      <div className="tx-status-banner-track" aria-hidden="true">
        <span className={step >= 1 ? "active" : ""}>Wallet</span>
        <span className={step >= 2 ? "active" : ""}>Confirming</span>
        <span>Done</span>
      </div>
      <p className="tx-status-banner-message">{message}</p>
      {amountSol != null && amountSol > 0 && (
        <p className="tx-status-banner-amount">
          {flow === "deposit" ? "Depositing" : "Withdrawing"}{" "}
          {amountSol.toFixed(4)} SOL
        </p>
      )}
      {signature && phase === "confirming" && (
        <a
          className="tx-status-banner-link"
          href={solscanTxUrl(signature)}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Solscan
        </a>
      )}
    </div>
  );
}
