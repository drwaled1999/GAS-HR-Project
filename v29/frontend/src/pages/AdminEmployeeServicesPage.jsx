import { useEffect, useMemo, useState } from "react";
import { apiFetch, API_BASE } from "../services/api";
import {
  Search,
  Download,
  RefreshCw,
  UploadCloud,
  Eye,
  Send,
  X,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";

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

function getToken() {
  return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
}

function hasValue(v) {
  return v !== null && v !== undefined && String(v).trim() !== "";
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "E";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatDate(v) {
  if (!v) return "-";
  return String(v).slice(0, 10);
}

function docLabel(value) {
  return DOC_TYPES.find((d) => d.value === value)?.label || value || "Document";
}

export default function AdminEmployeeServicesPage() {
  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");

  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
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

  function getMissing(emp) {
    return REQUIRED_FIELDS.filter((f) => !hasValue(emp[f.key]));
  }

  function getCompletion(emp) {
    const filled = REQUIRED_FIELDS.filter((f) => hasValue(emp[f.key])).length;
    return Math.round((filled / REQUIRED_FIELDS.length) * 100);
  }

  function colorByCompletion(v) {
    if (v >= 90) return "#16a34a";
    if (v >= 60) return "#f59e0b";
    return "#dc2626";
  }

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const text = `${e.full_name || ""} ${e.gas_id || ""} ${e.project_name || ""} ${e.job_title || ""}`.toLowerCase();
      const match = text.includes(search.toLowerCase());
      const missing = getMissing(e).length > 0;
      return match && (!onlyMissing || missing);
    });
  }, [employees, search, onlyMissing]);

  const stats = useMemo(() => {
    const total = employees.length;
    const complete = employees.filter((e) => getCompletion(e) === 100).length;
    const missing = total - complete;
    return { total, complete, missing };
  }, [employees]);

  function openEmployee(emp) {
    setSelected(emp);
    setActiveTab("profile");
    loadDocuments(emp.id);
  }

  async function saveEmployee() {
    try {
      await apiFetch(`/admin/employees/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify(selected),
      });
      await loadEmployees();
      setSelected(null);
      alert("Employee data updated successfully");
    } catch (err) {
      console.error("SAVE ERROR:", err);
      alert("Failed to save employee");
    }
  }

  async function exportExcel() {
    try {
      const res = await fetch(`${API_BASE}/admin/employees/export`, {
        headers: { Authorization: `Bearer ${getToken()}` },
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
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("EXPORT ERROR:", err);
      alert("Export failed");
    }
  }

  async function uploadDocument() {
    if (!selected?.id) return;
    if (!docFile) return alert("Please select a file");

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("document_type", docType);
      formData.append("file", docFile);

      const res = await fetch(`${API_BASE}/admin/employees/${selected.id}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      if (!res.ok) {
        alert("Upload failed");
        return;
      }

      setDocFile(null);
      await loadDocuments(selected.id);
      alert("Document uploaded successfully");
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function openDocument(docId) {
    try {
      const res = await fetch(`${API_BASE}/admin/employees/documents/${docId}/view`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) return alert("Cannot open document");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      alert("Cannot open document");
    }
  }

  async function downloadDocument(docId, fileName) {
    try {
      const res = await fetch(`${API_BASE}/admin/employees/documents/${docId}/view?download=1`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) return alert("Download failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "file";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Download failed");
    }
  }

  async function sendRequestUpdate() {
    try {
      await apiFetch(`/admin/employees/${selected.id}/request-update`, {
        method: "POST",
        body: JSON.stringify({ message: requestMessage }),
      });
      alert("Update request sent successfully");
    } catch {
      alert("Failed to send request");
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>HR OPERATIONS CENTER</div>
          <h1 style={styles.title}>Employee Services Center</h1>
          <p style={styles.subtitle}>
            إدارة بيانات الموظفين، استكمال النواقص، رفع المستندات، وإصدار تقارير Excel.
          </p>
        </div>

        <div style={styles.heroActions}>
          <button style={styles.secondaryBtn} onClick={loadEmployees}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button style={styles.primaryBtn} onClick={exportExcel}>
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      <div style={styles.stats}>
        <Stat icon={<Users />} label="Total Employees" value={stats.total} />
        <Stat icon={<CheckCircle2 />} label="Completed Files" value={stats.complete} />
        <Stat icon={<AlertTriangle />} label="Missing Data" value={stats.missing} />
      </div>

      <div style={styles.panel}>
        <div style={styles.toolbar}>
          <div style={styles.searchBox}>
            <Search size={18} />
            <input
              style={styles.searchInput}
              placeholder="Search by name, GAS ID, project, job title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            style={onlyMissing ? styles.filterActive : styles.filterBtn}
            onClick={() => setOnlyMissing((v) => !v)}
          >
            Missing data only
          </button>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Employee</th>
                <th style={styles.th}>GAS ID</th>
                <th style={styles.th}>Project</th>
                <th style={styles.th}>Job</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Completion</th>
                <th style={styles.th}>Missing</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td style={styles.empty} colSpan="8">Loading employees...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td style={styles.empty} colSpan="8">No employees found.</td></tr>
              ) : (
                filtered.map((emp) => {
                  const completion = getCompletion(emp);
                  const missing = getMissing(emp);
                  const color = colorByCompletion(completion);

                  return (
                    <tr key={emp.id}>
                      <td style={styles.td}>
                        <div style={styles.empCell}>
                          <div style={styles.avatar}>{initials(emp.full_name)}</div>
                          <div>
                            <div style={styles.empName}>{emp.full_name || "-"}</div>
                            <div style={styles.empSub}>{emp.email || "No email"}</div>
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}><span style={styles.gasBadge}>{emp.gas_id || "-"}</span></td>
                      <td style={styles.td}>{emp.project_name || "-"}</td>
                      <td style={styles.td}>{emp.job_title || "-"}</td>
                      <td style={styles.td}><span style={styles.status}>{emp.status || "active"}</span></td>

                      <td style={styles.td}>
                        <div style={styles.progressText}>{completion}%</div>
                        <div style={styles.progress}>
                          <div style={{ ...styles.progressFill, width: `${completion}%`, background: color }} />
                        </div>
                      </td>

                      <td style={styles.td}>
                        {missing.length ? (
                          <div style={styles.badges}>
                            {missing.slice(0, 3).map((m) => (
                              <span key={m.key} style={styles.badge}>{m.label}</span>
                            ))}
                            {missing.length > 3 && <span style={styles.more}>+{missing.length - 3}</span>}
                          </div>
                        ) : (
                          <span style={styles.complete}>Complete</span>
                        )}
                      </td>

                      <td style={styles.td}>
                        <button style={styles.manageBtn} onClick={() => openEmployee(emp)}>
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
      </div>

      {selected && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div style={styles.modalUser}>
                <div style={styles.modalAvatar}>{initials(selected.full_name)}</div>
                <div>
                  <h2 style={styles.modalTitle}>{selected.full_name}</h2>
                  <p style={styles.modalSub}>GAS ID: {selected.gas_id || "-"} · {selected.project_name || "-"}</p>
                </div>
              </div>

              <button style={styles.closeBtn} onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.tabs}>
              {["profile", "documents", "request"].map((tab) => (
                <button
                  key={tab}
                  style={activeTab === tab ? styles.tabActive : styles.tab}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "profile" ? "Profile Data" : tab === "documents" ? "Documents Vault" : "Request Update"}
                </button>
              ))}
            </div>

            {activeTab === "profile" && (
              <>
                <div style={styles.formGrid}>
                  <Field label="Phone" value={selected.phone} onChange={(v) => setSelected({ ...selected, phone: v })} />
                  <Field label="Email" value={selected.email} onChange={(v) => setSelected({ ...selected, email: v })} />
                  <Field label="ID / Iqama Number" value={selected.id_number} onChange={(v) => setSelected({ ...selected, id_number: v })} />
                  <Field label="Join Date" type="date" value={selected.join_date ? String(selected.join_date).slice(0, 10) : ""} onChange={(v) => setSelected({ ...selected, join_date: v })} />
                  <Field label="Address" value={selected.address} onChange={(v) => setSelected({ ...selected, address: v })} />
                  <Field label="Sabul Short Address" value={selected.sabul_short_address} onChange={(v) => setSelected({ ...selected, sabul_short_address: v })} />
                  <Field label="Education" value={selected.education} onChange={(v) => setSelected({ ...selected, education: v })} />
                  <Field label="Emergency Contact" value={selected.emergency_contact} onChange={(v) => setSelected({ ...selected, emergency_contact: v })} />
                  <Field label="Status" value={selected.status} onChange={(v) => setSelected({ ...selected, status: v })} />
                </div>

                <div style={styles.actions}>
                  <button style={styles.cancelBtn} onClick={() => setSelected(null)}>Cancel</button>
                  <button style={styles.saveBtn} onClick={saveEmployee}>Save Changes</button>
                </div>
              </>
            )}

            {activeTab === "documents" && (
              <>
                <div style={styles.uploadBox}>
                  <select style={styles.input} value={docType} onChange={(e) => setDocType(e.target.value)}>
                    {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>

                  <label style={styles.filePicker}>
                    <UploadCloud size={18} />
                    {docFile ? docFile.name : "Choose file"}
                    <input type="file" hidden onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                  </label>

                  <button style={styles.saveBtn} onClick={uploadDocument}>
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>

                <div style={styles.docsGrid}>
                  {documents.length === 0 ? (
                    <div style={styles.emptyDoc}>No documents uploaded.</div>
                  ) : (
                    documents.map((doc) => (
                      <div key={doc.id} style={styles.docCard}>
                        <FileText size={24} />
                        <div style={styles.docTitle}>{docLabel(doc.document_type)}</div>
                        <div style={styles.docName}>{doc.file_name}</div>
                        <div style={styles.docDate}>Uploaded: {formatDate(doc.uploaded_at)}</div>

                        <div style={styles.docActions}>
                          <button style={styles.previewBtn} onClick={() => openDocument(doc.id)}>
                            <Eye size={15} /> Preview
                          </button>
                          <button style={styles.downloadBtn} onClick={() => downloadDocument(doc.id, doc.file_name)}>
                            <Download size={15} /> Download
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {activeTab === "request" && (
              <>
                <textarea
                  style={styles.textarea}
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                />

                <div style={styles.actions}>
                  <button style={styles.saveBtn} onClick={sendRequestUpdate}>
                    <Send size={16} /> Send Request
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statIcon}>{icon}</div>
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      <input style={styles.input} type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 20,
    background: "linear-gradient(135deg,#f8fafc,#eef2f7)",
    color: "#0f172a",
    fontFamily: "Segoe UI, Arial, sans-serif",
  },
  hero: {
    background: "linear-gradient(135deg,#0f172a,#1e3a8a,#2563eb)",
    color: "#fff",
    borderRadius: 26,
    padding: 24,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  eyebrow: { fontSize: 12, fontWeight: 900, letterSpacing: "0.18em", color: "#bfdbfe" },
  title: { margin: "8px 0", fontSize: 30, fontWeight: 900 },
  subtitle: { margin: 0, color: "#dbeafe", fontWeight: 600 },
  heroActions: { display: "flex", gap: 10, alignItems: "center" },
  primaryBtn: btn("#fff", "#1d4ed8"),
  secondaryBtn: btn("rgba(255,255,255,0.14)", "#fff"),
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 14,
    marginBottom: 16,
  },
  stat: {
    background: "#fff",
    borderRadius: 20,
    padding: 18,
    display: "flex",
    gap: 14,
    alignItems: "center",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
  },
  statIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    background: "#eff6ff",
    color: "#2563eb",
    display: "grid",
    placeItems: "center",
  },
  statValue: { fontSize: 28, fontWeight: 900 },
  statLabel: { color: "#64748b", fontWeight: 800 },
  panel: {
    background: "#fff",
    borderRadius: 24,
    padding: 14,
    boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
  },
  toolbar: { display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  searchBox: {
    flex: 1,
    minWidth: 260,
    height: 46,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 15,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
    color: "#64748b",
  },
  searchInput: { border: "none", outline: "none", background: "transparent", flex: 1, fontWeight: 700 },
  filterBtn: btn("#f8fafc", "#334155"),
  filterActive: btn("#fef3c7", "#92400e"),
  tableWrap: { overflowX: "auto", borderRadius: 18, border: "1px solid #e5e7eb" },
  table: { width: "100%", minWidth: 980, borderCollapse: "collapse" },
  th: {
    padding: "12px 10px",
    background: "#f8fafc",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 900,
    color: "#475569",
    whiteSpace: "nowrap",
  },
  td: { padding: "12px 10px", borderTop: "1px solid #f1f5f9", fontWeight: 700 },
  empty: { textAlign: "center", padding: 28, color: "#64748b" },
  empCell: { display: "flex", gap: 10, alignItems: "center" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    background: "#dbeafe",
    color: "#1e3a8a",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },
  empName: {
    fontWeight: 900,
    maxWidth: 170,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  empSub: {
    color: "#94a3b8",
    fontSize: 12,
    maxWidth: 170,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  gasBadge: { background: "#f1f5f9", borderRadius: 999, padding: "6px 10px", fontSize: 12 },
  status: { background: "#dcfce7", color: "#166534", borderRadius: 999, padding: "6px 10px", fontSize: 12 },
  progressText: { fontSize: 12, fontWeight: 900 },
  progress: { width: 105, height: 8, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%" },
  badges: { display: "flex", gap: 5, flexWrap: "wrap", maxWidth: 170 },
  badge: { background: "#fee2e2", color: "#991b1b", borderRadius: 999, padding: "4px 8px", fontSize: 11 },
  more: { background: "#fef3c7", color: "#92400e", borderRadius: 999, padding: "4px 8px", fontSize: 11 },
  complete: { background: "#dcfce7", color: "#166534", borderRadius: 999, padding: "6px 10px", fontSize: 12 },
  manageBtn: btn("#2563eb", "#fff"),
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 999,
  },
  modal: {
    width: "100%",
    maxWidth: 980,
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 26,
    padding: 22,
  },
  modalHeader: { display: "flex", justifyContent: "space-between", gap: 12 },
  modalUser: { display: "flex", alignItems: "center", gap: 12 },
  modalAvatar: {
    width: 54,
    height: 54,
    borderRadius: 18,
    background: "#2563eb",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },
  modalTitle: { margin: 0 },
  modalSub: { margin: "4px 0 0", color: "#64748b" },
  closeBtn: { border: "none", background: "#f1f5f9", borderRadius: 12, width: 38, height: 38 },
  tabs: { display: "flex", gap: 8, margin: "18px 0", flexWrap: "wrap" },
  tab: btn("#f1f5f9", "#334155"),
  tabActive: btn("#2563eb", "#fff"),
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 },
  field: { display: "grid", gap: 6, fontWeight: 800, fontSize: 13 },
  input: { height: 44, border: "1px solid #e5e7eb", borderRadius: 12, padding: "0 12px" },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  cancelBtn: btn("#f1f5f9", "#334155"),
  saveBtn: btn("#16a34a", "#fff"),
  uploadBox: { display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 10, alignItems: "center" },
  filePicker: {
    height: 44,
    border: "1px dashed #93c5fd",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
    color: "#1d4ed8",
    background: "#eff6ff",
    fontWeight: 800,
  },
  docsGrid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 },
  docCard: { border: "1px solid #e5e7eb", borderRadius: 18, padding: 14 },
  docTitle: { fontWeight: 900, marginTop: 8 },
  docName: { color: "#64748b", fontSize: 13, wordBreak: "break-word" },
  docDate: { color: "#94a3b8", fontSize: 12, marginTop: 6 },
  docActions: { display: "flex", gap: 8, marginTop: 12 },
  previewBtn: btn("#eff6ff", "#1d4ed8"),
  downloadBtn: btn("#f0fdf4", "#15803d"),
  emptyDoc: { gridColumn: "1 / -1", textAlign: "center", padding: 20, color: "#64748b" },
  textarea: { width: "100%", minHeight: 140, border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 },
};

function btn(bg, color) {
  return {
    border: "none",
    background: bg,
    color,
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  };
}
