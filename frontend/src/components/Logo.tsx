import { BRAND } from "../lib/brand";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const SIZES = { sm: 28, md: 36, lg: 52 };

export function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const px = SIZES[size];
  const fontSize = size === "sm" ? "1.1rem" : size === "lg" ? "1.65rem" : "1.35rem";

  return (
    <div className={`logo ${className}`} style={showText ? undefined : { gap: 0 }}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="logo-svg"
      >
        <circle cx="32" cy="32" r="22" stroke="url(#logoGrad)" strokeWidth="1" opacity="0.25" />
        <circle cx="32" cy="32" r="18" stroke="url(#logoGrad)" strokeWidth="2.5" fill="none" strokeDasharray="6 8" />
        <circle cx="32" cy="32" r="5" fill="url(#logoGrad)" />
        <circle cx="48" cy="18" r="3.5" fill="var(--solana-green)" />
        <circle cx="48" cy="18" r="1.5" fill="var(--bg-primary)" opacity="0.5" />
        <path d="M32 14 L32 10 M32 54 L32 50" stroke="url(#logoGrad)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <defs>
          <linearGradient id="logoGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--accent-bright)" />
            <stop offset="1" stopColor="var(--solana-green)" />
          </linearGradient>
        </defs>
      </svg>
      {showText && (
        <span className="logo-text" style={{ fontSize }}>
          {BRAND.name}
        </span>
      )}
    </div>
  );
}
