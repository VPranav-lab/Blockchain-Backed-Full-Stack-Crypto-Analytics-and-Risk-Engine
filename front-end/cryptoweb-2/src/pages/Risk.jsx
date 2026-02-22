// src/pages/Risk.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import styles from "./Risk.module.css";
import { securityApi } from "../api/securityApi";
import Button from "../components/common/Button";
import Alert from "../components/common/Alert";

/**
 * Robustly normalize API payloads into arrays.
 * Your backend returns: { ok:true, events: { limit, items:[...] } }
 */
const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.events?.items)) return payload.events.items; // ✅ important
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

const normalizeSession = (s) => (s?.session ? s.session : s || null);
const normalizeFeatures = (f) => (f?.features ? f.features : f || null);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function fmtNum(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
function fmtDate(d) {
  try {
    return d ? new Date(d).toLocaleString() : "—";
  } catch {
    return "—";
  }
}
function safeJsonPreview(obj, max = 180) {
  try {
    const s = typeof obj === "string" ? obj : JSON.stringify(obj);
    if (!s) return "—";
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch {
    return "—";
  }
}
function actionTone(action) {
  const a = String(action || "").toUpperCase();
  if (a === "ALLOW") return "allow";
  if (a === "REVIEW") return "review";
  if (a === "BLOCK" || a === "DENY") return "block";
  return "neutral";
}
function endpointLabel(path) {
  return String(path || "").replace(/^\/+/, "/");
}
function nowIso() {
  return new Date().toISOString();
}

/** Semi-circle gauge for a single "current risk" value (no timeline). */
function RiskMeter({ value, max = 100, size = 120, stroke = 12 }) {
  const v = value == null ? null : Number(value);
  const clamped = v == null ? 0 : Math.max(0, Math.min(max, v));
  const pct = max > 0 ? clamped / max : 0;

  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = r + stroke / 2; // center near top

  // TOP semicircle: π -> 2π
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const angle = startAngle + (endAngle - startAngle) * pct;

  const x0 = cx + r * Math.cos(startAngle);
  const y0 = cy + r * Math.sin(startAngle);
  const xEnd = cx + r * Math.cos(endAngle);
  const yEnd = cy + r * Math.sin(endAngle);

  const x1 = cx + r * Math.cos(angle);
  const y1 = cy + r * Math.sin(angle);

  const largeArcFlag = pct > 0.5 ? 1 : 0;
  const sweepFlag = 1;

  const bgPath = `M ${x0} ${y0} A ${r} ${r} 0 0 ${sweepFlag} ${xEnd} ${yEnd}`;
  const valPath = `M ${x0} ${y0} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${x1} ${y1}`;

  // Total drawing height (arc + labels)
  const vbH = cy + stroke / 2 + 36;

  // Unique clipPath id per render (avoid collisions if component appears multiple times)
  const clipId = useMemo(() => `riskClip-${Math.random().toString(16).slice(2)}`, []);

  return (
    <div style={{ width: "87%", display: "grid", placeItems: "center" }}>
      <svg
        viewBox={`0 0 ${size} ${vbH}`}
        style={{
          display: "block",
          width: "87%",
          height: "auto",
          maxWidth: size,
        }}
        role="img"
        aria-label="Risk meter"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={size} height={vbH} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <path
            d={bgPath}
            fill="none"
            stroke="currentColor"
            opacity="0.14"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={valPath}
            fill="none"
            stroke="currentColor"
            opacity="0.95"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        </g>

        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="18" fill="currentColor">
          {value == null ? "—" : Math.round(clamped)}
        </text>
        <text x={cx} y={cy + 34} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.75">
          risk / {max}
        </text>
      </svg>
    </div>
  );
}

/** Stacked bar to show ML vs Rules contribution. */
function ContributionBar({ mlRisk, ruleRisk }) {
  const ml = mlRisk == null ? 0 : Math.max(0, Number(mlRisk));
  const ru = ruleRisk == null ? 0 : Math.max(0, Number(ruleRisk));
  const total = ml + ru;

  const mlPct = total > 0 ? (ml / total) * 100 : 0;
  const ruPct = total > 0 ? (ru / total) * 100 : 0;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.85 }}>Contribution</div>

      <div
        style={{
          height: 10,
          borderRadius: 999,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
        }}
        aria-label="ML vs rules contribution"
        title={`ML ${mlPct.toFixed(0)}% • Rules ${ruPct.toFixed(0)}%`}
      >
        <div style={{ width: `${mlPct}%`, background: "currentColor", opacity: 0.55 }} />
        <div style={{ width: `${ruPct}%`, background: "currentColor", opacity: 0.22 }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.85 }}>
        <span className={styles.mono}>ML: {mlRisk == null ? "—" : fmtNum(mlRisk)}</span>
        <span className={styles.mono}>Rules: {ruleRisk == null ? "—" : fmtNum(ruleRisk)}</span>
      </div>
    </div>
  );
}

/** Small visual "signal light" chip for drift flags. */
function Signal({ label, on }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        fontSize: 12,
        opacity: 0.95,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          background: "currentColor",
          opacity: on ? 0.95 : 0.25,
        }}
      />
      {label}
    </span>
  );
}

/** ✅ NEW: API Trace panel */
function ApiTraceCard({ trace, score, sessionId, intent, styles }) {
  const mlOnline = score?.ml?.ok === true;
  const mlOffline = score?.ml?.ok === false;

  return (
    <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 800 }}>Scoring run</div>
        <div className={styles.mono} style={{ fontSize: 12, opacity: 0.85 }}>
          {trace?.lastRunAt ? new Date(trace.lastRunAt).toLocaleString() : "—"}
          {trace?.durationMs != null ? ` • ${trace.durationMs}ms` : ""}
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, opacity: 0.9 }}>
        <div>
          <span style={{ opacity: 0.7 }}>Session</span>{" "}
          <span className={styles.mono}>{trace?.sessionId || sessionId || "—"}</span>
        </div>
        <div>
          <span style={{ opacity: 0.7 }}>Intent</span>{" "}
          <span className={styles.mono}>{trace?.intent || intent || "—"}</span>
        </div>
        <div>
          <span style={{ opacity: 0.7 }}>Rules</span>{" "}
          <span className={styles.mono}>{score?.ruleVersion || "—"}</span>
        </div>
        <div>
          <span style={{ opacity: 0.7 }}>ML</span>{" "}
          <span className={styles.mono}>
            {mlOnline ? "ONLINE" : mlOffline ? "OFFLINE" : "—"}
          </span>
        </div>
      </div>

      {Array.isArray(trace?.endpoints) && trace.endpoints.length ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>APIs called</div>

          <div style={{ display: "grid", gap: 6 }}>
            {trace.endpoints.map((ep, i) => (
              <div
                key={`${ep.name}-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 0.6fr 1.6fr 0.4fr 0.4fr",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 12,
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(0,0,0,0.18)",
                  overflow: "hidden",
                }}
              >
                <div style={{ fontWeight: 800, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ep.name}
                </div>
                <div className={styles.mono} style={{ opacity: 0.85 }}>{ep.method}</div>
                <div className={styles.mono} style={{ opacity: 0.9, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ep.path}
                </div>
                <div className={styles.mono} style={{ opacity: 0.85 }}>
                  {String(ep.status)}
                </div>
                <div className={styles.mono} style={{ opacity: 0.85 }}>
                  {ep.ms}ms
                </div>
              </div>
            ))}
          </div>

          {/* ML endpoint only inside details (no noisy localhost in main UI) */}
          {score?.ml?.endpoint ? (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.85 }}>ML details</summary>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>
                <div>
                  Endpoint: <span className={styles.mono} style={{ overflowWrap: "anywhere" }}>{score.ml.endpoint}</span>
                </div>
                {score?.ml?.error ? (
                  <div style={{ marginTop: 6, color: "#f0b90b" }}>
                    Error: <span className={styles.mono} style={{ overflowWrap: "anywhere" }}>{score.ml.error}</span>
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Run scoring to capture the API trace.
        </div>
      )}
    </div>
  );
}

export default function Risk() {
  const [session, setSession] = useState(null);
  const [features, setFeatures] = useState(null);
  const [events, setEvents] = useState([]);
  const [score, setScore] = useState(null);

  const [intent, setIntent] = useState("TRADE");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // UI controls
  const [autoScoreOnIntentChange, setAutoScoreOnIntentChange] = useState(false);
  const [eventFilter, setEventFilter] = useState("ALL");

  // ✅ NEW: trace of APIs called
  const [trace, setTrace] = useState({
    lastRunAt: null,
    durationMs: null,
    intent: null,
    sessionId: null,
    endpoints: [],
  });

  const sessionId = useMemo(() => session?.id || session?.sessionId || session?.sid || null, [session]);

  // decision
  const action = score?.action || features?.action || "—";
  const totalRisk = score?.risk ?? null;
  const mlRisk = score?.mlRisk ?? null;
  const ruleRisk = score?.ruleRisk ?? null;

  const refresh = useCallback(async () => {
    setErr("");
    setLoading(true);

    const started = performance.now();
    const endpoints = [];

    const call = async (name, fn, method, path) => {
      const t0 = performance.now();
      try {
        const data = await fn();
        endpoints.push({
          name,
          method,
          path: endpointLabel(path),
          ok: true,
          status: 200,
          ms: Math.round(performance.now() - t0),
        });
        return data;
      } catch (e) {
        endpoints.push({
          name,
          method,
          path: endpointLabel(path),
          ok: false,
          status: e?.response?.status ?? "ERR",
          ms: Math.round(performance.now() - t0),
        });
        throw e;
      }
    };

    try {
      const [sRaw, fRaw, eRaw] = await Promise.all([
        call("Current session", () => securityApi.getCurrentSession(), "GET", "/api/security/session/current").catch(() => null),
        call("My features", () => securityApi.getMyFeatures(), "GET", "/api/security/features/me").catch(() => null),
        call("My events", () => securityApi.getMyEvents({ limit: 50 }), "GET", "/api/security/events/me?limit=50").catch(() => null),
      ]);

      setSession(normalizeSession(sRaw));
      setFeatures(normalizeFeatures(fRaw));
      setEvents(asArray(eRaw));

      // store refresh endpoints as “last refresh” if you haven't run scoring yet
      setTrace((prev) => ({
        ...prev,
        durationMs: prev.lastRunAt ? prev.durationMs : Math.round(performance.now() - started),
        endpoints: prev.lastRunAt ? prev.endpoints : endpoints,
      }));
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) setErr("Unauthorized (401). Please log in again.");
      else setErr("Failed to load security data. Check /api/security routes, CORS, and authentication.");
    } finally {
      setLoading(false);
    }
  }, []);

  const ensureSession = useCallback(async () => {
    setErr("");
    setLoading(true);
    const started = performance.now();
    const endpoints = [];

    try {
      const t0 = performance.now();
      const sRaw = await securityApi.startSession({ rotate: false });
      endpoints.push({
        name: "Start session",
        method: "POST",
        path: endpointLabel("/api/security/session/start"),
        ok: true,
        status: 200,
        ms: Math.round(performance.now() - t0),
      });

      setSession(normalizeSession(sRaw));

      await refresh();

      setTrace((prev) => ({
        ...prev,
        lastRunAt: nowIso(),
        durationMs: Math.round(performance.now() - started),
        intent: prev.intent,
        sessionId: (normalizeSession(sRaw)?.id || normalizeSession(sRaw)?.sessionId || normalizeSession(sRaw)?.sid || null),
        endpoints,
      }));
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) setErr("Unauthorized (401). Please log in again.");
      else setErr("Failed to start session.");

      endpoints.push({
        name: "Start session",
        method: "POST",
        path: endpointLabel("/api/security/session/start"),
        ok: false,
        status: e?.response?.status ?? "ERR",
        ms: Math.round(performance.now() - started),
      });

      setTrace((prev) => ({
        ...prev,
        lastRunAt: nowIso(),
        durationMs: Math.round(performance.now() - started),
        endpoints,
      }));
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const doScore = useCallback(
    async (overrideIntent) => {
      setErr("");
      setLoading(true);

      const started = performance.now();
      const endpoints = [];

      const push = (name, method, path, ok, status, ms) => {
        endpoints.push({ name, method, path: endpointLabel(path), ok, status, ms });
      };

      try {
        // Ensure session exists
        let cur = session;
        if (!cur) {
          const t0 = performance.now();
          try {
            const sRaw = await securityApi.getCurrentSession();
            push("Current session", "GET", "/api/security/session/current", true, 200, Math.round(performance.now() - t0));
            cur = normalizeSession(sRaw);
            setSession(cur);
          } catch (e) {
            push("Current session", "GET", "/api/security/session/current", false, e?.response?.status ?? "ERR", Math.round(performance.now() - t0));
            cur = null;
          }
        }

        const sid = cur?.id || cur?.sessionId || cur?.sid || null;
        if (!sid) {
          setErr("No active session found. Click 'Start Session' first.");
          return;
        }

        const finalIntent = overrideIntent || intent;

        // Score session
        const t1 = performance.now();
        const sc = await securityApi.scoreSession({
          sessionId: sid,
          intent: finalIntent,
          persist: true,
        });
        push("Score session", "POST", "/api/security/session/score", true, 200, Math.round(performance.now() - t1));

        setScore(sc);

        // Refresh after scoring (features/events updated)
        await refresh();

        setTrace({
          lastRunAt: nowIso(),
          durationMs: Math.round(performance.now() - started),
          intent: finalIntent,
          sessionId: sid,
          endpoints,
        });
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401) setErr("Unauthorized (401). Please log in again.");
        else setErr("Risk scoring failed. Ensure backend supports /api/security/session/score and a session exists.");

        setTrace({
          lastRunAt: nowIso(),
          durationMs: Math.round(performance.now() - started),
          intent,
          sessionId: sessionId || null,
          endpoints: [
            ...endpoints,
            {
              name: "Score session",
              method: "POST",
              path: endpointLabel("/api/security/session/score"),
              ok: false,
              status: e?.response?.status ?? "ERR",
              ms: Math.round(performance.now() - started),
            },
          ],
        });
      } finally {
        setLoading(false);
      }
    },
    [intent, refresh, session, sessionId]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Optional: auto-score when intent changes
  useEffect(() => {
    if (!autoScoreOnIntentChange) return;
    if (!sessionId) return;
    doScore(intent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, autoScoreOnIntentChange, sessionId]);

  const safeEvents = useMemo(() => asArray(events), [events]);

  const filteredEvents = useMemo(() => {
    if (eventFilter === "ALL") return safeEvents;
    return safeEvents.filter((ev) => (ev.eventType || ev.type || "").toUpperCase() === eventFilter);
  }, [safeEvents, eventFilter]);

  // Evidence + features helpers
  const stats = score?.evidence?.stats || features?.stats || {};
  const drift = score?.drift || score?.evidence?.drift || features?.drift || {};
  const driftFlags = {
    ipDrift: score?.ipDrift ?? features?.ipDrift,
    deviceDrift: score?.deviceDrift ?? features?.deviceDrift,
    uaDrift: score?.uaDrift ?? features?.uaDrift,
  };

  const topStats = [
    ["login_fail_15m", stats.login_fail_15m],
    ["login_success_5m", stats.login_success_5m],
    ["login_success_1h", stats.login_success_1h],
    ["distinct_ip_24h", stats.distinct_ip_24h],
    ["distinct_ua_7d", stats.distinct_ua_7d],
  ];

  const topDrift = [
    ["distinct_ip_7d", drift.distinct_ip_7d],
    ["distinct_device_30d", drift.distinct_device_30d],
    ["ipDrift", driftFlags.ipDrift],
    ["deviceDrift", driftFlags.deviceDrift],
    ["uaDrift", driftFlags.uaDrift],
  ];

  const uniqueEventTypes = useMemo(() => {
    const s = new Set();
    for (const ev of safeEvents) s.add((ev?.eventType || ev?.type || "UNKNOWN").toUpperCase());
    return ["ALL", ...Array.from(s).sort()];
  }, [safeEvents]);

  const tone = actionTone(action);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Session Risk</h1>
        <p className={styles.subtitle}>Live session scoring + evidence (rules + ML). Debug why a user is allowed/blocked.</p>
      </div>

      {err ? <Alert type="error" message={err} /> : null}

      <div className={styles.grid}>
        {/* Session card */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Current Session</div>

          <div className={styles.row}>
            <span>Session ID</span>
            <span className={styles.mono}>{sessionId || "—"}</span>
          </div>

          <div className={styles.row}>
            <span>Status</span>
            <span>{session?.status || "ACTIVE"}</span>
          </div>

          <div className={styles.row}>
            <span>Started</span>
            <span>{fmtDate(session?.startedAt || session?.createdAt)}</span>
          </div>

          <div className={styles.row}>
            <span>Last Seen</span>
            <span>{fmtDate(session?.lastSeen)}</span>
          </div>

          <div className={styles.actions}>
            <Button onClick={refresh} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </Button>
            <Button onClick={ensureSession} disabled={loading}>
              Start Session
            </Button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={autoScoreOnIntentChange}
                onChange={(e) => setAutoScoreOnIntentChange(e.target.checked)}
              />
              Auto-score when intent changes
            </label>
          </div>
        </div>

        {/* Decision card */}
        <div className={styles.card}>
          <div className={styles.cardTitle} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span>Decision</span>

            <span
              className={styles.mono}
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                opacity: 0.95,
              }}
              title="Final decision for this session + intent"
            >
              {tone === "allow" ? "✅" : tone === "block" ? "⛔" : tone === "review" ? "🟡" : "•"}{" "}
              {String(action).toUpperCase()}
            </span>
          </div>

          {/* visual summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr",
              gap: 14,
              alignItems: "center",
              marginTop: 10,
              marginBottom: 6,
            }}
          >
            <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Total Risk</div>
              <div style={{ minWidth: 140, overflow: "hidden" }}>
                <RiskMeter value={totalRisk} max={100} />
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 10,
              }}
            >
              <ContributionBar mlRisk={mlRisk} ruleRisk={ruleRisk} />

              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, opacity: 0.88 }}>
                <span>
                  <span style={{ opacity: 0.75 }}>Intent:</span> <span className={styles.mono}>{intent}</span>
                </span>
                <span>
                  <span style={{ opacity: 0.75 }}>Session:</span>{" "}
                  <span className={styles.mono}>{sessionId ? "ACTIVE" : "—"}</span>
                </span>
              </div>
            </div>
          </div>

          <div className={styles.formRow} style={{ marginTop: 12 }}>
            <div className={styles.field}>
              <div className={styles.label}>Intent</div>
              <select className={styles.select} value={intent} onChange={(e) => setIntent(e.target.value)} disabled={loading}>
                <option value="TRADE">Trade</option>
                <option value="WALLET">Wallet</option>
                <option value="LOGIN">Login</option>
                <option value="PORTFOLIO">Portfolio</option>
              </select>
            </div>

            <div className={styles.actionsRight}>
              <Button onClick={() => doScore()} disabled={loading}>
                {loading ? "Scoring..." : "Run Scoring"}
              </Button>
            </div>
          </div>

          {/* ✅ API trace instead of ugly "ML ok (localhost...)" */}
          <ApiTraceCard trace={trace} score={score} sessionId={sessionId} intent={intent} styles={styles} />

          {score ? (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.9 }}>Raw score JSON</summary>
              <pre className={styles.pre}>{JSON.stringify(score, null, 2)}</pre>
            </details>
          ) : (
            <div className={styles.hint}>Run scoring to generate a live risk assessment.</div>
          )}
        </div>
      </div>

      {/* Evidence */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Evidence</div>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: -6, marginBottom: 10 }}>
          Signals that contributed to the decision.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Signal label="IP drift" on={!!driftFlags.ipDrift} />
          <Signal label="Device drift" on={!!driftFlags.deviceDrift} />
          <Signal label="UA drift" on={!!driftFlags.uaDrift} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Key stats</div>
            <div style={{ display: "grid", gap: 6 }}>
              {topStats.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span className={styles.mono} style={{ opacity: 0.85 }}>
                    {k}
                  </span>
                  <span>{v ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Drift</div>
            <div style={{ display: "grid", gap: 6 }}>
              {topDrift.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span className={styles.mono} style={{ opacity: 0.85 }}>
                    {k}
                  </span>
                  <span>{String(v ?? "—")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {features ? (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.9 }}>Raw derived features JSON</summary>
            <pre className={styles.pre}>{JSON.stringify(features, null, 2)}</pre>
          </details>
        ) : (
          <div className={styles.hint}>No features loaded yet.</div>
        )}
      </div>

      {/* Events */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>Recent Security Events</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>Filter:</div>
          <select
            className={styles.select}
            style={{ maxWidth: 320 }}
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            disabled={loading}
          >
            {uniqueEventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Showing {clamp(filteredEvents.length, 0, 50)} / {safeEvents.length}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Risk</th>
                <th>Detail</th>
              </tr>
            </thead>

            <tbody>
              {filteredEvents.slice(0, 50).map((ev, idx) => {
                const t = fmtDate(ev.createdAt);
                const type = (ev.eventType || ev.type || "—").toUpperCase();
                const r = ev?.metadata?.risk;
                const detailObj = ev.detail || ev.message || ev.metadata || ev;

                return (
                  <tr key={ev.id || ev.createdAt || idx}>
                    <td>{t}</td>
                    <td>{type}</td>
                    <td className={styles.mono}>{r == null ? "—" : fmtNum(r)}</td>
                    <td className={styles.mono}>
                      <details>
                        <summary style={{ cursor: "pointer", userSelect: "none" }}>
                          {safeJsonPreview(detailObj, 160)}
                        </summary>
                        <pre className={styles.pre} style={{ marginTop: 8 }}>
                          {JSON.stringify(detailObj, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                );
              })}

              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    No events yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
          Tip: generate events via LOGIN attempts, scoring runs, and wallet/trade actions. Events that include{" "}
          <span className={styles.mono}>metadata.risk</span> are the most useful for debugging.
        </div>
      </div>
    </div>
  );
}
