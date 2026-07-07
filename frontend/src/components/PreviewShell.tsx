import type { ReactNode } from "react";
import { AnimatedBackground } from "./AnimatedBackground";
import { Logo } from "./Logo";
import { OnChainBadge } from "./OnChainBadge";
import { SiteFooter } from "./SiteFooter";

interface PreviewShellProps {
  children: ReactNode;
  onChain?: boolean;
  balanceSol?: string;
  headerRight?: ReactNode;
}

export function PreviewShell({
  children,
  onChain,
  balanceSol,
  headerRight,
}: PreviewShellProps) {
  return (
    <div className="app">
      <AnimatedBackground />
      <header className="header">
        <div className="container header-inner">
          <div className="preview-header-brand">
            <Logo />
            {onChain && <OnChainBadge enabled />}
          </div>
          <div className="header-right">
            {headerRight}
            {balanceSol && (
              <div className="balance-pill">
                <span className="balance-label">Balance</span>
                <span className="balance-value">{balanceSol}</span>
              </div>
            )}
          </div>
        </div>
      </header>
      {children}
      <SiteFooter />
    </div>
  );
}
