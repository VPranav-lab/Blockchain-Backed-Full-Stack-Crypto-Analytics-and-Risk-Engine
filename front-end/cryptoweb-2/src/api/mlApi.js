import apiClient from "./apiClient";

export const mlApi = {
  // POST /api/ml/price-prediction
  predictPrice: async ({ symbols, interval = "1h", horizon = 24, includePropagation = false, asOf } = {}) => {
    const payload = {
      symbols: Array.isArray(symbols) ? symbols : [symbols].filter(Boolean),
      interval,
      horizon,
      includePropagation,
    };
    if (asOf) payload.asOf = asOf;

    try {
      const { data } = await apiClient.core.post("/api/ml/price-prediction", payload);
      // backend: { ok:true, result: {...} }
      return { ok: true, result: data?.result ?? null, requestId: data?.requestId };
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error || e?.message || "ml_error";
      return { ok: false, error: msg, status };
    }
  },

  // GET /api/ml/predictions
  getPredictions: async () => {
    try {
      const { data } = await apiClient.core.get("/api/ml/predictions");
      const items = data?.predictions || data?.items || data?.rows || data?.data || [];
      return Array.isArray(items) ? items : [];
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "ml_history_error";
      console.warn("ML prediction history fetch failed:", msg);
      return [];
    }
  },
};
