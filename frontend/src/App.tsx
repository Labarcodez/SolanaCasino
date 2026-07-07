import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { CrashArena } from "./components/CrashArena";
import { CoinflipGame } from "./components/CoinflipGame";
import { WalletPanel } from "./components/WalletPanel";
import { Leaderboard } from "./components/Leaderboard";
import { BetHistoryPanel } from "./components/BetHistoryPanel";
import { FairnessPanel } from "./components/FairnessPanel";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { MobileNav } from "./components/MobileNav";
import { useCasino, CasinoUserProvider } from "./hooks/CasinoUserProvider";
import { SocketProvider, useSocket } from "./hooks/useSocket";
import { SiteFooter } from "./components/SiteFooter";
import { BRAND } from "./lib/brand";
import { Logo } from "./components/Logo";
import AuthCallback from "./pages/AuthCallback";
import { ScreenshotPreview } from "./pages/ScreenshotPreview";
import { ProfilePanel } from "./components/ProfilePanel";
import { ScreenshotPreviewCoinflip } from "./pages/ScreenshotPreviewCoinflip";
import { ScreenshotPreviewProfile } from "./pages/ScreenshotPreviewProfile";
import { ScreenshotPreviewLeaderboard } from "./pages/ScreenshotPreviewLeaderboard";
import { ScreenshotPreviewFairness } from "./pages/ScreenshotPreviewFairness";
import { ScreenshotPreviewAuth, ScreenshotPreviewLanding } from "./pages/ScreenshotPreviewAuth";
import type { UserProfile } from "./lib/api";

type GameTab = "crash" | "coinflip" | "leaderboard" | "fairness" | "profile";

function CasinoContent() {
  const {
    isConnected,
    isAuthenticated,
    authLoading,
    authError,
    authenticate,
    signOut,
    authProvider,
    walletAddress,
    profile,
    config,
    configLoading,
    loading,
    error,
    deposit,
    withdraw,
    refresh,
  } = useCasino();
  const { connected: wsConnected } = useSocket();
  const [activeTab, setActiveTab] = useState<GameTab>("crash");
  const [localBalance, setLocalBalance] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const balanceSol = localBalance ?? profile?.balanceSol ?? 0;
  const onChainEnabled = config?.onChainEnabled ?? false;

  const handleBalanceUpdate = (balance: number) => {
    setLocalBalance(balance);
    refresh();
  };

  if (!isConnected || !walletAddress) {
    return (
      <div className="app">
        <AnimatedBackground />
        <Header connected={false} onChainEnabled={onChainEnabled} />
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

  const handleProfileUpdated = (updated: UserProfile) => {
    void refresh();
    setProfileOpen(false);
    if (updated.displayName) {
      setActiveTab("crash");
    }
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
      />

      {profileOpen && profile && (
        <div className="modal-overlay" onClick={() => setProfileOpen(false)} role="presentation">
          <div onClick={(e) => e.stopPropagation()}>
            <ProfilePanel
              profile={profile}
              onUpdated={handleProfileUpdated}
              onClose={() => setProfileOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="container">
        <nav className="nav-tabs" aria-label="Game tabs">
          <button
            className={`nav-tab ${activeTab === "crash" ? "active" : ""}`}
            onClick={() => setActiveTab("crash")}
          >
            🚀 Crash
          </button>
          <button
            className={`nav-tab ${activeTab === "coinflip" ? "active" : ""}`}
            onClick={() => setActiveTab("coinflip")}
          >
            🪙 Coinflip
          </button>
          <button
            className={`nav-tab ${activeTab === "leaderboard" ? "active" : ""}`}
            onClick={() => setActiveTab("leaderboard")}
          >
            🏆 Leaderboard
          </button>
          <button
            className={`nav-tab ${activeTab === "fairness" ? "active" : ""}`}
            onClick={() => setActiveTab("fairness")}
          >
            🔐 Fairness
          </button>
          <button
            className={`nav-tab ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            👤 Profile
          </button>
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
            <CrashArena
              balanceSol={balanceSol}
              minBetSol={config.minBetSol}
              maxBetSol={config.maxBetSol}
              onChainEnabled={onChainEnabled}
              onBalanceUpdate={handleBalanceUpdate}
            />
            <div className="crash-wallet-row">
              {profile && (
                <WalletPanel
                  balanceSol={balanceSol}
                  onChainBalanceSol={profile.onChainBalanceSol}
                  minBetSol={config.minBetSol}
                  minWithdrawSol={config.minWithdrawSol}
                  withdrawalsEnabled={config.withdrawalsEnabled}
                  onChainEnabled={onChainEnabled}
                  loading={loading}
                  onDeposit={async (amount) => deposit(amount)}
                  onWithdraw={async (amount) => {
                    const result = await withdraw(amount);
                    handleBalanceUpdate(result.balanceSol);
                    return result;
                  }}
                  error={error}
                />
              )}
              <BetHistoryPanel walletAddress={walletAddress} />
            </div>
          </div>
        ) : (
          <div className="container game-grid">
            <div>
              {activeTab === "coinflip" && config && (
                <CoinflipGame
                  walletAddress={walletAddress}
                  balanceSol={balanceSol}
                  minBetSol={config.minBetSol}
                  maxBetSol={config.maxBetSol}
                  onBalanceUpdate={handleBalanceUpdate}
                />
              )}
              {activeTab === "leaderboard" && <Leaderboard />}
              {activeTab === "fairness" && <FairnessPanel />}
              {activeTab === "profile" && profile && (
                <ProfilePanel profile={profile} onUpdated={handleProfileUpdated} />
              )}
            </div>

            <aside className="sidebar-panels">
              {config && profile && (
                <WalletPanel
                  balanceSol={balanceSol}
                  onChainBalanceSol={profile.onChainBalanceSol}
                  minBetSol={config.minBetSol}
                  minWithdrawSol={config.minWithdrawSol}
                  withdrawalsEnabled={config.withdrawalsEnabled}
                  onChainEnabled={onChainEnabled}
                  loading={loading}
                  onDeposit={async (amount) => deposit(amount)}
                  onWithdraw={async (amount) => {
                    const result = await withdraw(amount);
                    handleBalanceUpdate(result.balanceSol);
                    return result;
                  }}
                  error={error}
                />
              )}
              <BetHistoryPanel walletAddress={walletAddress} />
            </aside>
          </div>
        )}
      </main>

      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
      <SiteFooter />
    </div>
  );
}

function CasinoRoot() {
  const { isAuthenticated } = useCasino();
  return (
    <SocketProvider enabled={isAuthenticated}>
      <CasinoContent />
    </SocketProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/preview" element={<ScreenshotPreview />} />
      <Route path="/preview-coinflip" element={<ScreenshotPreviewCoinflip />} />
      <Route path="/preview-profile" element={<ScreenshotPreviewProfile />} />
      <Route path="/preview-leaderboard" element={<ScreenshotPreviewLeaderboard />} />
      <Route path="/preview-fairness" element={<ScreenshotPreviewFairness />} />
      <Route path="/preview-auth" element={<ScreenshotPreviewAuth />} />
      <Route path="/preview-landing" element={<ScreenshotPreviewLanding />} />
      <Route
        path="/*"
        element={
          <CasinoUserProvider>
            <CasinoRoot />
          </CasinoUserProvider>
        }
      />
    </Routes>
  );
}
