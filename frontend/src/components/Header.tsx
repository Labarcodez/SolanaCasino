import { ConnectButton } from "@phantom/react-sdk";
import { formatSol } from "../lib/api";
import { shortenAddress } from "../lib/utils";
import { OnChainBadge } from "./OnChainBadge";

interface HeaderProps {
  balanceSol?: number;
  connected: boolean;
  walletAddress?: string;
  onChainEnabled?: boolean;
  onSignOut?: () => void;
}

export function Header({
  balanceSol,
  connected,
  walletAddress,
  onChainEnabled,
  onSignOut,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="logo">
          <div className="logo-icon">◎</div>
          <span>SolCasino</span>
          {onChainEnabled && <OnChainBadge enabled />}
        </div>

        <div className="header-right">
          {connected && balanceSol !== undefined && (
            <div className="balance-pill">
              <span className="balance-label">Balance</span>
              <span className="balance-value">{formatSol(balanceSol)} SOL</span>
            </div>
          )}
          {connected && walletAddress && (
            <span className="wallet-chip">{shortenAddress(walletAddress)}</span>
          )}
          {connected && onSignOut && (
            <button className="btn-ghost" onClick={onSignOut} type="button">
              Sign out
            </button>
          )}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
