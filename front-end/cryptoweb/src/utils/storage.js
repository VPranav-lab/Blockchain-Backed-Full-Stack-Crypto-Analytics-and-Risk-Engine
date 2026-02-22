const KEYS = {
  watchlist: "cryptoweb_watchlist",
  trades: "cryptoweb_trades",
};

export function loadWatchlist() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.watchlist) || "[]");
  } catch {
    return [];
  }
}
export function saveWatchlist(list) {
  localStorage.setItem(KEYS.watchlist, JSON.stringify(list));
}

export function loadTrades() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.trades) || "[]");
  } catch {
    return [];
  }
}
export function saveTrades(list) {
  localStorage.setItem(KEYS.trades, JSON.stringify(list));
}
