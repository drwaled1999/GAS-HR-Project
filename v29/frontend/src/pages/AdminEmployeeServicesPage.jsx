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
  ClipboardCheck,
  FolderOpen,
  UserRound,
  Briefcase,
  Building2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const REQUIRED_FIELDS = [
  { key: "full_name", label: "Name" },
  { key: "gas_id", label: "GAS ID" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "id_number", label: "ID Number" },
  { key: "join_date", label: "Join Date" },
  { key: "address", label: "Address" },
  { key: "sabul_short_address", label: "Sabul Short Address" },
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

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

function fieldLabel(key) {
  return REQUIRED_FIELDS.find((f) => f.key === key)?.label || key;
}

function getFileName(att) {
  return att?.file_name || att?.filename || "document.pdf";
}

export default function AdminEmployeeServicesPage() {
  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [updateRequests, setUpdateRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [docType, setDocType] = useState("id");
  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [requestMessage, setRequestMessage] = useState(
    "Please update your missing employee profile information."
  );

  useEffect(() => {
    loadEmployees();
    loadUpdateRequests();
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

  async function loadUpdateRequests() {
    try {
      setLoadingRequests(true);
      const data = await apiFetch("/admin/employees/data-update-requests/list");
      setUpdateRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("LOAD UPDATE REQUESTS ERROR:", err);
      setUpdateRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }

  function getMissingFields(emp) {
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

  function getRequestAttachments(req) {
    let data = req?.submitted_data || {};

    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }

    if (Array.isArray(data.__attachments)) return data.__attachments;
    if (Array.isArray(data.attachments)) return data.attachments;

    return [];
  }

  function hasActiveRequestForEmployee(employeeId) {
    return updateRequests.some(
      (r) =>
        r.employee_id === employeeId &&
        ["pending_employee", "needs_correction", "submitted"].includes(r.status)
    );
  }

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const text = `${e.full_name || ""} ${e.gas_id || ""} ${
        e.project_name || ""
      } ${e.job_title || ""}`.toLowerCase();

      const match = text.includes(search.toLowerCase());
      const missing = getMissingFields(e).length > 0;

      return match && (!onlyMissing || missing);
    });
  }, [employees, search, onlyMissing]);

  const stats = useMemo(() => {
    const total = employees.length;
    const complete = employees.filter((e) => getCompletion(e) === 100).length;
    const missing = total - complete;
    const submitted = updateRequests.filter((r) => r.status === "submitted").length;

    return { total, complete, missing, submitted };
  }, [employees, updateRequests]);

  function openEmployee(emp) {
    setSelected(emp);
    setActiveTab("profile");
    setDocFile(null);
    loadDocuments(emp.id);
  }

  async function saveEmployee() {
    if (!selected?.id) return;

    try {
      const payload = {
        phone: selected.phone || "",
        email: selected.email || "",
        id_number: selected.id_number || "",
        join_date: selected.join_date || null,
        address: selected.address || "",
        sabul_short_address: selected.sabul_short_address || "",
        education: selected.education || "",
        emergency_contact: selected.emergency_contact || "",
        status: selected.status || "Active",
      };

      await apiFetch(`/admin/employees/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
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

      if (!res.ok) return alert("Export failed");

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

  function validateAdminFile(file) {
    if (!file) return "Please select a PDF file.";

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) return "Only PDF files are allowed.";
    if (file.size > MAX_FILE_SIZE) return "File size must be less than 10MB.";

    return "";
  }

  async function uploadDocument() {
    if (!selected?.id) return;
    if (uploading) return;

    const error = validateAdminFile(docFile);
    if (error) return alert(error);

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

      if (!res.ok) throw new Error("Upload failed");

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

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60000);
    } catch (err) {
      console.error("OPEN DOCUMENT ERROR:", err);
      alert("Cannot open document");
    }
  }

  async function downloadDocument(docId, fileName) {
    try {
      const res = await fetch(
        `${API_BASE}/admin/employees/documents/${docId}/view?download=1`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );

      if (!res.ok) return alert("Download failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = fileName || "file.pdf";
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("DOWNLOAD ERROR:", err);
      alert("Download failed");
    }
  }

  async function openUpdateAttachment(att, download = false) {
    try {
      if (!att?.public_id) {
        return alert("Attachment public_id is missing. Please re-upload the file.");
      }

      const params = new URLSearchParams({
        public_id: att.public_id || "",
        filename: getFileName(att),
      });

      if (download) params.set("download", "1");

      const res = await fetch(
        `${API_BASE}/admin/employees/data-update-attachments/view?${params}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!res.ok) {
        return alert(download ? "Download failed" : "Cannot open attachment");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      if (download) {
        const a = document.createElement("a");
        a.href = url;
        a.download = getFileName(att);
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        window.open(url, "_blank");
      }

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60000);
    } catch (err) {
      console.error("OPEN UPDATE ATTACHMENT ERROR:", err);
      alert(download ? "Download failed" : "Cannot open attachment");
    }
  }

  async function sendNormalNotification() {
    if (!selected?.id) return;

    try {
      await apiFetch(`/admin/employees/${selected.id}/request-update`, {
        method: "POST",
        body: JSON.stringify({ message: requestMessage }),
      });

      alert("Notification sent successfully");
    } catch (err) {
      console.error("SEND NOTIFICATION ERROR:", err);
      alert("Failed to send notification");
    }
  }

  async function sendSmartDataUpdateRequest() {
    if (!selected) return;

    if (hasActiveRequestForEmployee(selected.id)) {
      alert("Employee already has an active data update request. Please review it first.");
      return;
    }

    const missingFields = getMissingFields(selected);

    if (!missingFields.length) {
      alert("This employee has no missing fields.");
      return;
    }

    const approved = window.confirm(
      `Send data update request to employee for these missing fields?\n\n${missingFields
        .map((f) => `- ${f.label}`)
        .join("\n")}`
    );

    if (!approved) return;

    try {
      await apiFetch(`/admin/employees/${selected.id}/data-update-request`, {
        method: "POST",
        body: JSON.stringify({
          requested_fields: missingFields.map((f) => f.key),
          message: `Please complete the following missing fields: ${missingFields
            .map((f) => f.label)
            .join(", ")}`,
        }),
      });

      await loadUpdateRequests();
      alert("Smart data update request sent successfully.");
    } catch (err) {
      console.error("SMART REQUEST ERROR:", err);
      alert(err?.message || "Failed to send smart data update request");
    }
  }

  async function approveRequest(id) {
    try {
      const note = window.prompt("HR note:", "Approved by HR") || "Approved by HR";

      await apiFetch(`/admin/employees/data-update-requests/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ hr_note: note }),
      });

      alert("Request approved and employee data updated successfully.");
      await loadUpdateRequests();
      await loadEmployees();
    } catch (err) {
      console.error("APPROVE REQUEST ERROR:", err);
      alert("Failed to approve request");
    }
  }

  async function sendBackRequest(id) {
    try {
      const note =
        window.prompt("Correction note:", "Please correct the submitted information.") ||
        "Please correct the submitted information.";

      await apiFetch(`/admin/employees/data-update-requests/${id}/review`, {
        method: "POST",
        body: JSON.stringify({
          status: "needs_correction",
          hr_note: note,
        }),
      });

      alert("Request sent back for correction.");
      await loadUpdateRequests();
    } catch (err) {
      console.error("SEND BACK REQUEST ERROR:", err);
      alert("Failed to send back request");
    }
  }

  async function rejectRequest(id) {
    try {
      const note = window.prompt("Reject reason:", "Rejected by HR") || "Rejected by HR";

      await apiFetch(`/admin/employees/data-update-requests/${id}/review`, {
        method: "POST",
        body: JSON.stringify({
          status: "rejected",
          hr_note: note,
        }),
      });

      alert("Request rejected.");
      await loadUpdateRequests();
    } catch (err) {
      console.error("REJECT REQUEST ERROR:", err);
      alert("Failed to reject request");
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.topGlow} />

      <section style={styles.hero}>
        <div style={styles.heroLeft}>
          <div style={styles.heroBadge}>
            <Sparkles size={15} />
            Enterprise HR Operations
          </div>

          <h1 style={styles.title}>Employee Services Center</h1>

          <p style={styles.subtitle}>
            مركز تحكم احترافي لإدارة بيانات الموظفين، مراجعة طلبات تحديث البيانات،
            المستندات، واستكمال النواقص بطريقة منظمة وآمنة.
          </p>

          <div style={styles.heroMiniGrid}>
            <Mini icon={<ShieldCheck size={16} />} label="Secure Records" />
            <Mini icon={<FolderOpen size={16} />} label="Cloud Documents" />
            <Mini icon={<ClipboardCheck size={16} />} label="HR Review Flow" />
          </div>
        </div>

        <div style={styles.heroActions}>
          <button style={styles.heroBtn} onClick={loadUpdateRequests}>
            <RefreshCw size={16} /> Update Requests
          </button>
          <button style={styles.heroBtn} onClick={loadEmployees}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button style={styles.exportBtn} onClick={exportExcel}>
            <Download size={16} /> Export Excel
          </button>
        </div>
      </section>

      <div style={styles.stats}>
        <Stat icon={<Users />} label="Total Employees" value={stats.total} tone="blue" />
        <Stat icon={<CheckCircle2 />} label="Completed Files" value={stats.complete} tone="green" />
        <Stat icon={<AlertTriangle />} label="Missing Data" value={stats.missing} tone="amber" />
        <Stat icon={<ClipboardCheck />} label="Pending HR Review" value={stats.submitted} tone="purple" />
      </div>

      <section style={styles.section}>
        <SectionHeader
          title="Profile Update Requests"
          subtitle="طلبات تحديث بيانات الموظفين المرسلة من الموظف وتنتظر مراجعة الإدارة."
          action={
            <button style={styles.lightBtn} onClick={loadUpdateRequests}>
              <RefreshCw size={16} /> Refresh
            </button>
          }
        />

        {loadingRequests ? (
          <div style={styles.empty}>Loading requests...</div>
        ) : updateRequests.length === 0 ? (
          <div style={styles.empty}>No profile update requests found.</div>
        ) : (
          <div style={styles.requestsGrid}>
            {updateRequests.map((req) => {
              const fields = Array.isArray(req.requested_fields)
                ? req.requested_fields
                : [];
              const attachments = getRequestAttachments(req);

              return (
                <article key={req.id} style={styles.requestCard}>
                  <div style={styles.requestTop}>
                    <div style={styles.empCell}>
                      <div style={styles.avatar}>{initials(req.full_name)}</div>
                      <div>
                        <div style={styles.empName}>{req.full_name || "-"}</div>
                        <div style={styles.empSub}>
                          GAS ID: {req.gas_id || "-"} · {req.project_name || "-"}
                        </div>
                      </div>
                    </div>

                    <span style={statusStyle(req.status)}>{req.status || "-"}</span>
                  </div>

                  <div style={styles.infoGrid}>
                    <Info label="Created" value={formatDate(req.created_at)} />
                    <Info label="Job Title" value={req.job_title || "-"} />
                    <Info label="Attachments" value={attachments.length} />
                  </div>

                  <div style={styles.block}>
                    <div style={styles.blockTitle}>Requested Fields</div>
                    <div style={styles.chips}>
                      {fields.length ? (
                        fields.map((f) => (
                          <span key={f} style={styles.blueChip}>
                            {fieldLabel(f)}
                          </span>
                        ))
                      ) : (
                        <span style={styles.muted}>No fields</span>
                      )}
                    </div>
                  </div>

                  <div style={styles.block}>
                    <div style={styles.blockTitle}>Attachments</div>

                    {attachments.length ? (
                      <div style={styles.attachGrid}>
                        {attachments.map((att, index) => (
                          <div
                            key={`${att.public_id || att.file_url || att.url || index}`}
                            style={styles.attachCard}
                          >
                            <div style={styles.attachIcon}>
                              <FileText size={18} />
                            </div>

                            <div style={{ flex: 1, minWidth: 180 }}>
                              <strong>{att.label || "Attachment"}</strong>
                              <span>{getFileName(att)}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => openUpdateAttachment(att, false)}
                              style={styles.previewBtn}
                            >
                              <Eye size={15} /> Preview
                            </button>

                            <button
                              type="button"
                              onClick={() => openUpdateAttachment(att, true)}
                              style={styles.downloadBtn}
                            >
                              <Download size={15} /> Download
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={styles.noAttach}>No attachments uploaded</div>
                    )}
                  </div>

                  <div style={styles.cardFooter}>
                    {req.status === "submitted" ? (
                      <>
                        <button style={styles.approveBtn} onClick={() => approveRequest(req.id)}>
                          Approve
                        </button>
                        <button style={styles.correctionBtn} onClick={() => sendBackRequest(req.id)}>
                          Correction
                        </button>
                        <button style={styles.rejectBtn} onClick={() => rejectRequest(req.id)}>
                          Reject
                        </button>
                      </>
                    ) : (
                      <span style={styles.muted}>No action required</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <SectionHeader
          title="Employee Master Data"
          subtitle="استعراض بيانات الموظفين، نسبة اكتمال الملف، والمستندات."
        />

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
            style={onlyMissing ? styles.filterActive : styles.lightBtn}
            onClick={() => setOnlyMissing((v) => !v)}
          >
            Missing data only
          </button>
        </div>

        {loading ? (
          <div style={styles.empty}>Loading employees...</div>
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>No employees found.</div>
        ) : (
          <div style={styles.employeeGrid}>
            {filtered.map((emp) => {
              const completion = getCompletion(emp);
              const missing = getMissingFields(emp);
              const color = colorByCompletion(completion);
              const activeReq = hasActiveRequestForEmployee(emp.id);

              return (
                <article key={emp.id} style={styles.employeeCard}>
                  <div style={styles.employeeHead}>
                    <div style={styles.empCell}>
                      <div style={styles.avatar}>{initials(emp.full_name)}</div>
                      <div>
                        <div style={styles.empName}>{emp.full_name || "-"}</div>
                        <div style={styles.empSub}>{emp.email || "No email"}</div>
                      </div>
                    </div>

                    <span style={styles.gasBadge}>{emp.gas_id || "-"}</span>
                  </div>

                  <div style={styles.empMeta}>
                    <Info label="Project" value={emp.project_name || "-"} />
                    <Info label="Job Title" value={emp.job_title || "-"} />
                    <Info label="Status" value={emp.status || "Active"} />
                  </div>

                  <div style={styles.progressRow}>
                    <div style={styles.progressHeader}>
                      <strong>{completion}%</strong>
                      <span>Completed</span>
                    </div>
                    <div style={styles.progress}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${completion}%`,
                          background: color,
                        }}
                      />
                    </div>
                  </div>

                  <div style={styles.block}>
                    <div style={styles.blockTitle}>Missing Fields</div>

                    {missing.length ? (
                      <div style={styles.chips}>
                        {missing.slice(0, 5).map((m) => (
                          <span key={m.key} style={styles.redChip}>
                            {m.label}
                          </span>
                        ))}
                        {missing.length > 5 && (
                          <span style={styles.more}>+{missing.length - 5}</span>
                        )}
                      </div>
                    ) : (
                      <span style={styles.complete}>Complete</span>
                    )}
                  </div>

                  {activeReq ? (
                    <div style={styles.activeRequestNote}>
                      Active update request exists
                    </div>
                  ) : null}

                  <button style={styles.manageBtn} onClick={() => openEmployee(emp)}>
                    <UserRound size={16} /> Manage Employee
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div style={styles.modalUser}>
                <div style={styles.modalAvatar}>{initials(selected.full_name)}</div>
                <div>
                  <h2 style={styles.modalTitle}>{selected.full_name}</h2>
                  <p style={styles.modalSub}>
                    GAS ID: {selected.gas_id || "-"} · {selected.project_name || "-"}
                  </p>
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
                  {tab === "profile"
                    ? "Profile Data"
                    : tab === "documents"
                    ? "Documents Vault"
                    : "Request Update"}
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
                  <button style={styles.cancelBtn} onClick={() => setSelected(null)}>
                    Cancel
                  </button>
                  <button style={styles.saveBtn} onClick={saveEmployee}>
                    Save Changes
                  </button>
                </div>
              </>
            )}

            {activeTab === "documents" && (
              <>
                <div style={styles.dropZone}>
                  <FolderOpen size={26} />
                  <strong>{docFile ? docFile.name : "Employee Document Vault"}</strong>
                  <span>Upload employee documents as PDF only. Files are stored securely in Cloudinary.</span>
                </div>

                <div style={styles.uploadBox}>
                  <select style={styles.input} value={docType} onChange={(e) => setDocType(e.target.value)}>
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>

                  <label style={styles.filePicker}>
                    <UploadCloud size={18} />
                    {docFile ? docFile.name : "Choose PDF"}
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      hidden
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    />
                  </label>

                  <button
                    style={{
                      ...styles.saveBtn,
                      opacity: uploading ? 0.7 : 1,
                      cursor: uploading ? "not-allowed" : "pointer",
                    }}
                    onClick={uploadDocument}
                    disabled={uploading}
                  >
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

                        <select
                          style={styles.docSelect}
                          value={doc.document_type || "other"}
                          onChange={async (e) => {
                            await apiFetch(`/admin/employees/documents/${doc.id}`, {
                              method: "PUT",
                              body: JSON.stringify({ document_type: e.target.value }),
                            });
                            await loadDocuments(selected.id);
                          }}
                        >
                          {DOC_TYPES.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.label}
                            </option>
                          ))}
                        </select>

                        <div style={styles.docName}>{doc.file_name}</div>
                        <div style={styles.docDate}>Uploaded by: {doc.uploaded_by || "-"}</div>
                        <div style={styles.docDate}>Uploaded at: {formatDate(doc.uploaded_at)}</div>

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
                <div style={styles.smartBox}>
                  <h3 style={styles.smartTitle}>Smart Missing Data Request</h3>
                  <p style={styles.smartText}>
                    النظام سيحدد البيانات الناقصة تلقائيًا ثم يرسل طلب استكمال
                    للموظف بعد موافقة الإدارة.
                  </p>

                  <div style={styles.chips}>
                    {getMissingFields(selected).length ? (
                      getMissingFields(selected).map((f) => (
                        <span key={f.key} style={styles.redChip}>
                          {f.label}
                        </span>
                      ))
                    ) : (
                      <span style={styles.complete}>No missing fields</span>
                    )}
                  </div>

                  {hasActiveRequestForEmployee(selected.id) ? (
                    <div style={styles.activeRequestBox}>
                      يوجد طلب تحديث بيانات نشط لهذا الموظف. راجع الطلب الحالي قبل إرسال طلب جديد.
                    </div>
                  ) : null}

                  <button
                    style={{
                      ...styles.smartBtn,
                      opacity: hasActiveRequestForEmployee(selected.id) ? 0.55 : 1,
                    }}
                    onClick={sendSmartDataUpdateRequest}
                  >
                    <Send size={16} /> Request Missing Data
                  </button>
                </div>

                <div style={styles.normalBox}>
                  <h3 style={styles.smartTitle}>Normal Notification</h3>
                  <textarea
                    style={styles.textarea}
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                  />

                  <div style={styles.actions}>
                    <button style={styles.saveBtn} onClick={sendNormalNotification}>
                      <Send size={16} /> Send Notification
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ icon, label }) {
  return (
    <div style={styles.mini}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function Stat({ icon, label, value, tone }) {
  const toneMap = {
    blue: ["#eff6ff", "#2563eb"],
    green: ["#ecfdf3", "#16a34a"],
    amber: ["#fffbeb", "#f59e0b"],
    purple: ["#f5f3ff", "#7c3aed"],
  };

  const [bg, color] = toneMap[tone] || toneMap.blue;

  return (
    <div style={styles.stat}>
      <div style={{ ...styles.statIcon, background: bg, color }}>{icon}</div>
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={styles.sectionHeader}>
      <div>
        <h2 style={styles.sectionTitle}>{title}</h2>
        <p style={styles.sectionSub}>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoBox}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      <input
        style={styles.input}
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function statusStyle(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return styles.statusApproved;
  if (s === "submitted") return styles.statusSubmitted;
  if (s === "needs_correction") return styles.statusCorrection;
  if (s === "rejected") return styles.statusRejected;
  return styles.status;
}

function pill(bg, color) {
  return {
    background: bg,
    color,
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
    textTransform: "capitalize",
  };
}

function btn(bg, color) {
  return {
    border: "none",
    background: bg,
    color,
    padding: "11px 15px",
    borderRadius: 14,
    fontWeight: 950,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  };
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 22,
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,.16), transparent 34%), linear-gradient(135deg,#f8fafc,#eef2f7)",
    color: "#0f172a",
    fontFamily: "Segoe UI, Arial, sans-serif",
    position: "relative",
  },
  topGlow: {
    position: "fixed",
    width: 360,
    height: 360,
    right: -120,
    top: -120,
    borderRadius: "50%",
    background: "rgba(37,99,235,.14)",
    filter: "blur(20px)",
    pointerEvents: "none",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(135deg,#020617 0%,#0f172a 44%,#1d4ed8 100%)",
    color: "#fff",
    borderRadius: 34,
    padding: 30,
    display: "flex",
    justifyContent: "space-between",
    gap: 22,
    flexWrap: "wrap",
    marginBottom: 18,
    boxShadow: "0 30px 80px rgba(15,23,42,.28)",
  },
  heroLeft: { maxWidth: 780 },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 13px",
    borderRadius: 999,
    background: "rgba(255,255,255,.12)",
    border: "1px solid rgba(255,255,255,.16)",
    color: "#dbeafe",
    fontSize: 13,
    fontWeight: 950,
  },
  title: {
    margin: "14px 0 10px",
    fontSize: "clamp(29px,4vw,46px)",
    lineHeight: 1.06,
    fontWeight: 950,
    letterSpacing: -1,
  },
  subtitle: {
    margin: 0,
    color: "#dbeafe",
    fontWeight: 750,
    lineHeight: 1.8,
    maxWidth: 760,
  },
  heroMiniGrid: {
    display: "flex",
    gap: 9,
    flexWrap: "wrap",
    marginTop: 16,
  },
  mini: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,.10)",
    border: "1px solid rgba(255,255,255,.15)",
    fontSize: 12,
    fontWeight: 900,
  },
  heroActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  heroBtn: btn("rgba(255,255,255,.14)", "#fff"),
  exportBtn: btn("#fff", "#1d4ed8"),
  lightBtn: btn("#f1f5f9", "#334155"),
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 14,
    marginBottom: 18,
  },
  stat: {
    background: "rgba(255,255,255,.92)",
    borderRadius: 26,
    padding: 18,
    display: "flex",
    gap: 14,
    alignItems: "center",
    border: "1px solid rgba(226,232,240,.9)",
    boxShadow: "0 18px 42px rgba(15,23,42,.08)",
  },
  statIcon: {
    width: 54,
    height: 54,
    borderRadius: 19,
    display: "grid",
    placeItems: "center",
  },
  statValue: { fontSize: 31, fontWeight: 950 },
  statLabel: { color: "#64748b", fontWeight: 850 },
  section: {
    background: "rgba(255,255,255,.95)",
    borderRadius: 30,
    padding: 18,
    border: "1px solid rgba(226,232,240,.92)",
    boxShadow: "0 20px 50px rgba(15,23,42,.08)",
    marginBottom: 18,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionTitle: { margin: 0, fontSize: 24, fontWeight: 950 },
  sectionSub: { margin: "6px 0 0", color: "#64748b", fontWeight: 750 },
  requestsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
    gap: 14,
  },
  requestCard: {
    background: "linear-gradient(180deg,#fff,#f8fafc)",
    border: "1px solid #e5e7eb",
    borderRadius: 26,
    padding: 16,
    boxShadow: "0 14px 34px rgba(15,23,42,.07)",
  },
  requestTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottom: "1px solid #eef2f7",
    paddingBottom: 13,
  },
  empCell: { display: "flex", gap: 11, alignItems: "center", minWidth: 0 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 17,
    background: "linear-gradient(135deg,#dbeafe,#eff6ff)",
    color: "#1e3a8a",
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    flexShrink: 0,
  },
  empName: {
    fontWeight: 950,
    maxWidth: 230,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  empSub: { color: "#94a3b8", fontSize: 12, fontWeight: 800 },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
    gap: 10,
    marginTop: 13,
  },
  infoBox: {
    background: "#f8fafc",
    border: "1px solid #eef2f7",
    borderRadius: 17,
    padding: 10,
    display: "grid",
    gap: 4,
  },
  block: { marginTop: 15 },
  blockTitle: {
    fontSize: 12,
    fontWeight: 950,
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: ".04em",
  },
  chips: { display: "flex", flexWrap: "wrap", gap: 7 },
  blueChip: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  redChip: {
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  attachGrid: { display: "grid", gap: 8 },
  attachCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    background: "#fff",
    border: "1px solid #dbeafe",
    borderRadius: 18,
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 900,
    flexWrap: "wrap",
  },
  attachIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: "#eff6ff",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  noAttach: {
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 850,
  },
  cardFooter: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: "1px solid #eef2f7",
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  toolbar: { display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  searchBox: {
    flex: 1,
    minWidth: 260,
    height: 50,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
    color: "#64748b",
  },
  searchInput: {
    border: "none",
    outline: "none",
    background: "transparent",
    flex: 1,
    fontWeight: 800,
  },
  filterActive: btn("#fef3c7", "#92400e"),
  employeeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))",
    gap: 14,
  },
  employeeCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 26,
    padding: 16,
    boxShadow: "0 14px 32px rgba(15,23,42,.06)",
  },
  employeeHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  gasBadge: {
    background: "#f1f5f9",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 950,
  },
  empMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))",
    gap: 8,
    marginTop: 13,
  },
  progressRow: { marginTop: 14 },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: 900,
  },
  progress: {
    width: "100%",
    height: 9,
    background: "#e5e7eb",
    borderRadius: 99,
    overflow: "hidden",
    marginTop: 7,
  },
  progressFill: { height: "100%" },
  more: {
    background: "#fef3c7",
    color: "#92400e",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  complete: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 950,
  },
  activeRequestNote: {
    marginTop: 12,
    padding: "9px 11px",
    borderRadius: 14,
    background: "#fff7ed",
    color: "#9a3412",
    fontSize: 12,
    fontWeight: 900,
  },
  manageBtn: {
    ...btn("#2563eb", "#fff"),
    width: "100%",
    justifyContent: "center",
    marginTop: 16,
  },
  status: pill("#f1f5f9", "#334155"),
  statusApproved: pill("#dcfce7", "#166534"),
  statusSubmitted: pill("#dbeafe", "#1d4ed8"),
  statusCorrection: pill("#fef3c7", "#92400e"),
  statusRejected: pill("#fee2e2", "#991b1b"),
  approveBtn: btn("#16a34a", "#fff"),
  correctionBtn: btn("#f59e0b", "#fff"),
  rejectBtn: btn("#dc2626", "#fff"),
  empty: {
    padding: 26,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 850,
    textAlign: "center",
  },
  muted: { color: "#94a3b8", fontWeight: 850 },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.68)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    zIndex: 999,
  },
  modal: {
    width: "100%",
    maxWidth: 1030,
    maxHeight: "92vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 30,
    padding: 22,
    boxShadow: "0 34px 90px rgba(0,0,0,.34)",
  },
  modalHeader: { display: "flex", justifyContent: "space-between", gap: 12 },
  modalUser: { display: "flex", alignItems: "center", gap: 12 },
  modalAvatar: {
    width: 58,
    height: 58,
    borderRadius: 21,
    background: "linear-gradient(135deg,#2563eb,#1e40af)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
  },
  modalTitle: { margin: 0, fontWeight: 950 },
  modalSub: { margin: "4px 0 0", color: "#64748b", fontWeight: 750 },
  closeBtn: {
    border: "none",
    background: "#f1f5f9",
    borderRadius: 14,
    width: 40,
    height: 40,
    cursor: "pointer",
  },
  tabs: { display: "flex", gap: 8, margin: "18px 0", flexWrap: "wrap" },
  tab: btn("#f1f5f9", "#334155"),
  tabActive: btn("#2563eb", "#fff"),
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 12,
  },
  field: { display: "grid", gap: 6, fontWeight: 850, fontSize: 13 },
  input: {
    height: 46,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "0 12px",
    fontWeight: 750,
    background: "#fff",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
    flexWrap: "wrap",
  },
  cancelBtn: btn("#f1f5f9", "#334155"),
  saveBtn: btn("#16a34a", "#fff"),
  dropZone: {
    border: "2px dashed #93c5fd",
    background: "linear-gradient(135deg,#eff6ff,#ffffff)",
    color: "#1d4ed8",
    borderRadius: 22,
    padding: 24,
    marginBottom: 12,
    textAlign: "center",
    display: "grid",
    gap: 7,
    placeItems: "center",
    fontWeight: 900,
  },
  uploadBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 10,
    alignItems: "center",
  },
  filePicker: {
    height: 46,
    border: "1px dashed #93c5fd",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
    color: "#1d4ed8",
    background: "#eff6ff",
    fontWeight: 850,
    cursor: "pointer",
  },
  docsGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
    gap: 12,
  },
  docCard: { border: "1px solid #e5e7eb", borderRadius: 20, padding: 14 },
  docSelect: {
    width: "100%",
    height: 40,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    marginTop: 8,
    padding: "0 10px",
    fontWeight: 800,
  },
  docName: {
    color: "#64748b",
    fontSize: 13,
    wordBreak: "break-word",
    marginTop: 8,
  },
  docDate: { color: "#94a3b8", fontSize: 12, marginTop: 6 },
  docActions: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" },
  previewBtn: btn("#eff6ff", "#1d4ed8"),
  downloadBtn: btn("#f0fdf4", "#15803d"),
  emptyDoc: {
    gridColumn: "1 / -1",
    textAlign: "center",
    padding: 20,
    color: "#64748b",
  },
  textarea: {
    width: "100%",
    minHeight: 140,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    fontWeight: 750,
  },
  smartBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
  },
  normalBox: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 16,
  },
  smartTitle: { margin: "0 0 8px", fontSize: 18, fontWeight: 950 },
  smartText: { margin: "0 0 12px", color: "#64748b", fontWeight: 750 },
  smartBtn: btn("#f59e0b", "#fff"),
  activeRequestBox: {
    marginTop: 12,
    marginBottom: 12,
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    borderRadius: 16,
    padding: 12,
    fontWeight: 850,
  },
};
