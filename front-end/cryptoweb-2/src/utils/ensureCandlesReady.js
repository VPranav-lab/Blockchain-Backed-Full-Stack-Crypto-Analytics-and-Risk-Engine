export async function ensureCandlesReady({ baseUrl, symbol, interval, limit, timeoutMs = 30000 }) {
  async function fetchCandles() {
    const res = await fetch(
      `${baseUrl}/api/market/candles?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : (json.data ?? json.candles ?? []);
  }

  // 1) already ready?
  let candles = await fetchCandles();
  if (candles.length > 0) return true;

  // 2) activate
  await fetch(`${baseUrl}/api/market/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  }).catch(() => {});

  // 3) poll
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2000));
    candles = await fetchCandles();
    if (candles.length > 0) return true;
  }
  return false;
}
