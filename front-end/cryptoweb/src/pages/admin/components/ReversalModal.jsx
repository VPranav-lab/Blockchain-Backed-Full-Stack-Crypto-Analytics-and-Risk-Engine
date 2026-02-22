import React, { useEffect, useMemo, useRef, useState } from "react";
import { tradeApi } from "../../../api/tradeApi";
import { ledgerApi } from "../../../api/ledgerApi";

function shortHash(h) {
  if (!h || typeof h !== "string") return "—";
  return h.length <= 14 ? h : `${h.slice(0, 10)}…${h.slice(-4)}`;
}

export default function ReversalModal({ isOpen, trade, onClose, onSuccess }) {
  const tradeId = useMemo(() => (trade ? (trade.fillId ?? trade.id ?? null) : null), [trade]);

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ stages: idle -> submitting -> waiting_backend -> done
  const [stage, setStage] = useState("idle");

  const [receipt, setReceipt] = useState(null);
  const [receiptKind, setReceiptKind] = useState(null);
  const [receiptErr, setReceiptErr] = useState("");
  const [ledgerCommit, setLedgerCommit] = useState(null);
  const [reversalWalletTxId, setReversalWalletTxId] = useState(null);

  // ✅ hard guard: prevents 2nd submit no matter what rerenders happen
  const submittedRef = useRef(false);

  // ✅ only reset when OPENING a new trade (not on every refresh)
  const lastOpenTradeIdRef = useRef(null);

  const hardReset = () => {
    setReason("");
    setLoading(false);
    setStage("idle");
    setReceipt(null);
    setReceiptKind(null);
    setReceiptErr("");
    setLedgerCommit(null);
    setReversalWalletTxId(null);
    submittedRef.current = false;
    lastOpenTradeIdRef.current = null;
  };

  useEffect(() => {
    if (!isOpen) {
      hardReset();
      return;
    }

    // opening: reset only once per trade
    if (tradeId && lastOpenTradeIdRef.current !== tradeId) {
      hardReset();
      lastOpenTradeIdRef.current = tradeId;
    }
  }, [isOpen, tradeId]);

  if (!isOpen || !trade) return null;

  const canSubmit =
    !loading &&
    stage === "idle" &&
    !submittedRef.current &&
    Boolean(tradeId) &&
    Boolean(reason.trim());

  const setPendingMsg = (kind) => {
    setReceipt(null);
    setReceiptKind(kind);
    setReceiptErr(
      "Reversal recorded ✅ but receipt is pending (not committed to a block yet). Auto-mining should commit soon, or mine manually in Ledger → Settlement."
    );
  };

  const fetchTradeReceipt = async (id) => {
    const r = await ledgerApi.getTradeReceipt(id);
    if (r?.pending) {
      setPendingMsg("trade");
      return { pending: true };
    }
    setReceipt(r);
    setReceiptKind("trade");
    setReceiptErr("");
    return { pending: false };
  };

  const fetchWalletReceipt = async (txId) => {
    const r = await ledgerApi.getWalletReceipt(txId);
    if (r?.pending) {
      setPendingMsg("wallet");
      return { pending: true };
    }
    setReceipt(r);
    setReceiptKind("wallet");
    setReceiptErr("");
    return { pending: false };
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    // ✅ prevent double submit even if UI resets
    submittedRef.current = true;

    setLoading(true);
    setStage("submitting");
    setReceipt(null);
    setReceiptKind(null);
    setReceiptErr("");
    setLedgerCommit(null);
    setReversalWalletTxId(null);

    try {
      const usedReason = reason.trim();

      // 1) reverse trade
      const res = await tradeApi.reverseTrade(tradeId, usedReason);

      // 2) keep reason (don’t clear)
      setReason(usedReason);

      // 3) optional commit info
      const commit = res?.ledgerCommit || res?.data?.ledgerCommit || null;
      if (commit) setLedgerCommit(commit);

      // 4) optional wallet tx id
      const txId = res?.reversalWalletTxId ?? res?.walletTxId ?? null;
      if (txId) setReversalWalletTxId(txId);

      // 5) show receipt if available (non-blocking)
      await fetchTradeReceipt(tradeId);

      // ✅ now wait for parent to confirm backend status
      setStage("waiting_backend");
      await onSuccess?.(res, tradeId);

      // ✅ only mark done AFTER parent confirms backend
      setStage("done");
    } catch (e) {
      submittedRef.current = false; // allow retry only if request failed
      setStage("idle");
      alert("❌ Reversal Failed: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const mineAndRetry = async () => {
    if (loading || !tradeId) return;

    setLoading(true);
    setReceiptErr("");

    try {
      await ledgerApi.commit();

      const retryTrade = await ledgerApi.getTradeReceipt(tradeId);
      if (!retryTrade?.pending) {
        setReceipt(retryTrade);
        setReceiptKind("trade");
        setReceiptErr("");
        return;
      }

      if (reversalWalletTxId) {
        const retryWallet = await ledgerApi.getWalletReceipt(reversalWalletTxId);
        if (!retryWallet?.pending) {
          setReceipt(retryWallet);
          setReceiptKind("wallet");
          setReceiptErr("");
          return;
        }
      }

      setReceipt(null);
      setReceiptErr("Still pending after mining. Try again shortly or check Ledger → Settlement blocks.");
    } catch (e) {
      setReceiptErr("Mine/retry failed: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    hardReset();
    onClose?.();
  };

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.85)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          backgroundColor: "#1e2329",
          padding: 24,
          borderRadius: 12,
          width: 720,
          maxWidth: "100%",
          border: "1px solid #2b3139",
          boxShadow: "0 10px 30px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, color: "#fff" }}>
              Reverse Trade ({trade.symbol}){" "}
              {stage === "done" ? <span style={{ color: "#0ecb81", fontSize: 12 }}>• DONE</span> : null}
              {stage === "waiting_backend" ? <span style={{ color: "#f0b90b", fontSize: 12 }}>• WAITING BACKEND</span> : null}
            </h3>
            <div style={{ marginTop: 6, fontSize: 12, color: "#b7bdc6" }}>
              Fill ID: <span style={{ color: "#fff" }}>{trade.fillId ?? "-"}</span> • Side:{" "}
              <span style={{ color: "#fff" }}>{trade.side ?? "-"}</span> • Qty:{" "}
              <span style={{ color: "#fff" }}>{trade.qty ?? "-"}</span>
            </div>
          </div>

          <button
            onClick={close}
            disabled={loading}
            style={{
              background: "transparent",
              color: "#b7bdc6",
              border: "1px solid #2b3139",
              padding: "8px 10px",
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
            type="button"
          >
            Close
          </button>
        </div>

        {ledgerCommit ? (
          <div style={{ marginTop: 12, fontSize: 12, color: "#b7bdc6" }}>
            <b style={{ color: "#fff" }}>Ledger Commit:</b>{" "}
            {ledgerCommit.committed ? (
              <>
                COMMITTED • Height: {ledgerCommit.height ?? "—"} • Block: {shortHash(ledgerCommit.blockHash)}
              </>
            ) : (
              <>PENDING • Auto-mining will commit soon (or mine manually).</>
            )}
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, color: "#b7bdc6" }}>Reason *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. suspicious_activity / user_error / fraud_reversal"
            rows={3}
            disabled={stage !== "idle"}
            style={{
              width: "100%",
              padding: "10px",
              marginTop: 8,
              borderRadius: 10,
              border: "1px solid #2b3139",
              background: "#0b0e11",
              color: "#fff",
              resize: "vertical",
              boxSizing: "border-box",
              opacity: stage !== "idle" ? 0.85 : 1,
              cursor: stage !== "idle" ? "not-allowed" : "text",
            }}
          />
        </div>

        {receiptErr ? <div style={{ marginTop: 12, color: "#f0b90b", fontSize: 12 }}>{receiptErr}</div> : null}

        {stage !== "idle" && !receipt ? (
          <button
            disabled={loading || !tradeId}
            onClick={mineAndRetry}
            style={{
              background: "transparent",
              color: "#b7bdc6",
              border: "1px solid #2b3139",
              padding: "10px 14px",
              borderRadius: 10,
              width: "100%",
              marginTop: 12,
              fontWeight: 800,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            type="button"
          >
            {loading ? "Mining..." : "Mine (Settlement) & Retry Receipt"}
          </button>
        ) : null}

        {receipt ? (
          <div
            style={{
              marginTop: 12,
              border: "1px solid #2b3139",
              borderRadius: 12,
              padding: 12,
              background: "#0b0e11",
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
              Ledger Receipt ({receiptKind === "wallet" ? "Wallet Tx" : "Trade Fill"})
            </div>
            <pre style={{ margin: 0, whiteSpace: "pre", fontSize: 12, lineHeight: 1.4, maxHeight: 320, overflow: "auto" }}>
              {JSON.stringify(receipt, null, 2)}
            </pre>
          </div>
        ) : null}

        {reversalWalletTxId ? (
          <button
            disabled={loading}
            onClick={() => fetchWalletReceipt(reversalWalletTxId)}
            style={{
              background: "transparent",
              color: "#b7bdc6",
              border: "1px solid #2b3139",
              padding: "10px 14px",
              borderRadius: 10,
              width: "100%",
              marginTop: 12,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
            type="button"
          >
            View Wallet Receipt (Optional)
          </button>
        ) : null}

        {/* ✅ ONLY ONE cancel button */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          

          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            style={{
              background: "#f6465d",
              color: "#fff",
              border: "none",
              padding: "10px 14px",
              borderRadius: 10,
              opacity: canSubmit ? 1 : 0.6,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontWeight: 800,
            }}
            type="button"
          >
            {loading ? "Reversing..." : "Confirm Reversal"}
          </button>
        </div>
      </div>
    </div>
  );
}
