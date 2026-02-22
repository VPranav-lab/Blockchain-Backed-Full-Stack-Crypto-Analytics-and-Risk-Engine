import apiClient from "./apiClient";

export const healthApi = {
  // Check Core Backend (Source 45)
  checkCore: async () => {
    try {
      // We use /health/deep because it checks if the Database is actually connected
      const { data } = await apiClient.core.get("/health/deep");
      return data.ok; 
    } catch (e) {
      return false;
    }
  },

  // Check Deep Connectivity (DB + Mongo)
  // Contract Source 45
  checkDeep: async () => {
    try {
      const { data } = await apiClient.core.get("/health/deep");
      return data; // { ok: true, mysql: true, mongo: true }
    } catch (e) {
      return { ok: false };
    }
  }
};