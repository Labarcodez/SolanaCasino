import { useState } from "react";
import { verifyCrashFairness } from "../lib/api";
import { useSocket } from "../hooks/useSocket";

export function FairnessPanel() {
  const { crashState } = useSocket();
  const [serverSeed, setServerSeed] = useState("");
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [roundId, setRoundId] = useState("");
  const [crashPoint, setCrashPoint] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const fillFromLastRound = () => {
    if (!crashState?.serverSeed) return;
    setServerSeed(crashState.serverSeed);
    setServerSeedHash(crashState.serverSeedHash);
    setRoundId(crashState.id);
    setCrashPoint(String(crashState.crashPoint));
  };

  const handleVerify = async () => {
    setResult(null);
    try {
      const res = await verifyCrashFairness({
        serverSeed,
        serverSeedHash,
        roundId,
        crashPoint: parseFloat(crashPoint),
      });
      setResult(
        res.valid
          ? "✅ Verified — crash point is provably fair"
          : "❌ Verification failed — seeds do not match crash point",
      );
    } catch {
      setResult("❌ Verification error");
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">🔐 Provably Fair Verification</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 20 }}>
        Every crash round publishes a server seed hash before betting. After the
        round crashes, the server seed is revealed. You can verify the outcome was
        predetermined and fair.
      </p>

      {crashState?.serverSeed && (
        <button className="btn btn-outline btn-sm" onClick={fillFromLastRound} style={{ marginBottom: 16 }}>
          Fill from last crashed round
        </button>
      )}

      <div className="bet-controls">
        <div className="input-group">
          <label>Round ID</label>
          <input className="input" value={roundId} onChange={(e) => setRoundId(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Server Seed Hash (published before round)</label>
          <input className="input" value={serverSeedHash} onChange={(e) => setServerSeedHash(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Server Seed (revealed after crash)</label>
          <input className="input" value={serverSeed} onChange={(e) => setServerSeed(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Crash Point</label>
          <input className="input" type="number" step="0.01" value={crashPoint} onChange={(e) => setCrashPoint(e.target.value)} />
        </div>

        <button className="btn btn-primary" onClick={handleVerify}>
          Verify Round
        </button>

        {result && (
          <div className={`alert ${result.startsWith("✅") ? "alert-success" : "alert-error"}`}>
            {result}
          </div>
        )}
      </div>

      {crashState && (
        <div style={{ marginTop: 24, padding: 16, background: "var(--bg-primary)", borderRadius: 8 }}>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 8 }}>
            Current round hash (betting/running):
          </p>
          <code style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
            {crashState.serverSeedHash}
          </code>
        </div>
      )}
    </div>
  );
}
