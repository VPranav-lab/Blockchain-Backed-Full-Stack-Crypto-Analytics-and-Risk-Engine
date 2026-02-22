import apiClient from "./apiClient";

// ✅ HELPER: Convert Backend Strings to Numbers for UI
const parseNumbers = (item) => ({
  ...item,
  // Parse standard fields
  price: item.price ? parseFloat(item.price) : 0,
  stopPrice: item.stopPrice ? parseFloat(item.stopPrice) : 0, // Critical for Stop-Loss orders
  quantity: item.quantity ? parseFloat(item.quantity) : 0,
  qty: item.qty ? parseFloat(item.qty) : (item.quantity ? parseFloat(item.quantity) : 0),
  filled: item.filled ? parseFloat(item.filled) : 0,
  
  // Ensure ID is always accessible (some backends use _id, some use id)
  id: item.id || item._id
});

// Safe array extraction
function normalizeList(x) {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.orders)) return x.orders;
  if (Array.isArray(x?.data)) return x.data;
  return [];
}

export const ordersApi = {
  // List Pending Orders (Limit/Stop) -> Pranav Port 4000
  listPending: async () => {
    try {
      const { data } = await apiClient.trade.get("/api/orders");
      const list = normalizeList(data);
      // ✅ Fix: Convert strings to numbers before returning to UI
      return list.map(parseNumbers);
    } catch (e) {
      console.warn("Failed to fetch open orders", e);
      return [];
    }
  },

  // Cancel Order -> Pranav Port 4000
  cancel: async (id) => {
    const { data } = await apiClient.trade.delete(`/api/orders/${id}`);
    return data;
  },
};