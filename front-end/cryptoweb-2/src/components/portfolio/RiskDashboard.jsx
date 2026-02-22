import { useEffect, useMemo, useState } from "react";
import styles from "../../pages/portfolio/Portfolio.module.css";
import { portfolioApi } from "../../api/portfolioApi";

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const money0 = (n) => toNum(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const pct2 = (n) => `${toNum(n).toFixed(2)}%`;

const parseShockPct = (shockKey) => {
  if (shockKey == null) return null;
  const s = String(shockKey).trim();
  if (s.endsWith("%")) {
    const n = parseFloat(s.replace("%", ""));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) <= 1) return n * 100;
  return n;
};

const riskScore = (risk) => {
  const map = { LOW: 30, MEDIUM: 60, HIGH: 90 };
  const overall = String(risk?.overall_risk || "MEDIUM").toUpperCase();
  const vol = String(risk?.volatility_level || "LOW").toUpperCase();
  const conc = String(risk?.concentration_level || "LOW").toUpperCase();
  const news = String(risk?.news_risk_level || "LOW").toUpperCase();

  const score =
    0.45 * (map[overall] ?? 60) +
    0.20 * (map[vol] ?? 30) +
    0.20 * (map[conc] ?? 30) +
    0.15 * (map[news] ?? 30);

  return Math.round(score);
};

export default function RiskDashboard({
  summary,
  defaultScenarios,
  correlation,
  news,
  portfolio,
  totalEquity = 0,
}) {
  // ✅ UI slider is POSITIVE 1..99; backend receives negative decimal
  const [shockPctUi, setShockPctUi] = useState(10);
  const [simResult, setSimResult] = useState(null);

  const [propAsset, setPropAsset] = useState("BTCUSDT");
  const [propShockPctUi, setPropShockPctUi] = useState(20);
  const [propResult, setPropResult] = useState(null);

  const [showCorrelation, setShowCorrelation] = useState(false);

  const risk = summary?.risk_classification || {};
  const conc = summary?.concentration_risk || {};
  const perAsset = summary?.per_asset_risk || {};
  const newsRisk = summary?.news_risk || {};

  const overall = String(risk?.overall_risk || "—").toUpperCase();
  const volLevel = String(risk?.volatility_level || "—").toUpperCase();
  const concLevelFromApi = String(risk?.concentration_level || "—").toUpperCase();
  const newsLevel = String(risk?.news_risk_level || "—").toUpperCase();

  const score = useMemo(() => riskScore(risk), [risk]);

  const positions = useMemo(() => (Array.isArray(portfolio?.positions) ? portfolio.positions : []), [portfolio]);
  const portfolioTotalValue = toNum(portfolio?.totalValue, 0);
  const hasExposure = totalEquity > 0 && (positions.length > 0 || portfolioTotalValue > 0);

  const dominantFromPortfolio = useMemo(() => {
    if (!positions.length) return null;
    return [...positions].sort((a, b) => toNum(b.marketValue) - toNum(a.marketValue))[0];
  }, [positions]);

  const dominantSymbolFallback = dominantFromPortfolio?.symbol || null;
  const dominantWeightFallback =
    portfolioTotalValue > 0 && dominantFromPortfolio
      ? toNum(dominantFromPortfolio.marketValue) / portfolioTotalValue
      : 0;

  const dominantRaw = conc?.dominant_asset || dominantSymbolFallback;
  const dominant = dominantRaw ? String(dominantRaw).replace("USDT", "") : "—";

  const dominantVol =
    dominantRaw && perAsset?.[dominantRaw]?.volatility != null ? toNum(perAsset[dominantRaw].volatility, 0) : null;

  const maxWeightFromApi = toNum(conc?.max_weight, 0);
  const effectiveMaxWeight = maxWeightFromApi > 0 ? maxWeightFromApi : dominantWeightFallback;

  const concLevelFallback =
    effectiveMaxWeight >= 0.6 ? "HIGH" : effectiveMaxWeight >= 0.35 ? "MEDIUM" : "LOW";

  const concLevel =
    conc?.dominant_asset == null && positions.length ? concLevelFallback : concLevelFromApi;

  const activeEvents = toNum(newsRisk?.active_events, 0);
  const topDrivers = Array.isArray(newsRisk?.drivers) ? newsRisk.drivers.slice(0, 3) : [];

  const newsScenarios = Array.isArray(news?.news_risk_scenarios) ? news.news_risk_scenarios : [];

  const assets = useMemo(() => Object.keys(correlation?.correlation_matrix || {}), [correlation]);
  const displayAssets = useMemo(() => assets.map((a) => a.replace("USDT", "")), [assets]);

  useEffect(() => {
    const s = defaultScenarios?.scenario_shocks;
    if (!s) return;
    const firstKey = Object.keys(s)[0];
    if (firstKey) setSimResult(s[firstKey]);
    if (assets.length) setPropAsset(assets[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultScenarios, assets.length]);

  // Stress sim (debounced)
  useEffect(() => {
    if (!hasExposure) {
      setSimResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const shockDecimal = -(shockPctUi / 100);
        const res = await portfolioApi.getRiskScenarios(shockDecimal);
        const val = Object.values(res?.scenario_shocks || {})[0] || null;
        setSimResult(val);
      } catch {}
    }, 350);
    return () => clearTimeout(timer);
  }, [shockPctUi, hasExposure]);

  // Propagation (debounced)
  useEffect(() => {
    if (!hasExposure) {
      setPropResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const shockDecimal = -(toNum(propShockPctUi) / 100);
        const res = await portfolioApi.getPropagation(propAsset, shockDecimal);
        setPropResult(res);
      } catch {}
    }, 350);
    return () => clearTimeout(timer);
  }, [propAsset, propShockPctUi, hasExposure]);

  const getRiskColor = (level) => {
    const L = String(level || "").toUpperCase();
    if (L === "HIGH") return "#ef4444";
    if (L === "MEDIUM") return "#f59e0b";
    return "#10b981";
  };

  const simLoss = toNum(simResult?.portfolio_loss, 0);
  const simHitPct = totalEquity > 0 ? (simLoss / totalEquity) * 100 : toNum(simResult?.portfolio_loss_pct, 0);

  const scenarioEntries = useMemo(() => {
    const s = defaultScenarios?.scenario_shocks || {};
    return Object.entries(s)
      .map(([shockKey, v]) => {
        const loss = toNum(v?.portfolio_loss, 0);
        const shockPct = parseShockPct(shockKey);
        if (shockPct == null) return null;

        const hit = totalEquity > 0 ? (loss / totalEquity) * 100 : toNum(v?.portfolio_loss_pct, 0);
        return { shockKey, shockPct, loss, hit };
      })
      .filter(Boolean)
      .sort((a, b) => a.shockPct - b.shockPct);
  }, [defaultScenarios, totalEquity]);

  const corrVal = (row, col) => {
    if (row === col) return 1;
    const v = correlation?.correlation_matrix?.[row]?.[col];
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  };

  const corrCellStyle = (val) => {
    const intensity = Math.abs(val);
    const opacity = Math.max(0.08, Math.min(0.95, intensity));
    const isPos = val >= 0;

    return {
      backgroundColor: isPos ? `rgba(16, 185, 129, ${opacity})` : `rgba(239, 68, 68, ${opacity})`,
      color: intensity > 0.55 ? "#fff" : "rgba(255,255,255,0.75)",
      border: "1px solid rgba(255,255,255,0.06)",
    };
  };

  return (
    <div className={styles.riskGrid}>
      {/* KPIs */}
      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>Risk Level</div>
        <div className={styles.kpiValue} style={{ color: getRiskColor(overall) }}>
          {overall}
        </div>
        <div className={styles.kpiSub}>
          Volatility: <b>{volLevel}</b>
        </div>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>Risk Score</div>
        <div className={styles.kpiValue} style={{ color: "#fff" }}>
          {score}
        </div>
        <div className={styles.kpiSub}>Composite (overall/vol/conc/news)</div>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>Concentration</div>
        <div className={styles.kpiValue} style={{ color: getRiskColor(concLevel) }}>
          {concLevel}
        </div>
        <div className={styles.kpiSub}>
          Dominant: <b>{dominant}</b>{" "}
          {effectiveMaxWeight > 0 ? <span className={styles.dim}>({Math.round(effectiveMaxWeight * 100)}% weight)</span> : null}
          {dominantVol != null ? <span className={styles.dim} style={{ marginLeft: 8 }}>(vol {dominantVol.toFixed(4)})</span> : null}
        </div>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiLabel}>News Risk</div>
        <div className={styles.kpiValue} style={{ color: getRiskColor(newsLevel) }}>
          {newsLevel}
        </div>
        <div className={styles.kpiSub}>{activeEvents} active events</div>
      </div>

      {/* Stress Test */}
      <div className={`${styles.card} ${styles.colSpan2}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Stress Test</div>
        </div>

        <div className={styles.controlPad}>
          {!hasExposure ? (
            <div className={styles.empty} style={{ padding: 18 }}>
              No portfolio exposure yet. Place trades / hold assets to generate stress simulations.
            </div>
          ) : (
            <>
              <div className={styles.stressTopRow}>
                <span className={styles.mono}>
                  Market Drop: <b className={styles.red}>-{shockPctUi}%</b>
                </span>
                <span className={styles.mono}>
                  Loss: <b className={styles.red}>-${money0(simLoss)}</b>
                  <span className={styles.dim} style={{ marginLeft: 10 }}>
                    Hit: <b className={styles.red}>{pct2(simHitPct)}</b>
                  </span>
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="99"
                step="1"
                value={shockPctUi}
                onChange={(e) => setShockPctUi(Number(e.target.value))}
                className={styles.slider}
              />

              {/* precomputed */}
              {scenarioEntries.length ? (
                <div className={styles.scenarioBlock}>
                  <div className={styles.scenarioHead}>
                    <span className={styles.mono}>Scenario Grid</span>
                    <span className={styles.dim}>precomputed shocks</span>
                  </div>

                  <div className={styles.scenarioGrid}>
                    {scenarioEntries.slice(0, 12).map((s) => (
                      <button
                        key={s.shockKey}
                        type="button"
                        className={styles.scenarioTile}
                        onClick={() => setShockPctUi(Math.min(99, Math.max(1, Math.abs(Math.round(s.shockPct)))))}
                        title="Click to load into slider"
                      >
                        <div className={styles.scenarioPct}>{Math.round(s.shockPct)}%</div>
                        <div className={styles.scenarioRow}>
                          <span className={styles.dim}>Loss</span>
                          <span className={styles.red}>-${money0(s.loss)}</span>
                        </div>
                        <div className={styles.scenarioRow}>
                          <span className={styles.dim}>Hit</span>
                          <span className={styles.red}>{pct2(s.hit)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* News Scenarios (from /risk/news) */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>News Scenarios</div>
        </div>

        <div className={styles.newsList}>
          {newsScenarios.length ? (
            newsScenarios.map((n, i) => (
              <div key={i} className={styles.newsItem}>
                <div className={styles.newsCat}>{String(n.scenario_type || "—").toUpperCase()}</div>
                <div className={styles.newsHeadline}>{n.headline || "—"}</div>
                <div className={styles.newsMeta}>
                  <span className={styles.red}>-${money0(n?.impact_summary?.total_loss || 0)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.empty} style={{ padding: 18 }}>
              No active news-driven scenarios.
            </div>
          )}
        </div>
      </div>

      {/* Contagion */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Contagion</div>
        </div>

        <div className={styles.controlPad}>
          {!hasExposure ? (
            <div className={styles.empty} style={{ padding: 18 }}>
              No portfolio exposure yet.
            </div>
          ) : (
            <>
              <div className={styles.contagionTop}>
                <select
                  value={propAsset}
                  onChange={(e) => setPropAsset(e.target.value)}
                  className={styles.select}
                  disabled={!assets.length}
                >
                  {assets.length ? assets.map((a) => (
                    <option key={a} value={a}>{a.replace("USDT", "")}</option>
                  )) : (
                    <option value="BTCUSDT">BTC</option>
                  )}
                </select>

                <input
                  type="number"
                  value={propShockPctUi}
                  onChange={(e) => setPropShockPctUi(toNum(e.target.value, 0))}
                  className={styles.numInput}
                  min={1}
                  max={99}
                />
              </div>

              {propResult ? (
                <div className={styles.contagionBox}>
                  <div className={styles.contagionRow}>
                    <span className={styles.dim}>Total Loss</span>
                    <span className={styles.red}>-${money0(propResult?.portfolio_impact?.total_loss)}</span>
                  </div>
                  <div className={styles.contagionRowBig}>
                    <span>Portfolio Hit</span>
                    <span className={styles.red}>
                      {pct2(toNum(propResult?.portfolio_impact?.total_loss_pct, 0) * 100)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className={styles.empty} style={{ padding: 18 }}>
                  Select an asset and shock to simulate spillover.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Correlation */}
      <div className={`${styles.card} ${styles.colSpan4}`}>
        <div className={styles.cardHeader} style={{ justifyContent: "space-between" }}>
          <div className={styles.cardTitle}>Correlation Matrix</div>
          <button type="button" className={styles.miniBtn} onClick={() => setShowCorrelation((p) => !p)}>
            {showCorrelation ? "Hide" : "Show"}
          </button>
        </div>

        {showCorrelation ? (
          assets.length ? (
            <div
              className={styles.heatmapContainer}
              style={{
                gridTemplateColumns: `70px repeat(${assets.length}, minmax(40px, 1fr))`,
                gap: 6,
                alignItems: "center",
              }}
            >
              <div />
              {displayAssets.map((a) => (
                <div key={`col-${a}`} className={styles.heatmapLabel}>{a}</div>
              ))}

              {assets.map((row, i) => (
                <div key={`row-${row}`} style={{ display: "contents" }}>
                  <div className={styles.heatmapLabel} style={{ textAlign: "right", paddingRight: 12 }}>
                    {displayAssets[i]}
                  </div>

                  {assets.map((col) => {
                    const val = corrVal(row, col);
                    return (
                      <div
                        key={`${row}-${col}`}
                        className={styles.heatmapCell}
                        style={corrCellStyle(val)}
                        title={`${row.replace("USDT", "")} vs ${col.replace("USDT", "")}: ${val.toFixed(2)}`}
                      >
                        {val.toFixed(2)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty} style={{ padding: 18 }}>
              Not enough assets to compute correlation (need 2+).
            </div>
          )
        ) : (
          <div className={styles.empty} style={{ padding: 18 }}>
            Hidden (advanced). Click “Show”.
          </div>
        )}
      </div>
    </div>
  );
}
