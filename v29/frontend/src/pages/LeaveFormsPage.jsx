import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  Filter,
  Printer,
  RefreshCw,
  Search,
  X,
  Plus,
  Edit2,
  Trash2
} from "lucide-react";
import { API_BASE, apiFetch } from "../services/api";

const currentYear = new Date().getFullYear();

const leaveTypes = [
  { value: "", label: "All Types" },
  { value: "annual_leave", label: "Annual Leave" },
  { value: "emergency_leave", label: "Emergency Leave" },
  { value: "sick_leave", label: "Sick Leave" },
  { value: "unpaid_leave", label: "Unpaid Leave" },
];

export default function LeaveFormsPage() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // الفلاتر
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [type, setType] = useState("");

  // المعاينة
  const [selectedForm, setSelectedForm] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // التحكم في نافذة الإضافة والتعديل
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [formData, setFormData] = useState({
    employeeGasId: "",
    employeeName: "",
    type: "annual_leave",
    startDate: "",
    endDate: "",
    status: "Approved",
    note: "",
    projectName: "",
    position: ""
  });

  useEffect(() => {
    fetchForms();
  }, [project, type]);

  async function fetchForms() {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (project) q.set("project", project);
      if (type) q.set("type", type);

      const res = await apiFetch(`/leave-forms?${q.toString()}`);
      if (res && res.forms) {
        setForms(res.forms);
      }
    } catch (err) {
      setError(err.message || "Failed to load leave forms");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingRequestId(null);
    setFormData({
      employeeGasId: "",
      employeeName: "",
      type: "annual_leave",
      startDate: "",
      endDate: "",
      status: "Approved",
      note: "",
      projectName: "LEAVE",
      position: ""
    });
    setIsFormModalOpen(true);
  }

  function handleOpenEdit(item) {
    setEditingRequestId(item.requestId);
    setFormData({
      employeeGasId: item.employeeGasId || "",
      employeeName: item.employeeName || "",
      type: item.type || "annual_leave",
      startDate: item.startDate ? item.startDate.substring(0, 10) : "",
      endDate: item.endDate ? item.endDate.substring(0, 10) : "",
      status: item.status || "Approved",
      note: item.note || "",
      projectName: item.projectName || "LEAVE",
      position: item.position || ""
    });
    setIsFormModalOpen(true);
  }

  async function handleSaveForm(e) {
    e.preventDefault();
    try {
      if (editingRequestId) {
        await apiFetch(`/leave-forms/${editingRequestId}`, {
          method: "PUT",
          body: JSON.stringify(formData)
        });
      } else {
        await apiFetch(`/leave-forms`, {
          method: "POST",
          body: JSON.stringify(formData)
        });
      }
      setIsFormModalOpen(false);
      fetchForms();
    } catch (err) {
      alert(err.message || "Operation failed");
    }
  }

  async function handleDeleteForm(requestId) {
    if (!window.confirm("Are you sure you want to permanently delete this leave form?")) return;
    try {
      await apiFetch(`/leave-forms/${requestId}`, { method: "DELETE" });
      fetchForms();
    } catch (err) {
      alert(err.message || "Delete failed");
    }
  }

  async function handlePreview(item) {
    setSelectedForm(item);
    setPreviewLoading(true);
    setPreviewHtml("");
    try {
      const res = await apiFetch(`/leave-forms/${item.requestId}`);
      if (res && res.html) {
        setPreviewHtml(res.html);
      }
    } catch (err) {
      alert(err.message || "Failed to fetch preview html");
    } finally {
      setPreviewLoading(false);
    }
  }

  function downloadPdf(item) {
    const token = localStorage.getItem("token") || "";
    window.open(`${API_BASE}/leave-forms/${item.requestId}/pdf?token=${encodeURIComponent(token)}`, "_blank");
  }

  function printPreview() {
    const frame = document.getElementById("leave-form-preview-frame");
    if (frame && frame.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }
  }

  // التنسيقات المدمجة الفخمة المتطابقة مع الهوية الزرقاء الداكنة لنظامك
  const styles = {
    container: { padding: "24px", color: "#ffffff", fontFamily: "system-ui, sans-serif" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" },
    title: { fontSize: "28px", fontWeight: "700", margin: 0, color: "#ffffff" },
    subtitle: { fontSize: "14px", color: "#93c5fd", margin: "4px 0 0 0" },
    btnPrimary: { display: "inline-flex", alignItems: "center", gap: "8px", background: "#2563eb", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" },
    btnSoft: { display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", padding: "10px 18px", borderRadius: "8px", cursor: "pointer" },
    filterCard: { background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "16px", marginBottom: "20px" },
    filterGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "12px", alignItems: "center" },
    inputGroup: { position: "relative", width: "100%" },
    input: { width: "100%", height: "42px", background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "0 12px", color: "#fff", fontSize: "14px", outline: "none" },
    select: { width: "100%", height: "42px", background: "#0f172a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "0 12px", color: "#fff", fontSize: "14px", cursor: "pointer" },
    tableCard: { background: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", overflow: "hidden" },
    table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
    th: { background: "rgba(15, 23, 42, 0.4)", color: "#94a3b8", fontWeight: "600", padding: "14px 16px", fontSize: "13px", borderBottom: "1px solid rgba(255,255,255,0.1)" },
    td: { padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", verticalAlign: "middle" },
    badge: { padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", display: "inline-block" },
    actionBtn: { background: "rgba(255,255,255,0.08)", border: "none", color: "#cbd5e1", width: "34px", height: "34px", borderRadius: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    
    // 🌟 تنسيق الـ Overlay الثابت والمطلق لمنع النزول لأسفل الشاشة نهائياً
    overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "20px" },
    modalBox: { background: "#ffffff", color: "#0f172a", width: "100%", maxWidth: "600px", borderRadius: "16px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", flexDirection: "column" },
    modalHead: { padding: "18px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" },
    modalBody: { padding: "24px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", maxHeight: "80vh" },
    modalInput: { width: "100%", height: "40px", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "0 12px", fontSize: "14px", color: "#0f172a", outline: "none", background: "#ffffff" },
    modalLabel: { display: "block", fontSize: "13px", fontWeight: "600", color: "#334155", marginBottom: "6px" }
  };

  return (
    <div style={styles.container}>
      
      {/* الهيدر العلوي */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Leave Request Forms (QMS)</h1>
          <p style={styles.subtitle}>Review, edit, add and manage official company leave documents</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button style={styles.btnSoft} type="button" onClick={fetchForms} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button style={styles.btnPrimary} type="button" onClick={handleOpenCreate}>
            <Plus size={16} /> Create New Form
          </button>
        </div>
      </div>

      {/* لوحة الفلاتر الذكية */}
      <div style={styles.filterCard}>
        <form onSubmit={(e) => { e.preventDefault(); fetchForms(); }} style={styles.filterGrid}>
          <div style={styles.inputGroup}>
            <input style={styles.input} type="text" placeholder="Search by Gas ID, Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={styles.inputGroup}>
            <input style={styles.input} type="text" placeholder="Filter by Division / Project..." value={project} onChange={(e) => setProject(e.target.value)} />
          </div>
          <div>
            <select style={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
              {leaveTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button style={styles.btnPrimary} type="submit" disabled={loading}>Apply Filters</button>
        </form>
      </div>

      {error && <div style={{ background: "#ef4444", padding: "12px", borderRadius: "8px", marginBottom: "15px" }}>{error}</div>}

      {/* جدول عرض البيانات */}
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Employee Info</th>
              <th style={styles.th}>Division</th>
              <th style={styles.th}>Leave Type</th>
              <th style={styles.th}>Duration</th>
              <th style={styles.th}>Status</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((item) => (
              <tr key={item.requestId}>
                <td style={styles.td}>
                  <div style={{ fontWeight: "600" }}>{item.employeeName}</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>GAS ID: {item.employeeGasId}</div>
                </td>
                <td style={styles.td}><span style={{ ...styles.badge, background: "rgba(255,255,255,0.1)" }}>{item.projectName || "LEAVE"}</span></td>
                <td style={styles.td}><strong>{item.leaveTypeLabel}</strong></td>
                <td style={styles.td}>
                  <div style={{ fontSize: "13px" }}>{item.startDate?.substring(0, 10)} to {item.endDate?.substring(0, 10)}</div>
                  <div style={{ fontSize: "11px", color: "#60a5fa" }}>{item.daysCount} Days</div>
                </td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, background: String(item.status).toLowerCase() === "approved" ? "#10b981" : "#f59e0b", color: "#fff" }}>
                    {item.status || "Approved"}
                  </span>
                </td>
                <td style={{ ...styles.td, textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: "6px" }}>
                    <button style={styles.actionBtn} title="Preview" onClick={() => handlePreview(item)}><Eye size={15} /></button>
                    <button style={styles.actionBtn} title="Download" onClick={() => downloadPdf(item)}><Download size={15} /></button>
                    <button style={{ ...styles.actionBtn, color: "#3b82f6" }} title="Edit" onClick={() => handleOpenEdit(item)}><Edit2 size={15} /></button>
                    <button style={{ ...styles.actionBtn, color: "#ef4444" }} title="Delete" onClick={() => handleDeleteForm(item.requestId)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🌟 نافذة التعديل الفخمة - مثبتة ومستقلة تماماً في منتصف الشاشة */}
      {isFormModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHead}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                  {editingRequestId ? "✏️ Edit System Leave Form" : "✨ Create New Leave Record"}
                </h3>
              </div>
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setIsFormModalOpen(false)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSaveForm} style={styles.modalBody}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={styles.modalLabel}>Corporate Gas ID</label>
                  <input type="text" required style={styles.modalInput} value={formData.employeeGasId} onChange={(e) => setFormData({...formData, employeeGasId: e.target.value})} />
                </div>
                <div>
                  <label style={styles.modalLabel}>Employee Name</label>
                  <input type="text" required style={styles.modalInput} value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={styles.modalLabel}>Division / Project</label>
                  <input type="text" style={styles.modalInput} value={formData.projectName} onChange={(e) => setFormData({...formData, projectName: e.target.value})} />
                </div>
                <div>
                  <label style={styles.modalLabel}>Position</label>
                  <input type="text" style={styles.modalInput} value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={styles.modalLabel}>Leave Type</label>
                <select style={styles.modalInput} value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                  <option value="annual_leave">Annual Leave</option>
                  <option value="emergency_leave">Emergency Leave</option>
                  <option value="sick_leave">Sick Leave</option>
                  <option value="unpaid_leave">Unpaid Leave</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={styles.modalLabel}>Start Date</label>
                  <input type="date" required style={styles.modalInput} value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div>
                  <label style={styles.modalLabel}>End Date</label>
                  <input type="date" required style={styles.modalInput} value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={styles.modalLabel}>Workflow Status</label>
                <select style={styles.modalInput} value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label style={styles.modalLabel}>Comments / Justification</label>
                <textarea rows="2" style={{ ...styles.modalInput, height: "auto", padding: "8px" }} value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" style={{ ...styles.btnSoft, color: "#334155" }} onClick={() => setIsFormModalOpen(false)}>Cancel</button>
                <button type="submit" style={styles.btnPrimary}>Save Form Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 نافذة معاينة الاستمارة الرسمية - طبقة علوية معزولة تماماً في منتصف الشاشة */}
      {selectedForm && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modalBox, maxWidth: "850px", height: "90vh" }}>
            <div style={styles.modalHead}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>{selectedForm.employeeName} - Preview</h3>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button style={{ ...styles.btnPrimary, padding: "6px 12px" }} onClick={printPreview} disabled={previewLoading}><Printer size={14} /> Print</button>
                <button style={{ ...styles.btnSoft, color: "#334155", padding: "6px 12px" }} onClick={() => downloadPdf(selectedForm)}><Download size={14} /> Download</button>
                <button style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "10px" }} onClick={() => setSelectedForm(null)}><X size={18} /></button>
              </div>
            </div>
            <div style={{ flex: 1, background: "#f1f5f9", padding: "16px", display: "flex", justifyContent: "center" }}>
              {previewLoading ? (
                <div style={{ color: "#0f172a" }}>Loading official form...</div>
              ) : (
                <iframe id="leave-form-preview-frame" style={{ width: "100%", height: "100%", border: "none", background: "#fff", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }} srcDoc={previewHtml} />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
