import styles from "./AlertHeatmap.module.css";

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function getSeverity(a) {
  const raw = a?.severity ?? a?.level ?? a?.risk ?? a?.band ?? "LOW";
  return String(raw).toUpperCase();
}

function getTime(a) {
  const t = a?.createdAt ?? a?.created_at ?? a?.time ?? a?.ts ?? a?.timestamp;
  const d = t ? new Date(t) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const SEV_COLOR = {
  LOW: { r: 14, g: 203, b: 129 },
  MEDIUM: { r: 240, g: 185, b: 11 },
  HIGH: { r: 246, g: 70, b: 93 },
  CRITICAL: { r: 255, g: 107, b: 129 },
};

function rgba({ r, g, b }, a) {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export default function AlertHeatmap({ alerts = [] }) {
  // last 6 hours buckets (INCLUDING current hour) - use LOCAL hour keys (avoid UTC mismatch)
  const now = new Date();
  const buckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}`;

    buckets.push({
      key,
      label: `${String(d.getHours()).padStart(2, "0")}:00`,
    });
  }

  // grid[sevIndex][bucketIndex] = count
  const grid = SEVERITIES.map(() => buckets.map(() => 0));

  for (const a of Array.isArray(alerts) ? alerts : []) {
    const sev = getSeverity(a);
    const t = getTime(a);
    if (!t) continue;

    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
      t.getDate()
    ).padStart(2, "0")}T${String(t.getHours()).padStart(2, "0")}`;

    const r = SEVERITIES.indexOf(sev);
    const c = buckets.findIndex((b) => b.key === key);
    if (r >= 0 && c >= 0) grid[r][c] += 1;
  }

  const max = Math.max(1, ...grid.flat());

  const cellStyle = (sev, count) => {
    const base = SEV_COLOR[sev] || SEV_COLOR.LOW;
    const intensity = clamp01(count / max);

    const alpha = 0.06 + intensity * 0.78;
    const borderAlpha = 0.18 + intensity * 0.62;

    return {
      background: rgba(base, alpha),
      borderColor: rgba(base, borderAlpha),
      color: count > 0 ? "#fff" : "rgba(255,255,255,0.55)",
    };
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.title}>Severity Heatmap</div>
        <div className={styles.sub}>Last 6 hours · bucketed hourly</div>
      </div>

      {/* IMPORTANT: scroll container prevents forced squeezing on small widths */}
      <div className={styles.gridScroll}>
        <div className={styles.grid} role="grid" aria-label="Severity heatmap">
          {/* Corner */}
          <div className={styles.corner} />

          {/* Column headers */}
          {buckets.map((b) => (
            <div key={b.key} className={styles.colHeader}>
              {b.label}
            </div>
          ))}

          {/* Rows: label + 6 cells */}
          {SEVERITIES.map((sev, r) => (
            <div key={sev} className={styles.row}>
              <div className={styles.rowHeader}>{sev}</div>

              {buckets.map((b, c) => {
                const v = grid[r][c];
                return (
                  <div
                    key={`${sev}-${b.key}`}
                    className={`${styles.cell} ${v === 0 ? styles.cellZero : ""}`}
                    title={`${sev} @ ${b.label}: ${v}`}
                    style={cellStyle(sev, v)}
                  >
                    {v > 0 ? v : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.legend}>
        {SEVERITIES.map((sev) => {
          const base = SEV_COLOR[sev] || SEV_COLOR.LOW;
          return (
            <div key={sev} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ background: rgba(base, 0.55), borderColor: rgba(base, 0.85) }}
              />
              <span>{sev}</span>
            </div>
          );
        })}
        <div className={styles.legendNote}>Higher counts → brighter cells</div>
      </div>

      <div className={styles.hint}>Heatmap is computed client-side from alert timestamps + severities.</div>
    </div>
  );
}
