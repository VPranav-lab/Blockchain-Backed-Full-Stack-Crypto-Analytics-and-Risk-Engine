export default function LiveLine({ points = [], width = 320, height = 70 }) {
  // ✅ accept either [number] or [{price}] safely
  const clean = (points || [])
    .map((p) => (typeof p === "number" ? p : Number(p?.price)))
    .filter((n) => Number.isFinite(n));


  if (clean.length < 2) return <div style={{ height }} />;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1; // If all prices are the same, then max - min = 0. so we keep 1 because dividing with 0 infinity 

  // This code converts your prices into x,y coordinates so SVG can draw a line
  // high price small y (near top)
  // low price big y (near bottom)
  const d = clean
    .map((p, i) => {
      const x = (i / (clean.length - 1)) * (width - 2) + 1;
      const y = height - ((p - min) / span) * (height - 2) - 1;
      return `${x.toFixed(2)},${y.toFixed(2)}`; // Turn into "x,y" string
    })
    .join(" "); // (x,y)

  return (
    <svg width={width} height={height} style={{ display: "block" }} aria-hidden="true">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
