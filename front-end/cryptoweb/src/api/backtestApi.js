import apiClient from "./apiClient";

export const backtestApi = {
  // GET: Fetch all past backtests history (From Port 4000)
  getAll: async () => {
    // Uses .trade to hit Pranav's backend
    const { data } = await apiClient.trade.get("/api/backtest");
    return data;
  },

  // POST: Run a new instant backtest (From Port 4000)
  run: async (params) => {
    // params: { strategy, short_window, long_window, initial_capital }
    const { data } = await apiClient.trade.post("/api/backtest", params);
    return data;
  }
};