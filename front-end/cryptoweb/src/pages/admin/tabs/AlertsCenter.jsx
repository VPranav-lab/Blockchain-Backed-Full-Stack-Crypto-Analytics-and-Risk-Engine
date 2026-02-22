import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../AdminDashboard.module.css";
import { alertsApi } from "../../../api/alertApi";
import Alert from "../../../components/common/Alert";
import AlertHeatmap from "../components/AlertHeatmap";

const STATUSES = ["OPEN", "ACK", "CLOSED"];
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function getField(a, keys, fallback = null) {
  for (const k of keys) if (a && a[k] != null) return a[k];
  return fallback;
}

function normalizeArray(resp) {
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.alerts)) return resp.alerts;
  if (Array.isArray(resp?.items)) return resp.items;
  if (Array.isArray(resp?.data)) return resp.data;
  return [];
}

function extractError(e) {
  return e?.response?.data?.message || e?.response?.data?.error || e?.message || "Request failed";
}

const sevBadgeStyleFor = (sev) =>
  ({
    LOW: { background: "rgba(14,203,129,0.15)", color: "#0ecb81" },
    MEDIUM: { background: "rgba(240,185,11,0.15)", color: "#f0b90b" },
    HIGH: { background: "rgba(246,70,93,0.18)", color: "#f6465d" },
    CRITICAL: { background: "rgba(246,70,93,0.28)", color: "#ff6b81" },
  }[sev] || { background: "rgba(183,189,198,0.10)", color: "#b7bdc6" });

export default function AlertsCenter() {
  const [status, setStatus] = useState("OPEN");
  const [severity, setSeverity] = useState("ALL");
  const [sinceHours, setSinceHours] = useState(24);
  const [userId, setUserId] = useState("");

  const [alerts, setAlerts] = useState([]);
  const [serverCount, setServerCount] = useState(null);

  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [err, setErr] = useState("");

  const disableControls = loading || recomputing;

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await alertsApi.adminList({
        status,
        limit: 200,
        userId: userId.trim() || undefined,
        sinceHours: sinceHours || undefined,
      });

      const arr = normalizeArray(res);
      setAlerts(arr);
      setServerCount(typeof res?.count === "number" ? res.count : null);
    } catch (e) {
      console.error("adminList error:", e);
      setErr(extractError(e));
      setAlerts([]);
      setServerCount(null);
    } finally {
      setLoading(false);
    }
  }, [status, sinceHours, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (severity === "ALL") return alerts;
    return (alerts || []).filter((a) => {
      const sev = (getField(a, ["severity", "level"], "LOW") + "").toUpperCase();
      return sev === severity;
    });
  }, [alerts, severity]);

  const ackAlert = useCallback(
    async (id) => {
      setErr("");
      setLoading(true);
      try {
        await alertsApi.updateStatus(id, "ACK");
        await load();
      } catch (e) {
        if (e?.response?.status === 404) {
          await load();
          setErr("Alert was already removed/recomputed. Refreshed list.");
          return;
        }
        setErr(extractError(e));
      } finally {
        setLoading(false);
      }
    },
    [load]
  );

  const closeAlert = useCallback(
    async (id) => {
      setErr("");
      setLoading(true);
      try {
        await alertsApi.updateStatus(id, "CLOSED");
        await load();
      } catch (e) {
        if (e?.response?.status === 404) {
          await load();
          setErr("Alert was already removed/recomputed. Refreshed list.");
          return;
        }
        setErr(extractError(e));
      } finally {
        setLoading(false);
      }
    },
    [load]
  );

  const recompute = useCallback(async () => {
    setErr("");
    setRecomputing(true);
    try {
      await alertsApi.recompute({ windowHours: sinceHours || 24 });
      await load();
    } catch (e) {
      console.error("recompute error:", e);
      setErr(extractError(e));
    } finally {
      setRecomputing(false);
    }
  }, [sinceHours, load]);

  return (
    <div className={styles.tabPanel}>
      <div className={styles.tabHeader}>
        <h2>Alerts Management</h2>
        <p>Admin triage inbox (SECURITY + ML). ACK/CLOSE manage queue.</p>
      </div>

      {err ? <Alert type="error" message={err} /> : null}

      <div className={styles.alertsWrap}>
        {/* LEFT */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>
            <span>Filters</span>
            <span className={styles.badge}>
              {status} · {severity}
            </span>
          </div>

          <p className={styles.panelSub}>
            This page shows aggregated alerts (not “who is online”). Use Security Monitor for admin self-events / manual scoring.
          </p>

          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label>Status</label>
              <select
                className={styles.select}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={disableControls}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formField}>
              <label>Severity</label>
              <select
                className={styles.select}
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                disabled={disableControls}
              >
                <option value="ALL">ALL</option>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formGridOne} style={{ marginTop: 10 }}>
            <div className={styles.formField}>
              <label>Since (hours)</label>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={168}
                value={sinceHours}
                onChange={(e) => setSinceHours(parseInt(e.target.value || "24", 10))}
                disabled={disableControls}
              />
            </div>

            <div className={styles.formField}>
              <label>Filter by userId (optional)</label>
              <input
                className={styles.input}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="UUID"
                disabled={disableControls}
              />
            </div>
          </div>

          <div className={styles.actionsRow}>
            <button className={styles.btnSecondary} onClick={load} disabled={disableControls}>
              {loading ? "Loading..." : "Refresh"}
            </button>
            <button className={styles.btnPrimary} onClick={recompute} disabled={disableControls}>
              {recomputing ? "Recomputing..." : "Recompute"}
            </button>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className={styles.panelTitle} style={{ marginBottom: 8 }}>
              <span>Severity Heatmap</span>
              <span className={styles.badge}>last {sinceHours}h</span>
            </div>
            <AlertHeatmap alerts={filtered} />
            <div className={styles.hmLegend}>
              <span className={styles.legendDot} style={{ background: "rgba(246,70,93,0.25)" }} />
              <span>More alerts → brighter cell</span>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className={styles.tableCard}>
          <div className={styles.tableHead}>
            <div>
              <div className={styles.tableTitle}>Alerts</div>
              <div className={styles.tableMeta}>
                Showing {Math.min(filtered.length, 200)} of {serverCount != null ? serverCount : filtered.length}
              </div>
            </div>

            <span className={styles.badge}>
              {status} · {severity} · {sinceHours}h
            </span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>User</th>
                  <th>Summary</th>
                  <th style={{ width: 190, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.slice(0, 200).map((a) => {
                  const id = a._id || a.id;

                  const createdAt = getField(a, ["createdAt", "created_at", "time", "ts"]);
                  const sev = (getField(a, ["severity", "level"], "LOW") + "").toUpperCase();
                  const typ = (getField(a, ["type"], "—") + "").toUpperCase();
                  const kind = a?.explain?.kind ? String(a.explain.kind) : "";
                  const uid = getField(a, ["userId", "user_id", "sub"], "—");
                  const summary = getField(a, ["title", "summary", "message"], "");

                  const sevBadgeStyle = sevBadgeStyleFor(sev);

                  return (
                    <tr key={id}>
                      <td className={styles.mono}>{createdAt ? new Date(createdAt).toLocaleString() : "—"}</td>

                      <td>
                        <span
                          className={styles.badge}
                          style={{
                            ...sevBadgeStyle,
                            borderColor: "rgba(43,49,57,0.8)",
                            fontWeight: 800,
                          }}
                        >
                          {sev}
                        </span>
                      </td>

                      <td className={styles.mono}>{kind ? `${typ}-${kind}` : typ}</td>

                      <td className={styles.mono} title={uid}>
                        {(uid + "").slice(0, 10)}
                        {(uid + "").length > 10 ? "…" : ""}
                      </td>

                      <td title={summary}>
                        {(summary || "—").slice(0, 120)}
                        {(summary || "").length > 120 ? "…" : ""}
                      </td>

                      <td>
                        <div className={styles.rowActions}>
                          <button
                            className={styles.miniBtn}
                            onClick={() => ackAlert(id)}
                            disabled={disableControls || status === "CLOSED"}
                            type="button"
                          >
                            ACK
                          </button>
                          <button
                            className={styles.miniBtn}
                            onClick={() => closeAlert(id)}
                            disabled={disableControls}
                            type="button"
                          >
                            Close
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ opacity: 0.7, textAlign: "center", padding: 16 }}>
                      No alerts found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
