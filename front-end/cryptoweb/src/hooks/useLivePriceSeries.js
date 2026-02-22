import { useEffect, useRef, useState } from "react";
import { useLivePrices } from "./useLivePrices.js"; // keep same name as your existing file
// history builder

export function useLivePriceSeries({ baseUrl, symbol, sampleMs = 500, maxPoints = 240 }) {
  const liveMap = useLivePrices({ baseUrl, refreshMs: 1000 });
  const [series, setSeries] = useState([]);
  const lastRef = useRef(NaN);

  useEffect(() => {
    setSeries([]); // reset when symbol changes
    lastRef.current = NaN;
  }, [symbol]);

  useEffect(() => {
    const id = window.setInterval(() => { // Every sampleMs milliseconds (default 250ms), it runs the function inside.
      const p = Number(liveMap.get(symbol));
      if (!Number.isFinite(p)) return;

      // optional: skip duplicates
      if (p === lastRef.current) return;
      lastRef.current = p;

      setSeries((prev) => {
        const nowSec = Math.floor(Date.now() / 1000);
        const next = [...prev, { time: nowSec, price: p }];
        if (next.length > maxPoints) next.splice(0, next.length - maxPoints);
        return next;
      });
    }, sampleMs);

    return () => window.clearInterval(id); // stop interval
  }, [liveMap, symbol, sampleMs, maxPoints]);

  return series;
}
/*
useState = stores the series array so UI re-renders when it changes
useRef = stores last value without causing re-render
useEffect = runs reset logic + starts/stops the interval
*/