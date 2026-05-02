import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";

const REQUIRED_FIELDS = [
  { key: "full_name", label: "Name" },
  { key: "gas_id", label: "GAS ID" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "id_number", label: "ID Number" },
  { key: "join_date", label: "Join Date" },
  { key: "address", label: "Address" },
  { key: "sabul_short_address", label: "Sabul Address" },
  { key: "education", label: "Education" },
  { key: "emergency_contact", label: "Emergency Contact" },
];

const DOC_TYPES = [
  { value: "id", label: "ID / Iqama" },
  { value: "contract", label: "Contract" },
  { value: "certificate", label: "Certificate" },
  { value: "cv", label: "CV" },
  { value: "other", label: "Other" },
];

export default function AdminEmployeeServicesPage() {
  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);

  const [docType, setDocType] = useState("id");
  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [requestMessage, setRequestMessage] = useState(
    "Please update your missing employee profile information."
  );

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      setLoading(true);
      const data = await apiFetch("/admin/employees");
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("LOAD EMPLOYEES ERROR:", err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments(employeeId) {
    try {
      const data = await apiFetch(`/admin/employees/${employeeId}/documents`);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("LOAD DOCUMENTS ERROR:", err);
      setDocuments([]);
    }
  }

  function openEmployee(emp) {
    setSelected(emp);
    setActiveTab("profile");
    loadDocuments(emp.id);
  }

  function valueExists(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  function getMissingFields(emp) {
    return REQUIRED_FIELDS.filter((f) => !valueExists(emp[f.key]));
  }

  function getCompletion(emp) {
    const filled = REQUIRED_FIELDS.filter((f) => valueExists(emp[f.key])).length;
    return Math.round((filled / REQUIRED_FIELDS.length) * 100);
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const text = `${emp.full_name || ""} ${emp.gas_id || ""} ${
        emp.project_name || ""
      } ${emp.job_title || ""}`.toLowerCase();

      const matchSearch = text.includes(search.toLowerCase());
      const missing = getMissingFields(emp).length > 0;

      return matchSearch && (!onlyMissing || missing);
    });
  }, [employees, search, onlyMissing]);

  const stats = useMemo(() => {
    const total = employees.length;
    const complete = employees.filter((e) => getCompletion(e) === 100).length;
    const missing = employees.filter((e) => getCompletion(e) < 100).length;

    return { total, complete, missing };
  }, [employees]);

  async function saveEmployee() {
    try {
      await apiFetch(`/admin/employees/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify(selected),
      });

      setSelected(null);
      await loadEmployees();
    } catch (err) {
      console.error("SAVE EMPLOYEE ERROR:", err);
      alert("Failed to save employee");
    }
  }

  async function exportExcel() {
    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("authToken");

      const apiBase =
        import.meta.env.VITE_API_BASE_URL ||
        import.meta.env.VITE_API_URL ||
        "";

      const res = await fetch(`${apiBase}/admin/employees/export`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        alert("Export failed");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "employee-master-data.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("EXPORT ERROR:", err);
      alert("Export failed");
    }
  }

  async function uploadDocument() {
    if (!selected?.id) return;
    if (!docFile) {
      alert("Please select a file");
      return;
    }

    try {
      setUploading(true);

      const token =
        localStorage.getItem("token") || localStorage.getItem("authToken");

      const apiBase =
        import.meta.env.VITE_API_BASE_URL ||
        import.meta.env.VITE_API_URL ||
        "";

      const formData = new FormData();
      formData.append("document_type", docType);
      formData.append("file", docFile);

      const res = await fetch(
        `${apiBase}/admin/employees/${selected.id}/documents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        alert("Upload failed");
        return;
      }

      setDocFile(null);
      await loadDocuments(selected.id);
      alert("Document uploaded successfully");
    } catch (err) {
      console.error("UPLOAD DOCUMENT ERROR:", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function sendRequestUpdate() {
    if (!selected?.id) return;

    try {
      await apiFetch(`/admin/employees/${selected.id}/request-update`, {
        method: "POST",
        body: JSON.stringify({
          message: requestMessage,
        }),
      });

      alert("Update request sent successfully");
    } catch (err) {
      console.error("REQUEST UPDATE ERROR:", err);
      alert("Failed to send request");
    }
  }

  function getDocumentUrl(docId) {
    const apiBase =
      import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "";
    return `${apiBase}/admin/employees/documents/${docId}/view`;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>HR Employee Services Center</h1>
          <p style={styles.subtitle}>
            Complete employee data, manage documents, and export HR reports
          </p>
        </div>

        <button style={styles.exportBtn} onClick={exportExcel}>
          Export Excel
        </button>
      </div>

      <div style={styles.statsGrid}>
        <StatCard label="Total Employees" value={stats.total} />
        <StatCard label="Completed Files" value={stats.complete} />
        <StatCard label="Missing Data" value={stats.missing} />
      </div>

      <div style={styles.toolbar}>
        <input
          style={styles.search}
          placeholder="Search by name, GAS ID, project..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
          />
          Missing data only
        </label>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Employee</th>
              <th style={styles.th}>GAS ID</th>
              <th style={styles.th}>Project</th>
              <th style={styles.th}>Job Title</th>
              <th style={styles.th}>Completion</th>
              <th style={styles.th}>Missing Fields</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td style={styles.td} colSpan="7">
                  Loading employees...
                </td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan="7">
                  No employees found.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => {
                const completion = getCompletion(emp);
                const missing = getMissingFields(emp);

                return (
                  <tr key={emp.id}>
                    <td style={styles.td}>{emp.full_name || "-"}</td>
                    <td style={styles.td}>{emp.gas_id || "-"}</td>
                    <td style={styles.td}>{emp.project_name || "-"}</td>
                    <td style={styles.td}>{emp.job_title || "-"}</td>

                    <td style={styles.td}>
                      <div style={styles.progressText}>{completion}%</div>
                      <div style={styles.progress}>
                        <div
                          style={{
                            ...styles.progressBar,
                            width: `${completion}%`,
                            background:
                              completion >= 90
                                ? "#16a34a"
                                : completion >= 60
                                ? "#f59e0b"
                                : "#dc2626",
                          }}
                        />
                      </div>
                    </td>

                    <td style={styles.td}>
                      {missing.length ? (
                        <div style={styles.badges}>
                          {missing.slice(0, 4).map((m) => (
                            <span key={m.key} style={styles.badge}>
                              {m.label}
                            </span>
                          ))}
                          {missing.length > 4 && (
                            <span style={styles.badge}>
                              +{missing.length - 4}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={styles.done}>Complete</span>
                      )}
                    </td>

                    <td style={styles.td}>
                      <button
                        style={styles.actionBtn}
                        onClick={() => openEmployee(emp)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Employee Service File</h2>
                <p style={styles.modalSub}>
                  {selected.full_name || "-"} — {selected.gas_id || "-"}
                </p>
              </div>

              <button style={styles.closeBtn} onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>

            <div style={styles.tabs}>
              <button
                style={activeTab === "profile" ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab("profile")}
              >
                Profile
              </button>
              <button
                style={activeTab === "documents" ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab("documents")}
              >
                Documents
              </button>
              <button
                style={activeTab === "request" ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab("request")}
              >
                Request Update
              </button>
            </div>

            {activeTab === "profile" && (
              <>
                <div style={styles.formGrid}>
                  <Field
                    label="Phone"
                    value={selected.phone}
                    onChange={(v) => setSelected({ ...selected, phone: v })}
                  />

                  <Field
                    label="Email"
                    value={selected.email}
                    onChange={(v) => setSelected({ ...selected, email: v })}
                  />

                  <Field
                    label="ID / Iqama Number"
                    value={selected.id_number}
                    onChange={(v) =>
                      setSelected({ ...selected, id_number: v })
                    }
                  />

                  <Field
                    label="Join Date"
                    type="date"
                    value={
                      selected.join_date
                        ? String(selected.join_date).slice(0, 10)
                        : ""
                    }
                    onChange={(v) =>
                      setSelected({ ...selected, join_date: v })
                    }
                  />

                  <Field
                    label="Address"
                    value={selected.address}
                    onChange={(v) => setSelected({ ...selected, address: v })}
                  />

                  <Field
                    label="Sabul Short Address"
                    value={selected.sabul_short_address}
                    onChange={(v) =>
                      setSelected({ ...selected, sabul_short_address: v })
                    }
                  />

                  <Field
                    label="Education"
                    value={selected.education}
                    onChange={(v) => setSelected({ ...selected, education: v })}
                  />

                  <Field
                    label="Emergency Contact"
                    value={selected.emergency_contact}
                    onChange={(v) =>
                      setSelected({ ...selected, emergency_contact: v })
                    }
                  />
                </div>

                <div style={styles.modalActions}>
                  <button
                    style={styles.cancelBtn}
                    onClick={() => setSelected(null)}
                  >
                    Cancel
                  </button>

                  <button style={styles.saveBtn} onClick={saveEmployee}>
                    Save Changes
                  </button>
                </div>
              </>
            )}

            {activeTab === "documents" && (
              <div>
                <div style={styles.uploadBox}>
                  <select
                    style={styles.input}
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                  >
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>

                  <input
                    style={styles.input}
                    type="file"
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  />

                  <button
                    style={styles.saveBtn}
                    onClick={uploadDocument}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Upload Document"}
                  </button>
                </div>

                <div style={styles.docsList}>
                  {documents.length === 0 ? (
                    <div style={styles.emptyBox}>No documents uploaded.</div>
                  ) : (
                    documents.map((doc) => (
                      <div key={doc.id} style={styles.docItem}>
                        <div>
                          <strong>{doc.document_type}</strong>
                          <div style={styles.docSub}>{doc.file_name}</div>
                        </div>

                        <div style={styles.docActions}>
                          <a
                            style={styles.linkBtn}
                            href={getDocumentUrl(doc.id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Preview
                          </a>

                          <a
                            style={styles.linkBtn}
                            href={getDocumentUrl(doc.id)}
                            download
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "request" && (
              <div>
                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Message to Employee</span>
                  <textarea
                    style={styles.textarea}
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                  />
                </label>

                <div style={styles.infoBox}>
                  This will send a notification to the employee asking them to
                  update their profile information.
                </div>

                <div style={styles.modalActions}>
                  <button style={styles.saveBtn} onClick={sendRequestUpdate}>
                    Send Request Update
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <input
        type={type}
        style={styles.input}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: 20,
    fontFamily: "Segoe UI, Arial, sans-serif",
    color: "#111827",
  },
  header: {
    marginBottom: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#6b7280",
  },
  exportBtn: {
    border: "none",
    background: "#111827",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 14,
    marginBottom: 18,
  },
  statCard: {
    background: "#fff",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },
  statValue: {
    fontSize: 28,
    fontWeight: 800,
  },
  statLabel: {
    color: "#6b7280",
    marginTop: 4,
  },
  toolbar: {
    background: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    display: "flex",
    gap: 14,
    alignItems: "center",
    flexWrap: "wrap",
  },
  search: {
    flex: 1,
    minWidth: 220,
    padding: "12px 14px",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    outline: "none",
  },
  checkboxLabel: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    color: "#374151",
  },
  tableWrap: {
    background: "#fff",
    borderRadius: 18,
    overflowX: "auto",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 900,
  },
  th: {
    textAlign: "left",
    padding: 14,
    background: "#f9fafb",
    color: "#374151",
    fontSize: 13,
    borderBottom: "1px solid #e5e7eb",
  },
  td: {
    padding: 14,
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  },
  progressText: {
    fontWeight: 700,
    fontSize: 13,
    marginBottom: 5,
  },
  progress: {
    height: 8,
    background: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
    width: 120,
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
  },
  badges: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  badge: {
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 700,
  },
  done: {
    color: "#15803d",
    fontWeight: 800,
  },
  actionBtn: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "9px 12px",
    borderRadius: 10,
    fontWeight: 800,
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 999,
  },
  modal: {
    width: "100%",
    maxWidth: 950,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  modalTitle: {
    margin: 0,
    fontSize: 22,
  },
  modalSub: {
    marginTop: 6,
    color: "#6b7280",
  },
  closeBtn: {
    border: "none",
    background: "#f3f4f6",
    borderRadius: 12,
    padding: "8px 11px",
    cursor: "pointer",
    fontWeight: 900,
  },
  tabs: {
    display: "flex",
    gap: 8,
    marginTop: 18,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  tab: {
    border: "none",
    background: "#f3f4f6",
    color: "#374151",
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  tabActive: {
    border: "none",
    background: "#2563eb",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    marginTop: 18,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#374151",
  },
  input: {
    padding: "12px 13px",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    outline: "none",
    background: "#fff",
  },
  textarea: {
    minHeight: 120,
    padding: "12px 13px",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    outline: "none",
    resize: "vertical",
    fontFamily: "Segoe UI, Arial, sans-serif",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    border: "none",
    background: "#f3f4f6",
    padding: "11px 16px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  saveBtn: {
    border: "none",
    background: "#16a34a",
    color: "#fff",
    padding: "11px 16px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  uploadBox: {
    display: "grid",
    gridTemplateColumns: "180px 1fr auto",
    gap: 10,
    alignItems: "center",
    background: "#f9fafb",
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
  },
  docsList: {
    marginTop: 16,
    display: "grid",
    gap: 10,
  },
  docItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
  },
  docSub: {
    color: "#6b7280",
    fontSize: 13,
    marginTop: 4,
  },
  docActions: {
    display: "flex",
    gap: 8,
  },
  linkBtn: {
    textDecoration: "none",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "8px 10px",
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 13,
  },
  emptyBox: {
    padding: 18,
    background: "#f9fafb",
    borderRadius: 14,
    color: "#6b7280",
    border: "1px dashed #d1d5db",
  },
  infoBox: {
    marginTop: 14,
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: 14,
    borderRadius: 14,
    fontWeight: 700,
  },
};
