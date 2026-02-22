import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { securityApi } from "../../../api/securityApi";
import SecurityAnomalyChart from "../../../components/admin/SecurityAnomalyChart";
import * as Icons from "../components/AdminIcons";
import styles from "../AdminDashboard.module.css";

const toUpper = (v) => String(v || "").toUpperCase();

const normalizeTime = (obj) => {
  const t =
    obj?.createdAt ??
    obj?.created_at ??
    obj?.timestamp ??
    obj?.time ??
    obj?.ts ??
    obj?.created ??
    null;
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeRisk = (obj) => {
  const val = obj?.risk ?? obj?.score ?? obj?.ruleRisk ?? obj?.mlRisk ?? obj?.value ?? null;
  if (val === 0) return 0;
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
};

const riskToSeverity = (risk) => {
  if (risk == null) return "LOW";
  if (risk >= 80) return "CRITICAL";
  if (risk >= 50) return "HIGH";
  if (risk > 20) return "MEDIUM";
  return "LOW";
};

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.events?.items)) return payload.events.items;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const extractError = (e) =>
  e?.response?.data?.message || e?.response?.data?.error || e?.message || "Request failed";

export default function SecurityMonitor() {
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [err, setErr] = useState("");

  const mounted = useRef(true);

  const loadData = useCallback(async () => {
    setErr("");
    try {
      const data = await securityApi.getMyEvents({ limit: 50 });
      const items = asArray(data);
      if (mounted.current) setEvents(items);
    } catch (e) {
      if (mounted.current) setErr(extractError(e) || "Failed to load security events");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [loadData]);

  const manualTests = useMemo(() => {
    return (events || []).filter((e) => toUpper(e.type) === "MANUAL_RISK_TEST");
  }, [events]);

  const handleTestRiskSession = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      // Start session (safe if already exists)
      try {
        await securityApi.startSession({ rotate: false });
      } catch {}

      // Score & persist
      const score = await securityApi.scoreSession({ intent: "PORTFOLIO", persist: true });

      const risk = normalizeRisk(score) ?? normalizeRisk(score?.explain) ?? 0;
      const action = score?.action || score?.explain?.action || "UNKNOWN";
      const backendUserId = score?.userId || score?.user_id || score?.sub || "Me";
      const severity = riskToSeverity(risk);

      // Immediate UI feedback (local)
      const newEvent = {
        id: `manual_${Date.now()}`,
        createdAt: new Date().toISOString(),
        type: "MANUAL_RISK_TEST",
        userId: backendUserId,
        severity,
        risk,
        message: `Manual Risk Check: ${action} (Score: ${risk})`,
      };

      setEvents((prev) => [newEvent, ...(prev || [])]);

      // Refresh from backend in case persist created a real event
      await loadData();
    } catch (e) {
      setErr(extractError(e) || "Risk session test failed");
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  return (
    <div className={styles.tabPanel}>
      <div className={styles.tabHeader}>
        <h2>Security Monitor</h2>
        <p>Shows this admin account’s security events + lets you run a manual risk test.</p>
      </div>

      {err ? <div className={styles.walletOpsWarn}>{err}</div> : null}

      <div className={styles.heatmapGrid}>
        <div className={styles.heatCard} style={{ gap: 10 }}>
          <button className={styles.verifyBtn} onClick={loadData} disabled={loading}>
            Refresh
          </button>
          <button className={styles.scanBtn} onClick={handleTestRiskSession} disabled={loading}>
            <Icons.Shield /> {loading ? "Testing..." : "Test Risk Session"}
          </button>
        </div>
      </div>

      <div className={styles.splitSection}>
        <div className={styles.chartPanel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Manual Risk Tests</h3>
            <span className={styles.badge}>{manualTests.length}</span>
          </div>
          <SecurityAnomalyChart alerts={manualTests} />
        </div>

        <div className={styles.logsPanel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>My Security Events</h3>
            <span className={styles.badge}>{events.length}</span>
          </div>

          <div className={styles.logList}>
            {events.length === 0 ? (
              <div className={styles.empty}>No security events found</div>
            ) : (
              events.map((log, index) => {
                const id = log.id || log._id || `${index}`;
                const t = normalizeTime(log);
                const risk = normalizeRisk(log) ?? normalizeRisk(log?.explain) ?? 0;
                const severity = toUpper(log.severity) || riskToSeverity(risk);

                return (
                  <div key={id} className={styles.secLogItem}>
                    <div className={styles.secLogTop}>
                      <div className={styles.secLogType}>
                        {log.eventType || log.signalType || log.type || "SECURITY_EVENT"}
                      </div>
                      <div className={styles.secLogTime}>{t ? t.toLocaleTimeString() : "—"}</div>
                    </div>

                    <div className={styles.secLogBody}>
                      <div className={styles.secLogMsg}>
                        {log.message || log.description || log.title || "No description provided."}
                      </div>
                      <div
                        className={risk >= 50 || severity === "CRITICAL" ? styles.riskPillHigh : styles.riskPillLow}
                      >
                        RISK: {risk}
                      </div>
                    </div>

                    {(log.userId || log.user_id || log.ip || log?.ctx?.ip) ? (
                      <div className={styles.secLogMeta}>
                        {log.userId || log.user_id ? (
                          <span>
                            <span className={styles.dim}>User:</span>{" "}
                            <span className={styles.mono}>{log.userId || log.user_id}</span>
                          </span>
                        ) : null}
                        {log.ip || log?.ctx?.ip ? (
                          <span>
                            <span className={styles.dim}>IP:</span>{" "}
                            <span className={styles.mono}>{log.ip || log?.ctx?.ip}</span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
