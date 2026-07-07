type GameTab = "crash" | "coinflip" | "limbo" | "leaderboard" | "tournament" | "fairness" | "profile" | "admin";

interface MobileNavProps {
  activeTab: GameTab;
  onTabChange: (tab: GameTab) => void;
}

const TABS: { id: GameTab; label: string; icon: string }[] = [
  { id: "crash", label: "Crash", icon: "🚀" },
  { id: "limbo", label: "Limbo", icon: "🎯" },
  { id: "coinflip", label: "Flip", icon: "🪙" },
  { id: "tournament", label: "Race", icon: "⚔️" },
  { id: "profile", label: "Profile", icon: "👤" },
];

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  return (
    <nav className="mobile-nav" aria-label="Game navigation">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`mobile-nav-item ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          <span className="mobile-nav-icon">{tab.icon}</span>
          <span className="mobile-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
