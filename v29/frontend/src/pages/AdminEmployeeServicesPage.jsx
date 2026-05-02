import { useEffect, useMemo, useState } from "react";
import { apiFetch, API_BASE } from "../services/api";
import {
  Search,
  Download,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UploadCloud,
  Eye,
  Send,
  X,
  UserRound,
  Briefcase,
  ShieldCheck,
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

export default function AdminEmployeeServicesPage() {
  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
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
    setActiveTab("overview");
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

  function completionColor(value) {
    if (value >= 90) return "#16a34a";
    if (value >= 60) return "#f59e0b";
    return "#dc2626";
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const text = `${emp.full_name || ""} ${emp.gas_id || ""} ${emp.project_name || ""} ${emp.job_title || ""}`.toLowerCase();
      const matchSearch = text.includes(search.toLowerCase());
      const missing = getMissingFields(emp).length > 0;
      return matchSearch && (!onlyMissing || missing);
    });
  }, [employees, search, onlyMissing]);

  const stats = useMemo(() => {
    const total = employees.length;
    const complete = employees.filter((e) => getCompletion(e) === 100).length;
    const missing = employees.filter((e) => getCompletion(e) < 100).length;
    const avg = total
      ? Math.round(employees.reduce((sum, e) => sum + getCompletion(e), 0) / total)
      : 0;

    return { total, complete, missing, avg };
  }, [employees]);

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
      console.error("SAVE EMPLOYEE ERROR:", err);
      alert("Failed to save employee");
    }
  }

  async function exportExcel() {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const res = await fetch(`${API_BASE}/admin/employees/export`, {
        headers: { Authorization: `Bearer ${token}` },
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

      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const formData = new FormData();

      formData.append("document_type", docType);
      formData.append("file", docFile);

      const res = await fetch(`${API_BASE}/admin/employees/${selected.id}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
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
      console.error("UPLOAD DOCUMENT ERROR:", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function openDocument(docId) {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const res = await fetch(`${API_BASE}/admin/employees/documents/${docId}/view`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        alert("Cannot open document");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      window.open(url, "_blank");
    } catch (err) {
      console.error("OPEN DOCUMENT ERROR:", err);
      alert("Cannot open document");
    }
  }

  async function downloadDocument(docId, fileName) {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const res = await fetch(`${API_BASE}/admin/employees/documents/${docId}/view?download=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        alert("Download failed");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = fileName || "file";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("DOWNLOAD ERROR:", err);
      alert("Download failed");
    }
  }

  async function sendRequestUpdate() {
    if (!selected?.id) return;

    try {
      await apiFetch(`/admin/employees/${selected.id}/request-update`, {
        method: "POST",
        body: JSON.stringify({ message: requestMessage }),
      });

      alert("Update request sent successfully");
    } catch (err) {
      console.error("REQUEST UPDATE ERROR:", err);
      alert("Failed to send request");
    }
  }

  const selectedCompletion = selected ? getCompletion(selected) : 0;
  const selectedMissing = selected ? getMissingFields(selected) : [];

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>HR OPERATIONS</div>
          <h1 style={styles.title}>Employee Services Center</h1>
          <p style={styles.subtitle}>
            إدارة بيانات الموظفين، استكمال النواقص، رفع المستندات، وإصدار التقارير من مكان واحد.
          </p>
        </div>

        <div style={styles.heroActions}>
          <button style={styles.secondaryBtn} onClick={loadEmployees}>
            <RefreshCw size={17} />
            Refresh
          </button>

          <button style={styles.primaryBtn} onClick={exportExcel}>
            <Download size={17} />
            Export Excel
          </button>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatCard icon={<Users size={22} />} label="Total Employees" value={stats.total} tone="blue" />
        <StatCard icon={<CheckCircle2 size={22} />} label="Completed Files" value={stats.complete} tone="green" />
        <StatCard icon={<AlertTriangle size={22} />} label="Missing Data" value={stats.missing} tone="amber" />
        <StatCard icon={<ShieldCheck size={22} />} label="Average Completion" value={`${stats.avg}%`} tone="dark" />
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
            style={onlyMissing ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => setOnlyMissing((v) => !v)}
          >
            <AlertTriangle size={16} />
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
                <th style={styles.th}>Job Title</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Completion</th>
                <th style={styles.th}>Missing</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td style={styles.emptyTd} colSpan="8">Loading employees...</td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td style={styles.emptyTd} colSpan="8">No employees found.</td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const completion = getCompletion(emp);
                  const missing = getMissingFields(emp);
                  const color = completionColor(completion);

                  return (
                    <tr key={emp.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.employeeCell}>
                          <div style={styles.avatar}>{getInitials(emp.full_name)}</div>
                          <div>
                            <div style={styles.empName}>{emp.full_name || "-"}</div>
                            <div style={styles.empSub}>{emp.email || "No email"}</div>
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.codeBadge}>{emp.gas_id || "-"}</span>
                      </td>

                      <td style={styles.td}>{emp.project_name || "-"}</td>
                      <td style={styles.td}>{emp.job_title || "-"}</td>

                      <td style={styles.td}>
                        <span style={getStatusStyle(emp.status)}>{emp.status || "Active"}</span>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.progressLine}>
                          <span style={{ ...styles.progressValue, color }}>{completion}%</span>
                          <div style={styles.progress}>
                            <div style={{ ...styles.progressBar, width: `${completion}%`, background: color }} />
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        {missing.length ? (
                          <div style={styles.badges}>
                            {missing.slice(0, 3).map((m) => (
                              <span key={m.key} style={styles.badge}>{m.label}</span>
                            ))}
                            {missing.length > 3 && <span style={styles.badgeMore}>+{missing.length - 3}</span>}
                          </div>
                        ) : (
                          <span style={styles.completePill}>Complete</span>
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
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalTop}>
              <div style={styles.modalProfile}>
                <div style={styles.modalAvatar}>{getInitials(selected.full_name)}</div>
                <div>
                  <h2 style={styles.modalTitle}>{selected.full_name || "-"}</h2>
                  <p style={styles.modalSub}>
                    GAS ID: {selected.gas_id || "-"} · {selected.job_title || "-"} · {selected.project_name || "-"}
                  </p>
                </div>
              </div>

              <button style={styles.closeBtn} onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.modalSummary}>
              <MiniMetric label="Completion" value={`${selectedCompletion}%`} color={completionColor(selectedCompletion)} />
              <MiniMetric label="Missing Fields" value={selectedMissing.length} color="#f59e0b" />
              <MiniMetric label="Documents" value={documents.length} color="#2563eb" />
            </div>

            <div style={styles.tabs}>
              <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")} icon={<UserRound size={16} />} label="Overview" />
              <TabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")} icon={<Briefcase size={16} />} label="Profile Data" />
              <TabButton active={activeTab === "documents"} onClick={() => setActiveTab("documents")} icon={<FileText size={16} />} label="Documents Vault" />
              <TabButton active={activeTab === "request"} onClick={() => setActiveTab("request")} icon={<Send size={16} />} label="Request Update" />
            </div>

            {activeTab === "overview" && (
              <div style={styles.overviewGrid}>
                <InfoTile label="Phone" value={selected.phone} />
                <InfoTile label="Email" value={selected.email} />
                <InfoTile label="ID / Iqama" value={selected.id_number} />
                <InfoTile label="Join Date" value={formatDate(selected.join_date)} />
                <InfoTile label="Address" value={selected.address} wide />
                <InfoTile label="Sabul Address" value={selected.sabul_short_address} />
                <InfoTile label="Education" value={selected.education} />
                <InfoTile label="Emergency Contact" value={selected.emergency_contact} />
              </div>
            )}

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

                <div style={styles.modalActions}>
                  <button style={styles.cancelBtn} onClick={() => setSelected(null)}>Cancel</button>
                  <button style={styles.saveBtn} onClick={saveEmployee}>Save Changes</button>
                </div>
              </>
            )}

            {activeTab === "documents" && (
              <div>
                <div style={styles.uploadBox}>
                  <div>
                    <div style={styles.sectionTitle}>Upload Employee Document</div>
                    <div style={styles.sectionSub}>ID, contract, certificates, CV, or other HR documents.</div>
                  </div>

                  <select style={styles.input} value={docType} onChange={(e) => setDocType(e.target.value)}>
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>

                  <label style={styles.filePicker}>
                    <UploadCloud size={18} />
                    <span>{docFile ? docFile.name : "Choose file"}</span>
                    <input
                      type="file"
                      style={{ display: "none" }}
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    />
                  </label>

                  <button style={styles.saveBtn} onClick={uploadDocument} disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>

                <div style={styles.docsGrid}>
                  {documents.length === 0 ? (
                    <div style={styles.emptyBox}>No documents uploaded for this employee.</div>
                  ) : (
                    documents.map((doc) => (
                      <div key={doc.id} style={styles.docCard}>
                        <div style={styles.docIcon}><FileText size={22} /></div>
                        <div style={styles.docTitle}>{formatDocType(doc.document_type)}</div>
                        <div style={styles.docName}>{doc.file_name}</div>
                        <div style={styles.docMeta}>Uploaded: {formatDate(doc.uploaded_at)}</div>

                        <div style={styles.docActions}>
                          <button style={styles.previewBtn} onClick={() => openDocument(doc.id)}>
                            <Eye size={15} />
                            Preview
                          </button>

                          <button style={styles.downloadBtn} onClick={() => downloadDocument(doc.id, doc.file_name)}>
                            <Download size={15} />
                            Download
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "request" && (
              <div style={styles.requestBox}>
                <div>
                  <div style={styles.sectionTitle}>Request Data Update</div>
                  <div style={styles.sectionSub}>
                    Send a notification to the employee to update missing profile information.
                  </div>
                </div>

                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Message to Employee</span>
                  <textarea
                    style={styles.textarea}
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                  />
                </label>

                <div style={styles.infoBox}>
                  The employee will receive this request in their notifications page.
                </div>

                <div style={styles.modalActions}>
                  <button style={styles.saveBtn} onClick={sendRequestUpdate}>
                    Send Request
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

function StatCard({ icon, label, value, tone }) {
  const tones = {
    blue: ["#eff6ff", "#2563eb"],
    green: ["#f0fdf4", "#16a34a"],
    amber: ["#fffbeb", "#f59e0b"],
    dark: ["#f8fafc", "#111827"],
  };
  const [bg, color] = tones[tone] || tones.blue;

  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, background: bg, color }}>{icon}</div>
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button style={active ? styles.tabActive : styles.tab} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function MiniMetric({ label, value, color }) {
  return (
    <div style={styles.miniMetric}>
      <div style={{ ...styles.miniValue, color }}>{value}</div>
      <div style={styles.miniLabel}>{label}</div>
    </div>
  );
}

function InfoTile({ label, value, wide }) {
  return (
    <div style={{ ...styles.infoTile, gridColumn: wide ? "span 2" : "auto" }}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value || "-"}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <input type={type} style={styles.input} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function formatDocType(value) {
  const item = DOC_TYPES.find((d) => d.value === value);
  return item?.label || value || "Document";
}

function getInitials(name) {
  const clean = String(name || "").trim();
  if (!clean) return "E";
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "E";
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function getStatusStyle(status) {
  const active = String(status || "Active").toLowerCase() === "active";
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    background: active ? "#dcfce7" : "#fee2e2",
    color: active ? "#166534" : "#991b1b",
  };
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top right, rgba(37,99,235,0.12), transparent 32%), linear-gradient(135deg,#f8fafc 0%,#eef2f7 100%)",
    padding: 22,
    fontFamily: "Segoe UI, Arial, sans-serif",
    color: "#111827",
  },
  hero: {
    background: "linear-gradient(135deg,#0f172a,#1e3a8a 58%,#2563eb)",
    color: "#fff",
    borderRadius: 28,
    padding: 26,
    marginBottom: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "center",
    boxShadow: "0 24px 55px rgba(15,23,42,0.22)",
  },
  eyebrow: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.16em",
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#dbeafe",
    maxWidth: 720,
    lineHeight: 1.6,
    fontWeight: 650,
  },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryBtn: {
    border: "none",
    background: "#fff",
    color: "#1d4ed8",
    padding: "12px 16px",
    borderRadius: 14,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    boxShadow: "0 12px 28px rgba(0,0,0,0.15)",
  },
  secondaryBtn: {
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 14,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 14,
    marginBottom: 16,
  },
  statCard: {
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.9)",
    borderRadius: 22,
    padding: 18,
    display: "flex",
    gap: 14,
    alignItems: "center",
    boxShadow: "0 16px 38px rgba(15,23,42,0.08)",
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  statLabel: {
    color: "#64748b",
    fontWeight: 850,
    marginTop: 2,
  },
  panel: {
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(226,232,240,0.9)",
    borderRadius: 26,
    padding: 16,
    boxShadow: "0 18px 48px rgba(15,23,42,0.08)",
  },
  toolbar: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
    flexWrap: "wrap",
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    minHeight: 46,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#f8fafc",
    color: "#64748b",
  },
  searchInput: {
    border: "none",
    outline: "none",
    background: "transparent",
    width: "100%",
    fontSize: 14,
    fontWeight: 700,
    color: "#111827",
  },
  filterBtn: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    padding: "12px 14px",
    borderRadius: 14,
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
  },
  filterBtnActive: {
    border: "1px solid #f59e0b",
    background: "#fffbeb",
    color: "#92400e",
    padding: "12px 14px",
    borderRadius: 14,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: 20,
    border: "1px solid #e5e7eb",
  },
  table: {
    width: "100%",
    minWidth: 1180,
    borderCollapse: "separate",
    borderSpacing: 0,
    background: "#fff",
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    background: "#f8fafc",
    color: "#475569",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },
  tr: {
    transition: "0.18s ease",
  },
  td: {
    padding: "15px 16px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
    color: "#334155",
    fontWeight: 700,
  },
  emptyTd: {
    padding: 28,
    textAlign: "center",
    color: "#64748b",
    fontWeight: 850,
  },
  employeeCell: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,#dbeafe,#bfdbfe)",
    color: "#1e3a8a",
    fontWeight: 950,
  },
  empName: {
    fontWeight: 950,
    color: "#0f172a",
  },
  empSub: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 3,
    fontWeight: 750,
  },
  codeBadge: {
    background: "#f1f5f9",
    color: "#334155",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
  },
  progressLine: {
    display: "grid",
    gap: 6,
    width: 140,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: 950,
  },
  progress: {
    height: 9,
    background: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 999,
  },
  badges: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    maxWidth: 230,
  },
  badge: {
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 900,
  },
  badgeMore: {
    background: "#fef3c7",
    color: "#92400e",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 900,
  },
  completePill: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
  },
  manageBtn: {
    border: "none",
    background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 13,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(37,99,235,0.24)",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.62)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 999,
  },
  modal: {
    width: "100%",
    maxWidth: 1060,
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 30,
    padding: 22,
    boxShadow: "0 32px 85px rgba(0,0,0,0.35)",
  },
  modalTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
  },
  modalProfile: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  modalAvatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,#1e3a8a,#2563eb)",
    color: "#fff",
    fontSize: 18,
    fontWeight: 950,
    boxShadow: "0 14px 28px rgba(37,99,235,0.26)",
  },
  modalTitle: {
    margin: 0,
    fontSize: 24,
    fontWeight: 950,
    color: "#0f172a",
  },
  modalSub: {
    margin: "6px 0 0",
    color: "#64748b",
    fontWeight: 750,
  },
  closeBtn: {
    border: "none",
    background: "#f1f5f9",
    color: "#0f172a",
    width: 40,
    height: 40,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
  modalSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: 12,
    marginTop: 18,
  },
  miniMetric: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 14,
  },
  miniValue: {
    fontSize: 24,
    fontWeight: 950,
  },
  miniLabel: {
    color: "#64748b",
    fontWeight: 850,
    marginTop: 4,
  },
  tabs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    background: "#f8fafc",
    padding: 8,
    borderRadius: 18,
    marginTop: 18,
    marginBottom: 18,
    border: "1px solid #e5e7eb",
  },
  tab: {
    border: "none",
    background: "transparent",
    color: "#475569",
    padding: "10px 13px",
    borderRadius: 13,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    gap: 7,
    alignItems: "center",
  },
  tabActive: {
    border: "none",
    background: "#fff",
    color: "#1d4ed8",
    padding: "10px 13px",
    borderRadius: 13,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    gap: 7,
    alignItems: "center",
    boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
  },
  overviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 12,
  },
  infoTile: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 14,
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  infoValue: {
    marginTop: 7,
    color: "#0f172a",
    fontWeight: 900,
    wordBreak: "break-word",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
    gap: 14,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 900,
    color: "#334155",
  },
  input: {
    minHeight: 44,
    padding: "0 13px",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    outline: "none",
    background: "#fff",
    fontWeight: 750,
    color: "#111827",
  },
  textarea: {
    minHeight: 150,
    padding: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    outline: "none",
    resize: "vertical",
    fontFamily: "Segoe UI, Arial, sans-serif",
    fontWeight: 750,
    lineHeight: 1.6,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    border: "none",
    background: "#f1f5f9",
    color: "#334155",
    padding: "12px 16px",
    borderRadius: 14,
    fontWeight: 950,
    cursor: "pointer",
  },
  saveBtn: {
    border: "none",
    background: "linear-gradient(135deg,#16a34a,#15803d)",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 14,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBox: {
    display: "grid",
    gridTemplateColumns: "1.4fr 180px 1fr auto",
    gap: 12,
    alignItems: "center",
    background: "#f8fafc",
    padding: 16,
    borderRadius: 20,
    border: "1px solid #e5e7eb",
  },
  sectionTitle: {
    color: "#0f172a",
    fontWeight: 950,
    fontSize: 15,
  },
  sectionSub: {
    color: "#64748b",
    fontWeight: 750,
    fontSize: 13,
    marginTop: 4,
  },
  filePicker: {
    minHeight: 44,
    border: "1px dashed #93c5fd",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 14,
    padding: "0 12px",
    display: "flex",
    gap: 8,
    alignItems: "center",
    cursor: "pointer",
    fontWeight: 900,
    overflow: "hidden",
  },
  docsGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
    gap: 14,
  },
  docCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
  },
  docIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "#eff6ff",
    color: "#1d4ed8",
    marginBottom: 12,
  },
  docTitle: {
    fontWeight: 950,
    color: "#0f172a",
  },
  docName: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 750,
    wordBreak: "break-word",
  },
  docMeta: {
    marginTop: 8,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
  },
  docActions: {
    display: "flex",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap",
  },
  previewBtn: {
    border: "none",
    background: "#eff6ff",
    color: "#1d4ed8",
    padding: "9px 10px",
    borderRadius: 12,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
  },
  downloadBtn: {
    border: "none",
    background: "#f0fdf4",
    color: "#15803d",
    padding: "9px 10px",
    borderRadius: 12,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
  },
  emptyBox: {
    gridColumn: "1 / -1",
    padding: 22,
    background: "#f8fafc",
    borderRadius: 18,
    color: "#64748b",
    border: "1px dashed #cbd5e1",
    textAlign: "center",
    fontWeight: 850,
  },
  requestBox: {
    display: "grid",
    gap: 16,
  },
  infoBox: {
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: 14,
    borderRadius: 16,
    fontWeight: 850,
    border: "1px solid #bfdbfe",
  },
};
