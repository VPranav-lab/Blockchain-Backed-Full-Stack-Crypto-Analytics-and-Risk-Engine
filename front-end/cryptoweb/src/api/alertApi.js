import apiClient from "./apiClient";

export const alertsApi = {
  getAll: async ({ status = "OPEN", limit = 50 } = {}) => {
    const { data } = await apiClient.core.get(`/api/alerts?status=${encodeURIComponent(status)}&limit=${limit}`);
    return data; // { ok, status, count, alerts }
  },

  updateStatus: async (id, status) => {
    const { data } = await apiClient.core.patch(`/api/alerts/${id}`, { status });
    return data;
  },

  // ✅ FINAL: only windowHours is allowed
  recompute: async ({ windowHours } = {}) => {
    const body = {};
    if (windowHours) body.windowHours = windowHours;
    const { data } = await apiClient.core.post("/api/alerts/recompute", body);
    return data;
  },

  adminList: async ({ status = "OPEN", limit = 100, userId, sinceHours } = {}) => {
    const params = {};
    if (status) params.status = status;
    if (limit) params.limit = limit;
    if (userId) params.userId = userId;
    if (sinceHours) params.sinceHours = sinceHours;

    const { data } = await apiClient.core.get("/api/alerts/admin", {
      params,
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });

    return data; // { ok, count, alerts, ... }
  },
};
