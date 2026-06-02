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
  Trash2,
  Calendar
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
    } fill {
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

  // 💎 التنسيقات الفخمة جداً المحدثة لحل مشاكل الاختفاء والخطوط غير الواضحة
  const styles = {
    container: { padding: "30px", color: "#ffffff", fontFamily: "'Inter', system-ui, sans-serif", minHeight: "100vh" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" },
    title: { fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px", margin: 0, color: "#ffffff" },
    subtitle: { fontSize: "14px", color: "#94a3b8", margin: "6px 0 0 0" },
    
    // الأزرار الرئيسية بالصفحة
    btnPrimary: { display: "inline-flex", alignItems: "center", gap: "8px", background: "#3b82f6", color: "#ffffff", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", fontSize: "14px", cursor: "pointer", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)" },
    btnSoft: { display: "inline-flex", alignItems: "center", gap: "8px", background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", fontSize: "14px", cursor: "pointer" },
    
    // الفلاتر والجدول
    filterCard: { background: "#111827", border: "1px solid #1f2937", borderRadius: "14px", padding: "20px", marginBottom: "24px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)" },
    filterGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "16px", alignItems: "center" },
    input: { width: "100%", height: "44px", background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", padding: "0 14px", color: "#ffffff", fontSize: "14px", outline: "none" },
    select: { width: "100%", height: "44px", background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", padding: "0 14px", color: "#ffffff", fontSize: "14px", cursor: "pointer" },
    
    tableCard: { background: "#111827", border: "1px solid #1f2937", borderRadius: "14px", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" },
    table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
    th: { background: "#1f2937", color: "#94a3b8", fontWeight: "600", padding: "16px", fontSize: "13px", letterSpacing: "0.5px", textTransform: "uppercase", borderBottom: "1px solid #374151" },
    td: { padding: "16px", borderBottom: "1px solid #1f2937", color: "#e2e8f0" },
    badge: { padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "700" },
    actionBtn: { background: "#1f2937", border: "1px solid #374151", color: "#94a3b8", width: "36px", height: "36px", borderRadius: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
    
    // 🌟 تصميم الـ POP-UP الاحترافي وعالي التباين (Premium Glass Modal)
    overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(3, 7, 18, 0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999999, padding: "20px" },
    modalBox: { background: "#1f2937", color: "#ffffff", width: "100%", maxWidth: "650px", borderRadius: "16px", border: "1px solid #374151", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)", overflow: "hidden", display: "flex", flexDirection: "column" },
    modalHead: { padding: "20px 28px", background: "#111827", borderBottom: "1px solid #374151", display: "flex", justifyContent: "space-between", alignItems: "center" },
    modalBody: { padding: "28px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto", maxHeight: "85vh" },
    
    // حقول المدخلات داخل الـ Pop-up لتكون فخمة وبدون حواف حادة بدائية
    modalLabel: { display: "block", fontSize: "13px", fontWeight: "600", color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" },
    modalInput: { width: "100%", height: "46px", background: "#111827", border: "1px solid #4b5563", borderRadius: "10px", padding: "0 16px", fontSize: "14px", color: "#ffffff", outline: "none" },
    
    // الأزرار بأسفل الـ Pop-up (واضحة مئة بالمئة وليست مخفية)
    modalBtnCancel: { height: "46px", padding: "0 24px", background: "#374151", border: "1px solid #4b5563", borderRadius: "10px", fontSize: "14px", fontWeight: "700", color: "#94a3b8", cursor: "pointer" },
    modalBtnSave: { height: "46px", padding: "0 28px", background: "#2563eb", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", color: "#ffffff", cursor: "pointer", boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)" }
  };

  return (
    <div style={styles.container}>
      
      {/* الجزء العلوي للصفحة */}
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

      {/* لوحة الفلاتر */}
      <div style={styles.filterCard}>
        <form onSubmit={(e) => { e.preventDefault(); fetchForms(); }} style={styles.filterGrid}>
          <input style={styles.input} type="text" placeholder="Search by Gas ID, Name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <input style={styles.input} type="text" placeholder="Filter by Division..." value={project} onChange={(e) => setProject(e.target.value)} />
          <select style={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
            {leaveTypes.map((t) => <option key={t.value} value={t.value} style={{background: "#111827"}}>{t.label}</option>)}
          </select>
          <button style={styles.btnPrimary} type="submit" disabled={loading}>Apply Filters</button>
        </form>
      </div>

      {error && <div style={{ background: "#ef4444", padding: "14px", borderRadius: "8px", marginBottom: "15px", fontWeight: "600" }}>{error}</div>}

      {/* الجدول الاحترافي */}
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
                  <div style={{ fontWeight: "700", fontSize: "15px" }}>{item.employeeName}</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>GAS ID: {item.employeeGasId}</div>
                </td>
                <td style={styles.td}><span style={{ ...styles.badge, background: "#1f2937", color: "#3b82f6" }}>{item.projectName || "LEAVE"}</span></td>
                <td style={styles.td}><strong style={{ color: "#60a5fa" }}>{item.leaveTypeLabel}</strong></td>
                <td style={styles.td}>
                  <div style={{ fontSize: "13px", fontWeight: "500" }}>{item.startDate?.substring(0, 10)} to {item.endDate?.substring(0, 10)}</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{item.daysCount} Applied Days</div>
                </td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, background: String(item.status).toLowerCase() === "approved" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)", color: String(item.status).toLowerCase() === "approved" ? "#10b981" : "#f59e0b" }}>
                    {item.status || "Approved"}
                  </span>
                </td>
                <td style={{ ...styles.td, textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: "8px" }}>
                    <button style={styles.actionBtn} title="Preview" onClick={() => handlePreview(item)}><Eye size={15} /></button>
                    <button style={styles.actionBtn} title="Download" onClick={() => downloadPdf(item)}><Download size={15} /></button>
                    <button style={{ ...styles.actionBtn, borderColor: "#3b82f6", color: "#3b82f6" }} title="Edit" onClick={() => handleOpenEdit(item)}><Edit2 size={15} /></button>
                    <button style={{ ...styles.actionBtn, borderColor: "#ef4444", color: "#ef4444" }} title="Delete" onClick={() => handleDeleteForm(item.requestId)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🌟 نافذة التعديل الفخمة والمتباينة تماماً (الأزرار والخطوط واضحة %100 وبمنتصف الشاشة) */}
      {isFormModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHead}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#ffffff" }}>
                {editingRequestId ? "✏️ Edit Corporate Leave Form" : "✨ Create New QMS Record"}
              </h3>
              <button style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }} onClick={() => setIsFormModalOpen(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSaveForm} style={styles.modalBody}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={styles.modalLabel}>Corporate Gas ID</label>
                  <input type="text" required style={styles.modalInput} value={formData.employeeGasId} onChange={(e) => setFormData({...formData, employeeGasId: e.target.value})} />
                </div>
                <div>
                  <label style={styles.modalLabel}>Employee Name</label>
                  <input type="text" required style={styles.modalInput} value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={styles.modalLabel}>Division / Project</label>
                  <input type="text" style={styles.modalInput} value={formData.projectName} onChange={(e) => setFormData({...formData, projectName: e.target.value})} />
                </div>
                <div>
                  <label style={styles.modalLabel}>Job Position</label>
                  <input type="text" style={styles.modalInput} value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={styles.modalLabel}>Official Leave Type</label>
                <select style={styles.modalInput} value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                  <option value="annual_leave" style={{background: "#111827"}}>Annual Leave</option>
                  <option value="emergency_leave" style={{background: "#111827"}}>Emergency Leave</option>
                  <option value="sick_leave" style={{background: "#111827"}}>Sick Leave</option>
                  <option value="unpaid_leave" style={{background: "#111827"}}>Unpaid Leave</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
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
                <label style={styles.modalLabel}>Approval Status</label>
                <select style={styles.modalInput} value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                  <option value="Approved" style={{background: "#111827"}}>Approved</option>
                  <option value="Pending" style={{background: "#111827"}}>Pending</option>
                  <option value="Rejected" style={{background: "#111827"}}>Rejected</option>
                </select>
              </div>

              <div>
                <label style={styles.modalLabel}>Management Justification / Note</label>
                <textarea rows="3" style={{ ...styles.modalInput, height: "auto", padding: "12px", resize: "none" }} value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} />
              </div>

              {/* الأزرار الخلفية المتباينة بوضوح كامل */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "14px", marginTop: "12px", borderTop: "1px solid #374151", paddingTop: "20px" }}>
                <button type="button" style={styles.modalBtnCancel} onClick={() => setIsFormModalOpen(false)}>Cancel</button>
                <button type="submit" style={styles.modalBtnSave}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 نافذة المعاينة الفخمة والمنفصلة تماماً في منتصف الشاشة */}
      {selectedForm && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modalBox, maxWidth: "900px", height: "90vh" }}>
            <div style={styles.modalHead}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800" }}>{selectedForm.employeeName}</h3>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>GAS ID: {selectedForm.employeeGasId}</span>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button style={{ ...styles.btnPrimary, padding: "8px 16px" }} onClick={printPreview} disabled={previewLoading}><Printer size={14} /> Print</button>
                <button style={{ ...styles.btnSoft, padding: "8px 16px" }} onClick={() => downloadPdf(selectedForm)}><Download size={14} /> PDF</button>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", marginLeft: "10px" }} onClick={() => setSelectedForm(null)}><X size={22} /></button>
              </div>
            </div>
            <div style={{ flex: 1, background: "#111827", padding: "20px", display: "flex", justifyContent: "center" }}>
              {previewLoading ? (
                <div style={{ color: "#94a3b8", alignSelf: "center" }}>Loading official document preview...</div>
              ) : (
                <iframe id="leave-form-preview-frame" style={{ width: "100%", height: "100%", border: "none", background: "#ffffff", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }} srcDoc={previewHtml} />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
