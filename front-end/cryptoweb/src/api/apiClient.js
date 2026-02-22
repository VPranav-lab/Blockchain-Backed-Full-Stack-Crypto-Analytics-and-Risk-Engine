// src/api/apiClient.js
import axios from "axios";
import { clearAuthTokens } from "../utils/authStorage";

// --- 1) CONFIG ---
const CORE_BASE_URL =
  import.meta.env.VITE_API_A_BASE_URL || "http://localhost:5000";
const TRADE_BASE_URL =
  import.meta.env.VITE_API_C_BASE_URL || "http://localhost:4000";

const STORAGE_KEYS = {
  ACCESS: "accessToken",
  REFRESH: "refreshToken",
  DEVICE_ID: "deviceId",
};

// --- 2) HELPERS ---
const getDeviceId = () => {
  let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
  }
  return id;
};

const getAccessToken = () => localStorage.getItem(STORAGE_KEYS.ACCESS);
const getRefreshToken = () => localStorage.getItem(STORAGE_KEYS.REFRESH);

const forceLogout = () => {
  console.warn("⛔ Session expired. Forcing logout.");
  clearAuthTokens();
  window.location.href = "/login";
};

// --- 3) AXIOS INSTANCES ---
const coreClient = axios.create({ baseURL: CORE_BASE_URL });
const tradeClient = axios.create({ baseURL: TRADE_BASE_URL });

// Tag requests so we know which client to retry with
const tagClient = (clientName) => (config) => {
  config.__clientName = clientName; // custom marker
  return config;
};

coreClient.interceptors.request.use(tagClient("core"));
tradeClient.interceptors.request.use(tagClient("trade"));

// Attach auth + device headers
const attachAuth = (config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["x-device-id"] = getDeviceId();
  return config;
};

coreClient.interceptors.request.use(attachAuth);
tradeClient.interceptors.request.use(attachAuth);

const retryWithSameClient = (req) => {
  const name = req.__clientName;
  if (name === "trade") return tradeClient(req);
  return coreClient(req);
};

// --- 4) REFRESH LOGIC (401) ---
let isRefreshing = false;
// queue holds { resolve, reject, originalRequest }
let failedQueue = [];

const processQueueSuccess = (newAccess) => {
  failedQueue.forEach(({ resolve, originalRequest }) => {
    try {
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      resolve(retryWithSameClient(originalRequest));
    } catch (e) {
      resolve(Promise.reject(e));
    }
  });
  failedQueue = [];
};

const processQueueFailure = (err) => {
  failedQueue.forEach(({ reject }) => reject(err));
  failedQueue = [];
};

async function refreshTokens() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("No refresh token available");

  // IMPORTANT: Use a plain axios call (no interceptors) to avoid loops
  const { data } = await axios.post(`${CORE_BASE_URL}/api/auth/refresh`, {
    refresh,
  });

  const tokens = data?.tokens;
  const newAccess = tokens?.access;
  const newRefresh = tokens?.refresh;

  if (!newAccess || !newRefresh) {
    throw new Error("Refresh response missing tokens");
  }

  localStorage.setItem(STORAGE_KEYS.ACCESS, newAccess);
  localStorage.setItem(STORAGE_KEYS.REFRESH, newRefresh);

  // Update defaults for future requests
  coreClient.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
  tradeClient.defaults.headers.common.Authorization = `Bearer ${newAccess}`;

  return newAccess;
}

const errorInterceptor = async (error) => {
  const originalRequest = error.config;

  // If no response OR not 401 -> do nothing here
  if (!error.response || error.response.status !== 401) {
    return Promise.reject(error);
  }

  // Prevent infinite loop if refresh endpoint fails
  if (originalRequest?.url?.includes("/api/auth/refresh")) {
    forceLogout();
    return Promise.reject(error);
  }

  // Prevent re-trying same request multiple times
  if (originalRequest._retry) {
    return Promise.reject(error);
  }
  originalRequest._retry = true;

  // If refresh already happening, queue this request
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject, originalRequest });
    });
  }

  isRefreshing = true;

  try {
    console.log("🔄 Access expired (401). Refreshing tokens...");
    const newAccess = await refreshTokens();

    // Retry all queued requests first
    processQueueSuccess(newAccess);

    // Retry the original request
    originalRequest.headers.Authorization = `Bearer ${newAccess}`;
    return retryWithSameClient(originalRequest);
  } catch (err) {
    processQueueFailure(err);
    forceLogout();
    return Promise.reject(err);
  } finally {
    isRefreshing = false;
  }
};

// Apply response interceptors
coreClient.interceptors.response.use((r) => r, errorInterceptor);
tradeClient.interceptors.response.use((r) => r, errorInterceptor);

// --- 5) EXPORT ---
const apiClient = {
  core: coreClient,
  trade: tradeClient,
};

export default apiClient;
