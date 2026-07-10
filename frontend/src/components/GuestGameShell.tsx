import { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { Header } from "./Header";
import { AnimatedBackground } from "./AnimatedBackground";
import { LiveActivityMarquee } from "./LiveActivityMarquee";
import { SiteFooter } from "./SiteFooter";
import { WalletConnectButton } from "./WalletConnectButton";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { GameIcon } from "./icons/GameIcons";
import { GAMES } from "../lib/brand";
import { tabToPath, type GameTab } from "../hooks/useGameTab";

const CrashArena = lazy(() =>
  import("./CrashArena").then((m) => ({ default: m.CrashArena })),
);

const GUEST_GAME_TABS = new Set<GameTab>(["crash", "coinflip", "limbo"]);

export function isGuestGameTab(tab: GameTab): boolean {
  return GUEST_GAME_TABS.has(tab);
}

interface GuestGameShellProps {
  activeTab: GameTab;
  onChainEnabled?: boolean;
}

function TabLoader() {
  return (
    <div className="tab-loader" aria-busy="true">
      <div className="spinner" />
    </div>
  );
}

export function GuestGameShell({
  activeTab,
  onChainEnabled,
}: GuestGameShellProps) {
  const gameMeta = GAMES.find((g) => g.id === activeTab);

  return (
    <div className="app guest-game-app">
      <AnimatedBackground />
      <Header connected={false} onChainEnabled={onChainEnabled} />
      <LiveActivityMarquee />

      <div className="guest-game-banner">
        <div className="guest-game-banner-copy">
          <p className="guest-game-eyebrow">Spectator mode</p>
          <h1>{gameMeta?.name ?? "Play"} live on Solana</h1>
          <p>
            Watch rounds in real time. Connect Phantom to bet with provably fair
            outcomes.
          </p>
        </div>
        <WalletConnectButton />
      </div>

      <nav className="guest-game-nav container" aria-label="Game preview tabs">
        {GAMES.map((game) => (
          <Link
            key={game.id}
            to={tabToPath(game.id as GameTab)}
            className={`nav-tab ${activeTab === game.id ? "active" : ""}`}
          >
            <GameIcon id={game.id as "crash" | "coinflip" | "limbo"} size={16} />
            {game.shortLabel}
          </Link>
        ))}
      </nav>

      <main className="main-content guest-game-main">
        {activeTab === "crash" && (
          <div className="container crash-page">
            <GameErrorBoundary label="Crash">
              <Suspense fallback={<TabLoader />}>
                <CrashArena
                  balanceSol={0}
                  minBetSol={0.001}
                  maxBetSol={1}
                  spectator
                  onBalanceUpdate={() => {}}
                />
              </Suspense>
            </GameErrorBoundary>
          </div>
        )}

        {(activeTab === "coinflip" || activeTab === "limbo") && gameMeta && (
          <div className="container">
            <div className="card card-glow guest-game-preview">
              <div className="guest-game-preview-icon">
                <GameIcon id={activeTab} size={40} />
              </div>
              <h2>{gameMeta.name}</h2>
              <p>{gameMeta.desc}</p>
              <p className="guest-game-preview-rtp">{gameMeta.rtp} RTP</p>
              <div className="guest-game-preview-cta">
                <WalletConnectButton />
                <p className="guest-game-preview-hint">
                  Connect your wallet to play {gameMeta.name.toLowerCase()} with
                  instant settlement.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
