import { useState } from "react";
import { verifyCrashFairness } from "../lib/api";
import { useSocket } from "../hooks/useSocket";
import { PageHeader } from "./PageHeader";

export function FairnessPanel() {
  const { crashState } = useSocket();
  const [serverSeed, setServerSeed] = useState("");
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [roundId, setRoundId] = useState("");
  const [crashPoint, setCrashPoint] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const fillFromLastRound = () => {
    if (!crashState?.serverSeed) return;
    setServerSeed(crashState.serverSeed);
    setServerSeedHash(crashState.serverSeedHash);
    setRoundId(crashState.id);
    setCrashPoint(String(crashState.crashPoint));
  };

  const handleVerify = async () => {
    setResult(null);
    setVerifying(true);
    try {
      const res = await verifyCrashFairness({
        serverSeed,
        serverSeedHash,
        roundId,
        crashPoint: parseFloat(crashPoint),
      });
      setResult(
        res.valid
          ? "Verified — crash point is provably fair"
          : "Verification failed — seeds do not match crash point",
      );
    } catch {
      setResult("Verification error — check your inputs");
    } finally {
      setVerifying(false);
    }
  };

  const verified = result?.startsWith("Verified");

  return (
    <div className="card">
      <PageHeader
        title="Provably Fair"
        subtitle="Every crash round publishes a server seed hash before betting. After the crash, the seed is revealed so you can verify the outcome was predetermined."
      />

      {crashState?.serverSeed && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={fillFromLastRound}
          style={{ marginBottom: 16 }}
        >
          Fill from last crashed round
        </button>
      )}

      <div className="bet-controls">
        <div className="input-group">
          <label htmlFor="fairness-round-id">Round ID</label>
          <input
            id="fairness-round-id"
            className="input"
            value={roundId}
            onChange={(e) => setRoundId(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label htmlFor="fairness-hash">Server Seed Hash (pre-round)</label>
          <input
            id="fairness-hash"
            className="input"
            value={serverSeedHash}
            onChange={(e) => setServerSeedHash(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label htmlFor="fairness-seed">Server Seed (post-crash)</label>
          <input
            id="fairness-seed"
            className="input"
            value={serverSeed}
            onChange={(e) => setServerSeed(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label htmlFor="fairness-crash">Crash Point</label>
          <input
            id="fairness-crash"
            className="input"
            type="number"
            step="0.01"
            value={crashPoint}
            onChange={(e) => setCrashPoint(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleVerify}
          disabled={verifying}
        >
          {verifying ? "Verifying..." : "Verify Round"}
        </button>

        {result && (
          <div
            className={`alert ${verified ? "alert-success" : "alert-error"}`}
            role="status"
          >
            {verified ? "✅ " : "❌ "}
            {result}
          </div>
        )}
      </div>

      {crashState && (
        <div className="fairness-live-box">
          <p className="fairness-live-label">Current round hash</p>
          <div className="fairness-seed-box">{crashState.serverSeedHash}</div>
        </div>
      )}
    </div>
  );
}
