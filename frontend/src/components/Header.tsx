import { ConnectButton } from "@phantom/react-sdk";
import { formatSol } from "../lib/api";
import { shortenAddress } from "../lib/utils";
import { OnChainBadge } from "./OnChainBadge";
import { ProfileAvatar } from "./ProfileAvatar";

interface HeaderProps {
  balanceSol?: number;
  connected: boolean;
  walletAddress?: string;
  displayName?: string;
  onChainEnabled?: boolean;
  onSignOut?: () => void;
  onProfileClick?: () => void;
}

export function Header({
  balanceSol,
  connected,
  walletAddress,
  displayName,
  onChainEnabled,
  onSignOut,
  onProfileClick,
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
          {connected && walletAddress && displayName && (
            <button
              type="button"
              className="profile-chip"
              onClick={onProfileClick}
            >
              <ProfileAvatar
                seed={walletAddress}
                name={displayName}
                size="sm"
              />
              <span className="profile-chip-name">{displayName}</span>
              <span className="profile-chip-wallet">
                {shortenAddress(walletAddress)}
              </span>
            </button>
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
