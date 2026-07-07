export function OnChainBadge({ enabled }: { enabled?: boolean }) {
  if (!enabled) return null;
  return (
    <span className="on-chain-badge" title="Balances and bets settle on-chain via Anchor program">
      <span className="on-chain-dot" />
      On-Chain
    </span>
  );
}
