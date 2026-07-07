import { BRAND } from "../lib/brand";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const SIZES = { sm: 28, md: 36, lg: 48 };

export function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  const px = SIZES[size];
  const fontSize = size === "sm" ? "1.1rem" : size === "lg" ? "1.6rem" : "1.35rem";

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
        <circle cx="32" cy="32" r="18" stroke="url(#logoGrad)" strokeWidth="3" fill="none" strokeDasharray="4 6" />
        <circle cx="32" cy="32" r="6" fill="url(#logoGrad)" />
        <circle cx="48" cy="20" r="4" fill="var(--solana-green)" />
        <defs>
          <linearGradient id="logoGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--accent)" />
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
