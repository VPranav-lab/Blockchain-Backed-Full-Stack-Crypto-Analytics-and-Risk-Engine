import { useEffect, useState, useMemo } from "react";
import { backtestApi } from "../../api/backtestApi";
import styles from "./Strategy.module.css";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// --- Custom Tooltip ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipDate}>
          {new Date(label).toLocaleDateString(undefined, { dateStyle: "medium" })}
        </div>
        <div className={styles.tooltipVal}>
          ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </div>
    );
  }
  return null;
};

// ---------- DATE HELPERS (DD/MM/YYYY) ----------
const isDDMMYYYY = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(String(s || "").trim());

function ddmmyyyyToDate(s) {
  if (!isDDMMYYYY(s)) return null;
  const [dd, mm, yyyy] = s.split("/").map((x) => Number(x));
  if (!dd || !mm || !yyyy) return null;

  // Create date in UTC to avoid timezone shifting
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
  // Validate round-trip (e.g., 32/01/2024 should be invalid)
  if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;

  return dt;
}

function diffDaysUTC(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export default function StrategyPage() {
  const [history, setHistory] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ UI-only changes:
  // - dates start empty (no defaults)
  // - date format is DD/MM/YYYY
  const [params, setParams] = useState({
    symbol: "BTCUSDT",
    interval: "1d",
    short_window: "50",
    long_window: "200",
    initial_capital: "10000",
    startDate: "", // DD/MM/YYYY
    endDate: "",   // DD/MM/YYYY
  });

  // simple inline message (instead of alert spam)
  const [uiMsg, setUiMsg] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await backtestApi.getAll();
      const sorted = Array.isArray(data)
        ? data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        : [];
      setHistory(sorted);
      if (sorted.length > 0) setSelectedTest(sorted[0]);
    } catch (err) {
      console.error("Failed to load backtests", err);
    }
  };

  // Backtesting limits note
  const limitDays = useMemo(() => (params.interval === "1h" ? 30 : 365), [params.interval]);

  const handleRun = async () => {
    setUiMsg("");

    if (!params.symbol || !params.interval || !params.startDate || !params.endDate) {
      setUiMsg("Please fill in Symbol, Interval, Start Date and End Date.");
      return;
    }

    // Validate DD/MM/YYYY
    if (!isDDMMYYYY(params.startDate) || !isDDMMYYYY(params.endDate)) {
      setUiMsg("Dates must be in DD/MM/YYYY format.");
      return;
    }

    const startDt = ddmmyyyyToDate(params.startDate);
    const endDt = ddmmyyyyToDate(params.endDate);

    if (!startDt || !endDt) {
      setUiMsg("Invalid date. Please check day/month/year.");
      return;
    }

    if (endDt.getTime() < startDt.getTime()) {
      setUiMsg("End Date must be after Start Date.");
      return;
    }

    // Enforce range limits
    const days = diffDaysUTC(startDt, endDt);
    if (days > limitDays) {
      setUiMsg(
        params.interval === "1h"
          ? "1H backtesting supports max 30 days range."
          : "1D backtesting supports max 365 days range."
      );
      return;
    }

    setLoading(true);
    try {
      const payload = {
        symbol: params.symbol.toUpperCase(),
        interval: params.interval,
        shortWindow: Number(params.short_window),
        longWindow: Number(params.long_window),
        initialCapital: Number(params.initial_capital),

        // backend expects ISO strings
        startDate: startDt.toISOString(),
        endDate: endDt.toISOString(),
      };

      const newResult = await backtestApi.run(payload);

      setHistory((prev) => [newResult, ...prev]);
      setSelectedTest(newResult);
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Unknown error occurred";
      setUiMsg(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setUiMsg("");
    setParams((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>
          Strategy Lab{" "}
          <span className={styles.strategyBadge}>MA Crossover</span>{" "}
          
        </div>

        <div className={styles.subtitle}>
          Validate trading strategies on historical data before deploying capital.
        </div>
      </div>

      <div className={styles.grid}>
        {/* === LEFT: CONFIG === */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Configuration</span>
          </div>

          <div className={styles.panelBody}>
            {/* Limits note */}
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(183,189,198,0.95)",
                fontSize: 13,
                lineHeight: 1.35,
              }}
            >
              <div style={{ fontWeight: 900, color: "#EAECEF", marginBottom: 6 }}>
                Backtesting limits
              </div>
              <div>• <b>1D</b> timeframe: max <b>365 days</b></div>
              <div>• <b>1H</b> timeframe: max <b>30 days</b></div>
              <div style={{ marginTop: 6, opacity: 0.9 }}>
                Date format: <b>DD/MM/YYYY</b>
              </div>
            </div>

            {uiMsg ? (
              <div
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(246,70,93,0.08)",
                  border: "1px solid rgba(246,70,93,0.25)",
                  color: "#F6465D",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {uiMsg}
              </div>
            ) : null}

            <div className={styles.formGrid}>
              <div>
                <label className={styles.label}>Symbol</label>
                <input
                  className={styles.input}
                  value={params.symbol}
                  onChange={(e) => handleChange("symbol", e.target.value.toUpperCase())}
                  placeholder="BTCUSDT"
                />
              </div>
              <div>
                <label className={styles.label}>Interval</label>
                <select
                  className={styles.select}
                  value={params.interval}
                  onChange={(e) => handleChange("interval", e.target.value)}
                >
                  <option value="1h">1 Hour</option>
                  <option value="1d">1 Day</option>
                </select>
              </div>
            </div>

            {/* DD/MM/YYYY inputs (no default dates) */}
            <div className={styles.formGrid}>
              <div>
                <label className={styles.label}>Start Date</label>
                <input
                  type="text"
                  className={styles.inputDate}
                  value={params.startDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  placeholder="DD/MM/YYYY"
                />
              </div>
              <div>
                <label className={styles.label}>End Date</label>
                <input
                  type="text"
                  className={styles.inputDate}
                  value={params.endDate}
                  onChange={(e) => handleChange("endDate", e.target.value)}
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Short MA Period</label>
              <input
                type="number"
                className={styles.input}
                value={params.short_window}
                onChange={(e) => handleChange("short_window", e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Long MA Period</label>
              <input
                type="number"
                className={styles.input}
                value={params.long_window}
                onChange={(e) => handleChange("long_window", e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Initial Capital (USD)</label>
              <input
                type="number"
                className={styles.input}
                value={params.initial_capital}
                onChange={(e) => handleChange("initial_capital", e.target.value)}
              />
            </div>

            <button className={styles.runBtn} onClick={handleRun} disabled={loading}>
              {loading ? "Simulating..." : "Run Backtest"}
            </button>
          </div>

          <div
            className={styles.panelHeader}
            style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
          >
            <span className={styles.panelTitle}>Run History</span>
          </div>

          <div className={styles.historyList}>
            {history.map((test) => (
              <div
                key={test._id}
                className={`${styles.historyItem} ${
                  selectedTest?._id === test._id ? styles.historyItemActive : ""
                }`}
                onClick={() => setSelectedTest(test)}
              >
                <div className={styles.historyLeft}>
                  <div className={styles.historyTopRow}>
                    <span className={styles.historySymbol}>
                      {test.parameters?.symbol || test.symbol || "BTCUSDT"}
                    </span>
                    <span className={styles.historyTag}>
                      {test.parameters?.interval || "1d"}
                    </span>
                  </div>
                  <span className={styles.historyMeta}>
                    MA {test.parameters?.short_window}/{test.parameters?.long_window} •{" "}
                    {new Date(test.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div
                  className={`${styles.historyMetric} ${
                    test.metrics.total_return_pct >= 0 ? styles.textGreen : styles.textRed
                  }`}
                >
                  {test.metrics.total_return_pct > 0 ? "+" : ""}
                  {test.metrics.total_return_pct.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* === RIGHT: RESULTS === */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {selectedTest ? (
            <>
              {/* KPIS */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Total Return</span>
                  <span
                    className={`${styles.statValue} ${
                      selectedTest.metrics.total_return_pct >= 0 ? styles.textGreen : styles.textRed
                    }`}
                  >
                    {selectedTest.metrics.total_return_pct.toFixed(2)}%
                  </span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Max Drawdown</span>
                  <span className={`${styles.statValue} ${styles.textRed}`}>
                    {selectedTest.metrics.max_drawdown_pct.toFixed(2)}%
                  </span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Trades</span>
                  <span className={styles.statValue}>{selectedTest.metrics.trades_count}</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Final Equity</span>
                  <span className={styles.statValue} style={{ color: "#f0b90b" }}>
                    $
                    {Math.floor(
                      selectedTest.equity_curve[selectedTest.equity_curve.length - 1].equity
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* CHART */}
              <div className={styles.panel} style={{ flex: 1 }}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>
                    Equity Curve{" "}
                    <span style={{ opacity: 0.5 }}>
                      — {selectedTest.parameters?.symbol || "BTCUSDT"}
                    </span>
                  </span>
                </div>
                <div className={styles.panelBody}>
                  <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selectedTest.equity_curve}>
                        <defs>
                          <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" vertical={false} />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={(t) =>
                            new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                          }
                          stroke="#848e9c"
                          fontSize={11}
                          tickMargin={10}
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          tickFormatter={(v) => `$${v}`}
                          stroke="#848e9c"
                          fontSize={11}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="equity"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorEquity)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.panel} style={{ height: "100%" }}>
              <div className={styles.emptyState}>
                <span>Run a backtest to analyze results.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
