import apiClient from "./apiClient";

export const kycApi = {
  // --- USER ENDPOINTS ---
  submit: async (formData) => {
    const { data } = await apiClient.core.post("/api/kyc/submit", formData);
    return data;
  },

  getStatus: async () => {
    try {
      const { data } = await apiClient.core.get("/api/kyc/status");
      if (data && data.kyc) return data.kyc;
      return data;
    } catch (e) {
      return { status: "NONE" };
    }
  },

  // --- ADMIN ENDPOINTS ---
  listApplications: async (status = "PENDING", limit = 20, offset = 0) => {
    const { data } = await apiClient.core.get("/api/kyc/admin/applications", {
      params: { status, limit, offset },
    });

    // Normalize common shapes so UI doesn't break:
    // possible: { ok, applications }, { ok, rows }, { ok, items }, or array
    const list =
      (data && (data.applications || data.rows || data.items || data.kycApplications)) ||
      (Array.isArray(data) ? data : []);

    return list;
  },

  review: async (userId, decision, notes = "") => {
    const { data } = await apiClient.core.post("/api/kyc/admin/review", {
      userId,
      decision, // "APPROVE" or "REJECT"
      notes,
    });
    return data;
  },
};
