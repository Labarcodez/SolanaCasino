import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { verifyCrashFairness, verifyLimboFairness } from "../lib/api";
import { useSocket } from "../hooks/useSocket";
import { PageHeader } from "./PageHeader";

type FairnessTab = "crash" | "limbo" | "coinflip";

interface FairnessPanelProps {
  embedded?: boolean;
  initialGame?: FairnessTab;
}

export function FairnessPanel({
  embedded = false,
  initialGame = "crash",
}: FairnessPanelProps) {
  const { crashState } = useSocket();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<FairnessTab>(initialGame);
  const [serverSeed, setServerSeed] = useState("");
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [roundId, setRoundId] = useState("");
  const [crashPoint, setCrashPoint] = useState("");
  const [betId, setBetId] = useState("");
  const [clientSeed, setClientSeed] = useState("");
  const [targetMultiplier, setTargetMultiplier] = useState("2");
  const [expectedWon, setExpectedWon] = useState(true);
  const [coinflipExpected, setCoinflipExpected] = useState<"heads" | "tails">("heads");
  const [result, setResult] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setTab(initialGame);
  }, [initialGame]);

  useEffect(() => {
    const verify = searchParams.get("verify");
    if (verify === "crash" || verify === "limbo" || verify === "coinflip") {
      setTab(verify);
    }
    const seed = searchParams.get("serverSeed");
    const hash = searchParams.get("serverSeedHash");
    const rid = searchParams.get("roundId");
    const bid = searchParams.get("betId");
    const cs = searchParams.get("clientSeed");
    const cp = searchParams.get("crashPoint");
    const target = searchParams.get("target");
    if (seed) setServerSeed(seed);
    if (hash) setServerSeedHash(hash);
    if (rid) setRoundId(rid);
    if (bid) setBetId(bid);
    if (cs) setClientSeed(cs);
    if (cp) setCrashPoint(cp);
    if (target) setTargetMultiplier(target);
  }, [searchParams]);

  const fillFromLastRound = () => {
    if (!crashState?.serverSeed) return;
    setServerSeed(crashState.serverSeed);
    setServerSeedHash(crashState.serverSeedHash);
    setRoundId(crashState.id);
    setCrashPoint(String(crashState.crashPoint));
  };

  const handleVerifyCrash = async () => {
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

  const handleVerifyLimbo = async () => {
    setResult(null);
    setVerifying(true);
    try {
      const res = await verifyLimboFairness({
        serverSeed,
        betId,
        clientSeed,
        targetMultiplier: parseFloat(targetMultiplier),
        expectedWon,
      });
      setResult(
        res.valid
          ? `Verified — roll ${res.roll}, outcome ${res.won ? "WIN" : "LOSS"}`
          : `Verification failed — roll ${res.roll}, expected ${expectedWon ? "win" : "loss"}`,
      );
    } catch {
      setResult("Verification error — check your inputs");
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyCoinflip = async () => {
    setResult(null);
    setVerifying(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/fairness/verify-coinflip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverSeed,
          betId,
          clientSeed,
          expectedResult: coinflipExpected,
        }),
      });
      const data = await res.json();
      setResult(
        data.valid
          ? `Verified — result was ${data.result}`
          : `Failed — computed ${data.result}, expected ${coinflipExpected}`,
      );
    } catch {
      setResult("Verification error");
    } finally {
      setVerifying(false);
    }
  };

  const verified = result?.startsWith("Verified");

  return (
    <div className={`card ${embedded ? "fairness-panel-embedded" : ""}`.trim()}>
      {!embedded && (
        <PageHeader
          title="Provably Fair"
          subtitle="Independently verify any game outcome using published seeds"
        />
      )}

      <div className="fairness-tabs">
        {(["crash", "limbo", "coinflip"] as FairnessTab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`nav-tab ${tab === t ? "active" : ""}`}
            onClick={() => { setTab(t); setResult(null); }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "crash" && (
        <>
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
              <label>Round ID</label>
              <input className="input" value={roundId} onChange={(e) => setRoundId(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Server Seed Hash</label>
              <input className="input" value={serverSeedHash} onChange={(e) => setServerSeedHash(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Server Seed</label>
              <input className="input" value={serverSeed} onChange={(e) => setServerSeed(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Crash Point</label>
              <input className="input" type="number" step="0.01" value={crashPoint} onChange={(e) => setCrashPoint(e.target.value)} />
            </div>
            <button type="button" className="btn btn-primary" onClick={handleVerifyCrash} disabled={verifying}>
              {verifying ? "Verifying..." : "Verify Crash"}
            </button>
          </div>
        </>
      )}

      {tab === "limbo" && (
        <div className="bet-controls">
          <div className="input-group">
            <label>Bet ID</label>
            <input className="input" value={betId} onChange={(e) => setBetId(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Server Seed</label>
            <input className="input" value={serverSeed} onChange={(e) => setServerSeed(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Client Seed</label>
            <input className="input" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Target Multiplier</label>
            <input className="input" type="number" step="0.01" value={targetMultiplier} onChange={(e) => setTargetMultiplier(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Expected outcome</label>
            <select
              className="input"
              value={expectedWon ? "win" : "loss"}
              onChange={(e) => setExpectedWon(e.target.value === "win")}
            >
              <option value="win">Win</option>
              <option value="loss">Loss</option>
            </select>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleVerifyLimbo} disabled={verifying}>
            {verifying ? "Verifying..." : "Verify Limbo"}
          </button>
        </div>
      )}

      {tab === "coinflip" && (
        <div className="bet-controls">
          <div className="input-group">
            <label>Bet ID</label>
            <input className="input" value={betId} onChange={(e) => setBetId(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Server Seed</label>
            <input className="input" value={serverSeed} onChange={(e) => setServerSeed(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Client Seed</label>
            <input className="input" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Expected result</label>
            <select
              className="input"
              value={coinflipExpected}
              onChange={(e) => setCoinflipExpected(e.target.value as "heads" | "tails")}
            >
              <option value="heads">Heads</option>
              <option value="tails">Tails</option>
            </select>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleVerifyCoinflip} disabled={verifying}>
            {verifying ? "Verifying..." : "Verify Coinflip"}
          </button>
        </div>
      )}

      {result && (
        <div className={`alert ${verified ? "alert-success" : "alert-error"}`} role="status">
          {verified ? "✅ " : "❌ "}
          {result}
        </div>
      )}

      {crashState && tab === "crash" && (
        <div className="fairness-live-box">
          <p className="fairness-live-label">Current round hash</p>
          <div className="fairness-seed-box">{crashState.serverSeedHash}</div>
        </div>
      )}
    </div>
  );
}
