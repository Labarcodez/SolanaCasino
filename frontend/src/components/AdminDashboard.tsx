import { useCallback, useEffect, useState } from "react";
import { useCasino } from "../hooks/CasinoUserProvider";
import {
  fetchAdminActivity,
  fetchAdminAnalytics,
  fetchAdminDashboard,
  fetchAdminUsers,
  setCasinoPaused,
  processWithdrawal,
  type AdminActivityItem,
  type AdminAnalytics,
  type AdminDashboard,
  type AdminPeriod,
  type AdminUserBalance,
} from "../lib/api";
import { solscanAccountUrl, solscanTxUrl, shortenAddress } from "../lib/utils";
import { useToast } from "./ui/Toast";
import { PageHeader } from "./PageHeader";

const USERS_PAGE_SIZE = 50;
const ACTIVITY_PAGE_SIZE = 40;

type AdminTab = "overview" | "profit" | "activity" | "players";

const PERIOD_LABELS: Record<AdminPeriod, string> = {
  "1d": "24h",
  "7d": "7 days",
  "30d": "30 days",
  all: "All time",
};

const TABS: { id: AdminTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "profit", label: "Profit" },
  { id: "activity", label: "Activity" },
  { id: "players", label: "Players" },
];

function formatSol(value: number, digits = 4): string {
  return `${value.toFixed(digits)} SOL`;
}

function profitClass(value: number): string {
  if (value > 0) return "admin-pnl-positive";
  if (value < 0) return "admin-pnl-negative";
  return "";
}

function activityTypeLabel(type: AdminActivityItem["type"]): string {
  if (type === "bet") return "Bet";
  if (type === "deposit") return "Deposit";
  return "Withdrawal";
}

function ProfitStat({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div className={`admin-stat${emphasize ? " admin-stat--emphasis" : ""}`}>
      <span className="admin-stat-label">{label}</span>
      <span className="admin-stat-value">{value}</span>
      {hint && <span className="admin-stat-hint">{hint}</span>}
    </div>
  );
}

export function AdminDashboard() {
  const { walletAddress } = useCasino();
  const { toast } = useToast();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [period, setPeriod] = useState<AdminPeriod>("7d");
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [activity, setActivity] = useState<AdminActivityItem[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityOffset, setActivityOffset] = useState(0);
  const [activityFilter, setActivityFilter] = useState<
    "all" | "bet" | "deposit" | "withdrawal"
  >("all");
  const [activityWallet, setActivityWallet] = useState<string | null>(null);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [users, setUsers] = useState<AdminUserBalance[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userOffset, setUserOffset] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadUsers = useCallback(
    async (offset = userOffset, search = userSearch) => {
      setUsersLoading(true);
      try {
        const result = await fetchAdminUsers({
          limit: USERS_PAGE_SIZE,
          offset,
          search: search.trim() || undefined,
        });
        setUsers(result.users);
        setUsersTotal(result.total);
        setUserOffset(offset);
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Failed to load user balances",
          "error",
        );
      } finally {
        setUsersLoading(false);
      }
    },
    [toast, userOffset, userSearch],
  );

  const loadAnalytics = useCallback(
    async (p: AdminPeriod) => {
      setAnalyticsLoading(true);
      try {
        setAnalytics(await fetchAdminAnalytics(p));
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Failed to load analytics",
          "error",
        );
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [toast],
  );

  const loadActivity = useCallback(
    async (
      options?: {
        offset?: number;
        append?: boolean;
        type?: "all" | "bet" | "deposit" | "withdrawal";
        wallet?: string | null;
      },
    ) => {
      const offset = options?.offset ?? 0;
      const append = options?.append ?? false;
      const type = options?.type ?? activityFilter;
      const wallet =
        options?.wallet !== undefined ? options.wallet : activityWallet;
      setActivityLoading(true);
      try {
        const page = await fetchAdminActivity({
          limit: ACTIVITY_PAGE_SIZE,
          offset,
          type,
          wallet: wallet ?? undefined,
        });
        setActivity((prev) =>
          append ? [...prev, ...page.items] : page.items,
        );
        setActivityTotal(page.total);
        setActivityOffset(offset);
        setActivityHasMore(page.hasMore);
        if (options?.type) setActivityFilter(options.type);
        if (options?.wallet !== undefined) setActivityWallet(options.wallet);
      } catch (err) {
        toast(
          err instanceof Error ? err.message : "Failed to load activity",
          "error",
        );
      } finally {
        setActivityLoading(false);
      }
    },
    [activityFilter, activityWallet, toast],
  );

  const viewPlayerActivity = (wallet: string) => {
    setTab("activity");
    setActivityFilter("all");
    setActivityWallet(wallet);
    void loadActivity({ offset: 0, type: "all", wallet });
  };

  const loadDashboard = async () => {
    try {
      const dashboard = await fetchAdminDashboard();
      setData(dashboard);
      await loadUsers(0, userSearch);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Admin load failed", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (tab === "profit") {
      void loadAnalytics(period);
    }
  }, [tab, period, loadAnalytics]);

  useEffect(() => {
    if (tab === "activity") {
      void loadActivity({ offset: 0, type: activityFilter });
    }
  }, [tab, activityFilter, loadActivity]);

  const handleRefresh = () => {
    void loadDashboard();
    if (tab === "profit") void loadAnalytics(period);
    if (tab === "activity") void loadActivity({ offset: 0, type: activityFilter });
    if (tab === "players") void loadUsers(userOffset, userSearch);
  };

  const handleProcessWithdrawal = async (id: string) => {
    setProcessingId(id);
    try {
      const result = await processWithdrawal(id);
      toast("Withdrawal processed", "success", {
        label: "View tx",
        href: solscanTxUrl(result.signature),
      });
      await loadDashboard();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Processing failed", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const togglePause = async () => {
    if (!data) return;
    setPausing(true);
    try {
      await setCasinoPaused(!data.casinoPaused);
      toast(data.casinoPaused ? "Casino resumed" : "Casino paused", "success");
      await loadDashboard();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Pause toggle failed", "error");
    } finally {
      setPausing(false);
    }
  };

  const handleSearchUsers = (event: React.FormEvent) => {
    event.preventDefault();
    void loadUsers(0, userSearch);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="spinner" />
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <p>Admin access denied or unavailable.</p>
      </div>
    );
  }

  const treasury = data.treasury;
  const profitView = tab === "profit" ? analytics : null;

  return (
    <div className="card card-glow admin-dashboard" data-testid="admin-dashboard">
      <PageHeader
        title="Admin Dashboard"
        subtitle={`Operator controls · ${walletAddress?.slice(0, 8)}...`}
        action={
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleRefresh}
          >
            Refresh
          </button>
        }
      />

      <div className="admin-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`btn btn-sm ${tab === t.id ? "btn-primary" : "btn-outline"}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profit" && (
        <div className="admin-period-filters" role="group" aria-label="Time period">
          {(Object.keys(PERIOD_LABELS) as AdminPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`btn btn-sm ${period === p ? "btn-primary" : "btn-outline"}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      )}

      {tab === "overview" && (
        <>
          <section className="admin-treasury-panel" data-testid="admin-treasury-panel">
            <h4>Treasury reconciliation</h4>
            <p className="panel-hint">
              On-chain treasury vs player liabilities. Surplus should stay positive.
            </p>
            <div className="admin-stats-grid admin-stats-grid--treasury">
              <ProfitStat
                label="Treasury (on-chain)"
                value={formatSol(treasury.treasuryBalanceSol)}
                hint={shortenAddress(treasury.casinoWallet)}
              />
              <ProfitStat
                label="Player balances"
                value={formatSol(treasury.totalUserBalancesSol)}
              />
              <ProfitStat
                label="Pending withdrawals"
                value={formatSol(treasury.pendingWithdrawalsSol)}
              />
              <ProfitStat
                label="Total liabilities"
                value={formatSol(treasury.totalLiabilitiesSol)}
              />
              <div
                className={`admin-stat admin-stat--${treasury.solvent ? "ok" : "warn"}`}
              >
                <span className="admin-stat-label">Treasury surplus</span>
                <span className="admin-stat-value">
                  {formatSol(treasury.treasurySurplusSol)}
                </span>
                <span className="admin-stat-hint">
                  {treasury.solvent ? "Solvent" : "Under-funded — add SOL"}
                </span>
              </div>
            </div>
          </section>

          <section className="admin-section">
            <h4>House profit snapshot</h4>
            <div className="admin-stats-grid">
              <div className="admin-stat admin-stat--emphasis">
                <span className="admin-stat-label">Net profit (24h)</span>
                <span className={`admin-stat-value ${profitClass(data.netProfit24hSol)}`}>
                  {formatSol(data.netProfit24hSol)}
                </span>
              </div>
              <div className="admin-stat admin-stat--emphasis">
                <span className="admin-stat-label">Net profit (7d)</span>
                <span className={`admin-stat-value ${profitClass(data.netProfit7dSol)}`}>
                  {formatSol(data.netProfit7dSol)}
                </span>
              </div>
              <div className="admin-stat admin-stat--emphasis">
                <span className="admin-stat-label">Net profit (all time)</span>
                <span
                  className={`admin-stat-value ${profitClass(data.netProfitAllTimeSol)}`}
                >
                  {formatSol(data.netProfitAllTimeSol)}
                </span>
              </div>
              <ProfitStat label="24h Handle" value={formatSol(data.handle24hSol)} />
              <ProfitStat
                label="24h Gross"
                value={formatSol(data.grossRevenue24hSol)}
              />
              <ProfitStat label="Users" value={String(data.totalUsers)} />
              <ProfitStat label="Total bets" value={String(data.totalBets)} />
              <ProfitStat
                label="7d deposits"
                value={formatSol(data.flow7d.depositsSol)}
                hint={`${data.flow7d.depositCount} txs`}
              />
              <ProfitStat
                label="7d withdrawals"
                value={formatSol(data.flow7d.withdrawalsSol)}
                hint={`${data.flow7d.withdrawalCount} txs`}
              />
            </div>
          </section>

          {data.games7d.length > 0 && (
            <section className="admin-section">
              <h4>Game mix (7 days)</h4>
              <div className="admin-table admin-table--games">
                <div className="admin-table-row admin-table-row-header admin-table-row-games">
                  <span>Game</span>
                  <span>Bets</span>
                  <span>Handle</span>
                  <span>House profit</span>
                  <span>Win %</span>
                </div>
                {data.games7d.map((g) => (
                  <div key={g.game} className="admin-table-row admin-table-row-games">
                    <span style={{ textTransform: "capitalize" }}>{g.game}</span>
                    <span>{g.betCount}</span>
                    <span>{formatSol(g.handleSol)}</span>
                    <span className={profitClass(g.grossProfitSol)}>
                      {formatSol(g.grossProfitSol)}
                    </span>
                    <span>{g.winRatePercent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="admin-controls">
            <div className="admin-control-row">
              <div>
                <strong>Casino Status</strong>
                <p className="text-muted">
                  {data.casinoPaused ? "Paused — no new bets" : "Live — accepting bets"}
                </p>
              </div>
              <button
                type="button"
                className={`btn ${data.casinoPaused ? "btn-success" : "btn-danger"}`}
                onClick={() => void togglePause()}
                disabled={pausing}
              >
                {data.casinoPaused ? "Resume Casino" : "Pause Casino"}
              </button>
            </div>
            <div className="admin-control-row">
              <div>
                <strong>Withdrawals</strong>
                <p className="text-muted">
                  {data.withdrawalsEnabled ? "Enabled" : "Queued mode"}
                </p>
              </div>
              <span className="badge">{data.pendingWithdrawals.length} pending</span>
            </div>
          </div>

          {data.pendingWithdrawals.length > 0 && (
            <div className="admin-withdrawals">
              <h4>Pending Withdrawals</h4>
              <div className="admin-table">
                {data.pendingWithdrawals.map((w) => (
                  <div key={w.id} className="admin-table-row admin-table-row-actions">
                    <span className="mono-cell">{w.walletAddress.slice(0, 8)}...</span>
                    <span>{formatSol(w.amountSol)}</span>
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      disabled={!data.withdrawalsEnabled || processingId === w.id}
                      onClick={() => void handleProcessWithdrawal(w.id)}
                    >
                      {processingId === w.id ? "Sending..." : "Process"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "profit" && (
        <section className="admin-section" data-testid="admin-profit-panel">
          {analyticsLoading && !profitView ? (
            <p className="panel-hint">Loading profit analytics…</p>
          ) : profitView ? (
            <>
              <div className="admin-stats-grid">
                <div className="admin-stat admin-stat--emphasis">
                  <span className="admin-stat-label">
                    Net house profit ({PERIOD_LABELS[profitView.period]})
                  </span>
                  <span
                    className={`admin-stat-value ${profitClass(profitView.profit.netProfitSol)}`}
                  >
                    {formatSol(profitView.profit.netProfitSol)}
                  </span>
                  <span className="admin-stat-hint">
                    After rakeback, affiliate, jackpot & tournament payouts
                  </span>
                </div>
                <ProfitStat
                  label="Gross from bets"
                  value={formatSol(profitView.profit.grossProfitSol)}
                />
                <ProfitStat
                  label="Handle"
                  value={formatSol(profitView.profit.handleSol)}
                  hint={`${profitView.profit.betCount} bets`}
                />
                <ProfitStat
                  label="Effective hold"
                  value={`${profitView.profit.effectiveHoldPercent.toFixed(2)}%`}
                />
                <ProfitStat
                  label="Rakeback paid"
                  value={formatSol(profitView.profit.rakebackPaidSol)}
                />
                <ProfitStat
                  label="Affiliate paid"
                  value={formatSol(profitView.profit.affiliatePaidSol)}
                />
                <ProfitStat
                  label="Jackpot paid"
                  value={formatSol(profitView.profit.jackpotPaidSol)}
                />
                <ProfitStat
                  label="Tournament paid"
                  value={formatSol(profitView.profit.tournamentPaidSol)}
                />
              </div>

              <div className="admin-stats-grid admin-stats-grid--flow">
                <ProfitStat
                  label="Deposits in"
                  value={formatSol(profitView.flow.depositsSol)}
                  hint={`${profitView.flow.depositCount} deposits`}
                />
                <ProfitStat
                  label="Withdrawals out"
                  value={formatSol(profitView.flow.withdrawalsSol)}
                  hint={`${profitView.flow.withdrawalCount} withdrawals`}
                />
                <ProfitStat
                  label="Net deposit flow"
                  value={formatSol(profitView.flow.netDepositSol)}
                />
                <ProfitStat
                  label="Active players"
                  value={String(profitView.players.activeInPeriod)}
                  hint={`${profitView.players.newInPeriod} new · ${profitView.players.total} total`}
                />
              </div>

              {profitView.games.length > 0 && (
                <>
                  <h4>Profit by game</h4>
                  <div className="admin-table admin-table--games">
                    <div className="admin-table-row admin-table-row-header admin-table-row-games">
                      <span>Game</span>
                      <span>Bets</span>
                      <span>Handle</span>
                      <span>House profit</span>
                      <span>Player win %</span>
                    </div>
                    {profitView.games.map((g) => (
                      <div key={g.game} className="admin-table-row admin-table-row-games">
                        <span style={{ textTransform: "capitalize" }}>{g.game}</span>
                        <span>{g.betCount}</span>
                        <span>{formatSol(g.handleSol)}</span>
                        <span className={profitClass(g.grossProfitSol)}>
                          {formatSol(g.grossProfitSol)}
                        </span>
                        <span>{g.winRatePercent.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="admin-leaderboards">
                <div className="admin-leaderboard-col">
                  <h4>Top winners</h4>
                  {profitView.topWinners.length === 0 ? (
                    <p className="panel-hint">No bets in this period.</p>
                  ) : (
                    profitView.topWinners.map((p) => (
                      <div key={p.walletAddress} className="admin-leader-row">
                        <a
                          href={solscanAccountUrl(p.walletAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mono-cell"
                        >
                          {p.displayName ?? shortenAddress(p.walletAddress)}
                        </a>
                        <span className="admin-pnl-positive">
                          +{formatSol(p.netPnlSol)}
                        </span>
                        <span className="panel-hint">{p.betCount} bets</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="admin-leaderboard-col">
                  <h4>Top losers</h4>
                  {profitView.topLosers.length === 0 ? (
                    <p className="panel-hint">No bets in this period.</p>
                  ) : (
                    profitView.topLosers.map((p) => (
                      <div key={p.walletAddress} className="admin-leader-row">
                        <a
                          href={solscanAccountUrl(p.walletAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mono-cell"
                        >
                          {p.displayName ?? shortenAddress(p.walletAddress)}
                        </a>
                        <span className="admin-pnl-negative">
                          {formatSol(p.netPnlSol)}
                        </span>
                        <span className="panel-hint">{p.betCount} bets</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : null}
        </section>
      )}

      {tab === "activity" && (
        <section className="admin-section" data-testid="admin-activity-panel">
          {activityWallet && (
            <div className="admin-activity-wallet-banner">
              <span>
                Showing activity for{" "}
                <strong className="mono-cell">{shortenAddress(activityWallet)}</strong>
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setActivityWallet(null);
                  void loadActivity({ offset: 0, wallet: null });
                }}
              >
                Clear filter
              </button>
            </div>
          )}
          <div className="admin-activity-filters" role="tablist">
            {(["all", "bet", "deposit", "withdrawal"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={activityFilter === f}
                className={`btn btn-sm ${activityFilter === f ? "btn-primary" : "btn-outline"}`}
                onClick={() => setActivityFilter(f)}
              >
                {f === "all" ? "All" : activityTypeLabel(f)}
              </button>
            ))}
          </div>

          {activityLoading && activity.length === 0 ? (
            <p className="panel-hint">Loading activity…</p>
          ) : activity.length === 0 ? (
            <p className="panel-hint">No activity recorded yet.</p>
          ) : (
            <>
              <div className="admin-activity-feed">
                {activity.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className={`admin-activity-row admin-activity-row--${item.type}`}
                  >
                    <span className={`admin-activity-type admin-activity-type--${item.type}`}>
                      {activityTypeLabel(item.type)}
                    </span>
                    <span className="admin-activity-player">
                      <a
                        href={solscanAccountUrl(item.walletAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono-cell"
                      >
                        {item.displayName ?? shortenAddress(item.walletAddress)}
                      </a>
                    </span>
                    <span className="admin-activity-detail">{item.detail}</span>
                    <span className="admin-activity-amount">
                      {item.type === "bet" && item.payoutSol != null ? (
                        <>
                          {formatSol(item.amountSol)} →{" "}
                          <span
                            className={
                              item.payoutSol > item.amountSol
                                ? "admin-pnl-positive"
                                : "text-muted"
                            }
                          >
                            {formatSol(item.payoutSol)}
                          </span>
                        </>
                      ) : (
                        <span
                          className={
                            item.type === "deposit" ? "admin-pnl-positive" : ""
                          }
                        >
                          {item.type === "deposit" ? "+" : "−"}
                          {formatSol(item.amountSol)}
                        </span>
                      )}
                    </span>
                    <span className="admin-activity-time text-muted">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="admin-users-pagination">
                <span className="panel-hint">
                  Showing {activity.length} of {activityTotal} events
                </span>
                {activityHasMore && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={activityLoading}
                    onClick={() =>
                      void loadActivity({
                        offset: activityOffset + ACTIVITY_PAGE_SIZE,
                        append: true,
                        type: activityFilter,
                      })
                    }
                  >
                    {activityLoading ? "Loading…" : "Load more"}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "players" && (
        <section className="admin-users-panel" data-testid="admin-users-panel">
          <div className="admin-profit-hint">
            <p>
              <strong>How to read profit:</strong>{" "}
              <span className="admin-pnl-negative">Red player PnL</span> means they lost —{" "}
              <span className="admin-pnl-positive">you gained</span> that amount.{" "}
              <span className="admin-pnl-positive">Green player PnL</span> means they won more
              than they wagered (house loss).
            </p>
            <p>
              All-time house net profit:{" "}
              <strong className={profitClass(data.netProfitAllTimeSol)}>
                {formatSol(data.netProfitAllTimeSol)}
              </strong>
              {" · "}
              <button
                type="button"
                className="btn-link"
                onClick={() => setTab("profit")}
              >
                Open Profit tab
              </button>
              {" · "}
              <button
                type="button"
                className="btn-link"
                onClick={() => setTab("activity")}
              >
                See every bet in Activity
              </button>
            </p>
          </div>

          <div className="admin-users-header">
            <h4>Player balances ({usersTotal})</h4>
            <form className="admin-users-search" onSubmit={handleSearchUsers}>
              <input
                className="input"
                type="search"
                placeholder="Search wallet or name"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                aria-label="Search players"
              />
              <button type="submit" className="btn btn-outline btn-sm">
                Search
              </button>
            </form>
          </div>

          {usersLoading ? (
            <p className="panel-hint">Loading balances…</p>
          ) : users.length === 0 ? (
            <p className="panel-hint">No players match this search.</p>
          ) : (
            <>
              <div className="admin-table admin-table--users">
                <div className="admin-table-row admin-table-row-header admin-table-row-users">
                  <span>Player</span>
                  <span>Balance</span>
                  <span>Wagered</span>
                  <span>Won</span>
                  <span title="Player profit/loss (won − wagered)">Player PnL</span>
                  <span title="Your profit from this player (opposite of player PnL)">
                    House profit
                  </span>
                </div>
                {users.map((user) => {
                  const houseProfit = -user.netPnlSol;
                  return (
                  <div key={user.walletAddress} className="admin-table-row admin-table-row-users">
                    <span className="admin-user-cell">
                      <button
                        type="button"
                        className="admin-player-link"
                        onClick={() => viewPlayerActivity(user.walletAddress)}
                        title="View this player's activity"
                      >
                        {user.displayName ?? shortenAddress(user.walletAddress)}
                      </button>
                      <a
                        href={solscanAccountUrl(user.walletAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-user-wallet mono-cell"
                      >
                        {shortenAddress(user.walletAddress)}
                      </a>
                    </span>
                    <span>{formatSol(user.balanceSol)}</span>
                    <span>{formatSol(user.totalWageredSol)}</span>
                    <span>{formatSol(user.totalWonSol)}</span>
                    <span className={profitClass(user.netPnlSol)}>
                      {user.netPnlSol >= 0 ? "+" : ""}
                      {formatSol(user.netPnlSol)}
                    </span>
                    <span className={profitClass(houseProfit)}>
                      {houseProfit >= 0 ? "+" : ""}
                      {formatSol(houseProfit)}
                    </span>
                  </div>
                  );
                })}
              </div>
              <div className="admin-users-pagination">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={userOffset === 0}
                  onClick={() =>
                    void loadUsers(Math.max(0, userOffset - USERS_PAGE_SIZE))
                  }
                >
                  Previous
                </button>
                <span className="panel-hint">
                  {userOffset + 1}–{Math.min(userOffset + USERS_PAGE_SIZE, usersTotal)} of{" "}
                  {usersTotal}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={userOffset + USERS_PAGE_SIZE >= usersTotal}
                  onClick={() => void loadUsers(userOffset + USERS_PAGE_SIZE)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
