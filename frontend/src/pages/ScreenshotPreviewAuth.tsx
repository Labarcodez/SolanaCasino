import { AnimatedBackground } from "../components/AnimatedBackground";
import { Landing } from "../components/Landing";

export function ScreenshotPreviewAuth() {
  return (
    <div className="app">
      <AnimatedBackground />
      <header className="header">
        <div className="container header-inner">
          <div className="logo">
            <div className="logo-icon">◎</div>
            <span>SolCasino</span>
          </div>
        </div>
      </header>
      <div className="auth-screen">
        <h2>Complete your profile</h2>
        <p>
          Your wallet is connected via Google. Sign a free message to create your
          casino profile — no SOL required.
        </p>
        <button type="button" className="btn btn-primary">
          Create profile &amp; play
        </button>
      </div>
    </div>
  );
}

export function ScreenshotPreviewLanding() {
  return (
    <div className="app">
      <AnimatedBackground />
      <header className="header">
        <div className="container header-inner">
          <div className="logo">
            <div className="logo-icon">◎</div>
            <span>SolCasino</span>
          </div>
        </div>
      </header>
      <Landing socialLoginEnabled onChainEnabled />
    </div>
  );
}
