// src/components/charts/ChartDrawOverlay.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../../pages/Dashboard.module.css";

function lsKey(symbol, rangeKey, interval) {
  return `draw:v2:${symbol}:${rangeKey}:${interval}`;
}
// candles: so it knows the visible time and price range (domain)
export default function ChartDrawOverlay({ candles, symbol, rangeKey, interval }) {
  const wrapRef = useRef(null);
  const [enabled, setEnabled] = useState(false); // draw mode

  const [tool, setTool] = useState("trend"); // trend | hline | long | short
  const [items, setItems] = useState([]); // This stores all shapes the user drew.
  // every shape the user creates is pushed into this array
  const [draftA, setDraftA] = useState(null);
  // first click → set draftA = { time, price }
  // second click → finalize line from draftA to { time, price }, then clear draftA
  const [cursor, setCursor] = useState(null); // live mouse position (data coords)

  const domain = useMemo(() => {
    if (!candles || candles.length < 2) return null;
    const t0 = candles[0].time;
    const t1 = candles[candles.length - 1].time;
    let lo = Infinity, hi = -Infinity;
    for (const c of candles) {
      lo = Math.min(lo, Number(c.low));
      hi = Math.max(hi, Number(c.high));
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi === lo) return null;
    return { t0, t1, lo, hi };
  }, [candles]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey(symbol, rangeKey, interval));
      // If nothing saved yet, raw is null.
      setItems(raw ? JSON.parse(raw) : []); // back to array form
      setDraftA(null);
      setCursor(null);
    } catch {
      setItems([]);
      setDraftA(null);
      setCursor(null);
    }
  }, [symbol, rangeKey, interval]);

  useEffect(() => {
    try {
      localStorage.setItem(lsKey(symbol, rangeKey, interval), JSON.stringify(items)); // array into string
    } catch {}
  }, [items, symbol, rangeKey, interval]);

  const toData = (clientX, clientY) => {
    const el = wrapRef.current;
    if (!el || !domain) return null; // if div and domain null
    const r = el.getBoundingClientRect(); // give r.left, r.top, r.width, r.height
    const x01 = (clientX - r.left) / r.width;
    const y01 = (clientY - r.top) / r.height;
    const time = domain.t0 + x01 * (domain.t1 - domain.t0);
    const price = domain.hi - y01 * (domain.hi - domain.lo);
    return { time, price }; // This is what you store in drawings:
  };

  // clientX, clientY from the mouse event.

  const onMove = (e) => { // This only runs when Draw mode is ON.
    if (!enabled || !domain) return; // draw mode not enabled
    const p = toData(e.clientX, e.clientY); // we gets time and price on click
    if (p) setCursor(p); // stores the current mouse point in data coords.
  };

  const onClick = (e) => { // only allow clicks when drawing is enabled
    if (!enabled || !domain) return;
    const p = toData(e.clientX, e.clientY);
    if (!p) return;

    if (tool === "long" || tool === "short") { // take old drawings (prev)
      setItems((prev) => [...prev, { type: tool, p }]);
      // you create a new array that includes previous + new
      return;
    }

    if (tool === "hline") {
      setItems((prev) => [...prev, { type: "hline", y: p.price }]);
      return;
    }

    if (tool === "trend") {
      if (!draftA) { // ok first it null let say this become true and we store first click point then now draft is not null so we store second click in b
        setDraftA(p);
      } else {
        setItems((prev) => [...prev, { type: "trend", a: draftA, b: p }]);
        setDraftA(null);
      }
    }
  };

  const renderSvg = () => {
    const el = wrapRef.current;
    if (!el || !domain) return null;
    const r = el.getBoundingClientRect(); // convert data points to pixels so SVG can draw
    const w = r.width;
    const h = r.height;

    // You have data coords (time, price)
    // But SVG needs pixel coords (x, y)

    const xOf = (time) => ((time - domain.t0) / (domain.t1 - domain.t0)) * w;
    const yOf = (price) => ((domain.hi - price) / (domain.hi - domain.lo)) * h;
    // Used during render to draw SVG shapes.

    return (
      <svg className={styles.drawSvg} width="100%" height="100%">
        {items.map((it, idx) => {
          if (it.type === "hline") {
            const y = yOf(it.y); // yOf(it.y) converts that price → pixel y.
            return <line key={idx} x1="0" x2={w} y1={y} y2={y} className={styles.drawLine} />;
          }
          if (it.type === "trend") {
            const x1 = xOf(it.a.time), y1 = yOf(it.a.price);
            const x2 = xOf(it.b.time), y2 = yOf(it.b.price);
            return <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} className={styles.drawLine} />;
          }
          if (it.type === "long" || it.type === "short") {
            const cx = xOf(it.p.time), cy = yOf(it.p.price);
            return <circle key={idx} cx={cx} cy={cy} r="6" className={it.type === "long" ? styles.longDot : styles.shortDot} />;
          }
          return null;
        })}

        {/* preview trendline */}
        {draftA && cursor && (
          <line
            x1={xOf(draftA.time)}
            y1={yOf(draftA.price)}
            x2={xOf(cursor.time)}
            y2={yOf(cursor.price)}
            className={styles.drawLinePreview}
          />
        )}
      </svg>
    );
  };

  return (
    <div className={styles.drawUi}>
      <div className={styles.drawToolbar}>
        <button className={`${styles.pill} ${enabled ? styles.pillOn : ""}`} onClick={() => { setEnabled(v => !v); setDraftA(null); }}>
          Draw
        </button>

        <button disabled={!enabled} className={`${styles.pill} ${tool==="trend" ? styles.pillOn : ""}`} onClick={() => { setTool("trend"); setDraftA(null); }}>
          Trend
        </button>
        <button disabled={!enabled} className={`${styles.pill} ${tool==="hline" ? styles.pillOn : ""}`} onClick={() => { setTool("hline"); setDraftA(null); }}>
          H-Line
        </button>
        <button disabled={!enabled} className={`${styles.pill} ${tool==="long" ? styles.pillOn : ""}`} onClick={() => { setTool("long"); setDraftA(null); }}>
          Long
        </button>
        <button disabled={!enabled} className={`${styles.pill} ${tool==="short" ? styles.pillOn : ""}`} onClick={() => { setTool("short"); setDraftA(null); }}>
          Short
        </button>

        <button disabled={!enabled} className={styles.pill} onClick={() => { setItems([]); setDraftA(null); }}>
          Clear
        </button>
      </div>

      {/* IMPORTANT: only captures events when enabled -> hover OHLC works when Draw off */}
      <div
        ref={wrapRef}
        className={enabled ? styles.drawHitOn : styles.drawHitOff}
        onMouseMove={onMove}
        onClick={onClick}
      >
        {renderSvg()}
      </div>
    </div>
  );
}

// if you were halfway drawing a trend line, changing tools should cancel it.
/*
drawHitOff sets pointer-events: none; (so events pass through to the chart)
drawHitOn sets pointer-events: auto; (so overlay intercepts clicks/moves)
renderSvg() converts data coords → pixel coords and draws SVG lines/circles.
*/

// So items is basically your “saved drawings database”, not a list of tools.


