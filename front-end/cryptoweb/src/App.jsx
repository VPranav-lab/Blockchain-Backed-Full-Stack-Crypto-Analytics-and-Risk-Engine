import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import KycRoute from "./components/KycRoute"; 
import AdminRoute from "./components/AdminRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Layout from "./components/Layout/Layout";
import AppLayout from "./components/Layout/AppLayout";

// Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import MarketPage from "./pages/market/MarketPage";
import Wallet from "./pages/Wallet";
import News from "./pages/News";
import Portfolio from "./pages/portfolio/Portfolio"; 
import Watchlist from "./pages/watchlist/Watchlist"; 
import Trades from "./pages/Trades";
import Insights from "./pages/Insights";
import Risk from "./pages/Risk"; 
import Kyc from "./pages/Kyc";
import StrategyPage from "./pages/strategy/StrategyPage";

export default function App() {
  return (
    <Routes>
      {/* ---------------------------------------------------------------
          AUTH ROUTES (Standalone - No Sidebar)
          These typically have their own layout (AuthShell)
      --------------------------------------------------------------- */}
      <Route element={<Layout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* ---------------------------------------------------------------
          MAIN APP LAYOUT (Navbar + Sidebar visible everywhere)
          This restores the UI consistency you wanted.
      --------------------------------------------------------------- */}
      <Route element={<AppLayout />}>
        
        {/* === TIER 1: PUBLIC PAGES === 
            Visible to everyone (Guest or User). 
            They sit inside the AppLayout so they look "Pro". */}
        <Route path="/" element={<Home />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/news" element={<News />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* === TIER 2: LOGGED IN USERS ONLY === 
            Must have a token. If not, redirects to Login. */}
        <Route element={<ProtectedRoute />}>
          
          <Route path="/kyc" element={<Kyc />} />
          <Route path="/wallet" element={<Wallet />} />
          
          {/* ❌ REMOVED WATCHLIST FROM HERE - This was causing the crash */}

          {/* === TIER 3: STRICT KYC APPROVED ONLY === 
              If Wallet is LOCKED, these redirect to /wallet or show the Lock Screen.
              Moving Watchlist here prevents the API call for Pending users. */}
          <Route element={<KycRoute />}>
            {/* ✅ MOVED WATCHLIST HERE */}
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/risk" element={<Risk />} />
            
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/strategies" element={<StrategyPage />} />
          </Route>
        </Route>

        {/* === TIER 4: SUPER ADMIN === */}
        <Route element={<AdminRoute />}>
           <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}