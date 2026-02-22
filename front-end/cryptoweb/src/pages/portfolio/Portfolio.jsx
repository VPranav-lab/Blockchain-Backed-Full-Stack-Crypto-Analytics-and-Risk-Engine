import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Portfolio.module.css";

import { portfolioApi } from "../../api/portfolioApi";
import { walletApi } from "../../api/walletApi";
import { FEATURES } from "../../config/features";

import PortfolioTable from "../../components/portfolio/PortfolioTable";
import RiskDashboard from "../../components/portfolio/RiskDashboard";

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const money2 = (n) =>
  toNum(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Portfolio() {
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState("HOLDINGS");

  const [portfolio, setPortfolio] = useState({ positions: [], totalValue: 0, totalPnL: 0 });
  const [wallet, setWallet] = useState({ balance: 0 });

  const [riskData, setRiskData] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);

  const fetchHoldings = useCallback(async () => {
    try {
      const [pData, wData] = await Promise.all([
        portfolioApi.get(),
        FEATURES.WALLET ? walletApi.getBalance().catch(() => null) : Promise.resolve(null),
      ]);

      setPortfolio(pData || { positions: [], totalValue: 0, totalPnL: 0 });
      if (wData) setWallet(wData);
    } catch (e) {
      console.error("Portfolio sync failed", e);
    }
  }, []);

  useEffect(() => {
    fetchHoldings();
    const interval = setInterval(fetchHoldings, 500);
    return () => clearInterval(interval);
  }, [fetchHoldings]);

  const fetchRisk = useCallback(async () => {
    setRiskLoading(true);
    try {
      const [summary, scenarios, correlation, news] = await Promise.all([
        portfolioApi.getRiskSummary(),
        portfolioApi.getRiskScenarios(),
        portfolioApi.getCorrelation(),
        portfolioApi.getNewsRisk(),
      ]);
      setRiskData({ summary, scenarios, correlation, news });
    } catch (e) {
      console.error("Risk load failed", e);
      setRiskData(null);
    } finally {
      setRiskLoading(false);
    }
  }, []);

  const handleTabChange = async (t) => {
    setActiveTab(t);
    if (t === "RISK" && !riskData && !riskLoading) await fetchRisk();
  };

  const portValue = toNum(portfolio?.totalValue, 0);
  const cashValue = toNum(wallet?.balance, 0);
  const totalEquity = portValue + cashValue;
  const totalPnL = toNum(portfolio?.totalPnL, 0);

  const positions = useMemo(() => {
    const rows = Array.isArray(portfolio?.positions) ? [...portfolio.positions] : [];
    return rows.sort((a, b) => toNum(b.marketValue) - toNum(a.marketValue));
  }, [portfolio]);

  const gotoDeposit = () => (FEATURES.WALLET ? nav("/wallet") : nav("/kyc"));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.label}>Total Net Equity</div>
          <div className={styles.amount}>
            {money2(totalEquity)} <span className={styles.currency}>USD</span>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Profit / Loss</span>
              <span className={`${styles.statVal} ${totalPnL >= 0 ? styles.green : styles.red}`}>
                {totalPnL >= 0 ? "+" : ""}
                {money2(totalPnL)}
              </span>
            </div>

            <div className={styles.statItem}>
              <span className={styles.statLabel}>Cash Balance</span>
              <span className={styles.statVal}>${money2(cashValue)}</span>
            </div>

            <div className={styles.statItem}>
              <span className={styles.statLabel}>Assets Held</span>
              <span className={styles.statVal}>{positions.length}</span>
            </div>
          </div>
        </div>

        <button
          className={styles.depositBtn}
          onClick={gotoDeposit}
          title={FEATURES.WALLET ? "" : "Wallet integration is in progress. Complete KYC to unlock trading."}
          type="button"
        >
          {FEATURES.WALLET ? "Deposit Funds" : "Complete KYC"}
        </button>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "HOLDINGS" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("HOLDINGS")}
          type="button"
        >
          Holdings
        </button>

        <button
          className={`${styles.tab} ${activeTab === "RISK" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("RISK")}
          type="button"
        >
          Risk
        </button>
      </div>

      {activeTab === "HOLDINGS" ? (
        <PortfolioTable rows={positions} onTrade={(s) => nav(`/trades?symbol=${s}`)} />
      ) : riskLoading ? (
        <div style={{ padding: 80, textAlign: "center", color: "rgba(255,255,255,0.55)" }}>
          Loading Risk Models...
        </div>
      ) : riskData ? (
        <RiskDashboard
          summary={riskData.summary}
          defaultScenarios={riskData.scenarios}
          correlation={riskData.correlation}
          news={riskData.news}
          portfolio={portfolio}
          totalEquity={totalEquity}
        />
      ) : (
        <div style={{ padding: 80, textAlign: "center", color: "rgba(255,255,255,0.55)" }}>
          Risk data unavailable.
          <div style={{ marginTop: 10 }}>
            <button className={styles.miniBtn} onClick={fetchRisk} type="button">
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
