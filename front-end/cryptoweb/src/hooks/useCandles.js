// src/hooks/useCandles.js
import { useEffect, useMemo, useRef, useState } from "react";
// useRef → stores a value that stays between renders without causing rerenders (the cache Map)
// useState → stores values that change over time (candles, loading, err)

function normalizeCandleRow(row) {
  // Your API: array of objects
  // row = { time, open, high, low, close, volume }
  
  let time = Number(row.time ?? row.timestamp ?? row.t ?? row.openTime);

  // keep this safety: if backend ever returns ms, chart still works
  if (time > 10_000_000_000) time = Math.floor(time / 1000);
  // It does not convert ms→sec yet. chart want in seconds

  return {
    time,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume ?? 0), // if volume is missing (null or undefined), use 0
  };
}

export function useCandles({ symbol, interval, limit, baseUrl = "", refreshMs = 0 }) {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const key = useMemo(() => `${symbol}|${interval}|${limit}`, [symbol, interval, limit]);
  // Historical Chart Engine
  // "BTCUSDT|1h|24"
  // "ETHUSDT|30m|48"
  
  const cacheRef = useRef(new Map());
  // Ref (useRef) = “data I want to remember, but updating it shouldn’t repaint the UI”

  async function fetchCandles(signal) {
    const url = `${baseUrl}/api/market/candles?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, signal ? { signal } : undefined);
    // If signal is provided, fetch can be aborted. if not simple fetch
    if (!res.ok) throw new Error(`candles ${res.status}`);

    const json = await res.json();

    // Expect: json is an array of candle objects
    const list = Array.isArray(json) ? json : [];

    return list
      .map(normalizeCandleRow)
      .filter((c) => Number.isFinite(c.time)) // .filter() removes items you don’t want.
      .sort((a, b) => a.time - b.time);
  }

  // Initial fetch + on key changes
  useEffect(() => {
    let alive = true; // flag true
    const ctrl = new AbortController();

    (async () => {
      try {
        setErr("");
        setLoading(true);

        // cache hit
        if (cacheRef.current.has(key)) {
          setCandles(cacheRef.current.get(key));
          setLoading(false);
          return;
        }
        // cleanup aborts the fetch or if someone left in between stop fetching
        const norm = await fetchCandles(ctrl.signal);
        if (!alive) return; // after fetch return false

        cacheRef.current.set(key, norm);
        setCandles(norm);
        setLoading(false);
      } catch (e) {
        if (!alive) return; // if fetch is dead
        if (e?.name === "AbortError") return; // If fetch was aborted → ignore
        setErr(e?.message || "Failed to load candles");
        setLoading(false);
      }
    })();

    return () => {
      alive = false; // clean up
      ctrl.abort(); // now after fetch abort fetching
    };
  }, [key, baseUrl]);

  // Optional polling refresh (slow only)
  useEffect(() => {
    // So you only allow “slow polling” (>= 5 seconds).
    if (!refreshMs || refreshMs < 5000) return;

    let alive = true;
    const id = setInterval(async () => {
      try {
        const norm = await fetchCandles(); // no abort in interval 
        if (!alive) return;  // Polling is a background refresh
        cacheRef.current.set(key, norm);
        setCandles(norm);
      } catch {
        // ignore polling errors
      }
    }, refreshMs);

    return () => { // stop interval when dependencies change 
      alive = false;
      clearInterval(id);
    };
  }, [key, refreshMs, baseUrl]);

  const lastClose = candles.length ? candles[candles.length - 1].close : undefined;
  return { candles, lastClose, loading, err };
}
/*
 what is polling
It is called polling:
“every X milliseconds, call the API again, and update candles”
*/