import apiClient from "./apiClient";
import { clearAuthTokens } from "../utils/authStorage";


export const authApi = {
  // Login
  login: async (credentials) => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    const { data } = await apiClient.core.post("/api/auth/login", credentials);
    return data;
  },

  // Register
  register: async (userData) => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    const { data } = await apiClient.core.post("/api/auth/register", userData);
    return data;
  },

  // Get Profile
  getMe: async () => {
    const { data } = await apiClient.core.get("/api/auth/me");
    return data;
  },

  // ✅ SECURE LOGOUT (Source 30)
  // Must send refresh token so backend can blacklist it
  // ✅ SECURE LOGOUT (Source 30)

  logout: async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      await apiClient.core.post("/api/auth/logout", { refresh: refreshToken });
    }
    // Only clear tokens, do not redirect here
    clearAuthTokens();
  }

};