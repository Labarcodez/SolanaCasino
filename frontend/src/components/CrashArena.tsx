import { useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { CrashGame } from "./CrashGame";
import { LiveBetsPanel } from "./LiveBetsPanel";
import { CrashMobilePanels } from "./CrashMobilePanels";
import { useSocket } from "../hooks/useSocket";

interface CrashArenaProps {
  balanceSol: number;
  minBetSol: number;
  maxBetSol: number;
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

  const phase = crashState?.phase ?? "betting";
  const bets = crashState?.bets ?? [];

  const chatPanel = <ChatPanel spectator={spectator} />;
  const betsPanel = (
    <LiveBetsPanel bets={bets} phase={phase} />
  );

  return (
    <div
      className={`crash-arena ${focusMode ? "crash-arena--focus" : ""} ${spectator ? "crash-arena--spectator" : ""}`.trim()}
    >
      <div className="crash-arena-chat crash-arena-side-panel">
        {chatPanel}
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

      <div className="crash-arena-bets crash-arena-side-panel">
        {betsPanel}
      </div>

      <CrashMobilePanels chatPanel={chatPanel} betsPanel={betsPanel} />
    </div>
  );
}
