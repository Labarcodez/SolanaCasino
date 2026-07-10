import { PageHeader } from "../components/PageHeader";
import { WalletPanel } from "../components/WalletPanel";
import { BetHistoryPanel } from "../components/BetHistoryPanel";
import type { PendingWalletTx, WalletActionPhase } from "../hooks/useCasinoUser";

interface WalletPageProps {
  walletAddress: string;
  balanceSol: number;
  onChainBalanceSol: number;
  minBetSol: number;
  minWithdrawSol: number;
  withdrawalsEnabled: boolean;
  onChainEnabled: boolean;
  loading: boolean;
  walletActionPhase?: WalletActionPhase;
  pendingWalletTx?: PendingWalletTx | null;
  rpcProvider?: "alchemy" | "helius" | "custom" | "public";
  alchemyConfigured?: boolean;
  cluster?: string;
  error: string | null;
  onDeposit: (amount: number) => Promise<{
    amountSol: number;
    signature?: string;
    balanceSol?: number;
  }>;
  onWithdraw: (amount: number) => Promise<{
    signature?: string;
    queued?: boolean;
    message?: string;
    balanceSol?: number;
  }>;
  onBalanceUpdate: (balance: number) => void;
  onRecoverPendingDeposit: () => Promise<boolean>;
  onCreditDeposit: (signature: string) => Promise<{ balanceSol: number; signature: string }>;
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
  walletActionPhase,
  pendingWalletTx,
  error,
  rpcProvider,
  alchemyConfigured,
  cluster,
  onDeposit,
  onWithdraw,
  onBalanceUpdate,
  onRecoverPendingDeposit,
  onCreditDeposit,
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
        walletActionPhase={walletActionPhase}
        pendingWalletTx={pendingWalletTx}
        rpcProvider={rpcProvider}
        alchemyConfigured={alchemyConfigured}
        cluster={cluster}
        onDeposit={async (amount) => {
          const result = await onDeposit(amount);
          if ("balanceSol" in result && result.balanceSol !== undefined) {
            onBalanceUpdate(result.balanceSol);
          }
          return result;
        }}
        onWithdraw={async (amount) => {
          const result = await onWithdraw(amount);
          if (result.balanceSol !== undefined) {
            onBalanceUpdate(result.balanceSol);
          }
          return result;
        }}
        error={error}
        onRecoverPendingDeposit={onRecoverPendingDeposit}
        onCreditDeposit={async (signature) => {
          const result = await onCreditDeposit(signature);
          onBalanceUpdate(result.balanceSol);
          return result;
        }}
      />
      <BetHistoryPanel walletAddress={walletAddress} />
    </div>
  );
}
