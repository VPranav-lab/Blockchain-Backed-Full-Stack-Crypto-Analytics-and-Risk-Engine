import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from "lightweight-charts";

function calcRSI(closes, period = 14) {
  if (!closes || closes.length < period + 2) return [];

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += -diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const out = [];
  let rs = avgLoss === 0 ? 999999 : avgGain / avgLoss;
  out.push(100 - 100 / (1 + rs));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 999999 : avgGain / avgLoss;
    out.push(100 - 100 / (1 + rs));
  }
  return out;
}

function calcEMA(values, period) {
  if (!values || values.length < period) return [];
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const out = new Array(values.length).fill(null);
  out[period - 1] = ema;

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

export default function ChartStack({
  candles = [],
  height = 700,
  lastPrice,
  showVolume = true,
  showRSI = true,
  showEMA20 = false,
  showEMA50 = false,
  onHoverCandle, // (ohlcObj|null) => void
}) {
  const wrapRef = useRef(null);

  const chartCRef = useRef(null);
  const chartVRef = useRef(null);
  const chartRRef = useRef(null);

  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const rsiSeriesRef = useRef(null);

  const ema20Ref = useRef(null);
  const ema50Ref = useRef(null);

  const lastPriceLineRef = useRef(null);

  const up = "#16c784";
  const down = "#ea3943";

  const sizes = useMemo(() => {
    const candleH = Math.max(380, Math.floor(height * 0.68));
    const volH = Math.max(90, Math.floor(height * 0.16));
    const rsiH = Math.max(90, height - candleH - volH);
    return { candleH, volH, rsiH };
  }, [height]);

  const base = useMemo(
    () => ({
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255,255,255,.80)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,.06)" },
        horzLines: { color: "rgba(255,255,255,.06)" },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,.10)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,.10)",
      },
      crosshair: { mode: CrosshairMode.Normal },
      handleScroll: true,
      handleScale: true,
    }),
    []
  );

  // INIT
  useEffect(() => {
    if (!wrapRef.current) return;

    const nodes = wrapRef.current.querySelectorAll("[data-panel]");
    const n1 = nodes[0];
    const n2 = nodes[1];
    const n3 = nodes[2];
    if (!n1 || !n2 || !n3) return;

    const mk = (node, h) => createChart(node, { ...base, width: node.clientWidth, height: h });

    const c = mk(n1, sizes.candleH);
    const v = mk(n2, sizes.volH);
    const r = mk(n3, sizes.rsiH);

    const cs = c.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      wickUpColor: up,
      wickDownColor: down,
      borderUpColor: up,
      borderDownColor: down,
    });

    const vs = v.addSeries(HistogramSeries, { priceFormat: { type: "volume" } });
    const rs = r.addSeries(LineSeries, { lineWidth: 2 });

    // EMA lines on candle chart
    const ema20 = c.addSeries(LineSeries, { lineWidth: 2 });
    const ema50 = c.addSeries(LineSeries, { lineWidth: 2 });

    chartCRef.current = c;
    chartVRef.current = v;
    chartRRef.current = r;

    candleSeriesRef.current = cs;
    volumeSeriesRef.current = vs;
    rsiSeriesRef.current = rs;

    ema20Ref.current = ema20;
    ema50Ref.current = ema50;

    // === Safe time-range sync (prevents Value is null crash)
    const sync = () => {
      try {
        const range = c.timeScale().getVisibleRange();
        if (!range) return;
        v.timeScale().setVisibleRange(range);
        r.timeScale().setVisibleRange(range);
      } catch {
        // ignore
      }
    };
    c.timeScale().subscribeVisibleTimeRangeChange(sync);

    // === OHLC Hover row
    const onMove = (param) => {
      if (!onHoverCandle) return;
      if (!param || !param.time) {
        onHoverCandle(null);
        return;
      }
      try {
        const map = param.seriesData;
        const bar = map?.get?.(cs);
        if (!bar) {
          onHoverCandle(null);
          return;
        }
        onHoverCandle({
          time: param.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        });
      } catch {
        onHoverCandle(null);
      }
    };
    c.subscribeCrosshairMove(onMove);

    const onResize = () => {
      c.applyOptions({ width: n1.clientWidth });
      v.applyOptions({ width: n2.clientWidth });
      r.applyOptions({ width: n3.clientWidth });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      try {
        c.timeScale().unsubscribeVisibleTimeRangeChange(sync);
      } catch {}
      try {
        c.unsubscribeCrosshairMove(onMove);
      } catch {}

      c.remove();
      v.remove();
      r.remove();

      chartCRef.current = null;
      chartVRef.current = null;
      chartRRef.current = null;

      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      rsiSeriesRef.current = null;

      ema20Ref.current = null;
      ema50Ref.current = null;

      lastPriceLineRef.current = null;
    };
  }, [base, sizes.candleH, sizes.volH, sizes.rsiH, onHoverCandle]);

  // DATA + INDICATORS
  useEffect(() => {
    const cs = candleSeriesRef.current;
    const vs = volumeSeriesRef.current;
    const rs = rsiSeriesRef.current;
    const ema20 = ema20Ref.current;
    const ema50 = ema50Ref.current;

    if (!cs || !vs || !rs || !ema20 || !ema50) return;

    // Candles
    cs.setData(candles || []);

    // Volume
    vs.applyOptions({ visible: !!showVolume });
    if (candles?.length) {
      const vols = candles.map((c) => {
        const vol = Number(c.volume ?? c.v ?? 0);
        const isUp = c.close >= c.open;
        return {
          time: c.time,
          value: Number.isFinite(vol) ? vol : 0,
          color: isUp ? "rgba(22,199,132,.55)" : "rgba(234,57,67,.55)",
        };
      });
      vs.setData(vols);
    } else {
      vs.setData([]);
    }

    // RSI
    rs.applyOptions({ visible: !!showRSI });
    if (candles?.length) {
      const closes = candles.map((c) => Number(c.close)).filter(Number.isFinite);
      const rsi = calcRSI(closes, 14);
      const startIdx = 14;
      const rsiData = [];
      for (let i = 0; i < rsi.length; i++) {
        const idx = startIdx + i;
        const t = candles[idx]?.time;
        if (!t) continue;
        rsiData.push({ time: t, value: rsi[i] });
      }
      rs.setData(rsiData);
    } else {
      rs.setData([]);
    }

    // EMA 20/50
    ema20.applyOptions({ visible: !!showEMA20 });
    ema50.applyOptions({ visible: !!showEMA50 });

    if (candles?.length) {
      const closes = candles.map((c) => Number(c.close)).filter(Number.isFinite);
      const ema20Vals = calcEMA(closes, 20);
      const ema50Vals = calcEMA(closes, 50);

      const ema20Data = [];
      const ema50Data = [];

      for (let i = 0; i < candles.length; i++) {
        const t = candles[i]?.time;
        const v20 = ema20Vals[i];
        const v50 = ema50Vals[i];
        if (t && Number.isFinite(v20)) ema20Data.push({ time: t, value: v20 });
        if (t && Number.isFinite(v50)) ema50Data.push({ time: t, value: v50 });
      }

      ema20.setData(ema20Data);
      ema50.setData(ema50Data);
    } else {
      ema20.setData([]);
      ema50.setData([]);
    }

    chartCRef.current?.timeScale().fitContent();
  }, [candles, showVolume, showRSI, showEMA20, showEMA50]);

  // LAST PRICE LINE
  useEffect(() => {
    const cs = candleSeriesRef.current;
    if (!cs) return;

    if (lastPriceLineRef.current) {
      cs.removePriceLine(lastPriceLineRef.current);
      lastPriceLineRef.current = null;
    }
    if (typeof lastPrice !== "number") return;

    const lastC = candles?.[candles.length - 1];
    const isUp = lastC ? lastC.close >= lastC.open : true;

    lastPriceLineRef.current = cs.createPriceLine({
      price: lastPrice,
      color: isUp ? up : down,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "Last",
    });
  }, [lastPrice, candles]);

  return (
    <div ref={wrapRef} style={{ width: "100%", display: "grid", gap: 10 }}>
      <div data-panel style={{ width: "100%", borderRadius: 12, overflow: "hidden" }} />
      <div data-panel style={{ width: "100%", borderRadius: 12, overflow: "hidden" }} />
      <div data-panel style={{ width: "100%", borderRadius: 12, overflow: "hidden" }} />
    </div>
  );
}
