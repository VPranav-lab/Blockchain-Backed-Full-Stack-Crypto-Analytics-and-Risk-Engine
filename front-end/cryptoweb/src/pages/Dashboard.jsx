import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Dashboard.module.css";
import { useLivePrices } from "../hooks/useLivePrices.js";
import ChartStack from "../components/charts/ChartStack.jsx";
import ChartDrawOverlay from "../components/charts/ChartDrawOverlay.jsx";
import { marketApi } from "../api/marketApi.js";

// ===========================================================================
// 1. CONFIGURATION & HELPERS
// ===========================================================================

const RANGE = [
  { 
    key: "1D",  
    label: "1D",  
    durationMs: 86400000, 
    minutes: 1440,      
    intervals: ["1s", "5m", "15m", "30m"], 
    def: "30m" 
  },
  { 
    key: "7D",  
    label: "7D",  
    durationMs: 604800000, 
    minutes: 10080,     
    intervals: ["1h", "4h", "8h", "12h"],       
    def: "1h",
    baselineInterval: "1h" 
  },
  { 
    key: "30D", 
    label: "30D", 
    durationMs: 2592000000, 
    minutes: 43200,     
    intervals: ["8h", "12h", "1d"],            
    def: "8h",
    baselineInterval: "1d"
  },
  { 
    key: "6M",  
    label: "6M",  
    durationMs: 15552000000, 
    minutes: 259200,    
    intervals: ["12h", "1d"],                 
    def: "12h",
    baselineInterval: "1d" 
  },
  { 
    key: "1Y",  
    label: "1Y",  
    durationMs: 31536000000, 
    minutes: 525600,    
    intervals: ["1d"],             
    def: "1d",
    baselineInterval: "1d"
  },
];

const LS_KEY = "dash:industry:vFinalRefactor";

function fmt(n, maxDigits = 6) {
  if (!Number.isFinite(n)) return "--";
  return n.toLocaleString(undefined, { maximumFractionDigits: maxDigits });
}

function pct(n, digits = 2) {
  if (!Number.isFinite(n)) return "--";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function normalizeInterval(iv, fallback = "1h") {
  if (typeof iv === "string" && iv.length) return iv;
  return fallback;
}

function intervalToMinutes(ivRaw) {
  const iv = normalizeInterval(ivRaw, "1h");
  if (iv === "1s") return 1 / 60;
  if (iv.endsWith("m")) return parseInt(iv, 10);
  if (iv.endsWith("h")) return parseInt(iv, 10) * 60;
  if (iv.endsWith("d")) return parseInt(iv, 10) * 1440;
  return 60;
}

function calcLimit(rangeKey, intervalRaw) {
  const r = RANGE.find((x) => x.key === rangeKey) || RANGE[0];
  const iv = normalizeInterval(intervalRaw, r.def);
  
  if (iv === "1s") return 1000;

  const minsPerCandle = intervalToMinutes(iv);
  const rangeMinutes = r.minutes;
  
  let needed = Math.ceil(rangeMinutes / minsPerCandle);
  let requested = Math.ceil(needed * 1.20); 

  // Force Backend to use DB by respecting limits
  if (iv === "1h" && requested > 720) requested = 720;
  if (iv === "1d" && requested > 365) requested = 365;

  return Math.max(2, Math.min(requested, 1000));
}

function Sparkline({ points = [] }) {
  if (!points || points.length < 2) return <div className={styles.sparkEmpty} />;
  const w = 80, h = 22;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (w - 2) + 1;
    const y = h - ((p - min) / span) * (h - 2) - 1;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className={styles.spark} aria-hidden="true">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

// ===========================================================================
// 2. DASHBOARD COMPONENT
// ===========================================================================

export default function Dashboard() {
  const baseUrl = "http://localhost:4000";

  // --- State Initialization ---
  const restored = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
    catch { return {}; }
  }, []);

  const [symbol, setSymbol] = useState(restored.symbol || "BTCUSDT");
  const [rangeKey, setRangeKey] = useState(restored.rangeKey || "1D");

  const [symbolsRows, setSymbolsRows] = useState([]);
  const [symbolsErr, setSymbolsErr] = useState("");
  const [activating, setActivating] = useState(new Set());
  const [summaries, setSummaries] = useState({});

  const [showEMA20, setShowEMA20] = useState(true);
  const [showEMA50, setShowEMA50] = useState(true);

  // --- 1. LOAD DATA ---
  
  // A. Load Symbols List
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setSymbolsErr("");
        // Calls /api/market/symbols
        const data = await marketApi.symbols();
        if (!alive) return;
        // Ensure we handle the response array correctly
        setSymbolsRows(Array.isArray(data) ? data : (data?.data ?? []));
      } catch (e) {
        if (!alive) return;
        setSymbolsErr(e?.message || "Failed to load symbols");
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // B. Load Summaries
  useEffect(() => {
    async function loadSummaries() {
      try {
        const data = await marketApi.summaryAll();
        if (Array.isArray(data)) {
          const map = {};
          data.forEach(item => { map[item.symbol] = item; });
          setSummaries(map);
        }
      } catch (e) { console.error("Failed to load summaries", e); }
    }
    loadSummaries();
    const id = setInterval(loadSummaries, 15000);
    return () => clearInterval(id);
  }, []);

  // --- 2. PREPARE COIN LIST (MOVED UP FOR SAFETY) ---
  const allCoins = useMemo(() => {
    // This safely handles the object format you provided: { symbol: "0GUSDT", ... }
    return symbolsRows.map((x) => {
        if (typeof x === 'string') return x;
        return x.symbol || ""; 
    }).filter(Boolean);
  }, [symbolsRows]);

  const [search, setSearch] = useState("");
  
  // ✅ MOVED UP: Defined before usage in effects
  const visibleCoins = useMemo(() => {
    const q = search.trim().toUpperCase();
    return q ? allCoins.filter((s) => s.includes(q)) : allCoins;
  }, [search, allCoins]);

  // --- 3. INTERVALS ---
  const allowedIntervals = useMemo(() => {
    const r = RANGE.find((x) => x.key === rangeKey) || RANGE[0];
    return r.intervals;
  }, [rangeKey]);

  const [candleInterval, setCandleInterval] = useState(() => {
    const r = RANGE.find((x) => x.key === (restored.rangeKey || "1D")) || RANGE[0];
    const iv = normalizeInterval(restored.interval, r.def);
    return r.intervals.includes(iv) ? iv : r.def;
  });

  useEffect(() => {
    const r = RANGE.find((x) => x.key === rangeKey) || RANGE[0];
    setCandleInterval((prev) => {
      const safePrev = normalizeInterval(prev, r.def);
      if (!r.intervals.includes(safePrev)) return r.def;
      return safePrev;
    });
  }, [rangeKey]);

  useEffect(() => {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ symbol, rangeKey, interval: normalizeInterval(candleInterval) })
    );
  }, [symbol, rangeKey, candleInterval]);

  const safeInterval = useMemo(() => {
    const r = RANGE.find((x) => x.key === rangeKey) || RANGE[0];
    const iv = normalizeInterval(candleInterval, r.def);
    return r.intervals.includes(iv) ? iv : r.def;
  }, [rangeKey, candleInterval]);

  const limit = useMemo(() => calcLimit(rangeKey, safeInterval), [rangeKey, safeInterval]);
  
  // --- 4. LIVE PRICES ---
  const liveMap = useLivePrices({ baseUrl, refreshMs: 1000 });
  const livePrice = Number(liveMap.get(symbol));

  // --- 5. LIVE 1S ACCUMULATOR ---
  const isLive1s = safeInterval === "1s";
  const [live1sCandles, setLive1sCandles] = useState([]);

  useEffect(() => { if (isLive1s) setLive1sCandles([]); }, [symbol, isLive1s]);

  useEffect(() => {
    if (!isLive1s) return;
    let curSec = 0, o = NaN, h = -Infinity, l = Infinity, c = NaN;

    const flush = (sec) => {
      if (!Number.isFinite(o) || !Number.isFinite(c)) return;
      setLive1sCandles((prev) => {
        const next = [...prev, { time: sec, open: o, high: h, low: l, close: c, volume: 0 }];
        if (next.length > 1000) next.splice(0, next.length - 1000);
        return next;
      });
    };

    const id = setInterval(() => {
      const p = Number(liveMap.get(symbol));
      if (!Number.isFinite(p)) return;
      const nowSec = Math.floor(Date.now() / 1000);
      
      if (curSec === 0) { curSec = nowSec; o = c = p; h = p; l = p; return; }
      if (nowSec !== curSec) { flush(curSec); curSec = nowSec; o = c = p; h = p; l = p; return; }
      c = p; h = Math.max(h, p); l = Math.min(l, p);
    }, 100); 
    return () => clearInterval(id);
  }, [isLive1s, symbol, liveMap]);

  // --- 6. HISTORICAL FETCH (BACKEND) ---
  const [fetchedCandles, setFetchedCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isLive1s) return; 
    let active = true;
    setLoading(true);
    setErr("");

    async function fetchLocalCandles() {
      try {
        const url = `${baseUrl}/api/market/candles?symbol=${symbol}&interval=${safeInterval}&limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const json = await res.json();
        if (!active) return;

        let rawData = [];
        if (Array.isArray(json)) rawData = json;
        else if (json.data && Array.isArray(json.data)) rawData = json.data;

        setFetchedCandles(rawData);
      } catch (error) {
        if (active) setErr(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchLocalCandles();
    const id = setInterval(fetchLocalCandles, 60000); 
    return () => { active = false; clearInterval(id); };

  }, [symbol, safeInterval, limit, isLive1s]);

  // --- 7. COMBINE DATA ---
  const activeCandles = isLive1s ? live1sCandles : fetchedCandles;

  const sortedCandles = useMemo(() => {
    if ((!activeCandles || activeCandles.length === 0) && Number.isFinite(livePrice)) {
       return [{
         time: Math.floor(Date.now() / 1000),
         open: livePrice, high: livePrice, low: livePrice, close: livePrice, volume: 0
       }];
    }

    if (!activeCandles || activeCandles.length === 0) return [];

    const formatted = activeCandles.map((c) => ({
      time: c.timestamp ? Math.floor(c.timestamp / 1000) : c.time, 
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume || 0),
    }));

    const unique = new Map();
    formatted.forEach(c => unique.set(c.time, c));
    return Array.from(unique.values()).sort((a, b) => a.time - b.time);
  }, [activeCandles, livePrice]);

  // --- 8. STATIC BASELINE FETCH (Stable %) ---
  const [referenceOpen, setReferenceOpen] = useState(null);

  useEffect(() => {
    if (rangeKey === "1D") { setReferenceOpen(null); return; }
    let active = true;
    async function fetchBaseline() {
      try {
        const r = RANGE.find((x) => x.key === rangeKey) || RANGE[0];
        const startTime = Date.now() - r.durationMs;
        const baseIv = r.baselineInterval || "1h";
        
        const url = `${baseUrl}/api/market/candles?symbol=${symbol}&interval=${baseIv}&limit=1&from=${startTime}`;
        const res = await fetch(url);
        const json = await res.json();
        
        if (active) {
            let data = Array.isArray(json) ? json : (json.data || []);
            if (data.length > 0) {
                const c = data[0];
                const op = c.open !== undefined ? c.open : c[1];
                if (op) setReferenceOpen(Number(op));
            }
        }
      } catch (e) { console.error("Baseline fetch failed", e); }
    }
    fetchBaseline();
    const id = setInterval(fetchBaseline, 300000); 
    return () => { active = false; clearInterval(id); };
  }, [symbol, rangeKey]);

  const [hoverOHLC, setHoverOHLC] = useState(null);

  // --- 9. STATS ---
  const stats = useMemo(() => {
    const lastP = Number.isFinite(livePrice) ? livePrice : (sortedCandles.at(-1)?.close || NaN);
    const validLast = Number.isFinite(lastP) ? lastP : NaN;

    if (rangeKey === "1D" && summaries[symbol]) {
        const s = summaries[symbol];
        return {
            last: validLast,
            high: Number(s.high),
            low: Number(s.low),
            vol: Number(s.volume),
            changePct: Number(s.changePercent),
            label: "24h"
        };
    }

    let openPrice = NaN;
    if (referenceOpen && Number.isFinite(referenceOpen)) {
        openPrice = referenceOpen;
    } else if (sortedCandles.length > 0) {
        openPrice = Number(sortedCandles[0].open);
    }

    let min = Infinity, max = -Infinity, volSum = 0;
    for (const c of sortedCandles) {
        const h = Number(c.high);
        const l = Number(c.low);
        const v = Number(c.volume);
        if (h > max) max = h;
        if (l < min) min = l;
        volSum += v;
    }

    const chg = openPrice && openPrice !== 0 ? ((validLast - openPrice) / openPrice) * 100 : 0;

    return {
        last: validLast,
        high: max === -Infinity ? NaN : max,
        low: min === Infinity ? NaN : min,
        vol: volSum,
        changePct: chg,
        label: rangeKey
    };
  }, [rangeKey, summaries, symbol, sortedCandles, livePrice, referenceOpen]);

  const rangeDir = useMemo(() => {
    if (!Number.isFinite(stats.changePct)) return "flat";
    return stats.changePct >= 0 ? "up" : "down";
  }, [stats.changePct]);

  const ohlcText = useMemo(() => {
    const h = hoverOHLC;
    if (!h) return null;
    return {
      o: fmt(h.open), h: fmt(h.high), l: fmt(h.low), c: fmt(h.close),
      ch: pct(h.open ? ((h.close - h.open)/h.open)*100 : 0),
      up: h.close >= h.open
    };
  }, [hoverOHLC]);

  // --- 10. ACTIVATION ---
  async function ensureActivated(sym) {
    // Optimistic: Check local state
    const row = symbolsRows.find((x) => (typeof x === 'string' ? x : x.symbol) === sym);
    if (row?.enabled) return true;

    setActivating((prev) => new Set(prev).add(sym));
    try {
      await marketApi.activate_symbol(sym);
      // Update local state to match backend
      setSymbolsRows((prev) => prev.map((x) => {
          const s = typeof x === 'string' ? x : x.symbol;
          if (s === sym) {
              return typeof x === 'string' ? { symbol: s, enabled: true } : { ...x, enabled: true };
          }
          return x;
      }));
      return true;
    } catch (e) {
      if (e.response && e.response.status === 409) return true; // 409 = Already Active
      return false; 
    } finally { 
      setActivating((prev) => { const n = new Set(prev); n.delete(sym); return n; }); 
    }
  }

  async function onPickSymbol(sym) {
    setSymbol(sym); 
    ensureActivated(sym); 
  }

  // --- 11. UI HANDLERS ---
  const [navWidth, setNavWidth] = useState(290);
  const draggingRef = useRef(false);
  const onDragDown = () => { draggingRef.current = true; };
  useEffect(() => {
    const onMove = (e) => { if (draggingRef.current) setNavWidth(clamp(e.clientX, 240, 420)); };
    const onUp = () => (draggingRef.current = false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mousemove", onMove) || window.removeEventListener("mouseup", onUp);
  }, []);

  // Update search (already set above via visibleCoins)
  useEffect(() => {
    if (!search) return;
    const match = allCoins.find((s) => s.includes(search.trim().toUpperCase()));
    if (match && match !== symbol) onPickSymbol(match);
  }, [search, allCoins]);

  // Sparklines
  const histRef = useRef(new Map());
  const [sparkMap, setSparkMap] = useState(new Map());
  useEffect(() => {
    const map = histRef.current;
    for (const sym of visibleCoins) {
      const p = Number(liveMap.get(sym));
      if (!Number.isFinite(p)) continue;
      const arr = map.get(sym) || [];
      arr.push(p);
      if (arr.length > 40) arr.shift();
      map.set(sym, arr);
    }
    setSparkMap(new Map(map));
  }, [liveMap, visibleCoins]);

  return (
    <div className={styles.shell} style={{ gridTemplateColumns: `${navWidth}px 1fr` }}>
      <aside className={styles.nav}>
        <div className={styles.navTop}>
          <div className={styles.navHead}>
            <div className={styles.navTitle}>Dashboard</div>
            <div className={styles.navSub}>All coins</div>
          </div>
        </div>
        <div className={styles.searchRow}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} className={styles.search} placeholder="Search symbol…" />
        </div>
        <div style={{ display: "flex", gap: 8, padding: "0 10px 10px" }}>
          {symbolsErr && <span style={{ fontSize: 11, opacity: 0.7 }}>{symbolsErr}</span>}
        </div>
        <div className={styles.navList}>
          {visibleCoins.map((sym) => {
            const active = sym === symbol;
            const price = Number(liveMap.get(sym));
            const spts = sparkMap.get(sym) || [];
            
            const coinSummary = summaries[sym];
            const chg24 = coinSummary ? coinSummary.changePercent : null;
            const dir = chg24 !== null
                 ? (chg24 >= 0 ? styles.up : styles.down)
                 : (spts.length >= 2 ? (spts.at(-1) > spts.at(-2) ? styles.up : styles.down) : styles.flat);
            const isActivating = activating.has(sym);

            return (
              <div key={sym} className={`${styles.rowWrap} ${active ? styles.rowActive : ""}`}>
                <button className={styles.rowMain} onClick={() => onPickSymbol(sym)} disabled={isActivating}>
                  <div className={styles.rowLeft}>
                    <div className={styles.symLine}>
                      <span className={styles.sym}>{sym}</span>
                      <span className={styles.quote}>USDT</span>
                      {isActivating && <span style={{fontSize:9, marginLeft:4}}>...</span>}
                    </div>
                    <div className={styles.sparkWrap}>
                      <span className={`${styles.sparkColor} ${dir}`}>
                        <Sparkline points={spts} />
                      </span>
                    </div>
                  </div>
                  <div className={styles.rowRight}>
                    <div className={`${styles.px} ${dir}`}>{Number.isFinite(price) ? fmt(price, 6) : "--"}</div>
                    <div className={`${styles.pct} ${dir}`} style={{ opacity: 0.85 }}>
                        {chg24 !== null ? pct(Number(chg24)) : "live"}
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
        <div className={styles.dragHandle} onMouseDown={onDragDown} />
      </aside>

      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.hLeft}>
            <div className={styles.pairLine}>
              <span className={styles.pair}>{symbol}</span>
              <span className={styles.badge}>USDT</span>
              <span className={`${styles.big} ${rangeDir === "up" ? styles.up : rangeDir === "down" ? styles.down : styles.flat}`}>
                {fmt(stats.last, 6)}
              </span>
              <span className={`${styles.chg} ${rangeDir === "up" ? styles.up : styles.down}`}>
                {pct(stats.changePct)} ({stats.label})
              </span>
              {isLive1s && <span className={styles.badge} style={{ opacity: 0.8 }}>LIVE 1s</span>}
            </div>
            <div className={styles.ohlcRow}>
              {ohlcText ? (
                <>
                  <span className={styles.ohlcLabel}>O</span><span className={styles.ohlcVal}>{ohlcText.o}</span>
                  <span className={styles.ohlcLabel}>H</span><span className={styles.ohlcVal}>{ohlcText.h}</span>
                  <span className={styles.ohlcLabel}>L</span><span className={styles.ohlcVal}>{ohlcText.l}</span>
                  <span className={styles.ohlcLabel}>C</span><span className={styles.ohlcVal}>{ohlcText.c}</span>
                  <span className={`${styles.ohlcChange} ${ohlcText.up ? styles.up : styles.down}`}>{ohlcText.ch}</span>
                </>
              ) : (
                <span className={styles.ohlcHint}>Hover chart for OHLC</span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.kpis}>
          <div className={styles.kpi}><div className={styles.kLabel}>{stats.label} High</div><div className={styles.kVal}>{fmt(stats.high, 6)}</div></div>
          <div className={styles.kpi}><div className={styles.kLabel}>{stats.label} Low</div><div className={styles.kVal}>{fmt(stats.low, 6)}</div></div>
          <div className={styles.kpi}><div className={styles.kLabel}>{stats.label} Vol</div><div className={styles.kVal}>{fmt(stats.vol, 2)}</div></div>
          <div className={styles.kpi}><div className={styles.kLabel}>{stats.label} Change</div><div className={`${styles.kVal} ${rangeDir === "up" ? styles.up : styles.down}`}>{pct(stats.changePct)}</div></div>
        </div>

        <div className={styles.chartControls}>
          <div className={styles.tfRow}>
            {RANGE.map((r) => (
              <button
                key={r.key}
                className={`${styles.tfBtn} ${rangeKey === r.key ? styles.tfActive : ""}`}
                onClick={() => setRangeKey(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className={styles.ctrlGroup}>
            <button className={`${styles.pill} ${showEMA20 ? styles.pillOn : ""}`} onClick={() => setShowEMA20(v => !v)}>EMA 50</button>
            <button className={`${styles.pill} ${showEMA50 ? styles.pillOn : ""}`} onClick={() => setShowEMA50(v => !v)}>EMA 20</button>
            
            <div className={styles.intervalGroup}>
              <span className={styles.ctrlLabel}>Interval</span>
              <select
                value={safeInterval}
                onChange={(e) => {
                  const iv = e.target.value;
                  if (iv === "1s") {
                    setRangeKey("1D");
                    setCandleInterval("1s");
                  } else {
                    setCandleInterval(iv);
                  }
                }}
                className={styles.intervalSelect}
              >
                {allowedIntervals.map((iv) => <option key={iv} value={iv}>{iv}</option>)}
              </select>
            </div>
          </div>
        </div>

        <section className={styles.chartSection}>
          {err ? (
            <div className={styles.stateError}>Error: {err}</div>
          ) : loading && !isLive1s && sortedCandles.length === 0 ? (
            <div className={styles.stateLoading}>Loading Data…</div>
          ) : (
            <div className={styles.chartWrap} style={{ position: "relative" }}>
              <ChartStack
                key={`${symbol}-${rangeKey}-${safeInterval}`}
                candles={sortedCandles}
                lastPrice={stats.last}
                height={720}
                showVolume={!isLive1s} 
                showRSI={!isLive1s}
                showEMA20={!isLive1s && showEMA20}
                showEMA50={!isLive1s && showEMA50}
                onHoverCandle={setHoverOHLC}
              />
              <ChartDrawOverlay candles={sortedCandles} symbol={symbol} rangeKey={rangeKey} interval={safeInterval} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}