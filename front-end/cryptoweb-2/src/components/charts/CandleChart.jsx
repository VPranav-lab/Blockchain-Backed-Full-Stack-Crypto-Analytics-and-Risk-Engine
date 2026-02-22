import { useEffect, useMemo, useRef } from "react";
import { createChart, CrosshairMode, CandlestickSeries } from "lightweight-charts";

export default function CandleChart({ candles = [], height = 460, lastPrice }) {
  const wrapRef = useRef(null); // will point to the div DOM element where chart should be mounted:
  const chartRef = useRef(null); // stores the chart instance
  const seriesRef = useRef(null); // stores the candlestick series inside the chart
  const lastPriceLineRef = useRef(null); // stores the price line object

  const upColor = "#16c784";
  const downColor = "#ea3943";

  // We use useMemo so React doesn’t rebuild that options object every render.
  const options = useMemo(
    () => ({
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255,255,255,.85)",
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
    // wrapRef.current is the <div> in the DOM.
    
    // createChart(container, settings)
    const chart = createChart(wrapRef.current, {
      ...options,
      width: wrapRef.current.clientWidth,
      height,
    });

    // ✅ NEW API: addSeries(CandlestickSeries, options) Add the candlestick series
    const series = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      wickUpColor: upColor,
      wickDownColor: downColor,
      borderUpColor: upColor,
      borderDownColor: downColor,
    });
  
    // Refs let you keep them available forever without triggering UI rerenders.
    chartRef.current = chart;
    seriesRef.current = series;

    const onResize = () => {
      if (!wrapRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: wrapRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);

    // Cleanup (when component closes)
    // When you leave the page, it:
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      lastPriceLineRef.current = null;
    };
  }, [height, options]);

  // SET DATA
  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(candles);
    chartRef.current?.timeScale().fitContent();
    // timeScale() = x-axis control
    // fitContent() = auto zoom so all candles fit in visible area
  }, [candles]);

  // LAST PRICE LINE
  useEffect(() => {
    if (!seriesRef.current) return;

    if (lastPriceLineRef.current) {
      try {
        seriesRef.current.removePriceLine(lastPriceLineRef.current);
      } catch {}
        lastPriceLineRef.current = null;
    }

    if (typeof lastPrice !== "number") return;

    const lastC = candles?.[candles.length - 1]; // Get the most recent candle.
    const isUp = lastC ? lastC.close >= lastC.open : true; // If close >= open → “up candle”

    lastPriceLineRef.current = seriesRef.current.createPriceLine({
      price: lastPrice,
      color: isUp ? upColor : downColor,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: "Last",
    });
  }, [lastPrice, candles]);
  // when candle changes (because you want the color logic based on last candle)

  return <div ref={wrapRef} style={{ width: "100%", height }} />;
  // So the div is the mount target.
}
