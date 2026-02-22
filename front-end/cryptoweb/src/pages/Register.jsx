import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ✅ USE UNIFIED API MODULE
import { authApi } from "../api/authApi"; 

import AuthShell from "../components/auth/AuthShell.jsx";
import TextField from "../components/common/TextField.jsx";
import Button from "../components/common/Button.jsx";
import Alert from "../components/common/Alert.jsx";

import ui from "./auth/AuthForms.module.css";
import {
  normalizeEmail,
  validateEmail,
  validatePhoneE164,
  validatePasswordStrong,
} from "../utils/authValidation.js";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const location = useLocation();
  const next = new URLSearchParams(location.search).get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);

  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  // --- Validation Logic ---
  const emailError = useMemo(() => (!touched.email ? "" : validateEmail(email)), [email, touched.email]);
  const phoneError = useMemo(() => (!touched.phone ? "" : validatePhoneE164(phone)), [phone, touched.phone]);
  const passwordError = useMemo(
    () => (!touched.password ? "" : validatePasswordStrong(password)),
    [password, touched.password]
  );
  const confirmError = useMemo(() => {
    if (!touched.confirm) return "";
    if (!confirm) return "Please confirm your password.";
    return confirm === password ? "" : "Passwords do not match.";
  }, [confirm, password, touched.confirm]);

  const agreeError = useMemo(() => (!touched.agree ? "" : agree ? "" : "Please accept the terms."), [agree, touched.agree]);

  const canSubmit =
    !loading &&
    !emailError &&
    !phoneError &&
    !passwordError &&
    !confirmError &&
    !agreeError &&
    normalizeEmail(email) &&
    phone.trim() &&
    password &&
    confirm &&
    agree;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    
    if (!canSubmit) return;

    setLoading(true);
    try {
      // ---------------------------------------------------------
      // 🟢 INTEGRATION: Register + Auto-Login Flow
      // ---------------------------------------------------------
      
      const cleanEmail = normalizeEmail(email);
      const cleanPhone = phone.trim();

      // 1. Register User
      // Contract: POST /api/auth/register 
      // Body: { email, password, phone }
      await authApi.register({
        email: cleanEmail,
        phone: cleanPhone,
        password: password,
      });

      // 2. Auto-Login to get Tokens immediately
      // The register endpoint returns the user object, but usually NOT the token.
      // We must call login to establish the session.
      const loginRes = await authApi.login({
        email: cleanEmail,
        password: password,
      });

      // 3. Extract Tokens
      const { access, refresh } = loginRes.tokens;
      
      if (!access) throw new Error("Registration successful, but auto-login failed.");

      // 4. Store in Context/LocalStorage
      login(access, refresh);

      // 5. Navigate to KYC (The Contract says Wallet is LOCKED until KYC is done)
      // We send them straight to verification.
      navigate("/kyc", { replace: true });

    } catch (ex) {
      console.error("Registration Error:", ex);
      // Handle backend errors (e.g., "Email already exists")
      setErr(ex.response?.data?.error || ex.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create account" subtitle="Create your account in under a minute.">
      {err ? <Alert>{err}</Alert> : null}
      
      <div className={ui.topMeta}>
        <div className={ui.metaRow}>
          <span className={ui.badge}>Create account</span>
          <span className={ui.badgeSoft}>Secure</span>
          <span className={ui.metaNote}>Next: verify identity (KYC)</span>
        </div>
        <div className={ui.stepperMini}>
          <div className={`${ui.stepDot} ${ui.stepDotActive}`}>1</div>
          <div className={ui.stepLineMini} />
          <div className={`${ui.stepDot} ${ui.stepDotNext}`}>2</div>
          <div className={ui.stepTextMini}>
            <div className={ui.stepTitleMini}>Step 1 of 2</div>
            <div className={ui.stepSubMini}>Account</div>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className={ui.form} noValidate>
        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={emailError}
          autoComplete="email"
        />

        <TextField
          label="Phone"
          type="tel"
          placeholder="+1234567890"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          error={phoneError}
          hint="Use E.164 format (e.g., +1...)"
          autoComplete="tel"
        />

        <TextField
          label="Password"
          type={show1 ? "text" : "password"}
          placeholder="Min 12 chars"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={passwordError}
          right={
            <button
              type="button"
              className={ui.linkBtn}
              onClick={() => setShow1((s) => !s)}
              aria-label={show1 ? "Hide password" : "Show password"}
            >
              {show1 ? "Hide" : "Show"}
            </button>
          }
          autoComplete="new-password"
        />

        <TextField
          label="Confirm password"
          type={show2 ? "text" : "password"}
          placeholder="Repeat password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          error={confirmError}
          right={
            <button
              type="button"
              className={ui.linkBtn}
              onClick={() => setShow2((s) => !s)}
              aria-label={show2 ? "Hide password" : "Show password"}
            >
              {show2 ? "Hide" : "Show"}
            </button>
          }
          autoComplete="new-password"
        />

        <div className={`${ui.rowBetween} ${ui.leftRow}`}>
          <label className={ui.check}>
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              onBlur={() => setTouched((t) => ({ ...t, agree: true }))}
            />
            I agree to the <a className={ui.link} href="#terms" onClick={(e) => e.preventDefault()}>Terms</a> and{" "}
            <a className={ui.link} href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
          </label>
        </div>
        {agreeError ? <div className={ui.errorInline}>{agreeError}</div> : null}

        <Button type="submit" disabled={!canSubmit}>
          {loading ? "Creating Account..." : "Create Account"}
        </Button>

        <div className={ui.footer}>
          Already have an account?{" "}
          <Link className={ui.link} to={`/login?next=${encodeURIComponent(next)}`}>
            Sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}