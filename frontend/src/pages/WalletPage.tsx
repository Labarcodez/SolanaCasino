import { PageHeader } from "../components/PageHeader";
import { WalletPanel } from "../components/WalletPanel";
import { BetHistoryPanel } from "../components/BetHistoryPanel";

interface WalletPageProps {
  walletAddress: string;
  balanceSol: number;
  onChainBalanceSol: number;
  minBetSol: number;
  minWithdrawSol: number;
  withdrawalsEnabled: boolean;
  onChainEnabled: boolean;
  loading: boolean;
  error: string | null;
  onDeposit: (amount: number) => Promise<{ amountSol: number; signature?: string }>;
  onWithdraw: (amount: number) => Promise<{
    signature?: string;
    queued?: boolean;
    message?: string;
    balanceSol?: number;
  }>;
  onBalanceUpdate: (balance: number) => void;
}

export function WalletPage({
  walletAddress,
  balanceSol,
  onChainBalanceSol,
  minBetSol,
  minWithdrawSol,
  withdrawalsEnabled,
  onChainEnabled,
  loading,
  error,
  onDeposit,
  onWithdraw,
  onBalanceUpdate,
}: WalletPageProps) {
  return (
    <div className="container wallet-page">
      <PageHeader
        title="Wallet"
        subtitle="Deposit SOL to play, withdraw winnings anytime. Balances update after each game."
      />
      <WalletPanel
        balanceSol={balanceSol}
        onChainBalanceSol={onChainBalanceSol}
        minBetSol={minBetSol}
        minWithdrawSol={minWithdrawSol}
        withdrawalsEnabled={withdrawalsEnabled}
        onChainEnabled={onChainEnabled}
        loading={loading}
        onDeposit={onDeposit}
        onWithdraw={async (amount) => {
          const result = await onWithdraw(amount);
          if (result.balanceSol !== undefined) {
            onBalanceUpdate(result.balanceSol);
          }
          return result;
        }}
        error={error}
      />
      <BetHistoryPanel walletAddress={walletAddress} />
    </div>
  );
}
