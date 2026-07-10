import { lazy, Suspense, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { BetHistoryPanel } from "./components/BetHistoryPanel";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { MobileNav } from "./components/MobileNav";
import { useCasino, CasinoUserProvider } from "./hooks/CasinoUserProvider";
import { SocketProvider, useSocket } from "./hooks/useSocket";
import { TreasuryBar } from "./components/TreasuryBar";
import { LiveActivityMarquee } from "./components/LiveActivityMarquee";
import { SiteFooter } from "./components/SiteFooter";
import { BRAND } from "./lib/brand";
import { Logo } from "./components/Logo";
import { GameIcon } from "./components/icons/GameIcons";
import { ProfilePanel } from "./components/ProfilePanel";
import { PauseBanner } from "./components/PauseBanner";
import { ConfigErrorScreen } from "./components/ConfigErrorScreen";
import { GameErrorBoundary } from "./components/GameErrorBoundary";
import type { UserProfile } from "./lib/api";
import { shortenAddress } from "./lib/api";
import { useGameTab } from "./hooks/useGameTab";
import { GuestGameShell, isGuestGameTab } from "./components/GuestGameShell";

const CrashArena = lazy(() =>
  import("./components/CrashArena").then((m) => ({ default: m.CrashArena })),
);
const CoinflipGame = lazy(() =>
  import("./components/CoinflipGame").then((m) => ({ default: m.CoinflipGame })),
);
const LimboGame = lazy(() =>
  import("./components/LimboGame").then((m) => ({ default: m.LimboGame })),
);
const Leaderboard = lazy(() =>
  import("./components/Leaderboard").then((m) => ({ default: m.Leaderboard })),
);
const TournamentPanel = lazy(() =>
  import("./components/TournamentPanel").then((m) => ({ default: m.TournamentPanel })),
);
const FairnessPanel = lazy(() =>
  import("./components/FairnessPanel").then((m) => ({ default: m.FairnessPanel })),
);
const AdminDashboard = lazy(() =>
  import("./components/AdminDashboard").then((m) => ({ default: m.AdminDashboard })),
);
const WalletPage = lazy(() =>
  import("./pages/WalletPage").then((m) => ({ default: m.WalletPage })),
);
const LaunchTokenPage = lazy(() =>
  import("./pages/LaunchToken").then((m) => ({ default: m.LaunchTokenPage })),
);
const SiteTokenPage = lazy(() =>
  import("./pages/SiteToken").then((m) => ({ default: m.SiteTokenPage })),
);
const AuthCallback = lazy(() => import("./pages/AuthCallback"));

const ScreenshotPreview = lazy(() =>
  import("./pages/ScreenshotPreview").then((m) => ({ default: m.ScreenshotPreview })),
);
const ScreenshotPreviewCoinflip = lazy(() =>
  import("./pages/ScreenshotPreviewCoinflip").then((m) => ({ default: m.ScreenshotPreviewCoinflip })),
);
const ScreenshotPreviewProfile = lazy(() =>
  import("./pages/ScreenshotPreviewProfile").then((m) => ({ default: m.ScreenshotPreviewProfile })),
);
const ScreenshotPreviewLeaderboard = lazy(() =>
  import("./pages/ScreenshotPreviewLeaderboard").then((m) => ({ default: m.ScreenshotPreviewLeaderboard })),
);
const ScreenshotPreviewFairness = lazy(() =>
  import("./pages/ScreenshotPreviewFairness").then((m) => ({ default: m.ScreenshotPreviewFairness })),
);
const ScreenshotPreviewAuth = lazy(() =>
  import("./pages/ScreenshotPreviewAuth").then((m) => ({ default: m.ScreenshotPreviewAuth })),
);
const ScreenshotPreviewLanding = lazy(() =>
  import("./pages/ScreenshotPreviewAuth").then((m) => ({ default: m.ScreenshotPreviewLanding })),
);
const ScreenshotPreviewLimbo = lazy(() =>
  import("./pages/ScreenshotPreviewLimbo").then((m) => ({ default: m.ScreenshotPreviewLimbo })),
);
const ScreenshotPreviewTournament = lazy(() =>
  import("./pages/ScreenshotPreviewTournament").then((m) => ({ default: m.ScreenshotPreviewTournament })),
);
const ScreenshotPreviewAdmin = lazy(() =>
  import("./pages/ScreenshotPreviewAdmin").then((m) => ({ default: m.ScreenshotPreviewAdmin })),
);

function TabLoader() {
  return (
    <div className="tab-loader" aria-busy="true">
      <div className="spinner" />
    </div>
  );
}

const isDev = import.meta.env.DEV;

function CasinoApp() {
  return (
    <CasinoUserProvider>
      <CasinoRoot />
    </CasinoUserProvider>
  );
}

const CASINO_ROUTES = [
  "/",
  "/crash",
  "/coinflip",
  "/limbo",
  "/leaderboard",
  "/tournament",
  "/fairness",
  "/profile",
  "/wallet",
  "/token",
  "/launch",
  "/admin",
] as const;

function CasinoContent() {
  const {
    isConnected,
    isAuthenticated,
    hasRestorableSession,
    sessionWalletAddress,
    authLoading,
    authError,
    authenticate,
    signOut,
    authProvider,
    walletAddress,
    profile,
    config,
    configLoading,
    configError,
    reloadConfig,
    loading,
    walletActionPhase,
    error,
    deposit,
    withdraw,
    refresh,
    handleBalanceUpdate,
    recoverPendingDeposit,
    creditDepositBySignature,
  } = useCasino();
  const { connected: wsConnected } = useSocket();
  const { activeTab, setActiveTab } = useGameTab();
  const [profileOpen, setProfileOpen] = useState(false);

  const balanceSol = profile?.balanceSol ?? 0;
  const onChainEnabled = config?.onChainEnabled ?? false;

  if (!configLoading && configError && !config) {
    return (
      <ConfigErrorScreen message={configError} onRetry={() => void reloadConfig()} />
    );
  }

  if (!isConnected || !walletAddress) {
    if (hasRestorableSession && sessionWalletAddress) {
      return (
        <div className="app">
          <AnimatedBackground />
          <Header connected={false} onChainEnabled={onChainEnabled} />
          <div className="auth-screen">
            <div className="auth-card">
              <Logo size="lg" className="auth-card-logo" />
              <h2>Welcome back</h2>
              <p>
                Your session for{" "}
                <strong>{shortenAddress(sessionWalletAddress)}</strong> is saved.
                Reconnect the same Phantom wallet to continue playing.
              </p>
              <p className="wallet-hint">
                Use the Connect button in the header to restore your wallet connection.
              </p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void signOut()}
                style={{ width: "100%" }}
              >
                Sign out
              </button>
            </div>
          </div>
          <SiteFooter />
        </div>
      );
    }

    if (isGuestGameTab(activeTab)) {
      return (
        <GuestGameShell
          activeTab={activeTab}
          onChainEnabled={onChainEnabled}
        />
      );
    }

    if (activeTab === "fairness") {
      return (
        <div className="app">
          <AnimatedBackground />
          <Header connected={false} onChainEnabled={onChainEnabled} />
          <LiveActivityMarquee />
          <main className="main-content">
            <div className="container">
              <Suspense fallback={<TabLoader />}>
                <FairnessPanel />
              </Suspense>
            </div>
          </main>
          <SiteFooter />
        </div>
      );
    }

    return (
      <div className="app">
        <AnimatedBackground />
        <Header connected={false} onChainEnabled={onChainEnabled} />
        <LiveActivityMarquee />
        <Landing
          socialLoginEnabled={config?.socialLoginEnabled}
          onChainEnabled={onChainEnabled}
        />
        <SiteFooter />
      </div>
    );
  }

  if (isAuthenticated && configLoading) {
    return (
      <div className="app-loading">
        <Logo size="lg" />
        <div className="spinner" aria-hidden="true" />
        <p>Loading {BRAND.name}...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <AnimatedBackground />
        <Header
          connected
          walletAddress={walletAddress}
          onChainEnabled={onChainEnabled}
        />
        <div className="auth-screen">
          <div className="auth-card">
            <Logo size="lg" className="auth-card-logo" />
            <h2>Welcome to {BRAND.name}</h2>
            <p>
              Your wallet is connected
              {authProvider === "google" || authProvider === "apple"
                ? ` via ${authProvider === "google" ? "Google" : "Apple"}`
                : " via Phantom"}
              . Sign a free message to create your profile — no SOL required.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => authenticate().catch(console.error)}
              disabled={authLoading}
              style={{ width: "100%" }}
            >
              {authLoading ? "Signing..." : "Create profile & play"}
            </button>
            {authError && <div className="alert alert-error">{authError}</div>}
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const handleProfileUpdated = (_updated: UserProfile) => {
    void refresh();
    setProfileOpen(false);
  };

  return (
    <div className="app">
      <AnimatedBackground />
      <Header
        balanceSol={balanceSol}
        connected
        walletAddress={walletAddress}
        displayName={profile?.displayName}
        onChainEnabled={onChainEnabled}
        onSignOut={() => void signOut()}
        onProfileClick={() => setProfileOpen(true)}
        onWalletClick={() => setActiveTab("wallet")}
      />

      {profileOpen && profile && (
        <div
          className="modal-overlay"
          onClick={() => setProfileOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Profile"
            className="modal card profile-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <ProfilePanel
              profile={profile}
              onUpdated={handleProfileUpdated}
              onClose={() => setProfileOpen(false)}
            />
          </div>
        </div>
      )}

      <PauseBanner paused={config?.casinoPaused ?? false} />
      <LiveActivityMarquee />
      <TreasuryBar />

      <div className="container">
        <nav className="nav-tabs" aria-label="Game tabs">
          <button
            className={`nav-tab ${activeTab === "crash" ? "active" : ""}`}
            onClick={() => setActiveTab("crash")}
          >
            <GameIcon id="crash" size={16} className="nav-tab-icon" />
            Crash
          </button>
          <button
            className={`nav-tab ${activeTab === "coinflip" ? "active" : ""}`}
            onClick={() => setActiveTab("coinflip")}
          >
            <GameIcon id="coinflip" size={16} className="nav-tab-icon" />
            Coinflip
          </button>
          <button
            className={`nav-tab ${activeTab === "limbo" ? "active" : ""}`}
            onClick={() => setActiveTab("limbo")}
          >
            <GameIcon id="limbo" size={16} className="nav-tab-icon" />
            Limbo
          </button>
          <button
            className={`nav-tab ${activeTab === "leaderboard" ? "active" : ""}`}
            onClick={() => setActiveTab("leaderboard")}
          >
            <GameIcon id="leaderboard" size={16} className="nav-tab-icon" />
            Leaderboard
          </button>
          <button
            className={`nav-tab ${activeTab === "tournament" ? "active" : ""}`}
            onClick={() => setActiveTab("tournament")}
          >
            <GameIcon id="tournament" size={16} className="nav-tab-icon" />
            Tournament
          </button>
          <button
            className={`nav-tab ${activeTab === "fairness" ? "active" : ""}`}
            onClick={() => setActiveTab("fairness")}
          >
            <GameIcon id="fairness" size={16} className="nav-tab-icon" />
            Fairness
          </button>
          <button
            className={`nav-tab ${activeTab === "wallet" ? "active" : ""}`}
            onClick={() => setActiveTab("wallet")}
          >
            <GameIcon id="wallet" size={16} className="nav-tab-icon" />
            Wallet
          </button>
          <button
            className={`nav-tab ${activeTab === "token" ? "active" : ""}`}
            onClick={() => setActiveTab("token")}
          >
            Token
          </button>
          <button
            className={`nav-tab ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <GameIcon id="profile" size={16} className="nav-tab-icon" />
            Profile
          </button>
          {config?.adminWallet && walletAddress === config.adminWallet && (
            <button
              className={`nav-tab ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              <GameIcon id="admin" size={16} className="nav-tab-icon" />
              Admin
            </button>
          )}
          <div
            className="live-indicator"
            style={{ marginLeft: "auto", alignSelf: "center" }}
          >
            <div className="live-dot" />
            {wsConnected ? "Live" : "Connecting..."}
          </div>
        </nav>
      </div>

      <main className="main-content">
        {activeTab === "crash" && config ? (
          <div className="container crash-page">
            <GameErrorBoundary label="Crash">
              <Suspense fallback={<TabLoader />}>
                <CrashArena
                  balanceSol={balanceSol}
                  minBetSol={config.minBetSol}
                  maxBetSol={config.maxBetSol}
                  onChainEnabled={onChainEnabled}
                  onBalanceUpdate={handleBalanceUpdate}
                />
              </Suspense>
            </GameErrorBoundary>
            <BetHistoryPanel walletAddress={walletAddress} />
          </div>
        ) : activeTab === "wallet" && config && profile ? (
          <Suspense fallback={<TabLoader />}>
            <WalletPage
              walletAddress={walletAddress}
              balanceSol={balanceSol}
              onChainBalanceSol={profile.onChainBalanceSol}
              minBetSol={config.minBetSol}
              minWithdrawSol={config.minWithdrawSol}
              withdrawalsEnabled={config.withdrawalsEnabled}
              onChainEnabled={onChainEnabled}
              loading={loading}
              walletActionPhase={walletActionPhase}
              error={error}
              rpcProvider={config.rpcProvider}
              alchemyConfigured={config.alchemyConfigured}
              cluster={config.cluster}
              onDeposit={async (amount) => deposit(amount)}
              onWithdraw={async (amount) => withdraw(amount)}
              onBalanceUpdate={handleBalanceUpdate}
              onRecoverPendingDeposit={() => recoverPendingDeposit()}
              onCreditDeposit={(signature) => creditDepositBySignature(signature)}
            />
          </Suspense>
        ) : activeTab === "coinflip" || activeTab === "limbo" ? (
          <div className="container game-grid">
            <div>
              {activeTab === "coinflip" && config && (
                <GameErrorBoundary label="Coinflip">
                  <Suspense fallback={<TabLoader />}>
                    <CoinflipGame
                      walletAddress={walletAddress}
                      balanceSol={balanceSol}
                      minBetSol={config.minBetSol}
                      maxBetSol={config.maxBetSol}
                      onBalanceUpdate={handleBalanceUpdate}
                    />
                  </Suspense>
                </GameErrorBoundary>
              )}
              {activeTab === "limbo" && config && (
                <GameErrorBoundary label="Limbo">
                  <Suspense fallback={<TabLoader />}>
                    <LimboGame
                      walletAddress={walletAddress}
                      balanceSol={balanceSol}
                      minBetSol={config.minBetSol}
                      maxBetSol={config.maxBetSol}
                      limboMinTarget={config.limboMinTarget}
                      limboMaxTarget={config.limboMaxTarget}
                      limboHouseEdge={config.limboHouseEdge}
                      onChainEnabled={onChainEnabled}
                      onBalanceUpdate={handleBalanceUpdate}
                    />
                  </Suspense>
                </GameErrorBoundary>
              )}
            </div>
            <aside className="sidebar-panels">
              <BetHistoryPanel walletAddress={walletAddress} />
            </aside>
          </div>
        ) : (
          <div className="container">
            {activeTab === "leaderboard" && (
              <Suspense fallback={<TabLoader />}>
                <Leaderboard />
              </Suspense>
            )}
            {activeTab === "tournament" && (
              <Suspense fallback={<TabLoader />}>
                <TournamentPanel />
              </Suspense>
            )}
            {activeTab === "fairness" && (
              <Suspense fallback={<TabLoader />}>
                <FairnessPanel />
              </Suspense>
            )}
            {activeTab === "profile" && profile && (
              <ProfilePanel profile={profile} onUpdated={handleProfileUpdated} />
            )}
            {activeTab === "token" && (
              <Suspense fallback={<TabLoader />}>
                <SiteTokenPage onLaunchClick={() => setActiveTab("launch")} />
              </Suspense>
            )}
            {activeTab === "launch" && (
              <Suspense fallback={<TabLoader />}>
                <LaunchTokenPage />
              </Suspense>
            )}
            {activeTab === "admin" && (
              <GameErrorBoundary label="Admin">
                <Suspense fallback={<TabLoader />}>
                  <AdminDashboard />
                </Suspense>
              </GameErrorBoundary>
            )}
          </div>
        )}
      </main>

      <MobileNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        showAdmin={Boolean(config?.adminWallet && walletAddress === config.adminWallet)}
      />
      <SiteFooter />
    </div>
  );
}

function CasinoRoot() {
  const { isAuthenticated } = useCasino();
  const socketMode = isAuthenticated ? "authenticated" : "spectator";
  return (
    <SocketProvider mode={socketMode}>
      <CasinoContent />
    </SocketProvider>
  );
}

export default function App() {
  return (
    <Suspense fallback={<TabLoader />}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        {isDev ? (
          <>
            <Route path="/preview" element={<ScreenshotPreview />} />
            <Route path="/preview-coinflip" element={<ScreenshotPreviewCoinflip />} />
            <Route path="/preview-profile" element={<ScreenshotPreviewProfile />} />
            <Route path="/preview-leaderboard" element={<ScreenshotPreviewLeaderboard />} />
            <Route path="/preview-fairness" element={<ScreenshotPreviewFairness />} />
            <Route path="/preview-auth" element={<ScreenshotPreviewAuth />} />
            <Route path="/preview-landing" element={<ScreenshotPreviewLanding />} />
            <Route path="/preview-limbo" element={<ScreenshotPreviewLimbo />} />
            <Route path="/preview-tournament" element={<ScreenshotPreviewTournament />} />
            <Route path="/preview-admin" element={<ScreenshotPreviewAdmin />} />
          </>
        ) : (
          <Route path="/preview*" element={<Navigate to="/" replace />} />
        )}
        {CASINO_ROUTES.map((path) => (
          <Route key={path} path={path} element={<CasinoApp />} />
        ))}
        <Route path="/*" element={<Navigate to="/crash" replace />} />
      </Routes>
    </Suspense>
  );
}
