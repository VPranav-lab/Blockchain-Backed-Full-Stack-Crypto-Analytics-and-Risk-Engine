import React, { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import apiClient from "../../api/apiClient";

const getTime = (a) => {
  const v = a?.createdAt ?? a?.created_at ?? a?.timestamp ?? a?.time ?? a?.ts ?? null;
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getRisk = (a) => {
  const v = a?.risk ?? a?.score ?? a?.ruleRisk ?? a?.rule_risk ?? a?.value ?? null;
  if (v === 0) return 0;
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (Number.isFinite(n)) return n;

  // fallback to severity if numeric not present
  const sev = String(a?.severity || "").toUpperCase();
  if (sev === "CRITICAL") return 100;
  if (sev === "HIGH") return 70;
  if (sev === "MEDIUM") return 40;
  return 5;
};

export default function SecurityAnomalyChart({ alerts: propAlerts }) {
  const [internalAlerts, setInternalAlerts] = useState([]);

  useEffect(() => {
    if (Array.isArray(propAlerts)) {
      setInternalAlerts(propAlerts);
      return;
    }

    const fetchHistory = async () => {
      try {
        const { data } = await apiClient.core.get("/api/alerts/admin", {
          params: { limit: 200, sinceHours: 24 }
        });
        setInternalAlerts(Array.isArray(data?.alerts) ? data.alerts : []);
      } catch (e) {
        console.warn("Chart data sync failed:", e);
        setInternalAlerts([]);
      }
    };

    fetchHistory();
  }, [propAlerts]);

  const chartData = useMemo(() => {
    const now = new Date();

    // Build 12 buckets: current hour back to 11 hours ago
    const buckets = [];
    for (let i = 11; i >= 0; i--) {
      const slot = new Date(now);
      slot.setMinutes(0, 0, 0);
      slot.setHours(slot.getHours() - i);

      const label = slot.getHours().toString().padStart(2, "0") + ":00";
      buckets.push({
        time: label,
        key: `${slot.getFullYear()}-${slot.getMonth()}-${slot.getDate()}-${slot.getHours()}`,
        score: 0,
        count: 0,
        details: [],
      });
    }

    const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

    (internalAlerts || []).forEach((a) => {
      const t = getTime(a);
      if (!t) return;

      const h = new Date(t);
      h.setMinutes(0, 0, 0);

      const key = `${h.getFullYear()}-${h.getMonth()}-${h.getDate()}-${h.getHours()}`;
      const bucket = bucketByKey.get(key);
      if (!bucket) return;

      const r = getRisk(a);
      if (r !== null && r > bucket.score) bucket.score = r;
      bucket.count += 1;
      bucket.details.push(a);
    });

    return buckets;
  }, [internalAlerts]);

  const maxScore = Math.max(0, ...chartData.map((d) => d.score));
  const gradientColor = maxScore >= 80 ? "#ef4444" : maxScore >= 50 ? "#f59e0b" : "#10b981";

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="time"
            stroke="#71717a"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={2}
          />
          <YAxis
            stroke="#71717a"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
          />

          <Tooltip
            contentStyle={{ backgroundColor: "#18181b", border: "1px solid #27272a", borderRadius: "8px" }}
            itemStyle={{ color: "#fff" }}
            labelStyle={{ color: "#a1a1aa", marginBottom: 5 }}
            formatter={(value, _name, props) => {
              const count = props?.payload?.count ?? 0;
              return [`${value}/100 (events: ${count})`, "Max Risk"];
            }}
          />

          <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={50} stroke="#fbbf24" strokeDasharray="3 3" strokeOpacity={0.5} />

          <Area
            type="monotone"
            dataKey="score"
            stroke={gradientColor}
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorRisk)"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
