import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { marketApi } from "../../../api/marketApi";
import { healthApi } from "../../../api/healthApi";
import { ledgerApi } from "../../../api/ledgerApi";
import apiClient from "../../../api/apiClient";
import ReversalModal from "../components/ReversalModal";
import * as Icons from "../components/AdminIcons";
import styles from "../AdminDashboard.module.css";

function shortHash(h) {
  if (!h || typeof h !== "string") return "—";
  return h.length <= 14 ? h : `${h.slice(0, 10)}…${h.slice(-4)}`;
}

function prettyJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

// ✅ Always-fixed Portal modal to avoid CSS stacking issues
function ReceiptViewer({ state, onClose, onRetry }) {
  const isOpen = !!state?.isOpen;

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const title = state.title || "Receipt";
  const status = state.status || "idle";

  const headerText =
    status === "loading"
      ? "Loading receipt…"
      : status === "pending"
      ? "Pending ledger commit (auto-mining runs periodically). Try again in a moment."
      : status === "error"
      ? "Failed to load receipt."
      : "Receipt loaded.";

  const receipt = state.receipt;

  const pill = (text, kind = "neutral") => {
    const cls =
      kind === "ok"
        ? styles.statusApproved
        : kind === "bad"
        ? styles.statusRejected
        : styles.statusNeutral;

    return <span className={`${styles.statusPill} ${cls}`}>{text}</span>;
  };

  const overlay = (
    <div
      onMouseDown={(e) => {
        // click outside to close
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          maxHeight: "90vh",
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "linear-gradient(180deg, rgba(17,20,24,0.98), rgba(10,12,14,0.98))",
          boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
            <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>{headerText}</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {state.tradeId ? (
              <button
                className={styles.btnSecondary}
                onClick={() => onRetry?.(state.tradeId)}
                disabled={status === "loading"}
                type="button"
              >
                <Icons.Refresh /> Retry
              </button>
            ) : null}

            <button className={styles.btnDangerMini} onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 14, overflow: "auto", maxHeight: "calc(90vh - 64px)" }}>
          {status === "error" ? (
            <div className={styles.walletOpsWarn} style={{ marginBottom: 10 }}>
              {state.error || "Unknown error"}
            </div>
          ) : null}

          {receipt ? (
            <>
              {/* summary pills */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                {pill(
                  `Block: ${shortHash(receipt?.blockHash || receipt?.block?.blockHash || "—")}`,
                  "neutral"
                )}
                {pill(
                  `Proof OK: ${String(receipt?.verification?.proofOk ?? "—")}`,
                  "neutral"
                )}
                {receipt?.pending ? pill("PENDING", "bad") : pill("AVAILABLE", "ok")}
              </div>

              {/* scrollable json */}
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12,
                  lineHeight: 1.45,
                }}
                className={styles.mono}
              >
                {prettyJson(receipt)}
              </pre>
            </>
          ) : (
            <div className={styles.empty} style={{ padding: 18 }}>
              {status === "loading" ? "Loading…" : "No receipt data."}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(overlay, document.body);
}

export default function SystemMarkets() {
  const [loading, setLoading] = useState(false);
  const [systemHealth, setSystemHealth] = useState({ mysql: "checking...", mongo: "checking..." });
  const [markets, setMarkets] = useState([]);
  const [newSymbol, setNewSymbol] = useState("");

  // Trade Reversal State
  const [tradeSearchId, setTradeSearchId] = useState("");
  const [targetUserTrades, setTargetUserTrades] = useState([]);
  const [reversalModal, setReversalModal] = useState({ isOpen: false, trade: null });

  // Receipt Viewer State
  const [receiptView, setReceiptView] = useState({
    isOpen: false,
    title: "",
    status: "idle", // idle | loading | ready | pending | error
    tradeId: null,
    receipt: null,
    error: "",
  });

  useEffect(() => {
    loadSystemData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSystemData = async () => {
    try {
      const [health, mkt] = await Promise.all([
        healthApi.checkDeep().catch(() => ({ ok: false })),
        marketApi.symbols().catch(() => []),
      ]);

      setSystemHealth({
        mysql: health.mysql ? "Online" : "Down",
        mongo: health.mongo ? "Online" : "Down",
      });

      setMarkets(Array.isArray(mkt) ? mkt : []);
    } catch {
      setSystemHealth({ mysql: "Down", mongo: "Down" });
      setMarkets([]);
    }
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const refreshTradesFromBackend = async (userId) => {
    const { data } = await apiClient.trade.get(`/api/trades/get_trades?userId=${userId}`);
    const rawList = Array.isArray(data) ? data : data?.trades || [];
    const exact = rawList.filter((t) => t.userId === userId);
    setTargetUserTrades(exact);
    return exact;
  };

  // Poll until backend returns REVERSED for this tradeId (fillId)
  const waitForBackendReversal = async ({ userId, tradeId, maxTries = 10, delayMs = 800 }) => {
    for (let i = 0; i < maxTries; i++) {
      const list = await refreshTradesFromBackend(userId);

      const row = list.find((t) => Number(t.fillId || t.id) === Number(tradeId));
      const st = String(row?.status || "").toUpperCase();

      if (st === "REVERSED") return true;

      await sleep(delayMs);
    }
    return false;
  };


  const handleActivateSymbol = async () => {
    const sym = newSymbol.trim().toUpperCase();
    if (!sym) return;

    try {
      setLoading(true);
      await marketApi.activateSymbol(sym);
      setNewSymbol("");
      await loadSystemData();
      alert(`Market ${sym} activated!`);
    } catch (e) {
      alert("Activation failed: " + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleTestML = async () => {
    try {
      const { data } = await apiClient.core.post("/api/ml/price-prediction", {
        symbols: ["BTC"],
        interval: "1h",
        horizon: 4,
      });
      alert(`ML Online!\nPrediction: ${JSON.stringify(data.result)}`);
    } catch (e) {
      console.error(e);
      alert("ML Service Offline (Is Python running?)");
    }
  };

  const handleSearchTrades = async () => {
    const id = tradeSearchId.trim();
    if (!id) return;

    setLoading(true);
    setTargetUserTrades([]);

    try {
      const { data } = await apiClient.trade.get(`/api/trades/get_trades?userId=${id}`);
      const rawList = Array.isArray(data) ? data : data?.trades || [];

      // Safety: filter exact user matches
      const exact = rawList.filter((t) => t.userId === id);

      if (exact.length === 0) {
        if (rawList.length > 0) console.warn("Backend returned trades not matching UUID; filtered out.", rawList);
        alert("User found, but no trades match this specific UUID.");
      } else {
        setTargetUserTrades(exact);
      }
    } catch (e) {
      if (e.response?.status === 404) alert("❌ User UUID not found.");
      else alert("Error fetching trades.");
    } finally {
      setLoading(false);
    }
  };

  const closeReceiptViewer = () => {
    setReceiptView({ isOpen: false, title: "", status: "idle", tradeId: null, receipt: null, error: "" });
  };

  const fetchTradeReceiptIntoViewer = async (tradeId) => {
    setReceiptView({
      isOpen: true,
      title: `Trade Receipt — ID ${tradeId}`,
      status: "loading",
      tradeId,
      receipt: null,
      error: "",
    });

    try {
      const receipt = await ledgerApi.getTradeReceipt(tradeId);

      if (receipt?.pending) {
        setReceiptView((s) => ({ ...s, status: "pending", receipt, error: "" }));
        return;
      }

      setReceiptView((s) => ({ ...s, status: "ready", receipt, error: "" }));
    } catch (e) {
      setReceiptView((s) => ({
        ...s,
        status: "error",
        error: e?.response?.data?.error || e?.response?.data?.message || e?.message || "Failed to fetch receipt",
      }));
    }
  };

  // Client-side aggregation for reversed trades
  const fetchAllReversedReceipts = async () => {
    const reversed = targetUserTrades.filter((t) => String(t.status || "").toUpperCase() === "REVERSED");
    if (reversed.length === 0) return alert("No reversed trades found.");

    setReceiptView({
      isOpen: true,
      title: `Reversed Trade Receipts (${reversed.length})`,
      status: "loading",
      tradeId: null,
      receipt: null,
      error: "",
    });

    const limit = 4;
    const queue = reversed
      .map((t) => Number(t.fillId || t.id))
      .filter((x) => Number.isFinite(x) && x > 0);

    const results = [];
    let idx = 0;

    const worker = async () => {
      while (idx < queue.length) {
        const my = queue[idx++];
        try {
          const r = await ledgerApi.getTradeReceipt(my);
          results.push({ tradeId: my, receipt: r });
        } catch (e) {
          results.push({
            tradeId: my,
            receipt: null,
            error: e?.response?.data?.error || e?.response?.data?.message || e?.message || "Failed",
          });
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, () => worker()));

      const summary = {
        ok: true,
        count: results.length,
        committed: results.filter((x) => x.receipt && !x.receipt.pending).length,
        pending: results.filter((x) => x.receipt && x.receipt.pending).length,
        failed: results.filter((x) => x.error).length,
        items: results,
      };

      setReceiptView((s) => ({ ...s, status: "ready", receipt: summary, error: "" }));
    } catch (e) {
      setReceiptView((s) => ({ ...s, status: "error", error: e?.message || "Failed to fetch reversed receipts" }));
    }
  };

  const healthPillClass = (state) =>
    state === "Online" ? styles.statusApproved : state === "Down" ? styles.statusRejected : styles.statusNeutral;

  const reversedCount = useMemo(
    () => targetUserTrades.filter((t) => String(t.status || "").toUpperCase() === "REVERSED").length,
    [targetUserTrades]
  );

  return (
    <div className={styles.tabPanel}>
     <ReversalModal
        isOpen={reversalModal.isOpen}
        trade={reversalModal.trade}
        onClose={() => setReversalModal({ isOpen: false, trade: null })}
        onSuccess={async (_res, tradeId) => {
          const userId = tradeSearchId.trim(); // the searched UUID

          // ✅ only update UI when backend shows REVERSED
          const ok = await waitForBackendReversal({ userId, tradeId });

          if (!ok) {
            alert("Reversal submitted, but backend still not showing REVERSED yet. Try refresh in a moment.");
          }
        }}
      />


      <ReceiptViewer
        state={receiptView}
        onClose={closeReceiptViewer}
        onRetry={(id) => fetchTradeReceiptIntoViewer(id)}
      />

      {/* Top status row */}
      <div className={styles.heatmapGrid}>
        <div className={styles.heatCard}>
          <div className={styles.heatIcon}>
            <Icons.Activity />
          </div>
          <div>
            <span className={styles.heatTitle}>DB STATUS</span>
            <div className={styles.sysHealthRow}>
              <span className={`${styles.statusPill} ${healthPillClass(systemHealth.mysql)}`}>
                MySQL: {systemHealth.mysql}
              </span>
              <span className={`${styles.statusPill} ${healthPillClass(systemHealth.mongo)}`}>
                Mongo: {systemHealth.mongo}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.heatCard}>
          <div className={styles.heatIcon}>
            <Icons.Server />
          </div>
          <div>
            <span className={styles.heatTitle}>TRADING ENGINE</span>
            <div className={styles.heatValue} style={{ color: "var(--primary)" }}>
              ACTIVE
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className={styles.sysGrid}>
        {/* LEFT: Markets */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>
            <span>Active Markets</span>
            <span className={styles.badge}>{markets.length} total</span>
          </div>

          <div className={styles.sysRow}>
            <input
              className={styles.input}
              placeholder="SOLUSDT"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            />
            <button className={styles.miniBtn} onClick={handleActivateSymbol} disabled={loading || !newSymbol.trim()}>
              Add
            </button>
          </div>

          <div className={styles.sysList}>
            {markets.length === 0 ? (
              <div className={styles.empty}>No markets active</div>
            ) : (
              markets.map((m) => (
                <div key={m.symbol} className={styles.sysListItem}>
                  <div className={styles.sysListMain}>
                    <div className={styles.sysSymbol}>{m.symbol}</div>
                    <div className={styles.sysSmall}>
                      {m.enabled ? (
                        <span className={`${styles.statusPill} ${styles.statusApproved}`}>ACTIVE</span>
                      ) : (
                        <span className={`${styles.statusPill} ${styles.statusNeutral}`}>DISABLED</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Trade Reversal */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>
            <span>Trade Reversal & Audit</span>
            <span className={styles.badge}>Admin tool</span>
          </div>

          <div className={styles.panelSub}>
            Reverse fraud or error trades by creating a compensating ledger entry (original blocks are not deleted).
          </div>

          <div className={styles.sysRow}>
            <input
              className={styles.input}
              placeholder="Paste User UUID"
              value={tradeSearchId}
              onChange={(e) => setTradeSearchId(e.target.value)}
            />
            <button className={styles.btnPrimary} onClick={handleSearchTrades} disabled={loading || !tradeSearchId.trim()}>
              <span className={styles.sysBtnIcon}>
                <Icons.Search />
              </span>
              Search
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10 }}>
            <span className={styles.dim}>Reversed trades: {reversedCount}</span>
            <button
              className={styles.btnSecondary}
              onClick={fetchAllReversedReceipts}
              disabled={loading || reversedCount === 0}
              type="button"
            >
              Fetch All Reversed Receipts
            </button>
          </div>

          <div className={styles.sysListTall}>
            {targetUserTrades.length === 0 ? (
              <div className={styles.empty} style={{ padding: 26 }}>
                Enter a User ID to inspect trade history.
              </div>
            ) : (
              targetUserTrades.map((t) => {
                const id = Number(t.fillId || t.id);
                const qty = t.quantity || t.qty;
                const side = String(t.side || "").toUpperCase();
                const isBuy = side === "BUY";
                const status = String(t.status || "").toUpperCase();

                return (
                  <div key={id} className={styles.tradeCard}>
                    <div className={styles.tradeTop}>
                      <div className={styles.tradeLeft}>
                        <span className={isBuy ? styles.tradeBuy : styles.tradeSell}>
                          {side} {t.symbol}
                        </span>
                        <span className={styles.tradeMain}>
                          {qty} @ {t.price}
                        </span>
                      </div>

                      <div className={styles.tradeActions} style={{ display: "flex", gap: 8 }}>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => fetchTradeReceiptIntoViewer(id)}
                          type="button"
                        >
                          Receipt
                        </button>

                        {status !== "REVERSED" ? (
                          <button
                            className={styles.btnDangerMini}
                            onClick={() => setReversalModal({ isOpen: true, trade: t })}
                            type="button"
                          >
                            Reverse
                          </button>
                        ) : (
                          <span className={`${styles.statusPill} ${styles.statusNeutral}`}>REVERSED</span>
                        )}
                      </div>
                    </div>

                    <div className={styles.tradeMeta}>
                      Executed: {t.executedAt ? new Date(t.executedAt).toLocaleString() : "—"} • Block Height:{" "}
                      <span className={styles.tradeMetaHL}>{t.ledgerBlockHeight ?? "—"}</span> • Fill ID:{" "}
                      <span className={styles.mono}>{t.fillId ?? t.id ?? "—"}</span>
                    </div>
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
