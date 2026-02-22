export const fmtPrice = (price) => {
  if (!price) return "0.00";
  const num = Number(price);
  // If price is very small (like PEPE), show 8 decimals
  if (num < 1) {
    return num.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
  }
  // Standard coins (BTC, ETH) show 2 decimals
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtQty = (qty) => {
  if (!qty) return "0.00";
  // Quantities should always allow up to 8 decimals for precision
  return Number(qty).toLocaleString('en-US', { maximumFractionDigits: 8 });
};