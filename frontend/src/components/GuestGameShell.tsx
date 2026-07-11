import { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { Header } from "./Header";
import { AnimatedBackground } from "./AnimatedBackground";
import { LiveActivityMarquee } from "./LiveActivityMarquee";
import { SocketStatusBanner } from "./SocketStatusBanner";
import { SiteFooter } from "./SiteFooter";
import { ConnectTrigger } from "./ConnectTrigger";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { GameIcon, type GameIconId } from "./icons/GameIcons";
import { GAMES } from "../lib/brand";
import { tabToPath, type GameTab } from "../hooks/useGameTab";

const CrashArena = lazy(() =>
  import("./CrashArena").then((m) => ({ default: m.CrashArena })),
);
const Leaderboard = lazy(() =>
  import("./Leaderboard").then((m) => ({ default: m.Leaderboard })),
);
const TournamentPanel = lazy(() =>
  import("./TournamentPanel").then((m) => ({ default: m.TournamentPanel })),
);
const FairnessPanel = lazy(() =>
  import("./FairnessPanel").then((m) => ({ default: m.FairnessPanel })),
);

const GUEST_GAME_TABS = new Set<GameTab>(["crash", "coinflip", "limbo"]);
const GUEST_PUBLIC_TABS = new Set<GameTab>([
  "leaderboard",
  "tournament",
  "fairness",
]);

const GUEST_SOCIAL_NAV: { id: GameTab; label: string; icon: GameIconId }[] = [
  { id: "leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { id: "tournament", label: "Tournament", icon: "tournament" },
  { id: "fairness", label: "Fairness", icon: "fairness" },
];

export function isGuestGameTab(tab: GameTab): boolean {
  return GUEST_GAME_TABS.has(tab);
}

export function isGuestAccessibleTab(tab: GameTab): boolean {
  return GUEST_GAME_TABS.has(tab) || GUEST_PUBLIC_TABS.has(tab);
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
  const isGameTab = isGuestGameTab(activeTab);

  return (
    <div className="app guest-game-app">
      <AnimatedBackground />
      <Header connected={false} onChainEnabled={onChainEnabled} />
      <LiveActivityMarquee />
      <SocketStatusBanner />

      {isGameTab && (
        <div className="guest-game-banner">
          <div className="guest-game-banner-copy">
            <p className="guest-game-eyebrow">Spectator mode</p>
            <h1>{gameMeta?.name ?? "Play"} live on Solana</h1>
            <p>
              Watch rounds in real time. Connect Phantom to bet with provably fair
              outcomes.
            </p>
          </div>
          <ConnectTrigger intent="play" label="Connect to play" testId="guest-banner-connect" />
        </div>
      )}

      <nav className="guest-game-nav container" aria-label="Site navigation">
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
        {GUEST_SOCIAL_NAV.map((item) => (
          <Link
            key={item.id}
            to={tabToPath(item.id)}
            className={`nav-tab ${activeTab === item.id ? "active" : ""}`}
          >
            <GameIcon id={item.icon} size={16} />
            {item.label}
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
                <ConnectTrigger intent="play" testId="guest-game-connect" />
                <p className="guest-game-preview-hint">
                  Connect your wallet to play {gameMeta.name.toLowerCase()} with
                  instant settlement.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="container">
            <Suspense fallback={<TabLoader />}>
              <Leaderboard />
            </Suspense>
          </div>
        )}

        {activeTab === "tournament" && (
          <div className="container">
            <Suspense fallback={<TabLoader />}>
              <TournamentPanel />
            </Suspense>
          </div>
        )}

        {activeTab === "fairness" && (
          <div className="container">
            <Suspense fallback={<TabLoader />}>
              <FairnessPanel />
            </Suspense>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
