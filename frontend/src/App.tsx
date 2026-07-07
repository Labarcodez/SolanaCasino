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
import { CASINO_WALLET } from "./lib/api";
import AuthCallback from "./pages/AuthCallback";
import { ScreenshotPreview } from "./pages/ScreenshotPreview";
import { ProfilePanel } from "./components/ProfilePanel";
import { ScreenshotPreviewCoinflip } from "./pages/ScreenshotPreviewCoinflip";
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
        <Footer />
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
          <h2>Complete your profile</h2>
          <p>
            Your wallet is connected
            {authProvider === "google" || authProvider === "apple"
              ? ` via ${authProvider === "google" ? "Google" : "Apple"}`
              : ""}
            . Sign a free message to create your casino profile — no SOL
            required.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => authenticate().catch(console.error)}
            disabled={authLoading}
          >
            {authLoading ? "Signing..." : "Create profile & play"}
          </button>
          {authError && <div className="alert alert-error">{authError}</div>}
        </div>
        <Footer />
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
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p>
          SolCasino — Real SOL gambling on Solana. Provably fair games. Gamble
          responsibly.
        </p>
        <p className="footer-link">
          <a
            href={`https://solscan.io/account/${CASINO_WALLET}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Casino Wallet on Solscan
          </a>
        </p>
      </div>
    </footer>
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
