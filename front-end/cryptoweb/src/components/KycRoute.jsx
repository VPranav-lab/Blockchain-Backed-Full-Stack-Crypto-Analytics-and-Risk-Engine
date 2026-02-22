import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import apiClient from "../api/apiClient";

// --- ASSETS: Professional Icons ---
const LockIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ecb81" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// --- COMPONENT: The "Glass" Lock Screen ---
const LockedScreen = ({ status }) => {
  const isPending = status === "PENDING";
  const location = useLocation();
  const pageName = location.pathname.replace("/", "").toUpperCase();

  const statusColor = isPending ? "#3b82f6" : "#F6465D"; 
  const statusBg = isPending ? "rgba(59, 130, 246, 0.15)" : "rgba(246, 70, 93, 0.15)";
  const statusBorder = isPending ? "rgba(59, 130, 246, 0.3)" : "rgba(246, 70, 93, 0.3)";

  return (
    <div style={styles.pageOverlay}>
      <div style={styles.glowOrbTop}></div>
      <div style={styles.glowOrbBottom}></div>

      <div style={styles.glassCard}>
        <div style={styles.iconWrapper}>
          <div style={{ color: statusColor }}>
            <LockIcon />
          </div>
        </div>
        
        <h1 style={styles.title}>
          {isPending ? "Verification in Progress" : "Unlock Professional Trading"}
        </h1>
        
        <p style={styles.subtitle}>
          Access to <b>{pageName}</b> is restricted. <br/>
          {isPending 
            ? "Your documents are currently under review. This usually takes less than 24 hours."
            : "To comply with financial regulations, we need to verify your identity."}
        </p>

        <div style={styles.statusRow}>
          <span style={styles.statusLabel}>CURRENT STATUS:</span>
          <span style={{
            ...styles.badge,
            backgroundColor: statusBg,
            color: statusColor,
            borderColor: statusBorder
          }}>
            {status}
          </span>
        </div>

        <div style={styles.benefitsContainer}>
          <div style={styles.benefitsHeader}>WHY VERIFY?</div>
          <div style={styles.benefitItem}><CheckIcon /> <span>Unlimited Crypto Trading</span></div>
          <div style={styles.benefitItem}><CheckIcon /> <span>Fiat Withdrawals to Bank</span></div>
          <div style={styles.benefitItem}><CheckIcon /> <span>High-Frequency API Access</span></div>
          <div style={styles.benefitItem}><CheckIcon /> <span>Insurance Protection</span></div>
        </div>

        <div style={styles.actionGroup}>
          <Link to="/kyc" style={styles.primaryBtn}>
            {isPending ? "Check Application Status" : "Complete Verification Now"}
          </Link>
          <Link to="/dashboard" style={styles.secondaryBtn}>
            Return to Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
};

// --- LOGIC COMPONENT (REFACTORED FOR ADMIN BYPASS) ---
export default function KycRoute() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // ✅ STEP 1: CHECK USER ROLE (Admin Bypass)
        // We fetch the profile first. If role is 'admin', we skip the KYC check entirely.
        let isAdmin = false;
        try {
          const { data: authData } = await apiClient.core.get("/api/auth/me");
          if (authData?.user?.role === 'admin') {
            isAdmin = true;
          }
        } catch (e) {
          console.warn("Role check failed, falling back to KYC check");
        }

        if (isAdmin) {
          // 🎉 ADMIN DETECTED: Grant Instant Access
          setStatus("APPROVED");
          setLoading(false);
          return; 
        }

        // ✅ STEP 2: NORMAL USER (Check KYC Status)
        // Only runs if user is NOT an admin
        const { data } = await apiClient.core.get("/api/kyc/status");
        
        const rawStatus = 
          data?.kyc?.status || 
          data?.status || 
          "NOT_SUBMITTED";

        setStatus(String(rawStatus).toUpperCase());

      } catch (e) {
        console.error("Access Check Failed", e);
        setStatus("ERROR");
      } finally {
        setLoading(false);
      }
    };
    
    checkAccess();
  }, []);

  if (loading) return (
    <div style={styles.loaderContainer}>
      <div style={styles.spinner}></div>
      <span style={styles.loaderText}>VERIFYING ACCESS PERMISSIONS...</span>
    </div>
  );

  // If Approved (or Admin), show the protected page
  if (status === "APPROVED") return <Outlet />;

  // Otherwise, show the Lock Screen
  return <LockedScreen status={status} />;
}

// --- CSS-IN-JS STYLES (Your CryptoWeb Green Theme) ---
const styles = {
  pageOverlay: {
    position: "relative",
    minHeight: "calc(100vh - 64px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0b0e11",
    overflow: "hidden",
    padding: "20px"
  },
  glowOrbTop: {
    position: "absolute", top: "-10%", left: "20%", width: "500px", height: "500px",
    background: "radial-gradient(circle, rgba(14, 203, 129, 0.15) 0%, rgba(0,0,0,0) 70%)", 
    filter: "blur(80px)", zIndex: 0
  },
  glowOrbBottom: {
    position: "absolute", bottom: "-10%", right: "20%", width: "600px", height: "600px",
    background: "radial-gradient(circle, rgba(59, 130, 246, 0.10) 0%, rgba(0,0,0,0) 70%)", 
    filter: "blur(80px)", zIndex: 0
  },
  glassCard: {
    position: "relative", zIndex: 1,
    background: "rgba(30, 35, 41, 0.6)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "24px",
    padding: "48px",
    maxWidth: "480px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
  },
  iconWrapper: {
    marginBottom: "24px",
    filter: "drop-shadow(0 0 20px rgba(0,0,0,0.6))"
  },
  title: {
    color: "#EAECEF", fontSize: "26px", fontWeight: "700", margin: "0 0 12px 0",
    letterSpacing: "-0.5px"
  },
  subtitle: {
    color: "#848E9C", fontSize: "15px", lineHeight: "1.6", margin: "0 0 32px 0"
  },
  statusRow: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
    marginBottom: "40px", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px"
  },
  statusLabel: {
    color: "#848e9c", fontSize: "11px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase"
  },
  badge: {
    padding: "6px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: "800",
    letterSpacing: "0.5px", border: "1px solid transparent"
  },
  benefitsContainer: {
    textAlign: "left", marginBottom: "40px", 
    borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "24px"
  },
  benefitsHeader: {
    color: "#5E6673", fontSize: "11px", fontWeight: "700", textTransform: "uppercase",
    marginBottom: "16px", letterSpacing: "1px"
  },
  benefitItem: {
    display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px",
    color: "#EAECEF", fontSize: "14px", fontWeight: "500"
  },
  actionGroup: { display: "flex", flexDirection: "column", gap: "16px" },
  primaryBtn: {
    display: "block", width: "100%", padding: "16px", borderRadius: "8px",
    background: "linear-gradient(90deg, #0ECB81 0%, #0ABA75 100%)", 
    color: "#fff", fontWeight: "700", fontSize: "15px", textDecoration: "none",
    boxShadow: "0 4px 15px rgba(14, 203, 129, 0.25)",
    transition: "transform 0.2s, box-shadow 0.2s",
    textAlign: "center",
    cursor: "pointer"
  },
  secondaryBtn: {
    display: "block", width: "100%", padding: "16px", borderRadius: "8px",
    background: "transparent", border: "1px solid #474D57",
    color: "#EAECEF", fontWeight: "600", fontSize: "15px", textDecoration: "none",
    textAlign: "center",
    cursor: "pointer"
  },
  loaderContainer: {
    height: "80vh", display: "flex", flexDirection: "column", 
    alignItems: "center", justifyContent: "center", background: "#0b0e11"
  },
  spinner: {
    width: "40px", height: "40px", border: "3px solid #1e2329",
    borderTopColor: "#0ECB81", borderRadius: "50%", animation: "spin 1s linear infinite",
    marginBottom: "20px"
  },
  loaderText: { color: "#848E9C", fontSize: "12px", fontWeight: "700", letterSpacing: "1.5px" }
};