// src/pages/Insights.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import styles from "./Insights.module.css";
import { mlApi } from "../api/mlApi";
import Button from "../components/common/Button";
import Alert from "../components/common/Alert";

/**
 * ✅ ML-supported coins only (hardcoded)
 */
const SYMBOL_LIST = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "DOTUSDT",
  "LINKUSDT",
  "LTCUSDT",
  "TRXUSDT",
  "ATOMUSDT",
  "UNIUSDT",
];

// Keep your constraint (up to 6 per run)
const MAX_SYMBOLS = 6;

function normalizeSymbols(list) {
  return Array.from(
    new Set(
      (Array.isArray(list) ? list : [])
        .filter(Boolean)
        .map((s) => String(s).toUpperCase().trim())
    )
  );
}

function bullBear(p_up) {
  if (p_up == null) return { label: "—", cls: "neutral" };
  if (p_up >= 0.55) return { label: "BULL", cls: "bull" };
  if (p_up <= 0.45) return { label: "BEAR", cls: "bear" };
  return { label: "NEUTRAL", cls: "neutral" };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmtPct(x, digits = 1) {
  if (x == null || Number.isNaN(Number(x))) return "—";
  return `${(Number(x) * 100).toFixed(digits)}%`;
}

/**
 * ✅ Professional SVG chart
 * - grid + axes labels
 * - gradient fill under line
 * - hover tooltip (no libs)
 * - responsive width
 */
function AdvancedLineChart({
  points,
  title = "P(up) History",
  height = 220,
  padding = { top: 18, right: 16, bottom: 26, left: 44 },
}) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(900);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const next = Math.max(420, Math.floor(entries[0]?.contentRect?.width || 900));
      setW(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const safe = useMemo(() => {
    const arr = Array.isArray(points) ? points : [];
    return arr
      .filter((p) => p && p.t && typeof p.y === "number" && !Number.isNaN(p.y))
      .map((p) => ({ t: new Date(p.t), y: Number(p.y) }))
      .sort((a, b) => +a.t - +b.t)
      .slice(-60);
  }, [points]);

  if (safe.length < 2) {
    return (
      <div className={styles.chartCard}>
        <div className={styles.chartHead}>
          <div className={styles.sectionTitle}>{title}</div>
          <div className={styles.chartMeta}>Not enough points yet.</div>
        </div>
        <div className={styles.chartEmpty}>Run predictions a few times to build a timeline.</div>
      </div>
    );
  }

  const innerW = w - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const ys = safe.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padY = Math.max(0.02, (maxY - minY) * 0.12); // some breathing space
  const y0 = clamp(minY - padY, 0, 1);
  const y1 = clamp(maxY + padY, 0, 1);
  const spanY = y1 - y0 || 1;

  const xs = safe.map((p) => +p.t);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const spanX = maxX - minX || 1;

  const mapX = (t) => padding.left + ((+t - minX) / spanX) * innerW;
  const mapY = (y) => padding.top + (1 - (y - y0) / spanY) * innerH;

  const d = safe
    .map((p, i) => `${i === 0 ? "M" : "L"} ${mapX(p.t).toFixed(2)} ${mapY(p.y).toFixed(2)}`)
    .join(" ");

  const areaD = `${d} L ${mapX(safe[safe.length - 1].t).toFixed(2)} ${(padding.top + innerH).toFixed(
    2
  )} L ${mapX(safe[0].t).toFixed(2)} ${(padding.top + innerH).toFixed(2)} Z`;

  const last = safe[safe.length - 1];
  const first = safe[0];

  // y ticks (0..1 mapped to your range)
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const frac = i / ticks;
    const yVal = y0 + (1 - frac) * spanY;
    const yPos = padding.top + frac * innerH;
    return { yVal, yPos };
  });

  const onMove = (evt) => {
    const svg = evt.currentTarget;
    const r = svg.getBoundingClientRect();
    const px = evt.clientX - r.left;

    // clamp within chart area
    const xClamped = clamp(px, padding.left, padding.left + innerW);

    // find nearest point by x
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < safe.length; i++) {
      const dx = Math.abs(mapX(safe[i].t) - xClamped);
      if (dx < bestD) {
        bestD = dx;
        bestI = i;
      }
    }
    const p = safe[bestI];
    setHover({
      i: bestI,
      x: mapX(p.t),
      y: mapY(p.y),
      t: p.t,
      v: p.y,
    });
  };

  const onLeave = () => setHover(null);

  return (
    <div className={styles.chartCard} ref={wrapRef}>
      <div className={styles.chartHead}>
        <div className={styles.sectionTitle}>{title}</div>
        <div className={styles.chartMeta}>
          Range: {fmtPct(y0, 1)} → {fmtPct(y1, 1)} · Latest:{" "}
          <span className={styles.mono}>{fmtPct(last.y, 1)}</span>
        </div>
      </div>

      <div className={styles.chartWrap}>
        <svg
          viewBox={`0 0 ${w} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={title}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopOpacity="0.25" />
              <stop offset="100%" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* horizontal grid + labels */}
          {yTicks.map((t, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={t.yPos}
                x2={padding.left + innerW}
                y2={t.yPos}
                stroke="currentColor"
                opacity={0.10}
              />
              <text
                x={padding.left - 10}
                y={t.yPos + 3}
                textAnchor="end"
                fontSize="11"
                fill="currentColor"
                opacity="0.6"
              >
                {fmtPct(t.yVal, 0)}
              </text>
            </g>
          ))}

          {/* axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + innerH}
            stroke="currentColor"
            opacity="0.14"
          />
          <line
            x1={padding.left}
            y1={padding.top + innerH}
            x2={padding.left + innerW}
            y2={padding.top + innerH}
            stroke="currentColor"
            opacity="0.14"
          />

          {/* filled area */}
          <path d={areaD} fill="currentColor" opacity="0.18" />
          <path d={areaD} fill="url(#areaFill)" />

          {/* main line */}
          <path d={d} fill="none" stroke="currentColor" strokeWidth="2.4" opacity="0.95" />

          {/* endpoints */}
          <circle cx={mapX(first.t)} cy={mapY(first.y)} r="3.5" fill="currentColor" opacity="0.55" />
          <circle cx={mapX(last.t)} cy={mapY(last.y)} r="4.2" fill="currentColor" />

          {/* hover crosshair + tooltip */}
          {hover ? (
            <>
              <line
                x1={hover.x}
                y1={padding.top}
                x2={hover.x}
                y2={padding.top + innerH}
                stroke="currentColor"
                opacity="0.12"
              />
              <circle cx={hover.x} cy={hover.y} r="5" fill="currentColor" />
              <g>
                <rect
                  x={clamp(hover.x + 10, padding.left + 6, padding.left + innerW - 170)}
                  y={clamp(hover.y - 38, padding.top + 6, padding.top + innerH - 44)}
                  width="160"
                  height="42"
                  rx="10"
                  fill="rgba(0,0,0,0.45)"
                  stroke="rgba(255,255,255,0.10)"
                />
                <text
                  x={clamp(hover.x + 22, padding.left + 18, padding.left + innerW - 154)}
                  y={clamp(hover.y - 18, padding.top + 24, padding.top + innerH - 18)}
                  fontSize="11"
                  fill="white"
                  opacity="0.95"
                >
                  {hover.t.toLocaleString()}
                </text>
                <text
                  x={clamp(hover.x + 22, padding.left + 18, padding.left + innerW - 154)}
                  y={clamp(hover.y - 4, padding.top + 38, padding.top + innerH - 4)}
                  fontSize="12"
                  fill="white"
                  fontWeight="700"
                >
                  P(up): {fmtPct(hover.v, 1)}
                </text>
              </g>
            </>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

export default function Insights() {
  const [symbols, setSymbols] = useState(["BTCUSDT", "ETHUSDT"]);
  const [interval, setInterval] = useState("1h");
  const [horizon, setHorizon] = useState(24);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [err, setErr] = useState("");

  // ✅ options are now hardcoded list only
  const options = useMemo(() => {
    const uniq = normalizeSymbols(SYMBOL_LIST);
    uniq.sort((a, b) => a.localeCompare(b));
    return uniq;
  }, []);

  const [coinSearch, setCoinSearch] = useState("");
  const selectedSymbols = useMemo(
    () => normalizeSymbols(symbols).filter((s) => options.includes(s)).slice(0, MAX_SYMBOLS),
    [symbols, options]
  );

  const remaining = MAX_SYMBOLS - selectedSymbols.length;

  const filteredOptions = useMemo(() => {
    const q = coinSearch.trim().toUpperCase();
    const base = options.filter((s) => !selectedSymbols.includes(s));
    if (!q) return base;
    return base.filter((s) => s.includes(q) || s.replace("USDT", "").includes(q));
  }, [coinSearch, options, selectedSymbols]);

  const loadHistory = useCallback(async () => {
    const h = await mlApi.getPredictions();
    setHistory(Array.isArray(h) ? h : []);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const run = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const selected = selectedSymbols.slice(0, MAX_SYMBOLS);
      if (!selected.length) {
        setErr("Please select at least 1 supported coin.");
        setResult(null);
        return;
      }

      const r = await mlApi.predictPrice({
        symbols: selected,
        interval,
        horizon,
        includePropagation: false,
      });

      if (!r?.ok) {
        if (r?.status === 401) setErr("Unauthorized (401). Please log in again.");
        else setErr(`Prediction failed: ${r?.error || "unknown error"}`);
        setResult(null);
        return;
      }

      setResult(r.result || null);
      await loadHistory();
    } catch (e) {
      setErr(e?.message || "Prediction failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbols, interval, horizon, loadHistory]);

  const coins = useMemo(() => {
    if (!result) return [];
    return (
      result?.predictions ||
      result?.output?.predictions ||
      result?.coins ||
      result?.results ||
      []
    );
  }, [result]);

  // ✅ chart: show P(up) timeline for the first selected symbol
  const firstSym = selectedSymbols?.[0] || null;

  const pUpTimeline = useMemo(() => {
    if (!firstSym) return [];
    const pts = [];

    for (const row of history || []) {
      const t = row?.createdAt ? new Date(row.createdAt) : null;
      const preds = row?.output?.predictions || row?.predictions || [];
      const hit = Array.isArray(preds)
        ? preds.find((p) => String(p?.symbol || "").toUpperCase() === firstSym)
        : null;

      if (t && typeof hit?.p_up === "number") pts.push({ t, y: hit.p_up });
    }

    pts.sort((a, b) => +new Date(a.t) - +new Date(b.t));
    return pts.slice(-60);
  }, [history, firstSym]);

  const title = firstSym ? `P(up) History — ${firstSym.replace("USDT", "")}` : "P(up) History";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>ML Insights</h1>
        <p className={styles.subtitle}>
          Predictions available for <b>{SYMBOL_LIST.length}</b> supported coins. Select maximum of{" "}
          <b>{MAX_SYMBOLS}</b> coins per run.
        </p>
      </div>

      {err ? <Alert type="error" message={err} /> : null}

      {/* Controls */}
      <div className={styles.card}>
        <div className={styles.formRow}>
          <div className={styles.field}>
            <div className={styles.label}>Selected coins</div>

            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              {remaining > 0
                ? `You can add ${remaining} more coin(s).`
                : "Maximum selected (remove one to add another)."}
            </div>

            <div className={styles.pills}>
              {selectedSymbols.map((s) => (
                <span key={s} className={styles.pill}>
                  {s.replace("USDT", "")}
                  <button
                    className={styles.pillX}
                    type="button"
                    onClick={() =>
                      setSymbols((prev) =>
                        prev.filter((x) => String(x).toUpperCase() !== s)
                      )
                    }
                    aria-label={`remove ${s}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedSymbols.length === 0 ? (
                <span className={styles.pill} style={{ opacity: 0.6 }}>
                  No coins selected
                </span>
              ) : null}
            </div>

            <div className={styles.addRow}>
              <input
                className={styles.input}
                placeholder="Search coin (e.g. BTC, SOL...)"
                value={coinSearch}
                onChange={(e) => setCoinSearch(e.target.value)}
              />
              <select
                className={styles.select}
                value=""
                disabled={remaining <= 0 || filteredOptions.length === 0}
                onChange={(e) => {
                  const v = String(e.target.value || "").toUpperCase();
                  if (!v) return;
                  if (selectedSymbols.includes(v)) return;
                  if (remaining <= 0) return;
                  setSymbols((prev) =>
                    normalizeSymbols([...prev, v])
                      .filter((s) => options.includes(s))
                      .slice(0, MAX_SYMBOLS)
                  );
                }}
              >
                <option value="">
                  {filteredOptions.length === 0
                    ? "No matches"
                    : remaining <= 0
                    ? "Maximum selected"
                    : "+ Add coin"}
                </option>
                {filteredOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("USDT", "")} / USDT
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Interval</div>
            <select
              className={styles.select}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
            </select>
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Horizon (hours)</div>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={168}
              value={horizon}
              onChange={(e) => setHorizon(parseInt(e.target.value || "24", 10))}
            />
          </div>

          <div className={styles.actions}>
            <Button onClick={run} disabled={loading || selectedSymbols.length === 0}>
              {loading ? "Running..." : "Run Prediction"}
            </Button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <AdvancedLineChart points={pUpTimeline} title={title} />

      {/* Results Cards */}
      {coins.length ? (
        <div className={styles.grid}>
          {coins.map((coin, idx) => {
            const sym = String(coin.symbol || coin.coin || coin.ticker || `coin-${idx}`).toUpperCase();
            const p_up = coin.p_up ?? coin.prob_up ?? coin.probability_up;

            const expRet =
              coin.exp_return ?? coin.expected_return ?? coin.expectedReturn ?? coin.mu;

            const conf =
              coin.confidence ?? coin.conf ?? coin.model_confidence;

            const bb = bullBear(p_up);

            return (
              <div key={sym} className={styles.predCard}>
                <div className={styles.predTop}>
                  <div className={styles.predSym}>{sym.replace("USDT", "")}</div>
                  <div className={`${styles.badge} ${styles[bb.cls]}`}>{bb.label}</div>
                </div>

                <div className={styles.metrics}>
                  <div className={styles.metric}>
                    <div className={styles.mLabel}>P(up)</div>
                    <div className={styles.mValue}>{fmtPct(p_up, 1)}</div>
                  </div>

                  <div className={styles.metric}>
                    <div className={styles.mLabel}>Expected Return</div>
                    <div className={styles.mValue}>
                      {expRet == null ? "—" : `${(Number(expRet) * 100).toFixed(2)}%`}
                    </div>
                  </div>

                  <div className={styles.metric}>
                    <div className={styles.mLabel}>Confidence</div>
                    <div className={styles.mValue}>{fmtPct(conf, 0)}</div>
                  </div>
                </div>

                {Array.isArray(coin.drivers) ? (
                  <div className={styles.drivers}>
                    <div className={styles.drTitle}>Top drivers</div>
                    <ul className={styles.driverList}>
                      {coin.drivers.slice(0, 6).map((d, i) => (
                        <li key={`${sym}-drv-${i}`}>
                          {(d.name || d.feature || d.type || "feature")}:{" "}
                          {d.impact ?? d.weight ?? d.score ?? "—"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* History table */}
      <div className={styles.card}>
        <div className={styles.sectionTitle}>Prediction History</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Symbols</th>
                <th>Interval</th>
                <th>Horizon</th>
                <th>Model</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {(history || []).slice(0, 30).map((row, i) => {
                const inSymbols = row?.input?.symbols || row?.symbols || [];
                const inInterval = row?.input?.interval || row?.interval || "—";
                const inHorizon = row?.input?.horizon ?? row?.horizon ?? "—";
                const modelName = row?.model?.name || row?.output?.model?.name || "—";
                const modelVer = row?.model?.version || row?.output?.model?.version || "";
                const latency = row?.latencyMs != null ? `${row.latencyMs}ms` : "—";

                const symText = Array.isArray(inSymbols)
                  ? inSymbols.map((s) => String(s).toUpperCase()).join(", ")
                  : String(inSymbols || "—");

                return (
                  <tr key={row.id || row.createdAt || i}>
                    <td>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</td>
                    <td>{symText}</td>
                    <td>{inInterval}</td>
                    <td>{inHorizon}</td>
                    <td className={styles.mono}>
                      {modelName}
                      {modelVer ? `@${modelVer}` : ""}
                    </td>
                    <td className={styles.mono}>{latency}</td>
                  </tr>
                );
              })}

              {!history || history.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    No history yet. Run a prediction to create records.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

