import { ConnectButton } from "@phantom/react-sdk";
import { formatSol } from "../lib/api";

interface HeaderProps {
  balanceSol?: number;
  connected: boolean;
}

export function Header({ balanceSol, connected }: HeaderProps) {
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="logo">
          <div className="logo-icon">🎰</div>
          SolCasino
        </div>

        <div className="header-right">
          {connected && balanceSol !== undefined && (
            <div className="balance-pill">
              <span className="sol-icon">◎</span>
              <span>{formatSol(balanceSol)} SOL</span>
            </div>
          )}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
