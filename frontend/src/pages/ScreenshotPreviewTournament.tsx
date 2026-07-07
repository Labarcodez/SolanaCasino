import { PreviewShell } from "../components/PreviewShell";
import { PageHeader } from "../components/PageHeader";

const MOCK_ENTRIES = [
  { rank: 1, name: "OrbitKing", wagered: "42.50", prize: "1.275" },
  { rank: 2, name: "SolWhale", wagered: "28.10", prize: "0.843" },
  { rank: 3, name: "7xKp...9mNq", wagered: "15.80", prize: "0.474" },
  { rank: 4, name: "CrashLord", wagered: "9.20", prize: "0.276" },
];

export function ScreenshotPreviewTournament() {
  return (
    <PreviewShell onChain balanceSol="1.2450 SOL">
      <div className="container">
        <nav className="nav-tabs">
          <button type="button" className="nav-tab">🚀 Crash</button>
          <button type="button" className="nav-tab">🎯 Limbo</button>
          <button type="button" className="nav-tab active">⚔️ Tournament</button>
        </nav>
      </div>

      <main className="main-content">
        <div className="container">
          <div className="card tournament-panel">
            <PageHeader
              title="Weekly Tournament"
              subtitle="Top wagerers split the prize pool — 1% of all bets feeds the pool"
            />
            <div className="tournament-hero">
              <div className="tournament-prize">
                <span className="tournament-prize-value">3.2500 SOL</span>
                <span className="tournament-prize-label">Prize pool</span>
              </div>
              <div className="tournament-timer">
                <span className="tournament-timer-value">4d 12h</span>
                <span className="tournament-timer-label">Remaining</span>
              </div>
            </div>
            <div className="table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Wagered</th>
                    <th>Est. Prize</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ENTRIES.map((e) => (
                    <tr key={e.rank}>
                      <td>#{e.rank}</td>
                      <td>{e.name}</td>
                      <td>{e.wagered} SOL</td>
                      <td className="text-success">{e.prize} SOL</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </PreviewShell>
  );
}
