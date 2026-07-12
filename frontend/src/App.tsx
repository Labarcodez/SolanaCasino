import { lazy, Suspense, useState } from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { TransactionHistoryPanel } from "./components/TransactionHistoryPanel";
import { GameMobileHistorySheet } from "./components/GameMobileHistorySheet";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { MobileNav } from "./components/MobileNav";
import { useCasino, CasinoUserProvider } from "./hooks/CasinoUserProvider";
import { ConnectModalProvider } from "./context/ConnectModalContext";
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
import { useGameTab, parseGameTab, tabToPath, type GameTab } from "./hooks/useGameTab";
import { useDocumentTitle } from "./hooks/useDocumentTitle";
import { useFocusTrap } from "./hooks/useFocusTrap";
import { GuestGameShell, isGuestAccessibleTab } from "./components/GuestGameShell";
import { SocketStatusBanner } from "./components/SocketStatusBanner";
import { ZeroBalanceBanner } from "./components/ZeroBalanceBanner";
import { ConnectTrigger } from "./components/ConnectTrigger";
import { AuthSignInOverlay } from "./components/AuthSignInOverlay";

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
      <ConnectModalProvider>
        <CasinoRoot />
      </ConnectModalProvider>
    </CasinoUserProvider>
  );
}

const CASINO_ROUTES = [
  "/crash",
  "/coinflip",
  "/limbo",
  "/leaderboard",
  "/tournament",
  "/fairness",
  "/verify",
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
    pendingWalletTx,
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
  const profileDialogRef = useFocusTrap(profileOpen && !!profile, () =>
    setProfileOpen(false),
  );

  useDocumentTitle(activeTab);

  const balanceSol = profile?.balanceSol ?? 0;
  const onChainEnabled = config?.onChainEnabled ?? false;
  const isAdmin = profile?.isAdmin ?? false;
  const pendingProfileSignIn =
    Boolean(isConnected && walletAddress && !isAuthenticated);
  const gameTabsWhileSigningIn = new Set<GameTab>(["crash", "limbo", "coinflip"]);
  const showGameWhileSigningIn =
    pendingProfileSignIn && gameTabsWhileSigningIn.has(activeTab);

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
              <ConnectTrigger
                intent="play"
                label="Connect wallet"
                fullWidth
                testId="welcome-back-connect"
              />
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

    if (isGuestAccessibleTab(activeTab)) {
      return (
        <GuestGameShell
          activeTab={activeTab}
          onChainEnabled={onChainEnabled}
        />
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
          cluster={config?.cluster}
          withdrawalsEnabled={config?.withdrawalsEnabled}
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

  if (!isAuthenticated && !showGameWhileSigningIn) {
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
              data-testid="connect-sign-in"
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
    <div className={`app${pendingProfileSignIn ? " app--pending-signin" : ""}`}>
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
            ref={profileDialogRef}
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
      <SocketStatusBanner />
      <LiveActivityMarquee />
      <TreasuryBar />

      {config &&
        !pendingProfileSignIn &&
        (activeTab === "crash" ||
          activeTab === "coinflip" ||
          activeTab === "limbo") && (
          <ZeroBalanceBanner
            balanceSol={balanceSol}
            minBetSol={config.minBetSol}
            onGoToWallet={() => setActiveTab("wallet")}
          />
        )}

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
          {isAdmin && (
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

      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      <main id="main-content" className="main-content">
        {activeTab === "crash" && config ? (
          <div className="container crash-page">
            <GameErrorBoundary label="Crash">
              <Suspense fallback={<TabLoader />}>
                <CrashArena
                  balanceSol={pendingProfileSignIn ? 0 : balanceSol}
                  minBetSol={config.minBetSol}
                  maxBetSol={config.maxBetSol}
                  onBalanceUpdate={handleBalanceUpdate}
                  onRefreshBalance={() => void refresh()}
                  spectator={pendingProfileSignIn}
                />
              </Suspense>
            </GameErrorBoundary>
            <div className="crash-history-desktop game-sidebar-desktop">
              <TransactionHistoryPanel walletAddress={walletAddress} />
            </div>
            <GameMobileHistorySheet
              historyPanel={
                <TransactionHistoryPanel walletAddress={walletAddress} />
              }
            />
          </div>
        ) : activeTab === "wallet" && config ? (
          <Suspense fallback={<TabLoader />}>
            <WalletPage
              walletAddress={walletAddress}
              balanceSol={balanceSol}
              onChainBalanceSol={profile?.onChainBalanceSol ?? 0}
              minBetSol={config.minBetSol}
              minWithdrawSol={config.minWithdrawSol}
              withdrawalsEnabled={config.withdrawalsEnabled}
              onChainEnabled={onChainEnabled}
              loading={loading || !profile}
              walletActionPhase={walletActionPhase}
              pendingWalletTx={pendingWalletTx}
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
                      balanceSol={pendingProfileSignIn ? 0 : balanceSol}
                      minBetSol={config.minBetSol}
                      maxBetSol={config.maxBetSol}
                      onBalanceUpdate={handleBalanceUpdate}
                      spectator={pendingProfileSignIn}
                    />
                  </Suspense>
                </GameErrorBoundary>
              )}
              {activeTab === "limbo" && config && (
                <GameErrorBoundary label="Limbo">
                  <Suspense fallback={<TabLoader />}>
                    <LimboGame
                      walletAddress={walletAddress}
                      balanceSol={pendingProfileSignIn ? 0 : balanceSol}
                      minBetSol={config.minBetSol}
                      maxBetSol={config.maxBetSol}
                      limboMinTarget={config.limboMinTarget}
                      limboMaxTarget={config.limboMaxTarget}
                      limboHouseEdge={config.limboHouseEdge}
                      onChainEnabled={onChainEnabled}
                      onBalanceUpdate={handleBalanceUpdate}
                      spectator={pendingProfileSignIn}
                    />
                  </Suspense>
                </GameErrorBoundary>
              )}
            </div>
            <aside className="sidebar-panels game-sidebar-desktop">
              <TransactionHistoryPanel walletAddress={walletAddress} />
            </aside>
            <GameMobileHistorySheet
              historyPanel={
                <TransactionHistoryPanel walletAddress={walletAddress} />
              }
            />
          </div>
        ) : (
          <div className="container">
            {activeTab === "leaderboard" && (
              <Suspense fallback={<TabLoader />}>
                <Leaderboard walletAddress={walletAddress} />
              </Suspense>
            )}
            {activeTab === "tournament" && (
              <Suspense fallback={<TabLoader />}>
                <TournamentPanel walletAddress={walletAddress} />
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
              <GameErrorBoundary label="Token">
                <Suspense fallback={<TabLoader />}>
                  <SiteTokenPage />
                </Suspense>
              </GameErrorBoundary>
            )}
            {activeTab === "launch" && isAdmin && (
              <Suspense fallback={<TabLoader />}>
                <LaunchTokenPage />
              </Suspense>
            )}
            {activeTab === "admin" && isAdmin && (
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
        showAdmin={isAdmin}
      />
      {pendingProfileSignIn && (
        <AuthSignInOverlay
          authProvider={authProvider}
          authLoading={authLoading}
          authError={authError}
          onSignIn={() => authenticate().catch(console.error)}
          onSignOut={() => void signOut()}
        />
      )}
      <SiteFooter />
    </div>
  );
}

function RootRedirect() {
  const [searchParams] = useSearchParams();

  const legacyTab = searchParams.get("tab");
  if (legacyTab) {
    const tab = parseGameTab(legacyTab);
    const target = tabToPath(tab);
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    const query = next.toString();
    return <Navigate to={query ? `${target}?${query}` : target} replace />;
  }

  return <Navigate to="/crash" replace />;
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
          <Route path="/preview*" element={<Navigate to="/crash" replace />} />
        )}
        <Route path="/" element={<RootRedirect />} />
        {CASINO_ROUTES.map((path) => (
          <Route key={path} path={path} element={<CasinoApp />} />
        ))}
        <Route path="/*" element={<Navigate to="/crash" replace />} />
      </Routes>
    </Suspense>
  );
}
