import apiClient from "./apiClient";

/**
 * Treat "receipt not available yet" as a normal pending state.
 * Backend guide: receipt exists only after item committed into a block.
 */
function asPending(err, kind) {
  const status = err?.response?.status;
  const msg =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    "";

  const lowered = String(msg).toLowerCase();

  const isNotCommitted =
    status === 404 ||
    status === 400 ||
    status === 409 || // sometimes used for "not ready" / conflict states
    lowered.includes("not committed") ||
    lowered.includes("not yet committed") ||
    lowered.includes("pending") ||
    lowered.includes("no receipt");

  if (isNotCommitted) {
    return {
      pending: true,
      kind,
      message: "Not committed yet. Auto-mining will commit it soon, or commit a block and retry.",
      status,
      details: err?.response?.data || null,
    };
  }

  throw err;
}

function pickArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.blocks)) return data.blocks;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function uuid() {
  // browser support fallback
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

/**
 * Generic helpers for settlement vs audit admin routes
 */
async function adminGet(path) {
  const { data } = await apiClient.core.get(`${path}${path.includes("?") ? "&" : "?"}_t=${Date.now()}`);
  return data;
}

async function adminPost(path, body) {
  const key = uuid();
  const { data } = await apiClient.core.post(
    path,
    body ?? { idempotencyKey: key },
    { headers: { "Idempotency-Key": key } }
  );
  return data;
}

const settlementBase = "/api/ledger/admin";
const auditBase = "/api/ledger/admin/audit";

async function getBlocksFor(base, limit = 20, offset = 0) {
  const data = await adminGet(`${base}/blocks?limit=${limit}&offset=${offset}`);
  return { blocks: pickArray(data), raw: data };
}

async function getBlockDetailFor(base, height) {
  const data = await adminGet(`${base}/blocks/${height}`);
  if (data?.block) {
    return {
      block: data.block,
      items: data.items || data.block.items || data.block.data || [],
    };
  }
  return { block: data, items: data?.items || data?.data || [] };
}

async function verifyFor(base) {
  try {
    const data = await adminGet(`${base}/verify`);
    const isValid =
      data?.isValid === true ||
      data?.valid === true ||
      (data?.ok && (data?.verified > 0 || data?.isValid === true));
    return { isValid: !!isValid, details: data };
  } catch (e) {
    return { isValid: false, details: e?.response?.data || null };
  }
}

async function locksFor(base) {
  try {
    const data = await adminGet(`${base}/locks`);
    return data || { locked: false, locks: [] };
  } catch {
    return { locked: false, locks: [] };
  }
}

async function actionsFor(base, limit = 10) {
  try {
    const data = await adminGet(`${base}/actions?limit=${limit}`);
    const items = Array.isArray(data?.items) ? data.items : pickArray(data);
    return { items, raw: data };
  } catch {
    return { items: [], raw: null };
  }
}

export const ledgerApi = {
  /**
   * ----------------------------
   * Settlement Ledger (existing)
   * ----------------------------
   */
  getBlocks: (limit = 20, offset = 0) => getBlocksFor(settlementBase, limit, offset),
  getBlockDetail: (height) => getBlockDetailFor(settlementBase, height),
  verifyChain: () => verifyFor(settlementBase),
  getLocks: () => locksFor(settlementBase),
  getActions: (limit = 10) => actionsFor(settlementBase, limit),

  // Keep BOTH names for compatibility, but only one implementation
  commit: () => adminPost(`${settlementBase}/commit`),
  forceCommit: () => adminPost(`${settlementBase}/commit`),

  // unlock endpoint is settlementBase/unlock
  forceUnlock: async () => (await apiClient.core.post(`${settlementBase}/unlock`, { all: true })).data,

  /**
   * ----------------------------
   * Audit Ledger (NEW)
   * ----------------------------
   */
  getAuditBlocks: (limit = 20, offset = 0) => getBlocksFor(auditBase, limit, offset),
  getAuditBlockDetail: (height) => getBlockDetailFor(auditBase, height),
  verifyAuditChain: () => verifyFor(auditBase),
  getAuditLocks: () => locksFor(auditBase),
  getAuditActions: (limit = 10) => actionsFor(auditBase, limit),

  auditCommit: () => adminPost(`${auditBase}/commit`),
  auditUnlock: async () => (await apiClient.core.post(`${auditBase}/unlock`, { all: true })).data,

  /**
   * ----------------------------
   * Receipts (routes to correct chain)
   * ----------------------------
   */
  getWalletReceipt: async (txId) => {
    const id = Number(txId);
    try {
      return (await apiClient.core.get(`/api/ledger/receipt/wallet/${id}`)).data;
    } catch (err) {
      return asPending(err, "wallet");
    }
  },

  getTradeReceipt: async (tradeId) => {
    const id = Number(tradeId);
    try {
      return (await apiClient.core.get(`/api/ledger/receipt/trade/${id}`)).data;
    } catch (err) {
      return asPending(err, "trade");
    }
  },

  getSecurityReceipt: async (logId) => {
    const id = Number(logId);
    try {
      return (await apiClient.core.get(`/api/ledger/receipt/security/${id}`)).data;
    } catch (err) {
      return asPending(err, "security");
    }
  },

  /**
   * Wallet (unchanged)
   */
  getTransactions(limit = 200) {
    return apiClient.core.get(`/api/wallet/transactions?limit=${limit}`).then((r) => r.data);
  },
};
