import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { GameIcon, type GameIconId } from "./icons/GameIcons";
import { tabToPath, type GameTab } from "../hooks/useGameTab";

const PRIMARY_TABS: { id: GameTab; label: string; icon: GameIconId }[] = [
  { id: "crash", label: "Crash", icon: "crash" },
  { id: "limbo", label: "Limbo", icon: "limbo" },
  { id: "coinflip", label: "Flip", icon: "coinflip" },
];

const MORE_TABS: { id: GameTab; label: string; icon: GameIconId }[] = [
  { id: "leaderboard", label: "Ranks", icon: "leaderboard" },
  { id: "tournament", label: "Tourney", icon: "tournament" },
  { id: "token", label: "Token", icon: "wallet" },
  { id: "fairness", label: "Fairness", icon: "fairness" },
];

function tabFromPath(pathname: string): GameTab {
  const segment = pathname.replace(/^\//, "").split("/")[0] || "crash";
  const allowed = new Set<GameTab>([
    "crash",
    "limbo",
    "coinflip",
    "leaderboard",
    "tournament",
    "token",
    "fairness",
  ]);
  return allowed.has(segment as GameTab) ? (segment as GameTab) : "crash";
}

export function GuestMobileNav() {
  const location = useLocation();
  const activeTab = tabFromPath(location.pathname);
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_TABS.some((t) => t.id === activeTab);

  return (
    <>
      {moreOpen && (
        <div
          className="mobile-more-overlay"
          onClick={() => setMoreOpen(false)}
          role="presentation"
        />
      )}

      {moreOpen && (
        <div className="mobile-more-sheet" role="menu">
          {MORE_TABS.map((tab) => (
            <Link
              key={tab.id}
              to={tabToPath(tab.id)}
              role="menuitem"
              className={`mobile-more-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setMoreOpen(false)}
            >
              <GameIcon id={tab.icon} size={18} />
              {tab.label}
            </Link>
          ))}
        </div>
      )}

      <nav className="mobile-nav guest-mobile-nav" aria-label="Site navigation">
        {PRIMARY_TABS.map((tab) => (
          <Link
            key={tab.id}
            to={tabToPath(tab.id)}
            className={`mobile-nav-item ${activeTab === tab.id ? "active" : ""}`}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            <span className="mobile-nav-icon" aria-hidden="true">
              <GameIcon id={tab.icon} size={20} />
            </span>
            <span className="mobile-nav-label">{tab.label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`mobile-nav-item ${isMoreActive ? "active" : ""}`}
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-haspopup="menu"
        >
          <span className="mobile-nav-icon" aria-hidden="true">⋯</span>
          <span className="mobile-nav-label">More</span>
        </button>
      </nav>
    </>
  );
}
