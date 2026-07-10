import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

export type GameTab =
  | "crash"
  | "coinflip"
  | "limbo"
  | "leaderboard"
  | "tournament"
  | "fairness"
  | "profile"
  | "wallet"
  | "token"
  | "launch"
  | "admin";

const GAME_TABS = new Set<GameTab>([
  "crash",
  "coinflip",
  "limbo",
  "leaderboard",
  "tournament",
  "fairness",
  "profile",
  "wallet",
  "token",
  "launch",
  "admin",
]);

const TAB_PATHS: Record<GameTab, string> = {
  crash: "/crash",
  coinflip: "/coinflip",
  limbo: "/limbo",
  leaderboard: "/leaderboard",
  tournament: "/tournament",
  fairness: "/fairness",
  profile: "/profile",
  wallet: "/wallet",
  token: "/token",
  launch: "/launch",
  admin: "/admin",
};

const PATH_TO_TAB = new Map<string, GameTab>(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as GameTab]),
);

PATH_TO_TAB.set("/", "crash");
PATH_TO_TAB.set("/verify", "fairness");

export function parseGameTab(value: string | null): GameTab {
  if (value && GAME_TABS.has(value as GameTab)) {
    return value as GameTab;
  }
  return "crash";
}

export function tabToPath(tab: GameTab): string {
  return TAB_PATHS[tab];
}

export function pathToTab(pathname: string): GameTab {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return PATH_TO_TAB.get(normalized) ?? "crash";
}

/** Path-based game navigation with legacy `?tab=` redirect support. */
export function useGameTab() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const legacyTab = searchParams.get("tab");

  useEffect(() => {
    if (!legacyTab) return;
    const tab = parseGameTab(legacyTab);
    const target = tabToPath(tab);
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    const query = next.toString();
    navigate(query ? `${target}?${query}` : target, { replace: true });
  }, [legacyTab, navigate, searchParams]);

  const activeTab = useMemo(
    () => pathToTab(location.pathname),
    [location.pathname],
  );

  const setActiveTab = useCallback(
    (tab: GameTab) => {
      navigate(tabToPath(tab));
    },
    [navigate],
  );

  return { activeTab, setActiveTab };
}
