import { useState } from "react";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { CrashGame } from "./components/CrashGame";
import { CoinflipGame } from "./components/CoinflipGame";
import { WalletPanel } from "./components/WalletPanel";
import { Leaderboard } from "./components/Leaderboard";
import { BetHistoryPanel } from "./components/BetHistoryPanel";
import { FairnessPanel } from "./components/FairnessPanel";
import { useCasino, CasinoUserProvider } from "./hooks/CasinoUserProvider";
import { SocketProvider, useSocket } from "./hooks/useSocket";
import { CASINO_WALLET } from "./lib/api";
import AuthCallback from "./pages/AuthCallback";
import { ScreenshotPreview } from "./pages/ScreenshotPreview";
import { ScreenshotPreviewCoinflip } from "./pages/ScreenshotPreviewCoinflip";

type GameTab = "crash" | "coinflip" | "leaderboard" | "fairness";

function CasinoContent() {
  const {
    isConnected,
    isAuthenticated,
    authLoading,
    authError,
    authenticate,
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

  const balanceSol = localBalance ?? profile?.balanceSol ?? 0;

  const handleBalanceUpdate = (balance: number) => {
    setLocalBalance(balance);
    refresh();
  };

  if (!isConnected || !walletAddress) {
    return (
      <div className="app">
        <Header connected={false} />
        <Landing socialLoginEnabled={config?.socialLoginEnabled} />
        <Footer />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <Header connected={true} />
        <div className="landing" style={{ minHeight: "60vh" }}>
          <h2 style={{ marginBottom: 16 }}>Sign in to play</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            Sign a message with your wallet to verify ownership. This is free and
            does not send any SOL.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => authenticate().catch(console.error)}
            disabled={authLoading}
          >
            {authLoading ? "Signing..." : "Sign In with Wallet"}
          </button>
          {authError && (
            <div className="alert alert-error" style={{ marginTop: 16 }}>
              {authError}
            </div>
          )}
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="app">
      <Header balanceSol={balanceSol} connected={true} />

      <div className="container">
        <nav className="nav-tabs">
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
        <div className="container game-grid">
          <div>
            {activeTab === "crash" && config && (
              <CrashGame
                balanceSol={balanceSol}
                minBetSol={config.minBetSol}
                maxBetSol={config.maxBetSol}
                onBalanceUpdate={handleBalanceUpdate}
              />
            )}
            {activeTab === "coinflip" && config && walletAddress && (
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
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {config && profile && (
              <WalletPanel
                balanceSol={balanceSol}
                onChainBalanceSol={profile.onChainBalanceSol}
                minBetSol={config.minBetSol}
                minWithdrawSol={config.minWithdrawSol}
                withdrawalsEnabled={config.withdrawalsEnabled}
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
            {walletAddress && <BetHistoryPanel walletAddress={walletAddress} />}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p>
          SolCasino — Real SOL gambling on Solana mainnet. Provably fair games.
          Gamble responsibly.
        </p>
        <p style={{ marginTop: 8 }}>
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
  if (window.location.pathname === "/auth/callback") {
    return <AuthCallback />;
  }

  if (window.location.pathname === "/preview") {
    return <ScreenshotPreview />;
  }

  if (window.location.pathname === "/preview-coinflip") {
    return <ScreenshotPreviewCoinflip />;
  }

  return (
    <CasinoUserProvider>
      <CasinoRoot />
    </CasinoUserProvider>
  );
}
