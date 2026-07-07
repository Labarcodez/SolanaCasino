import { ChatPanel } from "./ChatPanel";
import { CrashGame } from "./CrashGame";
import { LiveBetsPanel } from "./LiveBetsPanel";
import { useSocket } from "../hooks/useSocket";

interface CrashArenaProps {
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  onChainEnabled?: boolean;
  onBalanceUpdate: (balance: number) => void;
}

export function CrashArena({
  balanceSol,
  minBetSol,
  maxBetSol,
  onChainEnabled,
  onBalanceUpdate,
}: CrashArenaProps) {
  const { crashState } = useSocket();

  return (
    <div className="crash-arena">
      <div className="crash-arena-chat">
        <ChatPanel />
      </div>

      <div className="crash-arena-main">
        <CrashGame
          balanceSol={balanceSol}
          minBetSol={minBetSol}
          maxBetSol={maxBetSol}
          onBalanceUpdate={onBalanceUpdate}
        />
      </div>

      <div className="crash-arena-bets">
        <LiveBetsPanel
          bets={crashState?.bets ?? []}
          phase={crashState?.phase ?? "betting"}
          onChainEnabled={onChainEnabled}
        />
      </div>
    </div>
  );
}
