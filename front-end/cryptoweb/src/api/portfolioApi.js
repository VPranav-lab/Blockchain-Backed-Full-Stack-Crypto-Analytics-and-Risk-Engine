import apiClient from "./apiClient";

export const portfolioApi = {
  // Core portfolio
  get: async () => {
    try {
      const { data } = await apiClient.trade.get("/api/portfolio");
      return data || { positions: [], totalValue: 0, totalPnL: 0 };
    } catch (e) {
      console.warn("Portfolio fetch failed:", e);
      return { positions: [], totalValue: 0, totalPnL: 0 };
    }
  },

  // Risk endpoints
  getRiskSummary: async () => (await apiClient.trade.get("/api/portfolio/risk/summary")).data,

  getRiskScenarios: async (shockDecimalOrNull = null) => {
    const url =
      shockDecimalOrNull != null
        ? `/api/portfolio/risk/scenarios?shock=${shockDecimalOrNull}`
        : "/api/portfolio/risk/scenarios";
    return (await apiClient.trade.get(url)).data;
  },

  getCorrelation: async () => (await apiClient.trade.get("/api/portfolio/risk/correlation")).data,

  getPropagation: async (sourceAsset, shockDecimal) => {
    return (
      await apiClient.trade.get("/api/portfolio/risk/propagation", {
        params: { sourceAsset, shock: shockDecimal },
      })
    ).data;
  },

  getNewsRisk: async () => (await apiClient.trade.get("/api/portfolio/risk/news")).data,
};
