import { ChatPanel } from "./ChatPanel";
import { CrashGame } from "./CrashGame";
import { LiveBetsPanel } from "./LiveBetsPanel";
import { useSocket } from "../hooks/useSocket";
import { useState } from "react";

interface CrashArenaProps {
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
  onChainEnabled?: boolean;
  onBalanceUpdate: (balance: number) => void;
  spectator?: boolean;
}

export function CrashArena({
  balanceSol,
  minBetSol,
  maxBetSol,
  onBalanceUpdate,
  spectator = false,
}: CrashArenaProps) {
  const { crashState } = useSocket();
  const [focusMode, setFocusMode] = useState(false);

  return (
    <div
      className={`crash-arena ${focusMode ? "crash-arena--focus" : ""} ${spectator ? "crash-arena--spectator" : ""}`.trim()}
    >
      <div className="crash-arena-chat">
        <ChatPanel spectator={spectator} />
      </div>

      <div className="crash-arena-main">
        <CrashGame
          balanceSol={balanceSol}
          minBetSol={minBetSol}
          maxBetSol={maxBetSol}
          onBalanceUpdate={onBalanceUpdate}
          spectator={spectator}
          focusMode={focusMode}
          onFocusModeChange={setFocusMode}
        />
      </div>

      <div className="crash-arena-bets">
        <LiveBetsPanel
          bets={crashState?.bets ?? []}
          phase={crashState?.phase ?? "betting"}
        />
      </div>
    </div>
  );
}
