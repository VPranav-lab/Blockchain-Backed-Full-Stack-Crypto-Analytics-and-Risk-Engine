export const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export const validateEmail = (email) => {
  const v = normalizeEmail(email);
  if (!v) return "Email is required.";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Enter a valid email address.";
};

export const validatePhoneE164 = (phone) => {
  const v = String(phone || "").trim();
  if (!v) return "Phone is required.";
  // E.164: + followed by 8-15 digits
  return /^\+[1-9]\d{7,14}$/.test(v) ? "" : "Use format +1234567890.";
};

export const validatePasswordStrong = (password) => {
  const v = String(password || "");
  if (!v) return "Password is required.";
  
  // 🔴 BACKEND REQUIREMENT: Min 12 Characters (Contract Section 3.1)
  if (v.length < 12) return "Use at least 12 characters.";
  
  // Optional: Keep these for better security, though backend might only enforce length
  if (!/[A-Z]/.test(v)) return "Add at least 1 uppercase letter.";
  if (!/[a-z]/.test(v)) return "Add at least 1 lowercase letter.";
  if (!/\d/.test(v)) return "Add at least 1 number.";
  
  return "";
};