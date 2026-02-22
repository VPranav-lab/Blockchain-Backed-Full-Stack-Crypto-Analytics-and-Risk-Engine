import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/authApi"; 
import { clearAuthTokens } from "../utils/authStorage";


const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("accessToken"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Initial Load: Check if token is valid & get User
  useEffect(() => {
    const initAuth = async () => {
      try {
        const access = localStorage.getItem("accessToken");
        if (!access) {
          setLoading(false);
          return;
        }

        const response = await authApi.getMe(); // will refresh if needed

        // ✅ IMPORTANT: token might have been refreshed
        const latestAccess = localStorage.getItem("accessToken");

        setUser(response.user);
        setToken(latestAccess);
      } catch (err) {
        setToken(null);
        setUser(null);
        clearAuthTokens();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);



  // 2. Login Function (Improved Debugging)
  // 2. Login Function (Updated to return User)
  const login = async (accessToken, refreshToken) => {
    if (!refreshToken) {
        console.warn("⚠️ WARNING: No Refresh Token provided during login!");
    }

    localStorage.setItem("accessToken", accessToken);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    
    setToken(accessToken);
    
    // Fetch Profile Immediately AND Return it
    try {
      const response = await authApi.getMe();
      const userData = response.user; // Extract user
      setUser(userData);              // Update State
      return userData;                // 👈 RETURN USER HERE
    } catch (e) {
      console.error("Login profile fetch failed", e);
      return null;
    }
  };

  // 3. Logout Function
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.warn("Logout API failed, clearing local state anyway");
      clearAuthTokens();
    }
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };
  



  const isAuthenticated = !!token && !!user && !loading;

  const value = useMemo(
    () => ({ token, isAuthenticated, user, login, logout, loading }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);