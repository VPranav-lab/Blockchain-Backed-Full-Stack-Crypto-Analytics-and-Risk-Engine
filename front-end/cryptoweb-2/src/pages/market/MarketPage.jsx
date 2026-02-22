import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { marketApi } from "../../api/marketApi";
import styles from "./MarketPage.module.css";

// --- CONFIG ---
// Restricted to USDT only as per backend limitations
const MARKETS = ["USDT"];

// --- HELPERS ---
const fmtPrice = (n, quote) => {
  if (!Number.isFinite(n)) return "--";
  // High precision for crypto-pairs, standard for stablecoins
  if (n < 1) return n.toFixed(8);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtLarge = (n) => {
  if (!Number.isFinite(n)) return "--";
  if (n > 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n > 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n > 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(0);
};

export default function MarketPage() {
  const nav = useNavigate();
  const { isAuthenticated } = useAuth();
  
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & State
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20; 

  // 1. Fetch Data
  useEffect(() => {
    const load = async () => {
      try {
        if(loading) setLoading(true);
        const data = await marketApi.summaryAll();
        
        // 🔒 SAFETY FILTER: 
        // 1. Only allow pairs ending in "USDT" (Backend Requirement)
        // 2. Remove leveraged tokens (UP/DOWN/BULL/BEAR)
        const cleanData = Array.isArray(data) 
          ? data.filter(c => 
              c.symbol.endsWith("USDT") && 
              !c.symbol.includes("UP") && 
              !c.symbol.includes("DOWN") && 
              !c.symbol.includes("BULL") && 
              !c.symbol.includes("BEAR")
            )
          : [];
          
        setRows(cleanData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
    // Auto-refresh every 10 seconds
    const id = setInterval(load, 10000); 
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  // 2. Data Processing (Contextual Highlights -> Search -> Sort -> Paginate)
  const { viewData, totalPages, highlights } = useMemo(() => {
    // A. Base Data (All Rows are already USDT)
    let marketData = [...rows];

    // B. Calculate Contextual Highlights
    let topGainer = null, topVol = null, topLoser = null;
    if (marketData.length > 2) {
      const byGain = [...marketData].sort((a,b) => Number(b.changePercent) - Number(a.changePercent));
      const byVol = [...marketData].sort((a,b) => Number(b.volume) - Number(a.volume));
      
      topGainer = byGain[0];
      topLoser = byGain[byGain.length - 1];
      topVol = byVol[0];
    }

    // C. Search
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      marketData = marketData.filter(r => r.symbol.includes(q));
    }

    // D. Sort (Default: Volume Descending for relevance)
    marketData.sort((a,b) => (Number(b.volume)||0) - (Number(a.volume)||0)); 

    // E. Pagination
    const totalPages = Math.ceil(marketData.length / pageSize) || 1;
    const start = (page - 1) * pageSize;
    const viewData = marketData.slice(start, start + pageSize);

    return { 
      viewData, 
      totalPages, 
      highlights: { topGainer, topVol, topLoser } 
    };
  }, [rows, search, page]);

  // Reset page on search
  useEffect(() => setPage(1), [search]);

  // 3. Action Logic
  const handleTrade = (symbol) => {
    const target = `/trades?symbol=${symbol}`;
    if (isAuthenticated) nav(target);
    else nav("/login", { state: { from: target } });
  };

  return (
    <div className={styles.page}>
      
      {/* 1. HIGHLIGHT CARDS */}
      {highlights.topGainer && (
        <div className={styles.highlightsGrid}>
          {/* Top Gainer */}
          <div className={styles.highlightCard} onClick={() => handleTrade(highlights.topGainer.symbol)}>
            <div className={styles.cardLabel}>🔥 Top Gainer</div>
            <div className={styles.cardRow}>
              <div>
                <div className={styles.cardSym}>{highlights.topGainer.symbol.replace("USDT","")}</div>
                <div className={styles.cardPrice}>{fmtPrice(Number(highlights.topGainer.close))}</div>
              </div>
              <div className={`${styles.badge} ${styles.up}`}>
                +{Number(highlights.topGainer.changePercent).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Highest Volume */}
          <div className={styles.highlightCard} onClick={() => handleTrade(highlights.topVol.symbol)}>
            <div className={styles.cardLabel}>💎 Highest Volume</div>
            <div className={styles.cardRow}>
              <div>
                <div className={styles.cardSym}>{highlights.topVol.symbol.replace("USDT","")}</div>
                <div className={styles.cardPrice}>Vol: {fmtLarge(Number(highlights.topVol.volume))}</div>
              </div>
              <div className={`${styles.badge} ${styles.hot}`}>Hot</div>
            </div>
          </div>

          {/* Top Dip */}
          <div className={styles.highlightCard} onClick={() => handleTrade(highlights.topLoser.symbol)}>
             <div className={styles.cardLabel}>📉 Top Dip</div>
             <div className={styles.cardRow}>
              <div>
                <div className={styles.cardSym}>{highlights.topLoser.symbol.replace("USDT","")}</div>
                <div className={styles.cardPrice}>{fmtPrice(Number(highlights.topLoser.close))}</div>
              </div>
              <div className={`${styles.badge} ${styles.down}`}>
                {Number(highlights.topLoser.changePercent).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CONTROLS */}
      <div className={styles.controls}>
        {/* Market Label (Static since only USDT) */}
        <div className={styles.marketTitle}>
           USDT Markets
        </div>

        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            className={styles.search}
            placeholder="Search coins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 3. MAIN DATA TABLE */}
      <div className={styles.tableFrame}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th align="left">Asset</th>
              <th align="right">Price</th>
              <th align="right">24h Change</th>
              <th align="right">24h High / Low</th>
              <th align="right">24h Volume</th>
              <th align="right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className={styles.loading}>Loading market data...</td></tr>
            ) : viewData.length === 0 ? (
              <tr><td colSpan="6" className={styles.loading}>No USDT pairs found.</td></tr>
            ) : (
              viewData.map((coin) => {
                const p = Number(coin.close);
                const chg = Number(coin.changePercent);
                const vol = Number(coin.volume);
                const high = Number(coin.high || p * 1.02); 
                const low = Number(coin.low || p * 0.98); 
                const dispName = coin.symbol.replace("USDT", "");

                return (
                  <tr key={coin.symbol} onClick={() => handleTrade(coin.symbol)}>
                    <td>
                      <div className={styles.coinCell}>
                        <div className={styles.icon}>{dispName[0]}</div>
                        <div>
                          <div className={styles.sym}>{dispName}</div>
                          <div className={styles.asset}>/ USDT</div>
                        </div>
                      </div>
                    </td>

                    <td className={styles.price}>{fmtPrice(p)}</td>
                    
                    <td>
                      <span className={chg >= 0 ? styles.up : styles.down}>
                        {chg > 0 ? "+" : ""}{chg.toFixed(2)}%
                      </span>
                    </td>

                    <td className={styles.hl}>
                      <div>H: {fmtPrice(high)}</div>
                      <div>L: {fmtPrice(low)}</div>
                    </td>

                    <td className={styles.vol}>{fmtLarge(vol)}</td>

                    <td>
                      <button 
                        className={styles.tradeBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTrade(coin.symbol);
                        }}
                      >
                        Trade
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button className={styles.pageBtn} disabled={page===1} onClick={()=>setPage(p=>p-1)}>Prev</button>
            <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
            <button className={styles.pageBtn} disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}