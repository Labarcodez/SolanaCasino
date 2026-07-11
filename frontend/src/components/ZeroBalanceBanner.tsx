import { formatSol } from "../lib/api";

interface ZeroBalanceBannerProps {
  balanceSol: number;
  minBetSol: number;
  onGoToWallet: () => void;
}

export function ZeroBalanceBanner({
  balanceSol,
  minBetSol,
  onGoToWallet,
}: ZeroBalanceBannerProps) {
  if (balanceSol >= minBetSol) return null;

  return (
    <div className="zero-balance-banner" data-testid="zero-balance-banner">
      <p>
        Casino balance is {formatSol(balanceSol)} SOL — deposit at least{" "}
        {formatSol(minBetSol)} SOL to place bets.
      </p>
      <button
        type="button"
        className="btn btn-success btn-sm"
        onClick={onGoToWallet}
      >
        Deposit SOL
      </button>
    </div>
  );
}
