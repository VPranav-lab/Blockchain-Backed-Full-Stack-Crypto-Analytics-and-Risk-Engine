import { useEffect, useState } from "react";
import { marketApi } from "../api/marketApi";

export function useSymbolSummary(symbol) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!symbol);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!symbol) return;

    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await marketApi.summary(symbol);
        if (alive) setData(res);
      } catch (e) {
        if (alive) setError(e?.message || "Failed to load summary");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [symbol]);

  return { data, loading, error };
}
