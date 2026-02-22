import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <div className="p-10 text-white">Loading permissions...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ✅ Check REAL backend role
  // Contract says roles are 'user' or 'admin' (lowercase)
  if (user?.role !== "admin") { 
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}