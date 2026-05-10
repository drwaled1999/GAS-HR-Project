import { useEffect, useMemo, useState } from "react";
import { apiFetch, API_BASE } from "../../services/api";

const FIELD_LABELS = {
  full_name: "Employee Name",
  gas_id: "GAS ID",
  phone: "Phone Number",
  email: "Email",
  id_number: "ID / Iqama Number",
  join_date: "Join Date",
  address: "Address",
  sabul_short_address: "Sabul Short Address",
  education: "Education",
  emergency_contact: "Emergency Contact",
};

const ATTACHMENT_TYPES = [
  { key: "id_iqama", label: "ID / Iqama Attachment" },
  { key: "education_certificate", label: "Education Certificate" },
  { key: "other", label: "Other Supporting Document" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getToken() {
  return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
}

export default function EmployeeDataUpdatePage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [note, setNote] = useState("");
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    if (!selected?.id) return;

    const saved = localStorage.getItem(`draft-request-${selected.id}`);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      setForm(parsed.form || {});
      setNote(parsed.note || "");
    } catch {
      localStorage.removeItem(`draft-request-${selected.id}`);
    }
  }, [selected]);

  useEffect(() => {
    if (!selected?.id) return;

    localStorage.setItem(
      `draft-request-${selected.id}`,
      JSON.stringify({
        form,
        note,
      })
    );
  }, [form, note, selected]);

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

  function getSubmittedData(item) {
    let data = item?.submitted_data || {};

    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }

    return data || {};
  }

  function getAttachments(item) {
    const data = getSubmittedData(item);
    return Array.isArray(data.__attachments) ? data.__attachments : [];
  }

  function openRequest(item) {
    setSelected(item);

    const fields = getFields(item);
    const submitted = getSubmittedData(item);
    const initial = {};

    fields.forEach((field) => {
      initial[field] = submitted?.[field] || "";
    });

    setForm(initial);
    setNote(item?.employee_note || "");
    setFiles({});
  }

  function handleFileChange(type, file) {
    if (!file) {
      setFiles((prev) => ({
        ...prev,
        [type]: null,
      }));
      return;
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      alert("Only PDF files are allowed.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("File size must be less than 10MB.");
      return;
    }

    const alreadyExists = Object.values(files).some(
      (f) => f && f.name === file.name && f.size === file.size
    );

    if (alreadyExists) {
      alert("This file has already been selected.");
      return;
    }

    setFiles((prev) => ({
      ...prev,
      [type]: file,
    }));
  }

  function validateForm() {
    const fields = getFields(selected);

    for (const field of fields) {
      const value = String(form[field] || "").trim();

      if (!value) {
        return `${FIELD_LABELS[field] || field} is required.`;
      }

      if (field === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(value)) {
          return "Invalid email address.";
        }
      }

      if (field === "phone") {
        if (value.length < 8) {
          return "Invalid phone number.";
        }
      }

      if (field === "join_date") {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return "Invalid join date.";
        }
      }
    }

    return "";
  }

  async function submitRequest() {
    if (!selected?.id) return;
    if (submitting) return;

    const validationError = validateForm();
    if (validationError) return alert(validationError);

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append("submitted_data", JSON.stringify(form));
      formData.append("note", note || "");

      const meta = [];

      ATTACHMENT_TYPES.forEach((type) => {
        const file = files[type.key];

        if (file) {
          formData.append("attachments", file);
          meta.push({
            document_type: type.key,
            label: type.label,
          });
        }
      });

      formData.append("attachment_meta", JSON.stringify(meta));

      const res = await fetch(`${API_BASE}/employee/data-update-requests/${selected.id}/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || "Failed to submit update");
      }

      localStorage.removeItem(`draft-request-${selected.id}`);

      alert("Your update has been submitted to HR for review.");

      setSelected(null);
      setForm({});
      setFiles({});
      setNote("");

      await loadRequests();
    } catch (err) {
      console.error("SUBMIT DATA UPDATE ERROR:", err);
      alert(err?.message || "Failed to submit update");
    } finally {
      setSubmitting(false);
    }
  }

  function getCompletion(item) {
    const fields = getFields(item);

    if (!fields.length) return 100;

    const completed = fields.filter((field) => String(form[field] || "").trim() !== "").length;

    return Math.round((completed / fields.length) * 100);
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
            Complete your requested information and upload PDF supporting documents.
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
              const attachments = getAttachments(item);

              return (
                <div key={item.id} style={styles.requestCard}>
                  <div style={styles.requestMain}>
                    <div style={styles.requestTop}>
                      <div>
                        <div style={styles.requestTitle}>Profile Update Request</div>
                        <div style={styles.requestMeta}>Created: {formatDate(item.created_at)}</div>
                      </div>

                      <span style={getStatusStyle(item.status)}>{formatStatus(item.status)}</span>
                    </div>

                    <div style={styles.chips}>
                      {fields.length ? (
                        fields.map((f) => (
                          <span key={f} style={styles.chip}>
                            {FIELD_LABELS[f] || f}
                          </span>
                        ))
                      ) : (
                        <span style={styles.muted}>No fields</span>
                      )}
                    </div>

                    {item.hr_note ? <div style={styles.hrNote}>HR Note: {item.hr_note}</div> : null}

                    {attachments.length ? (
                      <div style={styles.attachmentsMini}>
                        {attachments.map((a, index) => (
                          <a
                            key={`${a.file_url || index}`}
                            href={a.file_url}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.attachmentLink}
                          >
                            {a.label || "Attachment"} · {a.file_name || "Open PDF"}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div style={styles.rightSide}>
                    {(item.status === "pending_employee" || item.status === "needs_correction") && (
                      <button style={styles.actionBtn} onClick={() => openRequest(item)}>
                        Complete
                      </button>
                    )}

                    {item.status === "submitted" && <span style={styles.waitingText}>Waiting HR review</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div style={styles.overlay}>
          <div style={styles.sheet}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Complete Requested Data</h2>
                <p style={styles.modalSub}>
                  Fill the requested fields and attach PDF documents if available.
                </p>

                <div style={styles.progressWrap}>
                  <div style={styles.progressInfo}>
                    <strong>{getCompletion(selected)}%</strong>
                    <span>Completed</span>
                  </div>

                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${getCompletion(selected)}%`,
                      }}
                    />
                  </div>
                </div>
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
                    type={field === "join_date" ? "date" : "text"}
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

            <div style={styles.uploadSection}>
              <h3 style={styles.uploadTitle}>PDF Supporting Documents</h3>
              <p style={styles.uploadSub}>
                Upload PDF files only. Maximum file size is 10MB.
              </p>

              <div style={styles.uploadGrid}>
                {ATTACHMENT_TYPES.map((type) => (
                  <label key={type.key} style={styles.uploadCard}>
                    <div>
                      <strong>{type.label}</strong>
                      <p style={styles.fileHint}>{files[type.key]?.name || "PDF file only"}</p>
                    </div>

                    <span style={styles.chooseBtn}>Choose PDF</span>

                    <input
                      hidden
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => handleFileChange(type.key, e.target.files?.[0] || null)}
                    />
                  </label>
                ))}
              </div>
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
                style={{
                  ...styles.submitBtn,
                  opacity: submitting ? 0.7 : 1,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
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
    fontSize: "clamp(22px, 5vw, 30px)",
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    color: "#dbeafe",
    fontWeight: 600,
    lineHeight: 1.5,
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
    gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))",
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
    borderRadius: 20,
    padding: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
    gap: 14,
    alignItems: "center",
    background: "#fff",
  },
  requestMain: {
    minWidth: 0,
  },
  requestTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
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
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },
  chip: {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  muted: {
    color: "#94a3b8",
    fontWeight: 800,
  },
  hrNote: {
    marginTop: 10,
    padding: 10,
    background: "#fff7ed",
    color: "#9a3412",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 800,
  },
  attachmentsMini: {
    display: "grid",
    gap: 7,
    marginTop: 10,
  },
  attachmentLink: {
    color: "#2563eb",
    fontWeight: 800,
    fontSize: 13,
    textDecoration: "none",
    wordBreak: "break-word",
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
    padding: "10px 14px",
    borderRadius: 13,
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
    padding: 12,
    zIndex: 999,
  },
  sheet: {
    background: "#fff",
    width: "100%",
    maxWidth: 860,
    maxHeight: "92vh",
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
    fontSize: "clamp(20px, 4vw, 24px)",
    fontWeight: 900,
  },
  modalSub: {
    margin: "6px 0 0",
    color: "#64748b",
    fontWeight: 700,
    lineHeight: 1.5,
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
  progressWrap: {
    marginTop: 14,
  },
  progressInfo: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
    fontWeight: 800,
    fontSize: 13,
  },
  progressBar: {
    width: "100%",
    height: 10,
    background: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#16a34a",
    borderRadius: 999,
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
    height: 46,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "0 12px",
    outline: "none",
    fontWeight: 700,
    width: "100%",
    boxSizing: "border-box",
  },
  uploadSection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
  },
  uploadTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
  },
  uploadSub: {
    margin: "5px 0 12px",
    color: "#64748b",
    fontWeight: 700,
    fontSize: 13,
  },
  uploadGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
    gap: 10,
  },
  uploadCard: {
    border: "1px dashed #93c5fd",
    background: "#fff",
    borderRadius: 16,
    padding: 13,
    display: "grid",
    gap: 10,
    cursor: "pointer",
  },
  fileHint: {
    margin: "6px 0 0",
    color: "#64748b",
    fontWeight: 700,
    fontSize: 12,
    wordBreak: "break-word",
  },
  chooseBtn: {
    display: "inline-flex",
    justifyContent: "center",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 12,
    padding: "9px 10px",
    fontWeight: 900,
    fontSize: 13,
  },
  textarea: {
    minHeight: 110,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    outline: "none",
    fontFamily: "Segoe UI, Arial, sans-serif",
    fontWeight: 700,
    width: "100%",
    boxSizing: "border-box",
  },
  actions: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  cancelBtn: {
    border: "none",
    background: "#f1f5f9",
    color: "#334155",
    padding: "12px 15px",
    borderRadius: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  submitBtn: {
    border: "none",
    background: "#16a34a",
    color: "#fff",
    padding: "12px 15px",
    borderRadius: 13,
    fontWeight: 900,
  },
};
