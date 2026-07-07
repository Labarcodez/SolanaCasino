import { useState } from "react";
import { usePhantom } from "@phantom/react-sdk";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { CrashGame } from "./components/CrashGame";
import { CoinflipGame } from "./components/CoinflipGame";
import { WalletPanel } from "./components/WalletPanel";
import { Leaderboard } from "./components/Leaderboard";
import { BetHistoryPanel } from "./components/BetHistoryPanel";
import { useCasinoUser } from "./hooks/useCasinoUser";
import { SocketProvider, useSocket } from "./hooks/useSocket";
import { CASINO_WALLET } from "./lib/api";
import AuthCallback from "./pages/AuthCallback";

type GameTab = "crash" | "coinflip" | "leaderboard";

function CasinoApp() {
  const { isConnected } = usePhantom();
  const {
    walletAddress,
    profile,
    config,
    loading,
    error,
    deposit,
    withdraw,
    refresh,
  } = useCasinoUser();
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
        <Landing />
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
                walletAddress={walletAddress}
                balanceSol={balanceSol}
                minBetSol={config.minBetSol}
                maxBetSol={config.maxBetSol}
                onBalanceUpdate={handleBalanceUpdate}
              />
            )}
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
                onDeposit={async (amount) => {
                  return deposit(amount);
                }}
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

export default function App() {
  if (window.location.pathname === "/auth/callback") {
    return <AuthCallback />;
  }

  return (
    <SocketProvider>
      <CasinoApp />
    </SocketProvider>
  );
}
