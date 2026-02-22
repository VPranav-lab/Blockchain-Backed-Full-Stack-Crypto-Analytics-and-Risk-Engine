// src/pages/wallet/Wallet.jsx
import { useEffect, useMemo, useState } from "react";
import styles from "./Wallet.module.css";
import { walletApi } from "../api/walletApi";
import { FEATURES } from "../config/features";

const formatCurrency = (val) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(val || 0)
  );

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const maskLast4 = (x) => {
  const s = String(x || "");
  return s.length >= 4 ? s.slice(-4) : s;
};

const SOURCE_OPTIONS = [
  { id: "BANK", label: "Bank (IBAN)", value: "Bank (IBAN)" },
  { id: "DEBIT", label: "Debit Card", value: "Debit Card" },
  { id: "CREDIT", label: "Credit Card", value: "Credit Card" },
];

const Icons = {
  ArrowRight: (props) => (
    <svg
      {...props}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  Shield: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  Empty: () => (
    <svg
      width="46"
      height="46"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2b3139"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
};

function getTxDate(tx) {
  return tx?.created_at || tx?.createdAt || tx?.timestamp || tx?.time;
}
function getTxReference(tx) {
  return tx?.reference_id || tx?.referenceId || tx?.ref || tx?.id || "---";
}
function getTxSource(tx) {
  return tx?.source || tx?.meta?.source || tx?.details?.source || "";
}
function normalizeSignedAmount(tx) {
  const type = String(tx?.type || "").toLowerCase();
  const amt = Number(tx?.amount ?? 0);
  if (type === "withdraw") return -Math.abs(amt);
  if (type === "deposit") return Math.abs(amt);
  return amt;
}

function TransactionRow({ tx }) {
  const type = String(tx?.type || "").toLowerCase();
  const signed = normalizeSignedAmount(tx);
  const isPositive = signed > 0;
  const sign = signed > 0 ? "+" : signed < 0 ? "-" : "";
  const source = getTxSource(tx);

  return (
    <tr className={styles.txRow}>
      <td>{formatDate(getTxDate(tx))}</td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className={`${styles.txIcon} ${
              isPositive ? styles.txDep : styles.txWith
            }`}
          >
            {isPositive ? (
              <Icons.ArrowRight style={{ transform: "rotate(90deg)" }} />
            ) : (
              <Icons.ArrowRight style={{ transform: "rotate(-90deg)" }} />
            )}
          </div>
          <span
            style={{
              textTransform: "capitalize",
              fontWeight: 800,
              color: "#EAECEF",
            }}
          >
            {type || "unknown"}
          </span>
        </div>
      </td>
      <td className={styles.mono} style={{ color: "#848E9C" }}>
        <div style={{ overflowWrap: "anywhere" }}>{getTxReference(tx)}</div>
        {source ? (
          <div style={{ fontSize: 12, color: "#5e6673", marginTop: 4 }}>
            {source}
          </div>
        ) : null}
      </td>
      <td
        style={{
          textAlign: "right",
          fontWeight: 900,
          color: isPositive ? "#0ECB81" : signed < 0 ? "#F6465D" : "#848E9C",
        }}
      >
        {sign}
        {formatCurrency(Math.abs(signed))}
      </td>
      <td style={{ textAlign: "right" }}>
        <span className={styles.statusPill}>
          {String(tx?.status || "CONFIRMED").toUpperCase()}
        </span>
      </td>
    </tr>
  );
}

function isValidBank(b) {
  if (!b) return false;
  const bn = String(b.bankName || "").trim();
  const an = String(b.accountNumber || "").trim();
  return !!bn && !!an;
}

export default function Wallet() {
  if (!FEATURES.WALLET) {
    return (
      <div style={{ padding: 32, color: "#EAECEF" }}>
        <h2 style={{ marginTop: 0 }}>Wallet is disabled</h2>
        <p style={{ color: "#848E9C", maxWidth: 760 }}>
          Turn on <code>FEATURES.WALLET</code> in{" "}
          <code>src/config/features.js</code>.
        </p>
      </div>
    );
  }

  const [tab, setTab] = useState("HISTORY");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // core wallet numbers
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);

  // ✅ access state (wallet+kyc combined)
  const [access, setAccess] = useState({
    displayStatus: "LOCKED",
    walletStatus: "LOCKED",
    kycStatus: "NOT_SUBMITTED",
    isActive: false,
    isPending: false,
    isLocked: true,
    canTransfer: false,
    canLinkBank: false,
    wallet: { balance: 0, currency: "USDT", status: "LOCKED" },
    kyc: { status: "NOT_SUBMITTED" },
  });

  const [bank, setBank] = useState(null);
  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountNumber: "",
    iban: "",
    bic: "",
  });

  const [amount, setAmount] = useState("");
  const [depositSource, setDepositSource] = useState("BANK");

  const caps = walletApi?.capabilities || {};
  const canBankFeature = !!caps.bankDetails;
  const canTransferFeature = !!caps.userTransfers;

  const displayStatus = String(access.displayStatus || "LOCKED").toUpperCase();
  const isLocked = !!access.isLocked; // includes PENDING / NOT_SUBMITTED / REJECTED
  const isPending = !!access.isPending;

  // ✅ treat bank as linked only if required fields exist
  const bankLinked = useMemo(() => isValidBank(bank), [bank]);

  const netAmount = useMemo(() => {
    const a = Number(amount || 0);
    return Number.isFinite(a) && a > 0 ? a : 0;
  }, [amount]);

  const selectedSource = useMemo(() => {
    return SOURCE_OPTIONS.find((x) => x.id === depositSource) || SOURCE_OPTIONS[0];
  }, [depositSource]);

  const bankRequiredForDeposit = depositSource === "BANK";

  const resetMsg = () => setMsg({ type: "", text: "" });
  const pushMsg = (type, text) => setMsg({ type, text });

  const fetchData = async () => {
    setLoading(true);
    resetMsg();

    try {
      // ✅ One call gives you:
      // - wallet balance/status from core
      // - kyc status from core
      // - computed displayStatus + gating flags
      const [accessRes, txRes] = await Promise.all([
        walletApi.getAccessState(),       // core 5000 (balance + kyc status)
        walletApi.getTransactions(200),   // core 5000
      ]);

      setAccess(accessRes);

      // wallet numbers from core
      setBalance(Number(accessRes?.wallet?.balance || 0));
      setTransactions(Array.isArray(txRes) ? txRes : []);

      // bank comes from gateway (4000)
      if (canBankFeature) {
        const b = await walletApi.getBank().catch(() => null);
        const safeBank = isValidBank(b) ? b : null;
        setBank(safeBank);

        // only populate form when we actually have a bank
        if (safeBank) {
          setBankForm({
            bankName: safeBank.bankName || "",
            accountNumber: safeBank.accountNumber || "",
            iban: safeBank.iban || "",
            bic: safeBank.bic || "",
          });
        }
      } else {
        setBank(null);
      }
    } catch (err) {
      console.error("Wallet fetch error:", err);
      // fall back hard
      setAccess((s) => ({
        ...s,
        displayStatus: "LOCKED",
        walletStatus: "LOCKED",
        isLocked: true,
        isPending: false,
        canTransfer: false,
        canLinkBank: false,
      }));
      setBalance(0);
      setTransactions([]);
      setBank(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- ACTIONS ----------
  const handleSaveBank = async () => {
    resetMsg();

    // ✅ KYC lock enforcement (frontend)
    if (!access.canLinkBank) {
      if (isPending) return pushMsg("error", "Your KYC is pending review. Bank linking is disabled.");
      return pushMsg("error", "Wallet is locked until your KYC is approved.");
    }
    if (!canBankFeature) return pushMsg("error", "Bank linking is not available.");

    if (!bankForm.bankName?.trim()) return pushMsg("error", "Bank name is required.");
    if (!bankForm.accountNumber?.trim()) return pushMsg("error", "Account number is required.");
    if (!bankForm.iban?.trim()) return pushMsg("error", "IBAN is required.");

    setProcessing(true);
    try {
      await walletApi.saveBank(bankForm);
      pushMsg("success", "Bank details saved.");
      await fetchData();
    } catch (err) {
      const s = err?.response?.status;
      if (s === 403 || s === 423) {
        return pushMsg("error", "Wallet is locked until KYC approval.");
      }
      pushMsg("error", err?.response?.data?.message || "Failed to save bank details.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeposit = async () => {
    resetMsg();

    if (!canTransferFeature) return pushMsg("error", "Transfers are disabled.");
    if (!access.canTransfer) {
      if (isPending) return pushMsg("error", "Your KYC is pending review. Deposits are disabled.");
      return pushMsg("error", "Wallet is locked until your KYC is approved.");
    }

    if (bankRequiredForDeposit && !bankLinked) {
      return pushMsg("error", "Please link your bank first.");
    }

    const num = Number(amount);
    if (!amount || Number.isNaN(num) || num <= 0) return pushMsg("error", "Enter a valid amount.");

    setProcessing(true);
    try {
      await walletApi.deposit({ amount: num, source: selectedSource.value });
      pushMsg("success", `Deposit successful via ${selectedSource.label}: ${formatCurrency(num)}.`);
      setAmount("");
      await fetchData();
      setTab("HISTORY");
    } catch (err) {
      const s = err?.response?.status;
      if (s === 403 || s === 423) return pushMsg("error", "Wallet is locked until KYC approval.");
      if (s === 404 || s === 409) return pushMsg("error", "Please link your bank first.");
      pushMsg("error", err?.response?.data?.message || "Deposit failed.");
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    resetMsg();

    if (!canTransferFeature) return pushMsg("error", "Transfers are disabled.");
    if (!access.canTransfer) {
      if (isPending) return pushMsg("error", "Your KYC is pending review. Withdrawals are disabled.");
      return pushMsg("error", "Wallet is locked until your KYC is approved.");
    }
    if (!bankLinked) return pushMsg("error", "Please link your bank first.");

    const num = Number(amount);
    if (!amount || Number.isNaN(num) || num <= 0) return pushMsg("error", "Enter a valid amount.");
    if (num > balance) return pushMsg("error", "Insufficient available balance.");

    setProcessing(true);
    try {
      await walletApi.withdraw({ amount: num });
      pushMsg("success", `Withdrawal submitted: ${formatCurrency(num)}.`);
      setAmount("");
      await fetchData();
      setTab("HISTORY");
    } catch (err) {
      const s = err?.response?.status;
      if (s === 403 || s === 423) return pushMsg("error", "Wallet is locked until KYC approval.");
      if (s === 404 || s === 409) return pushMsg("error", "Please link your bank first.");
      pushMsg("error", err?.response?.data?.message || "Withdraw failed.");
    } finally {
      setProcessing(false);
    }
  };

  const tabs = [
    { id: "HISTORY", label: "History" },
    { id: "DEPOSIT", label: "Add Funds" },
    { id: "WITHDRAW", label: "Withdraw" },
    { id: "BANK", label: "Bank" },
  ];

  const title =
    tab === "HISTORY"
      ? "Transaction History"
      : tab === "DEPOSIT"
      ? "Add Funds"
      : tab === "WITHDRAW"
      ? "Withdraw"
      : "Bank Details";

  const subtitle =
    tab === "HISTORY"
      ? "Recent deposits and withdrawals"
      : tab === "DEPOSIT"
      ? "Choose a funding source and deposit"
      : tab === "WITHDRAW"
      ? "Withdraw available funds to your linked bank"
      : "Link or update your bank details";

  // nice helper text for the sidebar note
  const lockNote = useMemo(() => {
    if (displayStatus === "PENDING") return "KYC is pending review. Wallet features are disabled.";
    if (displayStatus === "LOCKED") return "Wallet is locked until your KYC is approved.";
    return "";
  }, [displayStatus]);

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.accountCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardLabel}>Spot Wallet</span>

              {/* ✅ This is now the KYC-aware badge */}
              <span
                className={`${styles.statusBadge} ${
                  displayStatus === "ACTIVE" ? styles.badgeActive : styles.badgeLocked
                }`}
              >
                {displayStatus}
              </span>
            </div>

            {displayStatus !== "ACTIVE" && (
              <div className={styles.note} style={{ marginTop: 10 }}>
                {lockNote}
              </div>
            )}

            <div style={{ margin: "16px 0 12px" }}>
              <div className={styles.balLabel}>Available Balance</div>
              <div className={styles.balValue}>
                {loading ? "..." : formatCurrency(balance)}
              </div>
            </div>

            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Provider</span>
                <span style={{ fontWeight: 900, textTransform: "uppercase" }}>
                  {walletApi?.provider || "hybrid"}
                </span>
              </div>

              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Bank</span>
                <span
                  style={{
                    fontWeight: 900,
                    color: !canBankFeature
                      ? "#848E9C"
                      : bankLinked
                      ? "#0ECB81"
                      : "#F6465D",
                  }}
                >
                  {canBankFeature ? (bankLinked ? "Linked" : "Not linked") : "N/A"}
                </span>
              </div>
            </div>
          </div>

          <nav className={styles.navMenu}>
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`${styles.navBtn} ${
                  tab === t.id ? styles.navBtnActive : ""
                }`}
                onClick={() => {
                  setTab(t.id);
                  resetMsg();
                  setAmount("");
                  if (t.id === "DEPOSIT") setDepositSource("DEBIT");
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className={styles.panel}>
          {msg.text && (
            <div
              className={`${styles.alert} ${
                msg.type === "success" ? styles.success : styles.error
              }`}
            >
              {msg.text}
            </div>
          )}

          {/* Header */}
          <div className={styles.header}>
            <div>
              <div className={styles.title}>{title}</div>
              <div className={styles.subtitle}>{subtitle}</div>
            </div>

            <button
              className={styles.refreshBtn}
              onClick={fetchData}
              disabled={loading || processing}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* HISTORY */}
          {tab === "HISTORY" && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {["Date", "Type", "Reference", "Amount", "Status"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign:
                            h === "Amount" || h === "Status" ? "right" : "left",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan="5"
                        style={{
                          padding: 50,
                          textAlign: "center",
                          color: "#848E9C",
                        }}
                      >
                        Loading ledger...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        style={{
                          padding: 60,
                          textAlign: "center",
                          color: "#848E9C",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 10,
                            opacity: 0.65,
                          }}
                        >
                          <Icons.Empty />
                          <span>No transactions found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, i) => <TransactionRow key={i} tx={tx} />)
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* DEPOSIT */}
          {tab === "DEPOSIT" && (
            <div className={styles.twoCol}>
              {/* Bank (only required for BANK deposits) */}
              <div className={styles.card}>
                <div className={styles.cardTitleRow}>
                  <div className={styles.cardTitle}>Bank Account</div>
                  <span className={styles.pill}>
                    {bankLinked ? (
                      <span
                        style={{
                          display: "inline-flex",
                          gap: 8,
                          alignItems: "center",
                          color: "#0ECB81",
                        }}
                      >
                        <Icons.Shield /> Linked
                      </span>
                    ) : (
                      "Not linked"
                    )}
                  </span>
                </div>

                {bankLinked ? (
                  <div className={styles.muted}>
                    <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
                      <div>
                        <div
                          style={{
                            color: "#5e6673",
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: 0.6,
                          }}
                        >
                          BANK NAME
                        </div>
                        <div style={{ color: "#EAECEF", fontWeight: 900 }}>
                          {bank.bankName}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            color: "#5e6673",
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: 0.6,
                          }}
                        >
                          ACCOUNT
                        </div>
                        <div
                          className={styles.mono}
                          style={{ color: "#EAECEF", fontWeight: 900 }}
                        >
                          •••• {maskLast4(bank.accountNumber)}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            color: "#5e6673",
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: 0.6,
                          }}
                        >
                          IBAN
                        </div>
                        <div
                          className={styles.mono}
                          style={{
                            color: "#EAECEF",
                            fontWeight: 800,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {bank.iban}
                        </div>
                      </div>
                    </div>

                    <div className={styles.note} style={{ marginTop: 14 }}>
                      Want to update? Go to <b>Bank</b> tab.
                    </div>
                  </div>
                ) : (
                  <div className={styles.bankFormCard} style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 900, color: "#EAECEF" }}>
                      Link Bank
                    </div>
                    <div className={styles.note}>
                      {!access.canLinkBank
                        ? isPending
                          ? "KYC is pending review. Bank linking is disabled."
                          : "KYC approval required before linking a bank."
                        : "Bank is required only if you deposit via Bank (IBAN)."}
                    </div>
                    <button
                      className={styles.submitBtn}
                      onClick={() => setTab("BANK")}
                      disabled={!access.canLinkBank}
                    >
                      Link Bank
                    </button>
                  </div>
                )}
              </div>

              {/* Deposit */}
              <div className={styles.card}>
                <div className={styles.cardTitleRow}>
                  <div className={styles.cardTitle}>Deposit Amount</div>
                  <span className={styles.pill}>Method: {selectedSource.label}</span>
                </div>

                <label className={styles.inputLabel} style={{ marginTop: 12 }}>
                  Funding Source
                </label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {SOURCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDepositSource(opt.id)}
                      className={styles.presetBtn}
                      disabled={!access.canTransfer || processing}
                      style={{
                        border:
                          depositSource === opt.id
                            ? "1px solid rgba(14,203,129,0.8)"
                            : undefined,
                        opacity: depositSource === opt.id ? 1 : 0.85,
                        fontWeight: depositSource === opt.id ? 900 : 800,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <label className={styles.inputLabel} style={{ marginTop: 12 }}>
                  Amount
                </label>
                <div className={styles.amountBox}>
                  <span className={styles.currencySymbol}>$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={styles.amountInput}
                    disabled={!access.canTransfer || processing}
                  />
                  <div className={styles.presetGroup}>
                    {[100, 500].map((val) => (
                      <button
                        key={val}
                        onClick={() => setAmount(String(val))}
                        className={styles.presetBtn}
                        disabled={!access.canTransfer || processing}
                      >
                        ${val}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.infoBox}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#848E9C",
                      fontSize: 13,
                    }}
                  >
                    <span>Net Received</span>
                    <span
                      className={styles.mono}
                      style={{ color: "#EAECEF", fontWeight: 900 }}
                    >
                      {formatCurrency(netAmount)}
                    </span>
                  </div>
                </div>

                <button
                  className={styles.submitBtn}
                  onClick={handleDeposit}
                  disabled={
                    !access.canTransfer ||
                    (bankRequiredForDeposit && !bankLinked) ||
                    processing ||
                    !amount
                  }
                >
                  {processing ? "Processing..." : "Confirm Deposit"}
                </button>

                {!access.canTransfer && (
                  <div className={styles.note}>
                    {isPending
                      ? "KYC is pending review. Deposits are disabled."
                      : "KYC approval required before deposits."}
                  </div>
                )}
                {access.canTransfer && bankRequiredForDeposit && !bankLinked && (
                  <div className={styles.note}>
                    Link your bank to enable Bank (IBAN) deposits.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WITHDRAW */}
          {tab === "WITHDRAW" && (
            <div className={styles.twoCol}>
              {/* Bank */}
              <div className={styles.card}>
                <div className={styles.cardTitleRow}>
                  <div className={styles.cardTitle}>Bank Account</div>
                  <span className={styles.pill}>
                    {bankLinked ? (
                      <span
                        style={{
                          display: "inline-flex",
                          gap: 8,
                          alignItems: "center",
                          color: "#0ECB81",
                        }}
                      >
                        <Icons.Shield /> Linked
                      </span>
                    ) : (
                      "Not linked"
                    )}
                  </span>
                </div>

                {bankLinked ? (
                  <div className={styles.muted}>
                    <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
                      <div>
                        <div
                          style={{
                            color: "#5e6673",
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: 0.6,
                          }}
                        >
                          BANK NAME
                        </div>
                        <div style={{ color: "#EAECEF", fontWeight: 900 }}>
                          {bank.bankName}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            color: "#5e6673",
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: 0.6,
                          }}
                        >
                          ACCOUNT
                        </div>
                        <div
                          className={styles.mono}
                          style={{ color: "#EAECEF", fontWeight: 900 }}
                        >
                          •••• {maskLast4(bank.accountNumber)}
                        </div>
                      </div>
                    </div>
                    <div className={styles.note} style={{ marginTop: 14 }}>
                      Want to update? Go to <b>Bank</b> tab.
                    </div>
                  </div>
                ) : (
                  <div className={styles.bankFormCard} style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 900, color: "#EAECEF" }}>
                      Link Bank to Withdraw
                    </div>
                    <div className={styles.note}>
                      {!access.canLinkBank
                        ? isPending
                          ? "KYC is pending review. Bank linking is disabled."
                          : "KYC approval required before linking a bank."
                        : "You must link your bank before withdrawals."}
                    </div>
                    <button
                      className={styles.submitBtn}
                      onClick={() => setTab("BANK")}
                      disabled={!access.canLinkBank}
                    >
                      Link Bank
                    </button>
                  </div>
                )}
              </div>

              {/* Withdraw */}
              <div className={styles.card}>
                <div className={styles.cardTitleRow}>
                  <div className={styles.cardTitle}>Withdraw Amount</div>
                  <span className={styles.pill}>
                    Available:{" "}
                    <span
                      className={styles.mono}
                      style={{ marginLeft: 8, fontWeight: 900 }}
                    >
                      {formatCurrency(balance)}
                    </span>
                  </span>
                </div>

                <label className={styles.inputLabel} style={{ marginTop: 12 }}>
                  Amount
                </label>
                <div className={styles.amountBox}>
                  <span className={styles.currencySymbol}>$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={styles.amountInput}
                    disabled={!access.canTransfer || !bankLinked || processing}
                  />
                  <button
                    onClick={() => setAmount(String(balance))}
                    className={styles.maxBtn}
                    disabled={!access.canTransfer || !bankLinked || processing}
                  >
                    MAX
                  </button>
                </div>

                <button
                  className={`${styles.submitBtn} ${styles.btnWithdraw}`}
                  onClick={handleWithdraw}
                  disabled={!access.canTransfer || !bankLinked || processing || !amount}
                >
                  {processing ? "Processing..." : "Confirm Withdraw"}
                </button>

                {!access.canTransfer && (
                  <div className={styles.note}>
                    {isPending
                      ? "KYC is pending review. Withdrawals are disabled."
                      : "KYC approval required before withdrawals."}
                  </div>
                )}
                {access.canTransfer && !bankLinked && (
                  <div className={styles.note}>Link your bank to enable withdrawals.</div>
                )}
              </div>
            </div>
          )}

          {/* BANK */}
          {tab === "BANK" && (
            <div className={styles.twoCol}>
              {/* Current bank */}
              <div className={styles.card}>
                <div className={styles.cardTitleRow}>
                  <div className={styles.cardTitle}>Current Bank</div>
                  {bankLinked ? (
                    <span className={styles.pill} style={{ color: "#0ECB81" }}>
                      <Icons.Shield /> Linked
                    </span>
                  ) : (
                    <span className={styles.pill}>Not linked</span>
                  )}
                </div>

                {bankLinked ? (
                  <div style={{ marginTop: 8, display: "grid", gap: 10 }}>
                    <div>
                      <div
                        style={{
                          color: "#5e6673",
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: 0.6,
                        }}
                      >
                        BANK NAME
                      </div>
                      <div style={{ color: "#EAECEF", fontWeight: 900 }}>
                        {bank.bankName}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          color: "#5e6673",
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: 0.6,
                        }}
                      >
                        ACCOUNT
                      </div>
                      <div
                        className={styles.mono}
                        style={{ color: "#EAECEF", fontWeight: 900 }}
                      >
                        •••• {maskLast4(bank.accountNumber)}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          color: "#5e6673",
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: 0.6,
                        }}
                      >
                        IBAN
                      </div>
                      <div
                        className={styles.mono}
                        style={{
                          color: "#EAECEF",
                          fontWeight: 800,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {bank.iban}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.note}>
                    {!access.canLinkBank
                      ? isPending
                        ? "KYC is pending review. Bank linking is disabled."
                        : "KYC approval required before linking a bank."
                      : "No bank linked yet."}
                  </div>
                )}
              </div>

              {/* Form */}
              <div className={styles.card}>
                <div className={styles.cardTitleRow}>
                  <div className={styles.cardTitle}>
                    {bankLinked ? "Update Bank Details" : "Link Bank Details"}
                  </div>
                  <span className={styles.pill}>IBAN Required</span>
                </div>

                {!access.canLinkBank && (
                  <div className={styles.note} style={{ marginTop: 10 }}>
                    {isPending
                      ? "KYC is pending review. Bank linking is disabled."
                      : "Wallet is locked until your KYC is approved. Bank linking is disabled."}
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <label className={styles.inputLabel}>Bank Name *</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. HSBC / Revolut / UniCredit"
                    value={bankForm.bankName}
                    onChange={(e) =>
                      setBankForm((s) => ({ ...s, bankName: e.target.value }))
                    }
                    disabled={!access.canLinkBank || processing}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <label className={styles.inputLabel}>Account Number *</label>
                  <input
                    className={styles.input}
                    placeholder="000000000000"
                    value={bankForm.accountNumber}
                    onChange={(e) =>
                      setBankForm((s) => ({
                        ...s,
                        accountNumber: e.target.value,
                      }))
                    }
                    disabled={!access.canLinkBank || processing}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <label className={styles.inputLabel}>IBAN *</label>
                  <input
                    className={styles.input}
                    placeholder="IT60X0542811101000000123456"
                    value={bankForm.iban}
                    onChange={(e) =>
                      setBankForm((s) => ({
                        ...s,
                        iban: e.target.value.toUpperCase(),
                      }))
                    }
                    disabled={!access.canLinkBank || processing}
                  />
                </div>

                <button
                  className={styles.submitBtn}
                  onClick={handleSaveBank}
                  disabled={processing || !access.canLinkBank}
                >
                  {processing ? "Saving..." : "Save Bank"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
