export function normalizeCandles(raw) {
  const arr = Array.isArray(raw) ? raw : raw?.data ?? [];

  // Array format: [time, open, high, low, close, volume]
  if (arr.length && Array.isArray(arr[0])) {
    return arr.map((a) => ({
      time: Number(a[0]),
      open: Number(a[1]),
      high: Number(a[2]),
      low: Number(a[3]),
      close: Number(a[4]),
      volume: Number(a[5]),
    }));
  }

  // Object format
  return arr.map((c) => ({
    time: Number(c.time ?? c.t ?? c.timestamp ?? c.openTime),
    open: Number(c.open ?? c.o),
    high: Number(c.high ?? c.h),
    low: Number(c.low ?? c.l),
    close: Number(c.close ?? c.c),
    volume: Number(c.volume ?? c.v),
  }));
}
