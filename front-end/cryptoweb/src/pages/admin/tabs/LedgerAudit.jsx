import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ledgerApi } from "../../../api/ledgerApi";
import * as Icons from "../components/AdminIcons";
import styles from "../AdminDashboard.module.css";

function safeDate(v) {
  const d = new Date(v || Date.now());
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function shortHash(h) {
  if (!h || typeof h !== "string") return "—";
  return h.length <= 14 ? h : `${h.slice(0, 10)}…${h.slice(-4)}`;
}

function normalizeBlocks(raw) {
  // supports: [] | {blocks: []} | {items: []} | {data: []} | {raw...}
  const arr = Array.isArray(raw) ? raw : raw?.blocks || raw?.items || raw?.data || [];
  return Array.isArray(arr) ? arr : [];
}

function normalizeActions(raw) {
  // supports: [] | {items: []} | {actions: []} | {data: []}
  const arr = Array.isArray(raw) ? raw : raw?.items || raw?.actions || raw?.data || [];
  return Array.isArray(arr) ? arr : [];
}

const LEDGER_MODES = {
  settlement: "settlement",
  audit: "audit",
};

export default function LedgerAudit() {
  const [mode, setMode] = useState(LEDGER_MODES.settlement);

  const [loading, setLoading] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [locks, setLocks] = useState({ locked: false, locks: [] });
  const [verify, setVerify] = useState({ isValid: true, details: null });
  const [actions, setActions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  const lockedCount = locks?.locks?.length || 0;

  const chainBadge = useMemo(
    () => (verify?.isValid ? styles.statusApproved : styles.statusRejected),
    [verify?.isValid]
  );

  const lockBadge = useMemo(
    () => (locks?.locked ? styles.statusRejected : styles.statusApproved),
    [locks?.locked]
  );

  const modeLabel = mode === "audit" ? "Audit Ledger (Security)" : "Settlement Ledger (Wallet + Trades)";

  // pick correct API methods per mode (keeps rest of UI unchanged)
  const api = useMemo(() => {
    if (mode === "audit") {
      return {
        getBlocks: ledgerApi.getAuditBlocks,
        verify: ledgerApi.verifyAuditChain,
        getLocks: ledgerApi.getAuditLocks,
        getActions: ledgerApi.getAuditActions,
        commit: ledgerApi.auditCommit,
        unlock: ledgerApi.auditUnlock,
        getBlockDetail: ledgerApi.getAuditBlockDetail,
      };
    }
    return {
      getBlocks: ledgerApi.getBlocks,
      verify: ledgerApi.verifyChain,
      getLocks: ledgerApi.getLocks,
      getActions: ledgerApi.getActions,
      commit: ledgerApi.forceCommit, // or ledgerApi.commit
      unlock: ledgerApi.forceUnlock,
      getBlockDetail: ledgerApi.getBlockDetail,
    };
  }, [mode]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [b, v, l, a] = await Promise.all([
        api.getBlocks(15, 0),
        api.verify(),
        api.getLocks(),
        api.getActions(12),
      ]);

      // IMPORTANT: ledgerApi.getBlocks returns { blocks, raw }
      setBlocks(Array.isArray(b?.blocks) ? b.blocks : []);

      setVerify(v || { isValid: false, details: null });
      setLocks(l || { locked: false, locks: [] });

      // IMPORTANT: ledgerApi.getActions returns { items, raw }
      setActions(Array.isArray(a?.items) ? a.items : []);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.error || e?.response?.data?.message || e?.message || "Failed to load ledger data");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openBlock = async (height) => {
    setSelected(null);
    setError("");
    try {
      const res = await api.getBlockDetail(height);

      const raw = res?.block || res || {};
      const items = res?.items || raw?.items || raw?.data || raw?.ledgerItems || [];

      setSelected({
        height: raw?.height ?? raw?.index ?? height,
        status: raw?.status || raw?.sources?.status || "UNKNOWN",

        blockHash: raw?.blockHash || raw?.hash || "—",
        prevHash: raw?.prevHash || raw?.previousHash || "—",
        merkleRoot: raw?.merkleRoot || "—",

        sealedByUserId: raw?.sealedByUserId || "—",

        itemsCount: raw?.itemsCount ?? (Array.isArray(items) ? items.length : 0),
        createdAt: raw?.createdAt || raw?.timestamp || raw?.time,

        items: Array.isArray(items) ? items : [],
        raw,
      });
    } catch (e) {
      console.error(e);
      setError("Could not fetch block details.");
    }
  };

  const confirmPhrase = async (title, phrase) => {
    const input = window.prompt(`${title}\n\nType: ${phrase}`);
    return input === phrase;
  };

  const handleCommit = async () => {
    const phrase = mode === "audit" ? "MINE_AUDIT" : "MINE";
    const title =
      mode === "audit"
        ? "Force Mine will commit a new AUDIT block (security logs)."
        : "Force Mine will commit a new SETTLEMENT block (wallet + trades).";

    if (!(await confirmPhrase(title, phrase))) return;

    setLoading(true);
    setError("");
    try {
      const res = await api.commit();
      alert(res?.message || "✅ Commit requested.");
      await loadAll();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Commit failed";

      // If commit blocked by lock, offer unlock+retry (dangerous)
      if (e?.response?.status === 409 || String(msg).toLowerCase().includes("lock")) {
        const doUnlock = await confirmPhrase(
          "Commit blocked by lock.\nThis is dangerous.\n\nProceed to force unlock all locks?",
          "UNLOCK"
        );
        if (!doUnlock) {
          setError("Commit blocked by lock. No unlock performed.");
        } else {
          try {
            await api.unlock();
            await new Promise((r) => setTimeout(r, 600));
            const res2 = await api.commit();
            alert(res2?.message || "✅ Unlocked & commit requested.");
            await loadAll();
          } catch (e2) {
            setError(e2?.response?.data?.error || e2?.response?.data?.message || e2?.message || "Force unlock failed");
          }
        }
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!(await confirmPhrase("Force Unlock clears ALL ledger locks.", "UNLOCK"))) return;

    setLoading(true);
    setError("");
    try {
      const res = await api.unlock();
      alert(res?.message || "✅ Unlock requested.");
      await loadAll();
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.message || e?.message || "Unlock failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchMode = async (nextMode) => {
    if (nextMode === mode) return;
    setSelected(null);
    setBlocks([]);
    setActions([]);
    setError("");
    setMode(nextMode);
    // loadAll will run via effect because api changes with mode
  };

  return (
    <div className={styles.tabPanel}>
      {/* Header */}
      <div className={styles.ledgerTopBar}>
        <div>
          <h2 className={styles.ledgerTitle}>Ledger Management</h2>
          <p className={styles.ledgerSub}>
            {modeLabel} — Verify integrity, review blocks, and perform controlled admin actions (commit / unlock).
          </p>
        </div>

        <div className={styles.ledgerTopActions} style={{ gap: 10 }}>
          {/* Mode Toggle */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className={mode === "settlement" ? styles.btnPrimary : styles.btnSecondary}
              onClick={() => handleSwitchMode("settlement")}
              disabled={loading}
              title="Settlement ledger: wallet transactions + trade fills"
            >
              Settlement
            </button>
            <button
              className={mode === "audit" ? styles.btnPrimary : styles.btnSecondary}
              onClick={() => handleSwitchMode("audit")}
              disabled={loading}
              title="Audit ledger: security logs"
            >
              Audit
            </button>
          </div>

          <button className={styles.btnSecondary} onClick={loadAll} disabled={loading}>
            <Icons.Refresh /> {loading ? "Refreshing…" : "Refresh"}
          </button>

          <button className={styles.btnPrimary} onClick={handleCommit} disabled={loading}>
            Mine Now
          </button>

          <button className={styles.btnDangerMini} onClick={handleUnlock} disabled={loading}>
            🔓 Unlock
          </button>
        </div>
      </div>

      {/* Status cards */}
      <div className={styles.ledgerStatusGrid}>
        <div className={styles.ledgerStatusCard}>
          <div className={styles.ledgerStatusIcon}>
            <Icons.Block />
          </div>
          <div className={styles.ledgerStatusMain}>
            <div className={styles.ledgerStatusLabel}>Ledger Locks</div>
            <div className={styles.ledgerStatusRow}>
              <span className={`${styles.statusPill} ${lockBadge}`}>{locks?.locked ? "LOCKED" : "UNLOCKED"}</span>
              <span className={styles.ledgerStatusMeta}>Active locks: {lockedCount}</span>
            </div>

            {lockedCount > 0 ? (
              <div className={styles.ledgerMiniList}>
                {locks.locks.slice(0, 3).map((lk, idx) => (
                  <div key={idx} className={styles.ledgerMiniItem}>
                    <span className={styles.mono}>{lk?.name || lk?.kind || lk?.type || "lock"}</span>
                    <span className={styles.dim}>{lk?.owner || lk?.by || lk?.source || ""}</span>
                  </div>
                ))}
                {lockedCount > 3 ? (
                  <div className={styles.dim} style={{ fontSize: 12 }}>
                    +{lockedCount - 3} more…
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.ledgerStatusCard}>
          <div className={styles.ledgerStatusIcon}>
            <Icons.Shield />
          </div>
          <div className={styles.ledgerStatusMain}>
            <div className={styles.ledgerStatusLabel}>Chain Integrity</div>
            <div className={styles.ledgerStatusRow}>
              <span className={`${styles.statusPill} ${chainBadge}`}>{verify?.isValid ? "VALID" : "CORRUPTED"}</span>
              <span className={styles.ledgerStatusMeta}>
                {verify?.details?.verified !== undefined ? `Verified: ${verify.details.verified}` : ""}
              </span>
            </div>

            {verify?.details ? (
              <div className={styles.ledgerHint}>
                {verify.details.message || verify.details.error || "Verification details available."}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <div className={styles.walletOpsWarn}>{error}</div> : null}

      {/* Main split */}
      <div className={styles.ledgerGrid}>
        {/* Block list */}
        <div className={styles.ledgerCard}>
          <div className={styles.ledgerCardHead}>
            <div className={styles.ledgerCardTitle}>Block History</div>
            <div className={styles.badge}>{blocks.length} blocks</div>
          </div>

          <div className={styles.ledgerBlocksRow}>
            {blocks.length === 0 ? (
              <div className={styles.empty}>No blocks mined</div>
            ) : (
              blocks.map((b, i) => {
                const height = b?.height ?? b?.index ?? i;
                const time = b?.createdAt ?? b?.timestamp ?? b?.time ?? Date.now();
                const txCount = b?.itemsCount ?? 0;
                const hash = b?.blockHash ?? b?.hash ?? "";
                const prev = b?.prevHash ?? b?.previousHash ?? "";
                const status = b?.status || b?.sources?.status || "UNKNOWN";
                const sealedBy = b?.sealedByUserId || "—";

                return (
                  <button
                    key={height}
                    type="button"
                    className={styles.blockCardBtn}
                    onClick={() => openBlock(height)}
                    title="Open block details"
                  >
                    <div className={styles.blockCardTop}>
                      <span className={styles.blockCardHeight}>#{height}</span>
                      <span className={styles.blockCardTime}>{safeDate(time).toLocaleTimeString()}</span>
                    </div>

                    <div className={styles.blockCardBody}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div className={styles.blockCardTx}>{txCount} txns</div>
                        <span className={`${styles.statusPill} ${styles.statusNeutral}`}>{status}</span>
                      </div>

                      <div className={styles.blockCardHash}>
                        <span className={styles.dim}>Hash:</span> <span className={styles.mono}>{shortHash(hash)}</span>
                      </div>
                      <div className={styles.blockCardHash}>
                        <span className={styles.dim}>Prev:</span> <span className={styles.mono}>{shortHash(prev)}</span>
                      </div>
                      <div className={styles.blockCardHash}>
                        <span className={styles.dim}>Sealed by:</span>{" "}
                        <span className={styles.mono}>{shortHash(sealedBy)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Details + audit */}
        <div className={styles.ledgerSide}>
          {/* Block details */}
          <div className={styles.ledgerCard}>
            <div className={styles.ledgerCardHead}>
              <div className={styles.ledgerCardTitle}>Block Details</div>
              <div className={styles.badge}>{selected ? `#${selected.height}` : "Select a block"}</div>
            </div>

            {!selected ? (
              <div className={styles.ledgerEmptyBox}>Click a block card to view full details.</div>
            ) : (
              <div className={styles.ledgerDetailGrid}>
                <div className={styles.ledgerDetailItem}>
                  <div className={styles.ledgerDetailLabel}>Status</div>
                  <div className={styles.ledgerDetailValue}>{selected.status}</div>
                </div>

                <div className={styles.ledgerDetailItem}>
                  <div className={styles.ledgerDetailLabel}>Block Hash</div>
                  <div className={`${styles.mono} ${styles.ledgerDetailValue}`}>{selected.blockHash}</div>
                </div>

                <div className={styles.ledgerDetailItem}>
                  <div className={styles.ledgerDetailLabel}>Previous Hash</div>
                  <div className={`${styles.mono} ${styles.ledgerDetailValue}`}>{selected.prevHash}</div>
                </div>

                <div className={styles.ledgerDetailItem}>
                  <div className={styles.ledgerDetailLabel}>Merkle Root</div>
                  <div className={`${styles.mono} ${styles.ledgerDetailValue}`}>{selected.merkleRoot}</div>
                </div>

                <div className={styles.ledgerDetailItem}>
                  <div className={styles.ledgerDetailLabel}>Items Count</div>
                  <div className={styles.ledgerDetailValue}>{selected.itemsCount}</div>
                </div>

                <div className={styles.ledgerDetailItem}>
                  <div className={styles.ledgerDetailLabel}>Sealed By (User)</div>
                  <div className={`${styles.mono} ${styles.ledgerDetailValue}`}>{selected.sealedByUserId}</div>
                </div>

                <div className={styles.ledgerDetailItem}>
                  <div className={styles.ledgerDetailLabel}>Created At</div>
                  <div className={styles.ledgerDetailValue}>
                    {selected.createdAt ? safeDate(selected.createdAt).toLocaleString() : "—"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Admin audit log */}
          <div className={styles.ledgerCard}>
            <div className={styles.ledgerCardHead}>
              <div className={styles.ledgerCardTitle}>Admin Actions</div>
              <div className={styles.badge}>{actions.length}</div>
            </div>

            <div className={styles.ledgerAuditList}>
              {actions.length === 0 ? (
                <div className={styles.empty}>No admin actions found</div>
              ) : (
                actions.map((it, idx) => {
                  const id = it?._id || it?.id || String(idx);
                  const action = it?.action || it?.type || "SYSTEM_EVENT";
                  const status = String(it?.status || "COMPLETED").toUpperCase();
                  const when = it?.updatedAt || it?.createdAt || Date.now();

                  const requestId = it?.requestId ? String(it.requestId).slice(0, 8) + "…" : null;

                  return (
                    <div key={id} className={styles.ledgerAuditItem}>
                      <div className={styles.ledgerAuditTop}>
                        <div className={styles.ledgerAuditAction}>
                          {action} {requestId ? <span className={styles.dim}>({requestId})</span> : null}
                        </div>
                        <span className={`${styles.statusPill} ${styles.statusNeutral}`}>{status}</span>
                      </div>

                      <div className={styles.ledgerAuditMeta}>
                        <span className={styles.mono}>{String(id).slice(0, 8)}…</span>
                        <span className={styles.dim}>{safeDate(when).toLocaleString()}</span>
                      </div>

                      <div className={styles.ledgerHint}>
                        {it?.ip ? `IP: ${it.ip} · ` : ""}
                        {it?.deviceId ? `Device: ${String(it.deviceId).slice(0, 8)}… · ` : ""}
                        {it?.adminUserId ? `Admin: ${String(it.adminUserId).slice(0, 8)}…` : ""}
                      </div>

                      {it?.message ? <div className={styles.ledgerHint}>{it.message}</div> : null}
                      {it?.reason ? <div className={styles.ledgerHint}>Reason: {it.reason}</div> : null}
                      {it?.tip ? (
                        <div className={styles.ledgerHint}>
                          Tip: height {it.tip.height} · {shortHash(it.tip.blockHash)}
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
    </div>
  );
}
