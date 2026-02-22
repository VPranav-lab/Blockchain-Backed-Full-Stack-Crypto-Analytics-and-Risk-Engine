// src/utils/authStorage.js
export const STORAGE_KEYS = {
  ACCESS: "accessToken",
  REFRESH: "refreshToken",
  DEVICE_ID: "deviceId",
};

export const clearAuthTokens = () => {
  localStorage.removeItem(STORAGE_KEYS.ACCESS);
  localStorage.removeItem(STORAGE_KEYS.REFRESH);
  // IMPORTANT: do NOT remove DEVICE_ID
};
