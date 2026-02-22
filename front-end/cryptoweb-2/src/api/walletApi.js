// src/api/walletApi.js
import apiClient from "./apiClient";

/**
 * HYBRID SOURCES:
 * - Balance + Transactions => core (5000)
 * - KYC status            => core (5000)
 * - Bank + Deposit/Withdraw => trade gateway (4000)
 * - Admin adjust          => core (5000)
 */

const capabilities = {
  provider: "hybrid",
  userTransfers: true,
  bankDetails: true,
  adminAdjust: true,
};

const rid = () => crypto.randomUUID();

function asUpper(v, fallback = "") {
  const s = String(v ?? "").trim();
  return s ? s.toUpperCase() : fallback;
}

function normalizeCoreBalance(data) {
  // core: GET /api/wallet/balance => { ok:true, balance, currency, status }
  // core: GET /api/wallet/me      => { ok:true, wallet:{...} }
  const w = data?.wallet ?? data ?? {};
  return {
    balance: w.balance != null ? Number(w.balance) : 0,
    currency: w.currency || "USDT",
    status: asUpper(w.status, "LOCKED"), // LOCKED|ACTIVE (core truth)
  };
}

function normalizeCoreTransactions(data) {
  // core: GET /api/wallet/transactions => { ok:true, items:[...] }
  const items = data?.items ?? data?.transactions ?? data ?? [];
  return Array.isArray(items) ? items : [];
}

/**
 * Your trade gateway controller returns legacy fields:
 *  - 200: { bank_name, account_number, ifsc_code, iban, bic, updated_at }
 *  - 404: { message: "No withdrawal bank account configured" }
 *
 * Also it sometimes returns {} for ifsc_code/iban/bic if missing.
 */
function normalizeGatewayBank(data) {
  if (!data) return null;

  const bankName = String(data.bank_name ?? data.bankName ?? "").trim();
  const accountNumber = String(data.account_number ?? data.accountNumber ?? "").trim();

  // Handle backend bug where it returns {} instead of ""
  const rawIban = data.iban ?? data.ifsc_code ?? data.ifscCode ?? "";
  const rawBic = data.bic ?? "";
  const iban = typeof rawIban === "string" ? rawIban.trim() : "";
  const bic = typeof rawBic === "string" ? rawBic.trim() : "";

  const updatedAt = data.updated_at ?? data.updatedAt ?? null;

  // If required fields missing -> treat as not linked
  if (!bankName || !accountNumber) return null;

  return { bankName, accountNumber, iban, bic, updatedAt };
}

function unsupported(feature) {
  const err = new Error(`Wallet feature not enabled: ${feature}.`);
  err.code = "WALLET_FEATURE_DISABLED";
  return err;
}

export const walletApi = {
  provider: "hybrid",
  capabilities,

  // ---------------- CORE (5000) ----------------

  /**
   * Wallet balance/status from core truth.
   * If backend blocks (403/423), treat as LOCKED.
   */
  getBalance: async () => {
    try {
      const { data } = await apiClient.core.get("/api/wallet/balance");
      return normalizeCoreBalance(data);
    } catch (err) {
      const s = err?.response?.status;
      if (s === 403 || s === 423) {
        return { balance: 0, currency: "USDT", status: "LOCKED" };
      }
      return { balance: 0, currency: "USDT", status: "UNKNOWN" };
    }
  },

  getTransactions: async (limit = 50) => {
    try {
      const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
      const { data } = await apiClient.core.get(
        `/api/wallet/transactions?limit=${encodeURIComponent(safeLimit)}`
      );
      return normalizeCoreTransactions(data);
    } catch {
      return [];
    }
  },

  /**
   * KYC status from core.
   * Returns: { level, status, submittedAt, updatedAt, ... }
   */
  getKycStatus: async () => {
    try {
      const { data } = await apiClient.core.get("/api/kyc/status");
      const kyc = data?.kyc ?? data ?? {};
      return {
        ...kyc,
        status: asUpper(kyc.status, "NOT_SUBMITTED"),
      };
    } catch {
      return { status: "NOT_SUBMITTED" };
    }
  },

  /**
   * One-stop helper for UI:
   * - walletStatus: ACTIVE|LOCKED|UNKNOWN (from wallet service)
   * - kycStatus: NOT_SUBMITTED|PENDING|APPROVED|REJECTED (from kyc service)
   *
   * UI Display Rule you asked for:
   * - If KYC is PENDING => show "PENDING" badge (even if wallet is still LOCKED)
   * - If KYC APPROVED and wallet ACTIVE => show ACTIVE
   * - If NOT_SUBMITTED => show LOCKED/NOT_SUBMITTED
   */
  getAccessState: async () => {
    const [w, k] = await Promise.all([walletApi.getBalance(), walletApi.getKycStatus()]);

    const walletStatus = asUpper(w?.status, "LOCKED");
    const kycStatus = asUpper(k?.status, "NOT_SUBMITTED");

    // Display status (what your wallet sidebar badge should show)
    let displayStatus = walletStatus;
    if (kycStatus === "PENDING") displayStatus = "PENDING";
    if (kycStatus === "REJECTED") displayStatus = "LOCKED";
    if (kycStatus === "NOT_SUBMITTED") displayStatus = "LOCKED";

    const isActive = walletStatus === "ACTIVE" && kycStatus === "APPROVED";
    const isPending = kycStatus === "PENDING";
    const isLocked = !isActive;

    return {
      wallet: w,
      kyc: k,
      walletStatus,
      kycStatus,
      displayStatus,
      isActive,
      isPending,
      isLocked,

      // Frontend gating (until you also enforce it in backend)
      canTransfer: isActive,        // only when fully approved+active
      canLinkBank: isActive,        // you said: if locked -> cannot link bank
    };
  },

  // ---------------- TRADE GATEWAY (4000) ----------------

  getBank: async () => {
    try {
      const { data } = await apiClient.trade.get("/api/wallet/bank");
      return normalizeGatewayBank(data);
    } catch (err) {
      const s = err?.response?.status;
      if (s === 404) return null; // not linked
      // If gateway forbids (locked) you can treat it as "not accessible"
      if (s === 403 || s === 423) return null;
      throw err;
    }
  },

  saveBank: async ({ bankName, accountNumber, iban, bic, ifscCode }) => {
    const payload = {
      bankName: String(bankName || "").trim(),
      accountNumber: String(accountNumber || "").trim(),
      ...(iban ? { iban: String(iban).trim() } : {}),
      ...(bic ? { bic: String(bic).trim() } : {}),
      ...(ifscCode ? { ifscCode: String(ifscCode).trim() } : {}),
    };

    const { data } = await apiClient.trade.post("/api/wallet/bank", payload);

    // Your gateway returns: { message: "...", bank: data.bank } OR legacy fields
    const bankObj = data?.bank
      ? {
          bank_name: data.bank.bank_name ?? data.bank.bankName,
          account_number: data.bank.account_number ?? data.bank.accountNumber,
          iban: data.bank.iban,
          bic: data.bank.bic,
          ifsc_code: data.bank.ifsc_code ?? data.bank.ifscCode,
          updated_at: data.bank.updated_at ?? data.bank.updatedAt,
        }
      : data;

    return normalizeGatewayBank(bankObj);
  },

  deposit: async ({ amount, source = "Bank (IBAN)" }) => {
    if (!capabilities.userTransfers) throw unsupported("deposit");
    const requestId = rid();
    const { data } = await apiClient.trade.post(
      "/api/wallet/deposit",
      { amount: Number(amount), source, referenceId: requestId },
      { headers: { "x-request-id": requestId } }
    );
    return data;
  },

  withdraw: async ({ amount }) => {
    if (!capabilities.userTransfers) throw unsupported("withdraw");
    const requestId = rid();
    const { data } = await apiClient.trade.post(
      "/api/wallet/withdraw",
      { amount: Number(amount), referenceId: requestId },
      { headers: { "x-request-id": requestId } }
    );
    return data;
  },

  // ---------------- CORE (5000) admin adjust (UNCHANGED) ----------------

  adminAdjust: async ({ userId, type, amount, description }) => {
    const idempotencyKey = crypto.randomUUID();
    const { data } = await apiClient.core.post(
      "/api/wallet/admin/adjust",
      { userId, type, amount, description, idempotencyKey, referenceId: idempotencyKey },
      { headers: { "Idempotency-Key": idempotencyKey, "x-request-id": idempotencyKey } }
    );
    return data;
  },
};
