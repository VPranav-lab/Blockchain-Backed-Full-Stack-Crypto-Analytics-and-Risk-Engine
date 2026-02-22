// src/pages/admin/tabs/WalletOperations.jsx
import React, { useMemo, useState } from "react";
import { walletApi } from "../../../api/walletApi";
import { ledgerApi } from "../../../api/ledgerApi";
import styles from "../AdminDashboard.module.css";

function shortHash(h) {
  if (!h || typeof h !== "string") return "—";
  return h.length <= 14 ? h : `${h.slice(0, 10)}…${h.slice(-4)}`;
}

export default function WalletOperations() {
  const [loading, setLoading] = useState(false);

  // receipt UI (manual)
  const [manualTxId, setManualTxId] = useState("");
  const [lastTxId, setLastTxId] = useState(null);
  const [receipt, setReceipt] = useState(null);

  // messages
  const [infoMsg, setInfoMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");

  // show ledgerCommit returned by backend
  const [lastCommit, setLastCommit] = useState(null);

  const [adjustForm, setAdjustForm] = useState({
    userId: "",
    amount: "",
    type: "DEPOSIT",
    description: "Admin Adjust",
  });

  const canSubmit = useMemo(() => {
    const amt = Number(adjustForm.amount);
    return !!adjustForm.userId && Number.isFinite(amt) && amt > 0;
  }, [adjustForm.userId, adjustForm.amount]);

  const resetMessagesAndReceipt = () => {
    setInfoMsg("");
    setErrMsg("");
    setReceipt(null);
    setLastTxId(null);
    setLastCommit(null);
  };

  const fetchWalletReceipt = async (txId) => {
    const r = await ledgerApi.getWalletReceipt(txId);

    if (r?.pending) {
      setReceipt(null);
      setErrMsg(
        "Receipt is pending (not committed to a block yet). Auto-mining should commit it soon. You can also mine manually in Ledger → Settlement."
      );
      return { pending: true };
    }

    setReceipt(r);
    setErrMsg("");
    return { pending: false };
  };

  const commitAndFetchReceipt = async () => {
    if (!lastTxId) return;

    setLoading(true);
    setInfoMsg("");
    setErrMsg("");

    try {
      await ledgerApi.commit();
      await fetchWalletReceipt(lastTxId);
    } catch (e) {
      setErrMsg("Commit/fetch failed: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleWalletAdjust = async (e) => {
    e.preventDefault();
    resetMessagesAndReceipt();

    if (!canSubmit) return;

    const amt = Number(adjustForm.amount);
    if (!window.confirm(`Execute ${adjustForm.type} of ${amt} USDT for this user?`)) return;

    setLoading(true);

    try {
      const res = await walletApi.adminAdjust({
        userId: adjustForm.userId,
        type: adjustForm.type,
        amount: amt,
        description: adjustForm.description,
      });

      setAdjustForm((p) => ({ ...p, amount: "" }));

      // ✅ NEW: ledgerCommit integration
      const ledgerCommit = res?.ledgerCommit || res?.data?.ledgerCommit || null;
      if (ledgerCommit) setLastCommit(ledgerCommit);

      // best-effort txId if backend returns it
      const txId =
        res?.txId ??
        res?.walletTxId ??
        res?.id ??
        res?.transactionId ??
        res?.data?.txId ??
        null;

      if (txId) {
        setLastTxId(txId);
        setManualTxId(String(txId));

        if (ledgerCommit?.committed === true) {
          setInfoMsg(
            `✅ Wallet updated and committed in block #${ledgerCommit?.height ?? "—"} (${shortHash(
              ledgerCommit?.blockHash
            )}). You can fetch the receipt below.`
          );
        } else if (ledgerCommit) {
          setInfoMsg(
            "✅ Wallet updated. Ledger commit is pending (auto-mining). You can fetch receipt later or mine manually in Ledger → Settlement."
          );
        } else {
          setInfoMsg("Wallet updated. A txId was returned, so you can fetch the receipt below.");
        }
      } else {
        // No txId returned -> we cannot fetch receipt as admin unless you paste txId from DB
        if (ledgerCommit?.committed === true) {
          setInfoMsg(
            `✅ Wallet updated and committed in block #${ledgerCommit?.height ?? "—"} (${shortHash(
              ledgerCommit?.blockHash
            )}). Backend did not return txId; paste Wallet Tx ID (from DB) to fetch receipt here.`
          );
        } else if (ledgerCommit) {
          setInfoMsg(
            "✅ Wallet updated. Ledger commit is pending (auto-mining). Backend did not return txId; paste Wallet Tx ID (from DB) to fetch receipt here, or let the user view it in Wallet → Transactions."
          );
        } else {
          setInfoMsg(
            "✅ Wallet updated successfully. Backend did not return txId, and admins cannot query the target user's wallet transactions via API. The user can view their receipt in Wallet → Transactions. If you need the receipt as admin, paste the Wallet Tx ID below (from DB) and fetch."
          );
        }
      }
    } catch (e2) {
      setErrMsg("Failed: " + (e2.response?.data?.error || e2.message));
    } finally {
      setLoading(false);
    }
  };

  const handleFetchManualReceipt = async () => {
    const txIdNum = Number(manualTxId);
    if (!Number.isInteger(txIdNum) || txIdNum <= 0) {
      setErrMsg("Enter a valid numeric Wallet Tx ID (example: 7).");
      return;
    }

    setLoading(true);
    setInfoMsg("");
    setErrMsg("");
    setReceipt(null);

    try {
      setLastTxId(txIdNum);
      await fetchWalletReceipt(txIdNum);
    } catch (e) {
      setErrMsg("Failed to fetch receipt: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.tabPanel}>
      <div className={styles.walletOpsHeader}>
        <div>
          <h2 className={styles.walletOpsTitle}>Wallet Management</h2>
          <p className={styles.walletOpsSub}>
            Manually credit or debit a user wallet. Receipts are viewable by users in Wallet → Transactions.
          </p>
        </div>
      </div>

      <div className={styles.walletOpsGrid}>
        {/* LEFT: Adjust Form */}
        <div className={styles.walletOpsCard}>
          <div className={styles.walletOpsCardHead}>
            <div className={styles.walletOpsCardTitle}>Manual Adjustment</div>
            <div className={styles.walletOpsCardHint}>Admin-only</div>
          </div>

          <form onSubmit={handleWalletAdjust} className={styles.walletOpsForm}>
            <div className={styles.walletOpsRow}>
              <div className={styles.formGroup}>
                <label>User UUID</label>
                <input
                  type="text"
                  value={adjustForm.userId}
                  onChange={(e) => setAdjustForm({ ...adjustForm, userId: e.target.value })}
                  placeholder="e.g. 47a536b5-1efc-42ef-916a-48e1c3c03d69"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Operation</label>
                <select value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}>
                  <option value="DEPOSIT">Credit (Deposit)</option>
                  <option value="WITHDRAW">Debit (Withdraw)</option>
                  <option value="ADJUST">Correction</option>
                </select>
              </div>
            </div>

            <div className={styles.walletOpsRow}>
              <div className={styles.formGroup}>
                <label>Amount (USDT)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={adjustForm.amount}
                  onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                  placeholder="e.g. 25.00"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Description</label>
                <input
                  type="text"
                  value={adjustForm.description}
                  onChange={(e) => setAdjustForm({ ...adjustForm, description: e.target.value })}
                  placeholder="Admin Adjust"
                />
              </div>
            </div>

            <div className={styles.walletOpsActions}>
              <button className={styles.btnPrimary} disabled={loading || !canSubmit} type="submit">
                {loading ? "Processing…" : "Execute"}
              </button>

              <button
                className={styles.btnSecondary}
                type="button"
                onClick={() => {
                  setAdjustForm((p) => ({ ...p, userId: "", amount: "" }));
                  setManualTxId("");
                  resetMessagesAndReceipt();
                }}
                disabled={loading}
              >
                Clear
              </button>
            </div>

            {/* NEW: show ledgerCommit quick summary */}
            {lastCommit ? (
              <div className={styles.walletOpsInfo}>
                <b>Ledger Commit:</b>{" "}
                {lastCommit.committed ? (
                  <>
                    COMMITTED • Height: {lastCommit.height ?? "—"} • Block: {shortHash(lastCommit.blockHash)}
                  </>
                ) : (
                  <>PENDING • Auto-mining will commit soon (or mine manually in Ledger → Settlement).</>
                )}
              </div>
            ) : null}

            {infoMsg ? <div className={styles.walletOpsInfo}>{infoMsg}</div> : null}
            {errMsg ? <div className={styles.walletOpsWarn}>{errMsg}</div> : null}
          </form>
        </div>

        {/* RIGHT: Manual Receipt */}
        <div className={styles.walletOpsCard}>
          <div className={styles.walletOpsCardHead}>
            <div className={styles.walletOpsCardTitle}>Receipt (Manual)</div>
            <div className={styles.walletOpsCardHint}>Paste Wallet Tx ID</div>
          </div>

          <div className={styles.walletOpsForm}>
            <div className={styles.walletOpsRow}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label>Wallet Tx ID</label>
                <input
                  type="text"
                  value={manualTxId}
                  onChange={(e) => setManualTxId(e.target.value)}
                  placeholder="e.g. 7"
                />
              </div>

              <div className={styles.formGroup} style={{ alignSelf: "flex-end" }}>
                <button
                  className={styles.btnPrimary}
                  type="button"
                  disabled={loading || !manualTxId.trim()}
                  onClick={handleFetchManualReceipt}
                >
                  {loading ? "Loading…" : "Fetch Receipt"}
                </button>
              </div>
            </div>

            {lastTxId && !receipt ? (
              <button
                className={styles.btnSecondary}
                disabled={loading}
                onClick={commitAndFetchReceipt}
                type="button"
                style={{ width: "100%" }}
              >
                {loading ? "Committing…" : "Mine (Settlement) & Fetch Receipt"}
              </button>
            ) : null}

            {!receipt ? (
              <div className={styles.walletOpsEmpty}>No receipt loaded. Paste a Wallet Tx ID and click “Fetch Receipt”.</div>
            ) : (
              <div className={styles.walletOpsReceipt}>
                <div className={styles.walletOpsReceiptTitle}>Ledger Receipt (Wallet Tx)</div>
                <pre
                  className={styles.walletOpsPre}
                  style={{
                    maxHeight: 360,
                    overflow: "auto",
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {JSON.stringify(receipt, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
