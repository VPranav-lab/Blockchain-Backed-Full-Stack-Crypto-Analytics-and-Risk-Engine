import React, { useEffect, useMemo, useState } from "react";
import { kycApi } from "../../../api/kycApi";
import styles from "../AdminDashboard.module.css";

const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
};

const shortId = (id) => {
  if (!id) return "—";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
};

const shortHash = (h) => {
  if (!h) return "—";
  if (h.length <= 16) return h;
  return `${h.slice(0, 6)}…${h.slice(-6)}`;
};

const statusClass = (s) => {
  const v = String(s || "").toUpperCase();
  if (v === "PENDING") return styles.statusPending;
  if (v === "APPROVED") return styles.statusApproved;
  if (v === "REJECTED") return styles.statusRejected;
  if (v === "NOT_SUBMITTED") return styles.statusNeutral;
  return styles.statusNeutral;
};

const copyToClipboard = async (text) => {
  try { await navigator.clipboard.writeText(text); } catch {}
};

function Drawer({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className={styles.drawerOverlay}>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <div className={styles.drawerPanel}>
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitle}>{title}</div>
          <button className={styles.btnGhost} onClick={onClose} type="button">Close</button>
        </div>
        <div className={styles.drawerBody}>{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ open, title, message, confirmText, variant, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalBackdrop} onClick={onCancel} />
      <div className={styles.modalCard}>
        <div className={styles.modalTitle}>{title}</div>
        <div className={styles.modalMsg}>{message}</div>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onCancel} type="button">Cancel</button>
          <button
            className={variant === "danger" ? styles.btnDanger : styles.btnPrimary}
            onClick={onConfirm}
            type="button"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KycManagement() {
  const [status, setStatus] = useState("PENDING");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, action: null });

  const fetchRows = async () => {
    setLoading(true);
    setErrMsg("");
    try {
      const offset = (page - 1) * pageSize;
      const list = await kycApi.listApplications(status, pageSize, offset);
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setErrMsg(e?.response?.data?.error || e?.message || "Failed to load applications");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); /* eslint-disable-next-line */ }, [status, page]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (r.full_name || "").toLowerCase();
      const uid = (r.user_id || r.userId || "").toLowerCase();
      const country = (r.country || "").toLowerCase();
      const docType = (r.doc_type || "").toLowerCase();
      const hash = (r.doc_number_hash || "").toLowerCase();
      return name.includes(q) || uid.includes(q) || country.includes(q) || docType.includes(q) || hash.includes(q);
    });
  }, [rows, query]);

  const approve = (r) => setConfirm({ open: true, action: { type: "APPROVE", row: r } });
  const reject = (r) => setConfirm({ open: true, action: { type: "REJECT", row: r } });

  const doReview = async () => {
    const action = confirm.action;
    if (!action) return;

    const r = action.row;
    const userId = r.user_id || r.userId;
    const decision = action.type;

    setConfirm({ open: false, action: null });
    setLoading(true);
    setErrMsg("");

    try {
      await kycApi.review(userId, decision, "");
      await fetchRows();
      if (selected && (selected.user_id || selected.userId) === userId) setSelected(null);
    } catch (e) {
      setErrMsg(e?.response?.data?.error || e?.message || "Review failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.kycWrap}>
      {/* Header */}
      <div className={styles.kycHeader}>
        <div>
          <div className={styles.kycTitle}>KYC Management</div>
          <div className={styles.kycSub}>
            Review identity applications. Approving activates wallet access.
          </div>
        </div>

        <div className={styles.kycToolbar}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name / user id / hash / country..."
            />
          </div>

          <select
            className={styles.selectDark}
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          >
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="NOT_SUBMITTED">NOT_SUBMITTED</option>
          </select>

          <button className={styles.btnSecondary} onClick={fetchRows} disabled={loading} type="button">
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            className={styles.btnGhost}
            onClick={() =>
              alert(
                "Review Guide:\n\n• Approve -> wallet becomes ACTIVE (backend rule)\n• Only doc hash is stored (no raw doc number)\n• Use View for full application detail."
              )
            }
            type="button"
          >
            Review Guide
          </button>
        </div>
      </div>

      {/* Error */}
      {errMsg ? <div className={styles.kycError}>{errMsg}</div> : null}

      {/* Card */}
      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <div className={styles.tableMeta}>
            Showing <b>{filtered.length}</b> records
          </div>
          <div className={styles.tableMeta}>Page {page}</div>
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.kycTable}>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>KYC</th>
                <th>Document</th>
                <th>Submitted</th>
                <th>Status</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={6} className={styles.empty}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>No applications found.</td></tr>
              ) : (
                filtered.map((r) => {
                  const uid = r.user_id || r.userId;
                  const name = r.full_name || "Unnamed applicant";
                  const st = String(r.status || "").toUpperCase();
                  const pending = st === "PENDING";

                  return (
                    <tr key={String(r.id ?? uid)} onClick={() => setSelected(r)} className={styles.rowClickable}>
                      <td>
                        <div className={styles.userName}>{name}</div>
                        <div className={styles.userId}>
                          <span className={styles.mono}>{shortId(uid)}</span>
                          <button
                            className={styles.iconBtn}
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(uid); }}
                            type="button"
                            title="Copy user id"
                          >
                            📋
                          </button>
                          <span className={styles.badgeMini}>{r.level || "L1"}</span>
                        </div>
                      </td>

                      <td>
                        <div className={styles.kvcLine}>
                          <span className={styles.dim}>DOB:</span> {r.dob || "—"}
                        </div>
                        <div className={styles.pillsRow}>
                          <span className={styles.badgeMini}>{r.country || "—"}</span>
                          <span className={styles.badgeMini}>{r.doc_type || "—"}</span>
                        </div>
                      </td>

                      <td>
                        <div className={styles.kvcLine}>
                          <span className={styles.dim}>Ref:</span>{" "}
                          <span className={styles.mono}>{shortHash(r.doc_number_hash)}</span>
                        </div>
                        <div className={styles.noteTiny}>
                          Hash only — raw doc number not stored
                        </div>
                      </td>

                      <td>
                        <div className={styles.kvcLine}>{fmtDateTime(r.submitted_at)}</div>
                        <div className={styles.noteTiny}>Updated: {fmtDateTime(r.updated_at)}</div>
                      </td>

                      <td>
                        <span className={`${styles.statusPill} ${statusClass(r.status)}`}>
                          {st || "—"}
                        </span>
                      </td>

                      <td className={styles.tdRight} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.actionsRowKyc}>
                          <button
                            className={styles.btnPrimary}
                            disabled={!pending || loading}
                            onClick={() => approve(r)}
                            type="button"
                          >
                            Approve
                          </button>
                          <button
                            className={styles.btnDanger}
                            disabled={!pending || loading}
                            onClick={() => reject(r)}
                            type="button"
                          >
                            Reject
                          </button>
                          <button className={styles.btnSecondary} onClick={() => setSelected(r)} type="button">
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.pager}>
          <div className={styles.tableMeta}>Tip: search filters only the current page.</div>
          <div className={styles.pagerBtns}>
            <button className={styles.btnSecondary} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading} type="button">
              Prev
            </button>
            <span className={styles.badgeMini}>Page {page}</span>
            <button className={styles.btnSecondary} onClick={() => setPage((p) => p + 1)} disabled={loading || rows.length < pageSize} type="button">
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.full_name || "Unnamed applicant"} — Application Detail` : "Application Detail"}
      >
        {selected ? (
          <div className={styles.drawerGrid}>
            <div className={styles.drawerCard}>
              <div className={styles.drawerCardTitle}>Applicant</div>
              <div className={styles.drawerRow}><span className={styles.dim}>Name:</span> {selected.full_name || "Unnamed applicant"}</div>
              <div className={styles.drawerRow}>
                <span className={styles.dim}>User ID:</span>{" "}
                <span className={styles.mono}>{selected.user_id || selected.userId}</span>
                <button className={styles.iconBtn} onClick={() => copyToClipboard(selected.user_id || selected.userId)} type="button">📋</button>
              </div>
              <div className={styles.drawerRow}><span className={styles.dim}>Level:</span> {selected.level || "—"}</div>
              <div className={styles.drawerRow}><span className={styles.dim}>Status:</span> {String(selected.status || "—")}</div>
            </div>

            <div className={styles.drawerCard}>
              <div className={styles.drawerCardTitle}>KYC Details</div>
              <div className={styles.drawerRow}><span className={styles.dim}>DOB:</span> {selected.dob || "—"}</div>
              <div className={styles.drawerRow}><span className={styles.dim}>Country:</span> {selected.country || "—"}</div>
              <div className={styles.drawerRow}><span className={styles.dim}>Document Type:</span> {selected.doc_type || "—"}</div>
              <div className={styles.drawerRow}>
                <span className={styles.dim}>Doc Hash:</span> <span className={styles.mono}>{selected.doc_number_hash || "—"}</span>
              </div>
              <div className={styles.noteTiny}>Only a hash is stored; raw document number is not available.</div>
            </div>

            <div className={styles.drawerCard}>
              <div className={styles.drawerCardTitle}>Timestamps</div>
              <div className={styles.drawerRow}><span className={styles.dim}>Submitted:</span> {fmtDateTime(selected.submitted_at)}</div>
              <div className={styles.drawerRow}><span className={styles.dim}>Updated:</span> {fmtDateTime(selected.updated_at)}</div>
            </div>

            <div className={styles.drawerCard}>
              <div className={styles.drawerCardTitle}>Admin Review</div>
              <div className={styles.drawerRow}><span className={styles.dim}>Reviewed By:</span> {selected.reviewed_by ? shortId(selected.reviewed_by) : "—"}</div>
              <div className={styles.drawerRow}><span className={styles.dim}>Notes:</span> {selected.review_notes || "—"}</div>
            </div>

            <div className={styles.drawerFooter}>
              <button className={styles.btnPrimary} disabled={String(selected.status || "").toUpperCase() !== "PENDING"} onClick={() => approve(selected)} type="button">
                Approve
              </button>
              <button className={styles.btnDanger} disabled={String(selected.status || "").toUpperCase() !== "PENDING"} onClick={() => reject(selected)} type="button">
                Reject
              </button>
              <button className={styles.btnSecondary} onClick={() => setSelected(null)} type="button">
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <ConfirmModal
        open={confirm.open}
        title={confirm.action?.type === "APPROVE" ? "Approve KYC?" : "Reject KYC?"}
        message={
          confirm.action?.type === "APPROVE"
            ? "This will approve the application and unlock wallet access."
            : "This will reject the application."
        }
        confirmText={confirm.action?.type === "APPROVE" ? "Approve" : "Reject"}
        variant={confirm.action?.type === "APPROVE" ? "primary" : "danger"}
        onCancel={() => setConfirm({ open: false, action: null })}
        onConfirm={doReview}
      />
    </div>
  );
}
