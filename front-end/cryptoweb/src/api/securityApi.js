import apiClient from "./apiClient";

export const securityApi = {
  health: async () => (await apiClient.core.get("/api/security/health")).data,

  getCurrentSession: async () => (await apiClient.core.get("/api/security/session/current")).data.session,

  startSession: async ({ rotate = false, ttlHours } = {}) => {
    const payload = { rotate };
    if (ttlHours) payload.ttlHours = ttlHours;
    const { data } = await apiClient.core.post("/api/security/session/start", payload);
    return data.session;
  },

  scoreSession: async ({ sessionId, intent = "PORTFOLIO", persist = true } = {}) => {
    const payload = { intent, persist };
    if (sessionId) payload.sessionId = sessionId;
    const { data } = await apiClient.core.post("/api/security/session/score", payload);
    return data.score;
  },

  endSession: async ({ sessionId, reason } = {}) => {
    const payload = {};
    if (sessionId) payload.sessionId = sessionId;
    if (reason) payload.reason = reason;
    const { data } = await apiClient.core.post("/api/security/session/end", payload);
    return data;
  },

  getMyFeatures: async () => (await apiClient.core.get("/api/security/me/features")).data,

  getMyEvents: async ({ limit = 50 } = {}) =>
    (await apiClient.core.get(`/api/security/me/events?limit=${limit}`)).data,

  // ✅ Back-compat alias (UI sometimes calls getEvents(limit))
  getEvents: async (limit = 50) =>
    (await apiClient.core.get(`/api/security/me/events?limit=${limit}`)).data,
};
