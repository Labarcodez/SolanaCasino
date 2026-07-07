import { useState } from "react";

type GameTab = "crash" | "coinflip" | "limbo" | "leaderboard" | "tournament" | "fairness" | "profile" | "admin";

interface MobileNavProps {
  activeTab: GameTab;
  onTabChange: (tab: GameTab) => void;
  showAdmin?: boolean;
}

const PRIMARY_TABS: { id: GameTab; label: string; icon: string }[] = [
  { id: "crash", label: "Crash", icon: "🚀" },
  { id: "limbo", label: "Limbo", icon: "🎯" },
  { id: "coinflip", label: "Flip", icon: "🪙" },
  { id: "tournament", label: "Race", icon: "⚔️" },
  { id: "profile", label: "Profile", icon: "👤" },
];

const MORE_TABS: { id: GameTab; label: string; icon: string; adminOnly?: boolean }[] = [
  { id: "leaderboard", label: "Leaderboard", icon: "🏆" },
  { id: "fairness", label: "Fairness", icon: "🔐" },
  { id: "admin", label: "Admin", icon: "⚙️", adminOnly: true },
];

export function MobileNav({ activeTab, onTabChange, showAdmin }: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTabs = MORE_TABS.filter((t) => !t.adminOnly || showAdmin);
  const isMoreActive = moreTabs.some((t) => t.id === activeTab);

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
          {moreTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="menuitem"
              className={`mobile-more-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => {
                onTabChange(tab.id);
                setMoreOpen(false);
              }}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <nav className="mobile-nav" aria-label="Game navigation">
        {PRIMARY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mobile-nav-item ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            <span className="mobile-nav-icon" aria-hidden="true">{tab.icon}</span>
            <span className="mobile-nav-label">{tab.label}</span>
          </button>
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
