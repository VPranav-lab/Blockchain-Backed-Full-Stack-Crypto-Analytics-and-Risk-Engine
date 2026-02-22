// core_files/services/personA.gateway.js
const axios = require("axios");

function baseUrl() {
  const u = String(process.env.PERSON_A_BASE_URL || "").trim();
  if (!u) throw new Error("PERSON_A_BASE_URL not set");
  return u.replace(/\/+$/, "");
}

function internalKey() {
  const k = String(process.env.INTERNAL_EXECUTOR_KEY || "").trim();
  if (!k) throw new Error("INTERNAL_EXECUTOR_KEY not set");
  return k;
}

const http = axios.create({ timeout: 15000 });

function bearer(token) {
  const t = String(token || "").trim();
  return t.startsWith("Bearer ") ? t : `Bearer ${t}`;
}

/**
 * Trades (existing)
 */
async function executeUserTrade({ token, symbol, side, qty, referenceId, expectedPrice, maxSlippageBps, fee }) {
  const { data } = await http.post(
    `${baseUrl()}/api/trade/execute`,
    { symbol, side, qty, referenceId, expectedPrice, maxSlippageBps, fee },
    { headers: { Authorization: bearer(token) } }
  );
  return data;
}

async function executeInternalTrade({ userId, symbol, side, qty, referenceId, expectedPrice, maxSlippageBps, fee }) {
  const { data } = await http.post(
    `${baseUrl()}/api/internal/trade/execute`,
    { userId, symbol, side, qty, referenceId, expectedPrice, maxSlippageBps, fee },
    { headers: { "x-internal-key": internalKey() } }
  );
  return data;
}

async function getFillByReferenceInternal({ userId, referenceId }) {
  const { data } = await http.get(`${baseUrl()}/api/internal/trade/fills/by-reference/${referenceId}`, {
    headers: { "x-internal-key": internalKey() },
    params: { userId },
  });
  return data;
}

async function listFillsInternal({ userId, limit = 200, cursorId = null }) {
  const params = { userId, limit };
  if (cursorId != null) params.cursorId = cursorId;

  const { data } = await http.get(`${baseUrl()}/api/internal/trade/fills`, {
    headers: { "x-internal-key": internalKey() },
    params,
  });
  return data;
}

/**
 * Wallet (NEW): proxy to Person A to keep wallet authority + idempotency + ledger pointers centralized.
 */
async function walletBalance({ token }) {
  const { data } = await http.get(`${baseUrl()}/api/wallet/balance`, {
    headers: { Authorization: bearer(token) },
  });
  return data;
}

async function walletTransactions({ token, limit = 200 }) {
  const { data } = await http.get(`${baseUrl()}/api/wallet/transactions`, {
    headers: { Authorization: bearer(token) },
    params: { limit },
  });
  return data;
}

async function walletDeposit({ token, amount, source, referenceId }) {
  const { data } = await http.post(
    `${baseUrl()}/api/wallet/deposit`,
    { amount, source, referenceId },
    { headers: { Authorization: bearer(token) } }
  );
  return data;
}

async function walletWithdraw({ token, amount, referenceId }) {
  const { data } = await http.post(
    `${baseUrl()}/api/wallet/withdraw`,
    { amount, referenceId },
    { headers: { Authorization: bearer(token) } }
  );
  return data;
}

async function walletGetBank({ token }) {
  const { data } = await http.get(`${baseUrl()}/api/wallet/bank`, {
    headers: { Authorization: bearer(token) },
  });
  return data;
}

async function walletSaveBank({ token, bankName, accountNumber, iban, bic, ifscCode }) {
  const { data } = await http.post(
    `${baseUrl()}/api/wallet/bank`,
    { bankName, accountNumber, iban, bic, ifscCode },
    { headers: { Authorization: bearer(token) } }
  );
  return data;
}

module.exports = {
  executeUserTrade,
  executeInternalTrade,
  getFillByReferenceInternal,
  listFillsInternal,

  walletBalance,
  walletTransactions,
  walletDeposit,
  walletWithdraw,
  walletGetBank,
  walletSaveBank,
};
