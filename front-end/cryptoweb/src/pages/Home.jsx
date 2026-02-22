import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./Home.module.css";

// ====== CONFIG ======
const LIVE_URL = "http://localhost:4000/api/market/livedata";
const SUMMARY_URL = "http://localhost:4000/api/market/summary/allcoins";

// 6 coins in Market Snapshot (Binance-style)
const SNAPSHOT_COINS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT"];

// ====== FORMATTERS ======
function fmtUsd(n) {
  if (!Number.isFinite(n)) return "--";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(n) {
  if (!Number.isFinite(n)) return "--";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

// ====== HELPERS ======
async function fetchJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// livedata can be: [..] OR {data:[..]} OR {tickers:[..]}
function normalizeLive(payload) {
  const arr =
    Array.isArray(payload) ? payload :
    Array.isArray(payload?.data) ? payload.data :
    Array.isArray(payload?.tickers) ? payload.tickers :
    [];

  return arr
    .map((x) => ({ symbol: x?.symbol, price: Number(x?.price) }))
    .filter((x) => x.symbol && Number.isFinite(x.price));
}

// small concurrency limiter
async function mapLimit(items, limit, mapper) {
  const out = new Array(items.length);
  let i = 0;

  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await mapper(items[idx], idx);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // latest live prices for coins we care about
  const [livePrices, setLivePrices] = useState({}); // { BTCUSDT: 89190.32, ... }

  const [summaryMap, setSummaryMap] = useState({});
  const [summaryList, setSummaryList] = useState([]); // array for sorting

  // for Binance-like price color + flash based on last tick
  const prevLiveRef = useRef({});
  const [pricePulse, setPricePulse] = useState({}); 
  // { BTCUSDT: "up"|"down"|null } to trigger a flash class

  const onPrimaryCTA = () => {
    if (isAuthenticated) navigate("/dashboard");
    else navigate("/register");
  };

  const onSecondaryCTA = () => {
    navigate("/market");
  };

  const onAdminCTA = () => {
    navigate("/admin");
  };

  // --- DATA FETCHING (SUMMARY) ---
  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        const rows = await fetchJson(SUMMARY_URL, ac.signal);

        const map = {};
        for (const r of rows) {
          if (!r?.symbol) continue;

          const row = {
            symbol: r.symbol,
            change: Number(r.changePercent) || 0,
            vol: Number(r.volume) || 0,
            lastClose: Number(r.close),
          };

          map[r.symbol] = row;
        }

        setSummaryMap(map);
        setSummaryList(Object.values(map)); // 🔑 all 438 coins
      } catch {}
    })();

    return () => ac.abort();
  }, []);

  // --- DATA FETCHING (LIVE) ---
  useEffect(() => {
    const ac = new AbortController();

    const tick = async () => {
      try {
        const payload = await fetchJson(LIVE_URL, ac.signal);
        const arr = normalizeLive(payload);

        const next = {};
        const pulseNext = {};

        for (const x of arr) {
          const price = x.price;
          next[x.symbol] = price;

          const prev = prevLiveRef.current[x.symbol];
          if (Number.isFinite(prev) && prev !== price) {
            pulseNext[x.symbol] = price > prev ? "up" : "down";
          }
          prevLiveRef.current[x.symbol] = price;
        }

        setLivePrices(prev => ({ ...prev, ...next }));

        if (Object.keys(pulseNext).length) {
          setPricePulse(prev => ({ ...prev, ...pulseNext }));
          setTimeout(() => {
            setPricePulse(prev => {
              const c = { ...prev };
              Object.keys(pulseNext).forEach(k => delete c[k]);
              return c;
            });
          }, 260);
        }
      } catch {}
    };

    tick();
    const t = setInterval(tick, 1000);

    return () => {
      ac.abort();
      clearInterval(t);
    };
  }, []);

  // ===== Binance-style snapshot display objects =====
  const snapshotTickers = useMemo(() => {
    return SNAPSHOT_COINS.map(sym => {
      const s = summaryMap[sym];
      if (!s) return null;

      const live = Number(livePrices[sym]);
      const price = Number.isFinite(live) ? live : s.lastClose;

      const pulse = pricePulse[sym];
      const dir =
        pulse === "up" ? "up" :
        pulse === "down" ? "down" :
        "flat";

      return {
        symbol: sym,
        price,
        change: s.change,
        vol: s.vol,
        dir,
        pulse,
      };
    }).filter(Boolean);
  }, [summaryMap, livePrices, pricePulse]);

  const topGainers = useMemo(() => {
    return [...summaryList]
      .sort((a, b) => b.change - a.change)
      .slice(0, 3)
      .map(r => ({
        ...r,
        price: Number(livePrices[r.symbol]) || r.lastClose,
      }));
  }, [summaryList, livePrices]);

  const topLosers = useMemo(() => {
    return [...summaryList]
      .sort((a, b) => a.change - b.change)
      .slice(0, 3)
      .map(r => ({
        ...r,
        price: Number(livePrices[r.symbol]) || r.lastClose,
      }));
  }, [summaryList, livePrices]);

  return (
    <div className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.kicker}>CryptoWeb • Trading Simulation • Risk & ML Insights</div>
          <h1 className={styles.title}>
            Trade smarter with a <span className={styles.grad}>simulation-first</span> crypto platform.
          </h1>
          <p className={styles.subtitle}>
            Binance-like UX, but built for your capstone: paper trading, backtesting, risk analytics,
            alerts, and ML-driven insights — all in one secure web app.
          </p>

          <div className={styles.ctaRow}>
            <button className={styles.ctaPrimary} onClick={onPrimaryCTA}>
              {isAuthenticated ? "Open Dashboard" : "Create free account"}
            </button>

            <button className={styles.ctaGhost} onClick={onSecondaryCTA}>
              Explore Market
            </button>

            {!isAuthenticated && (
              <div className={styles.authHint}>
                Already have an account? <Link to="/login" className={styles.link}>Login</Link>
              </div>
            )}
          </div>

          <div className={styles.heroBadges}>
            <span className={styles.pill}>JWT-ready Auth</span>
            <span className={styles.pill}>Security Logging</span>
            <span className={styles.pill}>Ledger Verification</span>
            <span className={styles.pill}>Backtesting + Risk</span>
          </div>
        </div>

        {/* HERO RIGHT: Stats panel */}
        <div className={styles.heroPanel}>
          <div className={styles.panelTop}>
            <div>
              <div className={styles.panelTitle}>Market snapshot</div>
            </div>
            <Link className={styles.panelLink} to="/market">View all</Link>
          </div>

          <div className={styles.snapshotGrid}>
            {snapshotTickers.slice(0, 6).map((t) => (
              <div key={t.symbol} className={styles.snapCard}>
                <div className={styles.snapRow}>
                  <div className={styles.sym}>{t.symbol}</div>
                  <div className={t.change > 0 ? styles.up : t.change < 0 ? styles.down : styles.flat}>
                    {t.change > 0 ? "+" : ""}
                    {t.change.toFixed(2)}%
                  </div>
                </div>

                <div
                  className={[
                    styles.price,
                    t.dir === "up" ? styles.up : t.dir === "down" ? styles.down : styles.flat,
                    t.pulse === "up" ? styles.flashUp : t.pulse === "down" ? styles.flashDown : "",
                  ].join(" ")}
                >
                  ${fmtPrice(t.price)}
                </div>

                <div className={styles.vol}>Vol: {fmtUsd(t.vol)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MOVERS */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Top Movers (24h)</h2>
          <div className={styles.muted}>Preview the market — login only required for simulation features.</div>
        </div>

        <div className={styles.moversGrid}>
          {/* Top Gainers */}
          <div className={styles.glassCard}>
            <div className={styles.cardTitle}>Top Gainers</div>
            <div className={styles.table}>
              {topGainers.map((t) => (
                <div key={t.symbol} className={styles.row}>
                  <div className={styles.rowLeft}>
                    <div className={styles.symBig}>{t.symbol}</div>
                    <div className={styles.rowSub}>${fmtPrice(t.price)}</div>
                  </div>
                  <div className={`${styles.chg} ${styles.up}`}>+{t.change.toFixed(2)}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Losers */}
          <div className={styles.glassCard}>
            <div className={styles.cardTitle}>Top Losers</div>
            <div className={styles.table}>
              {topLosers.map((t) => (
                <div key={t.symbol} className={styles.row}>
                  <div className={styles.rowLeft}>
                    <div className={styles.symBig}>{t.symbol}</div>
                    <div className={styles.rowSub}>${fmtPrice(t.price)}</div>
                  </div>
                  <div className={`${styles.chg} ${styles.down}`}>{t.change.toFixed(2)}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Simulation Ready Card (WITH ADMIN BUTTON) */}
          <div className={styles.glassCard}>
            <div className={styles.cardTitle}>Simulation-ready</div>
            <div className={styles.cardText}>
              Build a portfolio with paper trades, track P&L, run backtests, and evaluate risk metrics.
              Your Market tab stays public — your trading actions remain protected.
            </div>
            
            <div className={styles.cardCtas}>
              <button className={styles.smallPrimary} onClick={onPrimaryCTA}>
                {isAuthenticated ? "Go to Dashboard" : "Start simulation"}
              </button>
              
              <Link className={styles.smallGhost} to="/market">Go to Market</Link>

              {/* ✅ ADMIN BUTTON (Fixed Role Check) */}
              {user?.role === "ADMIN" && (
                <button className={styles.smallAdmin} onClick={onAdminCTA}>
                  Admin Panel
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>Built for an industrial capstone</h2>
        </div>

        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>Trading Simulation</div>
            <div className={styles.featureText}>
              Paper trades, transaction history, and equity curve visualizations (no real funds).
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>Risk Analytics</div>
            <div className={styles.featureText}>
              Volatility, drawdown, concentration risk, and scenario stress testing.
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>Backtesting</div>
            <div className={styles.featureText}>
              Strategy performance metrics and clean result dashboards for grading.
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>ML Insights</div>
            <div className={styles.featureText}>
              Predictions + bull/bear indicators and feature engineering (API-ready integration).
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>Security & Logs</div>
            <div className={styles.featureText}>
              Behavioral logs, anomaly scoring, and admin views for monitoring.
            </div>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureTitle}>Ledger Integrity</div>
            <div className={styles.featureText}>
              Tamper-evident internal ledger verification (industrial-grade demo feature).
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>How it works</h2>
          <div className={styles.muted}>Simple user journey — like Binance, but for simulation.</div>
        </div>

        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNum}>1</div>
            <div>
              <div className={styles.stepTitle}>Create account</div>
              <div className={styles.stepText}>Register and login (JWT-ready flow).</div>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNum}>2</div>
            <div>
              <div className={styles.stepTitle}>Explore market</div>
              <div className={styles.stepText}>Browse prices and movers (public access).</div>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNum}>3</div>
            <div>
              <div className={styles.stepTitle}>Simulate trades</div>
              <div className={styles.stepText}>Paper trade + portfolio metrics (protected).</div>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNum}>4</div>
            <div>
              <div className={styles.stepTitle}>Analyze &amp; validate</div>
              <div className={styles.stepText}>Risk, backtesting, alerts, and ledger verification.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}