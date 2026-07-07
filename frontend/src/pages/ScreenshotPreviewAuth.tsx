import { PreviewShell } from "../components/PreviewShell";
import { Landing } from "../components/Landing";
import { Logo } from "../components/Logo";
import { BRAND } from "../lib/brand";

export function ScreenshotPreviewAuth() {
  return (
    <PreviewShell>
      <div className="auth-screen">
        <div className="auth-card">
          <Logo size="lg" className="auth-card-logo" />
          <h2>Complete your profile</h2>
          <p>
            Your wallet is connected via Google. Sign a free message to create your
            {BRAND.name} profile — no SOL required.
          </p>
          <button type="button" className="btn btn-primary" style={{ width: "100%" }}>
            Create profile &amp; play
          </button>
        </div>
      </div>
    </PreviewShell>
  );
}

export function ScreenshotPreviewLanding() {
  return (
    <PreviewShell footer>
      <Landing socialLoginEnabled onChainEnabled />
    </PreviewShell>
  );
}
