import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ✅ USE THE UNIFIED API MODULE (Cleaner & Safer)
import { authApi } from "../api/authApi"; 

import AuthShell from "../components/auth/AuthShell.jsx";
import TextField from "../components/common/TextField.jsx";
import Button from "../components/common/Button.jsx";
import Alert from "../components/common/Alert.jsx";

import ui from "./auth/AuthForms.module.css";
import { validateEmail } from "../utils/authValidation.js";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine where to go after login
  const nextPath = new URLSearchParams(location.search).get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Validate email on the fly
  const emailError = useMemo(() => {
    if (!email) return "";
    return validateEmail(email);
  }, [email]);

  const canSubmit = !!email && !!password && !emailError && !loading;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!canSubmit) return;
  
    setLoading(true);
    try {
      // 1. Send Credentials
      const response = await authApi.login({
        email: email.trim().toLowerCase(), 
        password,
      });

      // 2. Extract Tokens
      const { access, refresh } = response.tokens;
      if (!access) throw new Error("No access token received.");

      // 3. Login & WAIT for the User Profile (This is the Magic Logic)
      const user = await login(access, refresh);

      // 4. Reliable Role Check (Using the data we just waited for)
      if (user?.role === 'admin') {
         console.log("👨‍💼 Admin detected. Redirecting to Admin Console...");
         navigate("/admin", { replace: true });
      } else {
         console.log("👤 User detected. Redirecting to Dashboard...");
         navigate(nextPath, { replace: true });
      }

    } catch (ex) {
      console.error("Login Error:", ex);
      setErr(ex.response?.data?.error || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Log in"
      subtitle="Enter your credentials to continue."
    >
      {/* --- PRESERVED UI SECTION START --- */}
      <div className={ui.topRow}>
        <div className={ui.reward}>
          <div className={ui.rewardTitle}>Complete verification to unlock rewards</div>
          <div className={ui.rewardText}>
            Verify your identity to access restricted features and improve account security.
          </div>
          <div className={ui.miniRow}>
            <span className={ui.chip}>KYC status tracking</span>
            <span className={ui.chip}>New device alerts</span>
            <span className={ui.chip}>Session protection</span>
          </div>
        </div>

        <div className={ui.qrCard}>
          <div className={ui.qrBox}>QR</div>
          <div className={ui.qrText}>
            <div className={ui.qrTitle}>Log in with QR</div>
            <div className={ui.qrSub}>Scan from the mobile app (UI placeholder).</div>
          </div>
        </div>
      </div>
      {/* --- PRESERVED UI SECTION END --- */}

      {err ? <Alert>{err}</Alert> : null}

      <form onSubmit={onSubmit} className={ui.form} style={{ display: "grid", gap: 12 }}>
        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
          autoComplete="email"
        />

        <TextField
          label="Password"
          type={show ? "text" : "password"}
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          right={
            <button
              type="button"
              className={ui.linkBtn}
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? "Hide" : "Show"}
            </button>
          }
          autoComplete="current-password"
        />

        <Button type="submit" disabled={!canSubmit}>
          {loading ? "Logging in..." : "Log in"}
        </Button>

        <div className={ui.footer}>
          New to CryptoWeb?{" "}
          <Link className={ui.link} to={`/register?next=${encodeURIComponent(nextPath)}`}>
            Create account
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}