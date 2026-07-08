import { ConnectButton } from "@phantom/react-sdk";
import { formatSol } from "../lib/api";
import { shortenAddress } from "../lib/utils";
import { OnChainBadge } from "./OnChainBadge";
import { ProfileAvatar } from "./ProfileAvatar";
import { Logo } from "./Logo";

interface HeaderProps {
  balanceSol?: number;
  connected: boolean;
  walletAddress?: string;
  displayName?: string;
  onChainEnabled?: boolean;
  onSignOut?: () => void;
  onProfileClick?: () => void;
  onWalletClick?: () => void;
}

export function Header({
  balanceSol,
  connected,
  walletAddress,
  displayName,
  onChainEnabled,
  onSignOut,
  onProfileClick,
  onWalletClick,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="container header-inner">
        <Logo size="md" />

        <div className="header-right">
          {onChainEnabled && <OnChainBadge enabled />}
          {connected && balanceSol !== undefined && (
            <button
              type="button"
              className="balance-pill balance-pill-btn"
              onClick={onWalletClick}
              title="Open wallet"
            >
              <span className="balance-label">Balance</span>
              <span className="balance-value">{formatSol(balanceSol)} SOL</span>
            </button>
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
