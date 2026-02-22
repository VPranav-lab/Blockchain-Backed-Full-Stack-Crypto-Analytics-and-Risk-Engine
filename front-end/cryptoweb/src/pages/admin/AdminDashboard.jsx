import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./AdminDashboard.module.css";
import * as Icons from "./components/AdminIcons";
import { FEATURES } from "../../config/features";

// Tabs
import KycManagement from "./tabs/KycManagement";
import WalletOperations from "./tabs/WalletOperations";
import SystemMarkets from "./tabs/SystemMarkets";
import SecurityMonitor from "./tabs/SecurityMonitor";
import LedgerAudit from "./tabs/LedgerAudit";
import AlertsCenter from "./tabs/AlertsCenter";

const TAB = {
  KYC: "KYC",
  WALLET: "WALLET",
  SYSTEM: "SYSTEM",
  SECURITY: "SECURITY",
  ALERTS: "ALERTS",
  LEDGER: "LEDGER",
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(TAB.KYC);

  // Access Control
  useEffect(() => {
    if (user && user.role !== "admin") {
      alert("Access Denied: Admins only.");
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const headerTitle = useMemo(() => {
    switch (activeTab) {
      case TAB.KYC:
        return "KYC Management";
      case TAB.WALLET:
        return "Wallet Operations";
      case TAB.SYSTEM:
        return "System & Markets";
      case TAB.SECURITY:
        return "Security System Monitor";
      case TAB.ALERTS:
        return "Alerts Center";
      case TAB.LEDGER:
        return "Ledger Management";
      default:
        return "Admin Console";
    }
  }, [activeTab]);

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          Admin<span style={{ color: "#0ecb81" }}>Console</span>
        </div>

        <nav className={styles.nav}>
          <button
            onClick={() => setActiveTab(TAB.KYC)}
            className={activeTab === TAB.KYC ? styles.active : ""}
            type="button"
          >
            <Icons.User /> Identity (KYC)
          </button>

          {FEATURES.WALLET && (
            <button
              onClick={() => setActiveTab(TAB.WALLET)}
              className={activeTab === TAB.WALLET ? styles.active : ""}
              type="button"
            >
              <Icons.Wallet /> Wallet Ops
            </button>
          )}

          <button
            onClick={() => setActiveTab(TAB.SYSTEM)}
            className={activeTab === TAB.SYSTEM ? styles.active : ""}
            type="button"
          >
            <Icons.Server /> System & Markets
          </button>

          <button
            onClick={() => setActiveTab(TAB.SECURITY)}
            className={activeTab === TAB.SECURITY ? styles.active : ""}
            type="button"
            title="Shows alert trends + this admin’s security feed (not all users online)"
          >
            <Icons.Shield /> Security Monitor
          </button>

          <button
            onClick={() => setActiveTab(TAB.ALERTS)}
            className={activeTab === TAB.ALERTS ? styles.active : ""}
            type="button"
            title="Workflow for OPEN/ACK/CLOSED alerts + receipts"
          >
            <Icons.AlertIcon /> Alerts Center
          </button>

          <button
            onClick={() => setActiveTab(TAB.LEDGER)}
            className={activeTab === TAB.LEDGER ? styles.active : ""}
            type="button"
            title="Settlement + audit chain management (commit/unlock/verify)"
          >
            <Icons.Block /> Ledger
          </button>
        </nav>
      </aside>

      <main className={styles.content}>
        <header className={styles.topbar}>
          <h1>{headerTitle}</h1>
          <div className={styles.adminProfile}>
            <span>{user?.email || "Super Admin"}</span>
          </div>
        </header>

        <div className={styles.workspace}>
          {activeTab === TAB.KYC && <KycManagement />}

          {FEATURES.WALLET && activeTab === TAB.WALLET && <WalletOperations />}

          {activeTab === TAB.SYSTEM && <SystemMarkets />}

          {activeTab === TAB.SECURITY && <SecurityMonitor />}

          {activeTab === TAB.ALERTS && <AlertsCenter />}

          {activeTab === TAB.LEDGER && <LedgerAudit />}
        </div>
      </main>
    </div>
  );
}
