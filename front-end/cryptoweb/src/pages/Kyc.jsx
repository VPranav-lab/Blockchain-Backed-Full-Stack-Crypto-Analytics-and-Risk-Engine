import { useState } from "react";
import { useNavigate } from "react-router-dom";

// ✅ USE UNIFIED API MODULE
import { kycApi } from "../api/kycApi";
import { FEATURES } from "../config/features";

import AuthShell from "../components/auth/AuthShell.jsx";
import TextField from "../components/common/TextField.jsx";
import Button from "../components/common/Button.jsx";
import Alert from "../components/common/Alert.jsx";

import ui from "./auth/AuthForms.module.css";

export default function Kyc() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD
  const [country, setCountry] = useState(""); // ISO2 preferred
  const [docNumber, setDocNumber] = useState("");

  // ✅ hard-coded (backend expects PASSPORT)
  const docType = "PASSPORT";

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  const fieldErr = (key, msg) => (touched[key] ? msg : "");

  const nameError = fieldErr(
    "fullName",
    fullName.trim() ? "" : "Full name is required."
  );
  const dobError = fieldErr(
    "dob",
    /^\d{4}-\d{2}-\d{2}$/.test(dob) ? "" : "Use YYYY-MM-DD."
  );
  const countryError = fieldErr(
    "country",
    country.trim().length >= 2 ? "" : "Country is required."
  );
  const docNumError = fieldErr(
    "docNumber",
    docNumber.trim() ? "" : "Document number is required."
  );

  const canSubmit =
    !loading &&
    !nameError &&
    !dobError &&
    !countryError &&
    !docNumError &&
    fullName.trim() &&
    /^\d{4}-\d{2}-\d{2}$/.test(dob) &&
    country.trim() &&
    docNumber.trim();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    setTouched({
      fullName: true,
      dob: true,
      country: true,
      docNumber: true,
    });

    if (!canSubmit) return;

    setLoading(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        dob,
        country: country.trim().toUpperCase().slice(0, 2),
        docType, // ✅ PASSPORT
        docNumber: docNumber.trim(),
      };

      // Contract: POST /api/kyc/submit
      await kycApi.submit(payload);

      // Redirect
      navigate(FEATURES.WALLET ? "/" : "/dashboard", { replace: true });
    } catch (ex) {
      console.error("KYC Error:", ex);
      setErr(
        ex.response?.data?.message ||
          ex.response?.data?.error ||
          "KYC submission failed."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Identity verification"
      subtitle="Enter your details to verify your account."
    >
      <div className={ui.stepper}>
        <div className={`${ui.step} ${ui.stepDone}`}>1</div>
        <div className={ui.stepLine} />
        <div className={`${ui.step} ${ui.stepActive}`}>2</div>
        <div className={ui.stepText}>
          <div className={ui.stepTitle}>Step 2 of 2</div>
          <div className={ui.stepSub}>Verification</div>
        </div>
      </div>

      {err ? <Alert>{err}</Alert> : null}

      <form onSubmit={onSubmit} className={ui.form} noValidate>
        <TextField
          label="Full name"
          placeholder="As on your document"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
          error={nameError}
        />

        <TextField
          label="Date of birth"
          placeholder="YYYY-MM-DD"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, dob: true }))}
          error={dobError}
          inputMode="numeric"
          hint="Format: YYYY-MM-DD"
        />

        <TextField
          label="Country"
          placeholder="US"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, country: true }))}
          error={countryError}
          maxLength={2}
          hint="Use 2-letter ISO code (e.g. US, UK, IN)"
        />

        {/* ✅ Show Passport but not selectable */}
        <TextField label="Document type" value="Passport" disabled />

        <TextField
          label="Document number"
          placeholder="Enter exactly as on document"
          value={docNumber}
          onChange={(e) => setDocNumber(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, docNumber: true }))}
          error={docNumError}
        />

        <Button type="submit" disabled={!canSubmit}>
          {loading ? "Submitting..." : "Submit Verification"}
        </Button>

        <br />
        <br />

        <div className={ui.footer}>We will review your details shortly.</div>
      </form>
    </AuthShell>
  );
}
