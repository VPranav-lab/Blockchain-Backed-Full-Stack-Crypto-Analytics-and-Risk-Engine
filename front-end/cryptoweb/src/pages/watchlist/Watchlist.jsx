import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Watchlist.module.css";

// APIs & Utils
import { watchlistApi } from "../../api/watchlistApi";
import { marketApi } from "../../api/marketApi";
import { useLivePrices } from "../../hooks/useLivePrices";
import { fmtPrice, fmtQty } from "../../utils/format";

export default function Watchlist() {
  const navigate = useNavigate();

  // Data State
  const [watchlist, setWatchlist] = useState([]);
  const [marketData, setMarketData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  // Live Prices
  const liveMap = useLivePrices({ baseUrl: "http://localhost:4000", refreshMs: 1000 });

  // 1. Initial Load
  useEffect(() => {
    loadData();
    
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      const [wlRes, mktRes] = await Promise.all([
        watchlistApi.get(),
        marketApi.summaryAll() 
      ]);
      setWatchlist(Array.isArray(wlRes) ? wlRes : []);
      setMarketData(Array.isArray(mktRes) ? mktRes : []);
    } catch (e) {
      console.error("Load failed", e);
    } finally {
      setLoading(false);
    }
  };

  // 2. Add Handler
  const handleAdd = async (symbol) => {
    if (watchlist.some(w => w.symbol === symbol)) return;
    
    // Optimistic Update
    setWatchlist(prev => [...prev, { symbol }]);
    setSearchTerm("");
    setShowResults(false);
    
    try { 
      await watchlistApi.add(symbol);
      // Reload to ensure backend sync
      loadData(); 
    } catch (e) { 
      console.error("Add failed", e);
      loadData(); // Revert
    }
  };

  // 3. Remove Handler
  // ✅ FIX: Ensure symbol is valid before sending
  const handleRemove = async (symbol) => {
    if (!symbol) return;

    console.log("Removing symbol:", symbol); // Debug log

    // Optimistic Update: Remove immediately from UI
    setWatchlist(prev => prev.filter(w => w.symbol !== symbol));
    
    try { 
      // Ensure strict matching with backend
      await watchlistApi.remove(symbol); 
    } catch (e) {
      console.error("Delete failed", e);
      // If it failed (e.g. 404), reload data to show it's still there (or gone)
      loadData(); 
    }
  };

  // 4. Search Results
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    return marketData
      .filter(coin => 
        coin.symbol.toUpperCase().includes(searchTerm.toUpperCase()) &&
        !watchlist.some(w => w.symbol === coin.symbol)
      )
      .slice(0, 8); 
  }, [searchTerm, marketData, watchlist]);

  // 5. Table Data Logic
  const tableData = useMemo(() => {
    return watchlist.map((item) => {
      const coin = marketData.find(m => m.symbol?.toUpperCase() === item.symbol?.toUpperCase()) || {};
      const liveP = liveMap.get(item.symbol);
      const apiPrice = coin.current_price || coin.close || coin.lastPrice || 0;
      const displayPrice = liveP || apiPrice;

      return {
        // ✅ Use 'symbol' as the unique key since we are deleting by symbol
        symbol: item.symbol,
        base: item.symbol.replace("USDT", ""),
        price: Number(displayPrice),
        change: Number(coin.changePercent || coin.price_change_percent_24h || 0), 
        volume: Number(coin.volume || coin.volume_24h || 0),
      };
    });
  }, [watchlist, marketData, liveMap]);

  return (
    <div className={styles.page}>
      
      {/* HEADER & SEARCH */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Watchlist</h1>
          <div className={styles.subtitle}>Track your favorite assets</div>
        </div>

        <div className={styles.searchContainer} ref={searchRef}>
          <div className={styles.inputWrapper}>
            <svg className={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="Search coin..." 
              className={styles.searchInput}
              value={searchTerm}
              onFocus={() => setShowResults(true)}
              onChange={(e) => { setSearchTerm(e.target.value); setShowResults(true); }}
            />
          </div>

          {/* RESULTS DROPDOWN */}
          {showResults && searchTerm && (
            <div className={styles.dropdown}>
              {searchResults.length > 0 ? (
                searchResults.map(coin => (
                  <div key={coin.symbol} className={styles.resultItem} onClick={() => handleAdd(coin.symbol)}>
                    <div className={styles.resLeft}>
                      <span className={styles.resSym}>{coin.symbol}</span>
                      <span className={styles.resName}>Crypto</span>
                    </div>
                    <span className={styles.resPrice}>
                      ${fmtPrice(coin.current_price || coin.close || 0)}
                    </span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>No coins found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thLeft}>Asset</th>
              <th className={styles.thRight}>Price</th>
              <th className={styles.thRight}>24h Change</th>
              <th className={styles.thRight}>24h Vol</th>
              <th className={styles.thRight}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className={styles.msg}>Loading assets...</td></tr>
            ) : tableData.length === 0 ? (
              <tr><td colSpan="5" className={styles.msg}>Your watchlist is empty. Add coins above.</td></tr>
            ) : (
              tableData.map((row) => {
                const isUp = row.change >= 0;
                return (
                  <tr key={row.symbol} className={styles.row}>
                    <td>
                      <div className={styles.asset}>
                        {row.symbol}
                        <span className={styles.badge}>{row.base} Network</span>
                      </div>
                    </td>
                    <td className={`${styles.tdRight} ${styles.mono}`}>
                      ${fmtPrice(row.price)}
                    </td>
                    <td className={`${styles.tdRight} ${styles.mono}`}>
                      <span className={isUp ? styles.green : styles.red}>
                        {isUp ? "+" : ""}{row.change.toFixed(2)}%
                      </span>
                    </td>
                    <td className={`${styles.tdRight} ${styles.dim}`}>
                      {fmtQty(row.volume)}
                    </td>
                    <td className={styles.tdRight}>
                      <div className={styles.actions}>
                        <button className={styles.tradeBtn} onClick={() => navigate(`/trades?symbol=${row.symbol}`)}>
                          Trade
                        </button>
                        
                        {/* ✅ FIX: Pass row.symbol to remove function */}
                        <button className={styles.removeBtn} onClick={() => handleRemove(row.symbol)}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}