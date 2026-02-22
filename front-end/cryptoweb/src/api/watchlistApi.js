import apiClient from "./apiClient";

export const watchlistApi = {
  // 1. Get List (From Port 4000)
  get: async () => {
    try {
      // Uses .trade to hit Pranav's backend
      const { data } = await apiClient.trade.get("/api/watchlist");
      return data || [];
    } catch (e) {
      console.warn("Fetch watchlist failed", e);
      return [];
    }
  },

  // 2. Add Coin (From Port 4000)
  add: async (symbol) => {
    const { data } = await apiClient.trade.post("/api/watchlist", { symbol });
    return data;
  },

  // 3. Remove Coin (From Port 4000)
  remove: async (symbol) => {
    try {
      // ✅ Sends: DELETE http://localhost:4000/api/watchlist/BTCUSDT
      const { data } = await apiClient.trade.delete(`/api/watchlist/${encodeURIComponent(symbol)}`);
      return data;
    } catch (error) {
      // If backend says 404, it means "Coin not found/Already deleted".
      // We accept this as success so the UI doesn't break.
      if (error.response && error.response.status === 404) {
        return { message: "Already removed (ignored 404)" };
      }
      throw error;
    }
  }
};