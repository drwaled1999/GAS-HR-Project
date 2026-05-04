import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../services/api";

const FIELD_LABELS = {
  phone: "Phone Number",
  email: "Email",
  id_number: "ID / Iqama Number",
  address: "Address",
  sabul_short_address: "Sabul Short Address",
  education: "Education",
  emergency_contact: "Emergency Contact",
};

export default function EmployeeDataUpdatePage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      const data = await apiFetch("/employee/data-update-requests");
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("LOAD DATA UPDATE REQUESTS ERROR:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function openRequest(item) {
    setSelected(item);

    const fields = getFields(item);
    const initial = {};

    fields.forEach((field) => {
      initial[field] = item?.submitted_data?.[field] || "";
    });

    setForm(initial);
    setNote(item?.employee_note || "");
  }

  function getFields(item) {
    const raw = item?.requested_fields;

    if (Array.isArray(raw)) return raw;

    try {
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function submitRequest() {
    if (!selected?.id) return;

    try {
      setSubmitting(true);

      await apiFetch(`/employee/data-update-requests/${selected.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          submitted_data: form,
          note,
        }),
      });

      alert("Your update has been submitted to HR for review.");
      setSelected(null);
      setForm({});
      setNote("");
      await loadRequests();
    } catch (err) {
      console.error("SUBMIT DATA UPDATE ERROR:", err);
      alert(err?.message || "Failed to submit update");
    } finally {
      setSubmitting(false);
    }
  }

  const stats = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((x) => x.status === "pending_employee").length,
      submitted: items.filter((x) => x.status === "submitted").length,
      approved: items.filter((x) => x.status === "approved").length,
    };
  }, [items]);

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>EMPLOYEE PROFILE UPDATE</div>
          <h1 style={styles.title}>My Data Update Requests</h1>
          <p style={styles.subtitle}>
            Complete the requested information and submit it to HR for review.
          </p>
        </div>

        <button style={styles.refreshBtn} onClick={loadRequests}>
          Refresh
        </button>
      </div>

      <div style={styles.statsGrid}>
        <Card label="Total Requests" value={stats.total} />
        <Card label="Pending" value={stats.pending} />
        <Card label="Submitted" value={stats.submitted} />
        <Card label="Approved" value={stats.approved} />
      </div>

      <div style={styles.panel}>
        <h2 style={styles.sectionTitle}>Requests</h2>

        {loading ? (
          <div style={styles.empty}>Loading requests...</div>
        ) : items.length === 0 ? (
          <div style={styles.empty}>No data update requests found.</div>
        ) : (
          <div style={styles.list}>
            {items.map((item) => {
              const fields = getFields(item);

              return (
                <div key={item.id} style={styles.requestCard}>
                  <div>
                    <div style={styles.requestTitle}>
                      Profile Update Request
                    </div>

                    <div style={styles.requestMeta}>
                      Requested Fields:{" "}
                      {fields.length
                        ? fields.map((f) => FIELD_LABELS[f] || f).join(", ")
                        : "-"}
                    </div>

                    <div style={styles.requestMeta}>
                      Created: {formatDate(item.created_at)}
                    </div>

                    {item.hr_note ? (
                      <div style={styles.hrNote}>HR Note: {item.hr_note}</div>
                    ) : null}
                  </div>

                  <div style={styles.rightSide}>
                    <span style={getStatusStyle(item.status)}>
                      {formatStatus(item.status)}
                    </span>

                    {(item.status === "pending_employee" ||
                      item.status === "needs_correction") && (
                      <button
                        style={styles.actionBtn}
                        onClick={() => openRequest(item)}
                      >
                        Complete
                      </button>
                    )}

                    {item.status === "submitted" && (
                      <span style={styles.waitingText}>Waiting HR review</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Complete Requested Data</h2>
                <p style={styles.modalSub}>
                  Fill only the fields requested by HR.
                </p>
              </div>

              <button style={styles.closeBtn} onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>

            <div style={styles.formGrid}>
              {getFields(selected).map((field) => (
                <label key={field} style={styles.field}>
                  <span>{FIELD_LABELS[field] || field}</span>
                  <input
                    style={styles.input}
                    value={form[field] || ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [field]: e.target.value,
                      }))
                    }
                    placeholder={`Enter ${FIELD_LABELS[field] || field}`}
                  />
                </label>
              ))}
            </div>

            <label style={styles.fieldFull}>
              <span>Employee Note</span>
              <textarea
                style={styles.textarea}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note to HR..."
              />
            </label>

            <div style={styles.actions}>
              <button style={styles.cancelBtn} onClick={() => setSelected(null)}>
                Cancel
              </button>

              <button
                style={styles.submitBtn}
                onClick={submitRequest}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit to HR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function formatStatus(status) {
  const s = String(status || "").replaceAll("_", " ");
  return s || "-";
}

function getStatusStyle(status) {
  const s = String(status || "").toLowerCase();

  let bg = "#f1f5f9";
  let color = "#334155";

  if (s === "pending_employee") {
    bg = "#fef3c7";
    color = "#92400e";
  }

  if (s === "submitted") {
    bg = "#dbeafe";
    color = "#1d4ed8";
  }

  if (s === "approved") {
    bg = "#dcfce7";
    color = "#166534";
  }

  if (s === "rejected") {
    bg = "#fee2e2";
    color = "#991b1b";
  }

  if (s === "needs_correction") {
    bg = "#ffedd5";
    color = "#9a3412";
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background: bg,
    color,
    textTransform: "capitalize",
    whiteSpace: "nowrap",
  };
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 16,
    background: "linear-gradient(135deg,#f8fafc,#eef2f7)",
    fontFamily: "Segoe UI, Arial, sans-serif",
    color: "#0f172a",
  },
  hero: {
    background: "linear-gradient(135deg,#0f172a,#1e3a8a,#2563eb)",
    color: "#fff",
    borderRadius: 24,
    padding: 22,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
    boxShadow: "0 18px 45px rgba(15,23,42,0.18)",
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: "0.16em",
    fontWeight: 900,
    color: "#bfdbfe",
  },
  title: {
    margin: "8px 0",
    fontSize: 28,
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    color: "#dbeafe",
    fontWeight: 600,
  },
  refreshBtn: {
    border: "none",
    background: "#fff",
    color: "#1d4ed8",
    padding: "11px 15px",
    borderRadius: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: 12,
    marginTop: 14,
  },
  statCard: {
    background: "#fff",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 12px 30px rgba(15,23,42,0.07)",
    border: "1px solid #e5e7eb",
  },
  statValue: {
    fontSize: 26,
    fontWeight: 900,
  },
  statLabel: {
    color: "#64748b",
    fontWeight: 800,
    marginTop: 4,
  },
  panel: {
    marginTop: 14,
    background: "#fff",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 14px 36px rgba(15,23,42,0.08)",
    border: "1px solid #e5e7eb",
  },
  sectionTitle: {
    margin: "0 0 14px",
    fontSize: 20,
    fontWeight: 900,
  },
  empty: {
    padding: 22,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 800,
    textAlign: "center",
  },
  list: {
    display: "grid",
    gap: 12,
  },
  requestCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    background: "#fff",
  },
  requestTitle: {
    fontWeight: 900,
    fontSize: 16,
  },
  requestMeta: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 5,
    fontWeight: 700,
  },
  hrNote: {
    marginTop: 8,
    padding: 10,
    background: "#fff7ed",
    color: "#9a3412",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
  },
  rightSide: {
    display: "grid",
    gap: 8,
    justifyItems: "end",
  },
  actionBtn: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "9px 12px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  waitingText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.62)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 999,
  },
  modal: {
    background: "#fff",
    width: "100%",
    maxWidth: 760,
    maxHeight: "90vh",
    overflowY: "auto",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 25px 70px rgba(0,0,0,0.3)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
  },
  modalSub: {
    margin: "6px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  closeBtn: {
    border: "none",
    background: "#f1f5f9",
    width: 38,
    height: 38,
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 900,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 12,
  },
  field: {
    display: "grid",
    gap: 6,
    fontWeight: 850,
    fontSize: 13,
    color: "#334155",
  },
  fieldFull: {
    display: "grid",
    gap: 6,
    fontWeight: 850,
    fontSize: 13,
    color: "#334155",
    marginTop: 12,
  },
  input: {
    height: 44,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "0 12px",
    outline: "none",
    fontWeight: 700,
  },
  textarea: {
    minHeight: 110,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    outline: "none",
    fontFamily: "Segoe UI, Arial, sans-serif",
    fontWeight: 700,
  },
  actions: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
    border: "none",
    background: "#f1f5f9",
    color: "#334155",
    padding: "11px 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  submitBtn: {
    border: "none",
    background: "#16a34a",
    color: "#fff",
    padding: "11px 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
};
