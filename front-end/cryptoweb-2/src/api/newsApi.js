import apiClient from "./apiClient";

export const newsApi = {
  // 1. Get All News (Main Feed)
  getAll: async () => {
    try {
      // 🔴 WAS: const { data } = await apiClient.get("/news"); 
      // ✅ FIX: Use .trade to hit Port 4000
      const { data } = await apiClient.trade.get("/api/news");
      return data;
    } catch (error) {
      console.warn("News API Error:", error);
      return [];
    }
  },

  // 2. Get Latest Headline (Hero Section)
  getLatest: async () => {
    try {
      // 🔴 WAS: const { data } = await apiClient.get("/news/latest");
      // ✅ FIX: Use .trade to hit Port 4000
      const { data } = await apiClient.trade.get("/api/news/latest");
      return Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.warn("Latest News Error:", error);
      return null;
    }
  }
};