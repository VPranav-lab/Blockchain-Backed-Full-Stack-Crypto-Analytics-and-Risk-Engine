// src/api/tradeApi.js
import apiClient from "./apiClient";

// ✅ HELPER: Strict Financial Parser
const parseNumbers = (item) => {
  const qtyRaw = item.qty ?? item.quantity;
  const priceRaw = item.price ?? item.expectedPrice ?? item.expected_price;

  return {
    ...item,
    id: item.id || item.fillId || item._id,
    price: priceRaw != null ? parseFloat(priceRaw) : 0,
    qty: qtyRaw != null ? parseFloat(qtyRaw) : 0,
    quantity: qtyRaw != null ? parseFloat(qtyRaw) : 0, // keep for UI compatibility
    timestamp: item.executedAt || item.createdAt || item.created_at || item.createdAt || Date.now(),
  };
};


// ✅ format a positive number into a trimmed decimal string OR undefined
const formatNum = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return undefined;
  return x.toFixed(8).replace(/\.?0+$/, "");
};

export const tradeApi = {
  // --- 1. PORTFOLIO ---
  getUserHoldings: async () => {
    try {
      const { data } = await apiClient.trade.get("/api/portfolio");
      return {
        positions: Array.isArray(data.positions) ? data.positions : [],
        totalValue: data.totalValue || 0,
        totalPnL: data.totalPnL || 0,
      };
    } catch (e) {
      return { positions: [], totalValue: 0, totalPnL: 0 };
    }
  },

  // --- 2. MARKET DATA ---
  getPrice: async (symbol) => {
    try {
      const { data } = await apiClient.trade.get("/api/market/summary/allcoins");
      const coin = Array.isArray(data) ? data.find((c) => c.symbol === symbol) : null;
      return { price: coin ? parseFloat(coin.current_price) : 0 };
    } catch (e) {
      return { price: 0 };
    }
  },

  // --- 3. TRADE HISTORY ---
  getTradeHistory: async () => {
    try {
      const { data } = await apiClient.trade.get("/api/trades/get_trades");
      const rawList = Array.isArray(data) ? data : data.trades || data.rows || [];
      return rawList.map(parseNumbers).filter((t) => t.status === "FILLED" || t.status === "REVERSED");
    } catch (e) {
      console.error("History fetch failed:", e);
      return [];
    }
  },

  // --- 4. OPEN ORDERS ---
  getOpenOrders: async () => {
    try {
      const { data } = await apiClient.trade.get("/api/orders");
      const rawList = Array.isArray(data) ? data : data.orders || [];
      return rawList.map(parseNumbers);
    } catch (e) {
      return [];
    }
  },

  // --- 5. EXECUTE TRADE ---
  // IMPORTANT: Your backend order executor calls internal execute with:
  // expectedPrice: claimed.expectedPrice || null
  // So for LIMIT/STOP orders we MUST store expectedPrice in the order record,
  // otherwise backend will send null and Person C will reject it (Zod).
  execute: async (orderData) => {
    const { type, symbol, side, quantity, price, stopPrice } = orderData;

    const referenceId =
      globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Date.now().toString();

    const formatNum = (n) => {
      const x = Number(n);
      if (!Number.isFinite(x) || x <= 0) return undefined;
      return x.toFixed(8).replace(/\.?0+$/, "");
    };

    const strQty = formatNum(quantity);
    const strPrice = formatNum(price);
    const strStop = formatNum(stopPrice);

    if (!strQty) throw new Error("Enter valid quantity");

    // ✅ MARKET
    if (type === "MARKET") {
      const payload = {
        symbol: String(symbol).toUpperCase(),
        side: String(side).toUpperCase(),
        quantity: strQty,
        qty: strQty,
        referenceId,
        ...(strPrice ? { expectedPrice: strPrice } : {}),
      };

      console.log("POST /api/trades/execute_trade payload =>", JSON.stringify(payload, null, 2));
      const { data } = await apiClient.trade.post("/api/trades/execute_trade", payload);
      return data;
    }

    // ✅ LIMIT
    if (type === "LIMIT") {
      if (!strPrice) throw new Error("Limit orders require a price");

      const payload = {
        symbol: String(symbol).toUpperCase(),
        side: String(side).toUpperCase(),
        quantity: strQty,
        qty: strQty,
        orderType: "LIMIT",
        referenceId,

        price: strPrice,

        // ✅ CRITICAL: must be saved in Mongo or backend executor will send null later
        expectedPrice: strPrice,

        // ✅ optional duplicate key if backend uses snake_case
        expected_price: strPrice,
      };

      console.log("POST /api/orders payload =>", JSON.stringify(payload, null, 2));
      const { data } = await apiClient.trade.post("/api/orders", payload);
      return data;
    }

    // ✅ STOP-LIMIT (your UI calls it STOP)
// ✅ STOP (backend supports only ONE price field; no triggerPrice/stopPrice)
  if (type === "STOP") {
    // Backend rule: STOP only for SELL (it will reject BUY anyway)
    if (String(side).toUpperCase() !== "SELL") {
      throw new Error("Stop-Loss is Sell Only");
    }

    // Backend requires price for STOP as well
    if (!strPrice) throw new Error("Stop orders require a price");

    const payload = {
      symbol: String(symbol).toUpperCase(),
      side: "SELL",
      quantity: strQty,
      qty: strQty,
      orderType: "STOP",
      referenceId,
      price: strPrice, // ✅ single price used by backend
    };

    console.log("POST /api/orders payload =>", JSON.stringify(payload, null, 2));
    const { data } = await apiClient.trade.post("/api/orders", payload);
    return data;
  }


    throw new Error(`Unsupported order type: ${type}`);
  },


  // --- 6. UTILS ---
  cancelOrder: async (id) => {
    const { data } = await apiClient.trade.delete(`/api/orders/${id}`);
    return data;
  },

  getTradesForUser: async (userId) => {
    try {
      const { data } = await apiClient.trade.get(`/api/trades/get_trades?userId=${userId}`);
      return (data.trades || []).map(parseNumbers);
    } catch (e) {
      return [];
    }
  },

  reverseTrade: async (fillId, reason) => {
    const referenceId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `rev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const { data } = await apiClient.core.post(`/api/trade/fills/${fillId}/reverse`, {
      reason,
      referenceId,
    });
    return data;
  },
};
