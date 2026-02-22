import { useEffect, useState } from "react";
// give me the latest price for MANY coins
// live feed source for the dashboard

function pickList(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.coins)) return json.coins;
  return [];
}

export function useLivePrices({ baseUrl = "", refreshMs = 1000 }) {
  const [map, setMap] = useState(() => new Map());
  // It lives in React state, so when you call setMap(...), React re-renders the UI.
  // the official prices shown on screen.

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const res = await fetch(`${baseUrl}/api/market/livedata`);
        if (!res.ok) return;

        const json = await res.json();
        const list = pickList(json);

        // ✅ Keep last known good values if backend returns empty temporarily
        if (!Array.isArray(list) || list.length === 0) return;

        const next = new Map();
        // a temporary “builder Map” for this tick
        for (const x of list) {
          const symbol = x?.symbol; // if x is undefined/null, it won’t crash 
          const price = Number(x?.price ?? x?.last ?? x?.lastPrice ?? x?.c);
          if (symbol && Number.isFinite(price)) 
            next.set(symbol, price);
        }

        if (!alive) return;

        // ✅ Do not set empty map -> prevents NaN UI storms
        if (next.size > 0) 
          setMap(next); // Updating state triggers UI re-render where this hook is used
      } catch {
        // ignore: keep existing map
      }
    }

    tick(); // the browser will run it like this every second:
    const id = setInterval(tick, refreshMs); // Hey browser, call the function tick every refreshMs milliseconds
    // repeats every refreshMs milliseconds

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [baseUrl, refreshMs]);

  return map;
}
/*
key = coin symbol (string) like "BTCUSDT", "ETHUSDT"
value = latest price (number) like 89190.32
*/
