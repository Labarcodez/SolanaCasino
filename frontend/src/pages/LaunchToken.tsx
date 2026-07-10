import { useState, useRef } from "react";
import { useCasino } from "../hooks/CasinoUserProvider";
import { useToast } from "../components/ui/Toast";
import { PageHeader } from "../components/PageHeader";
import { uploadTokenMetadata, registerLaunchedToken } from "../lib/api";
import { buildPumpCreateTransaction, getPumpFunUrl } from "../lib/pump";

export function LaunchTokenPage() {
  const { walletAddress, signAndSendTx, isAuthenticated } = useCasino();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("Orbit Casino");
  const [symbol, setSymbol] = useState("ORBIT");
  const [description, setDescription] = useState(
    "Official memecoin of Orbit Casino — play crash, limbo & coinflip on Solana.",
  );
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("https://orbit-casino.com");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImage = (file: File | null) => {
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast("Image must be under 512KB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLaunch = async () => {
    if (!walletAddress || !isAuthenticated) {
      toast("Connect wallet first", "error");
      return;
    }
    if (!imagePreview) {
      toast("Upload a square token image", "error");
      return;
    }

    setLoading(true);
    try {
      const { uri } = await uploadTokenMetadata({
        name,
        symbol,
        description,
        imageBase64: imagePreview,
        twitter: twitter || undefined,
        telegram: telegram || undefined,
        website: website || undefined,
      });

      const { transaction, mint } = await buildPumpCreateTransaction({
        name,
        symbol,
        uri,
        creator: walletAddress,
      });

      const { signature } = await signAndSendTx(transaction);
      await registerLaunchedToken(mint.publicKey.toBase58(), signature);

      toast("Token launched on Pump.fun!", "success", {
        label: "View on Pump.fun",
        href: getPumpFunUrl(mint.publicKey.toBase58()),
      });

      window.open(getPumpFunUrl(mint.publicKey.toBase58()), "_blank");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Launch failed", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="card card-glow">
        <PageHeader
          title="Launch Token"
          subtitle="Connect your wallet to launch on Pump.fun"
        />
        <p className="panel-hint">Sign in with Phantom to create your token.</p>
      </div>
    );
  }

  return (
    <div className="card card-glow launch-token-page">
      <PageHeader
        title="Launch on Pump.fun"
        subtitle="Create a memecoin with Token-2022 · you sign with Phantom"
      />

      <div className="launch-token-form">
        <div className="input-group">
          <label>Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            disabled={loading}
          />
        </div>
        <div className="input-group">
          <label>Symbol</label>
          <input
            className="input"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            maxLength={10}
            disabled={loading}
          />
        </div>
        <div className="input-group">
          <label>Description</label>
          <textarea
            className="input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            disabled={loading}
          />
        </div>
        <div className="input-group">
          <label>Image (512×512 PNG/JPG, max 512KB)</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => handleImage(e.target.files?.[0] ?? null)}
            disabled={loading}
          />
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="launch-token-preview" />
          )}
        </div>
        <div className="input-group">
          <label>Twitter (optional)</label>
          <input
            className="input"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="https://x.com/..."
            disabled={loading}
          />
        </div>
        <div className="input-group">
          <label>Telegram (optional)</label>
          <input
            className="input"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="input-group">
          <label>Website</label>
          <input
            className="input"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={loading}
          />
        </div>

        <p className="panel-hint launch-token-warning">
          Name, symbol, and image are immutable after launch. Review carefully
          before signing. No creation fee — you pay only Solana tx fees.
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleLaunch}
          disabled={loading}
        >
          {loading ? "Launching…" : "Launch token"}
        </button>
      </div>
    </div>
  );
}
