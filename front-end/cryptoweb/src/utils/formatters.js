export const formatPrice = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleString() : "-";
