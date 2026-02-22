import apiClient from "./apiClient";

export const marketApi = {
  // --- READ PUBLIC DATA (From Port 4000) ---

  // 1. Get Symbols List
  symbols: async () => {
    try {
      // Uses apiClient.trade to hit Port 4000
      const { data } = await apiClient.trade.get("/api/market/symbols");
      return data; 
    } catch (e) {
      console.error("Failed to fetch symbols", e);
      return [];
    }
  },

  // 2. Get Full Market Summary
  summaryAll: async () => {
    const { data } = await apiClient.trade.get("/api/market/summary/allcoins");
    return data;
  },

  // 3. Get Live Prices
  live: async () => {
    const { data } = await apiClient.trade.get("/api/market/livedata");
    return data;
  },

  // 4. Get Candles
  candles: async ({ symbol, interval, limit }) => {
    const { data } = await apiClient.trade.get("/api/market/candles", { 
      params: { symbol, interval, limit } 
    });
    return data;
  },

  // --- WRITE / ACTIONS (From Port 4000) ---

  // 5. Activate Symbol (Direct Call)
  // Kept exactly as you had it, but using the unified client for safety
  activate_symbol: async (symbol) => {
    // Uses .trade client which is already configured for http://localhost:4000
    return apiClient.trade.post(`/api/market/activate`, { symbol: symbol }); 
  },

  // Backward-compatible alias (some screens use camelCase)
  activateSymbol: async (symbol) => {
    const res = await apiClient.trade.post(`/api/market/activate`, { symbol });
    return res?.data ?? res;
  },

  // 6. Activate Coin (Watchlist Logic)
  // Kept your logic to handle both string/object inputs
  activate: async (input) => {
    let symbol;
    if (typeof input === "string") symbol = input;
    else if (typeof input === "object" && input?.symbol) symbol = input.symbol;
    
    if (!symbol) throw new Error("Invalid symbol provided");
    
    // Pranav said watchlist is: /api/watchlist
    // routed to trade client (Port 4000)
    const { data } = await apiClient.trade.post("/api/watchlist", { symbol: symbol.toUpperCase() });
    return data;
  },
};