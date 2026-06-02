import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  Eye,
  FileText,
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

const months = [
  { value: "", label: "All Months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function LeaveFormsPage() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // فلاتر البحث والموجز الحالي
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [packageName, setPackageName] = useState("");
  const [type, setType] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  // حالات المعاينة للـ HTML والـ PDF
  const [selectedForm, setSelectedForm] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // التحكم في نافذة الإضافة والتعديل الاحترافية الجديدة
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
  }, [project, packageName, type, month, year]);

  async function fetchForms() {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams();
      if (search) q.set("search", search);
      if (project) q.set("project", project);
      if (packageName) q.set("packageName", packageName);
      if (type) q.set("type", type);
      if (month) q.set("month", month);
      if (year) q.set("year", year);

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

  const stats = useMemo(() => {
    return {
      total: forms.length,
      annual: forms.filter((f) => f.type === "annual_leave").length,
      emergency: forms.filter((f) => f.type === "emergency_leave").length,
      sick: forms.filter((f) => f.type === "sick_leave").length,
      unpaid: forms.filter((f) => f.type === "unpaid_leave").length,
    };
  }, [forms]);

  const years = useMemo(() => {
    const list = [];
    for (let y = currentYear - 3; y <= currentYear + 2; y++) {
      list.push(y);
    }
    return list;
  }, []);

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

  return (
    <div className="lf-container">
      <div className="lf-header">
        <div>
          <h1 className="lf-title">Leave Request Forms (QMS)</h1>
          <p className="lf-subtitle">Review and manage official company standard forms and documentation</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button className="lf-btn lf-btn-soft" type="button" onClick={fetchForms} disabled={loading}>
            <RefreshCw size={16} className={loading ? "lf-spin" : ""} /> Refresh
          </button>
          <button className="lf-btn lf-btn-primary" type="button" onClick={handleOpenCreate}>
            <Plus size={16} /> Create Form
          </button>
        </div>
      </div>

      {/* كروت الإحصائيات الفخمة */}
      <div className="lf-stats-grid">
        <div className="lf-stat-card">
          <div className="lf-stat-label">Total Generated Forms</div>
          <div className="lf-stat-val text-primary">{stats.total}</div>
        </div>
        <div className="lf-stat-card">
          <div className="lf-stat-label">Annual Leave</div>
          <div className="lf-stat-val" style={{ color: "#10b981" }}>{stats.annual}</div>
        </div>
        <div className="lf-stat-card">
          <div className="lf-stat-label">Emergency Leave</div>
          <div className="lf-stat-val" style={{ color: "#f59e0b" }}>{stats.emergency}</div>
        </div>
        <div className="lf-stat-card">
          <div className="lf-stat-label">Sick Leave</div>
          <div className="lf-stat-val" style={{ color: "#ef4444" }}>{stats.sick}</div>
        </div>
      </div>

      {/* لوحة الفلاتر والبحث الاحترافية */}
      <div className="lf-filters-card">
        <form onSubmit={(e) => { e.preventDefault(); fetchForms(); }} className="lf-filters-grid">
          <div className="lf-input-group">
            <Search size={16} className="lf-input-icon" />
            <input
              className="lf-input"
              type="text"
              placeholder="Search ID, Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="lf-input-group">
            <Filter size={16} className="lf-input-icon" />
            <input
              className="lf-input"
              type="text"
              placeholder="Division / Project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            />
          </div>
          <div className="lf-input-group">
            <select className="lf-select" value={type} onChange={(e) => setType(e.target.value)}>
              {leaveTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="lf-input-group">
            <select className="lf-select" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="lf-input-group">
            <select className="lf-select" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button className="lf-btn lf-btn-primary" type="submit" disabled={loading}>Apply Filter</button>
        </form>
      </div>

      {error && <div className="lf-alert lf-alert-danger">{error}</div>}

      {/* جدول البيانات الرئيسي */}
      <div className="lf-table-card">
        {loading && forms.length === 0 ? (
          <div className="lf-empty">Loading records...</div>
        ) : forms.length === 0 ? (
          <div className="lf-empty">No leave form found matching filter rules.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="lf-table">
              <thead>
                <tr>
                  <th>Employee Info</th>
                  <th>Division</th>
                  <th>Leave Type</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {forms.map((item) => (
                  <tr key={item.requestId}>
                    <td>
                      <div className="lf-emp-name">{item.employeeName || "Unknown"}</div>
                      <div className="lf-emp-id">GAS ID: {item.employeeGasId || "-"}</div>
                    </td>
                    <td><span className="lf-badge lf-badge-secondary">{item.projectName || "LEAVE"}</span></td>
                    <td><strong>{item.leaveTypeLabel}</strong></td>
                    <td>
                      <div className="lf-date-range">
                        {item.startDate ? item.startDate.substring(0, 10) : ""} to {item.endDate ? item.endDate.substring(0, 10) : ""}
                      </div>
                      <div className="lf-days-count">{item.daysCount} Applied Days</div>
                    </td>
                    <td>
                      <span className={`lf-badge ${String(item.status).toLowerCase() === "approved" ? "lf-badge-success" : "lf-badge-warning"}`}>
                        {item.status || "Approved"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button className="lf-action-btn" title="Preview Form" onClick={() => handlePreview(item)}><Eye size={15} /></button>
                        <button className="lf-action-btn" title="Download PDF" onClick={() => downloadPdf(item)}><Download size={15} /></button>
                        <button className="lf-action-btn" style={{ color: "#2563eb" }} title="Edit Form" onClick={() => handleOpenEdit(item)}><Edit2 size={15} /></button>
                        <button className="lf-action-btn" style={{ color: "#dc2626" }} title="Delete Form" onClick={() => handleDeleteForm(item.requestId)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🌟 نافذة التعديل والإضافة المودرن الفخمة بمنتصف الشاشة (Premium Management Modal) */}
      {isFormModalOpen && (
        <div className="lf-modal-overlay" style={{ zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="lf-modal" style={{ maxWidth: "600px", width: "100%", background: "#ffffff", borderRadius: "12px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)", overflow: "hidden", animation: "lf-modal-fade 0.2s ease-out" }}>
            
            {/* الهيدر الخاص بالنافذة */}
            <div className="lf-modal-head" style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#1e293b" }}>
                  {editingRequestId ? "✏️ Edit System Leave Form" : "✨ Create New Leave Record"}
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>Provide authorized form values across corporate QMS rules</p>
              </div>
              <button className="lf-action-btn" style={{ background: "#f1f5f9", borderRadius: "50%", padding: "6px", color: "#64748b" }} onClick={() => setIsFormModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* محتوى الاستمارة المقسم بشكل فخم وعمودين */}
            <form onSubmit={handleSaveForm} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Corporate Gas ID</label>
                  <input type="text" required placeholder="e.g. 2210" style={{ width: "100%", height: "38px", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0 12px", fontSize: "13px" }} value={formData.employeeGasId} onChange={(e) => setFormData({...formData, employeeGasId: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Employee Full Name</label>
                  <input type="text" required placeholder="John Doe" style={{ width: "100%", height: "38px", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0 12px", fontSize: "13px" }} value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Division / Project</label>
                  <input type="text" placeholder="LEAVE" style={{ width: "100%", height: "38px", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0 12px", fontSize: "13px" }} value={formData.projectName} onChange={(e) => setFormData({...formData, projectName: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Job Title / Position</label>
                  <input type="text" placeholder="Engineer / Specialist" style={{ width: "100%", height: "38px", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0 12px", fontSize: "13px" }} value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Official Leave Type</label>
                <select style={{ width: "100%", height: "38px", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0 12px", fontSize: "13px", background: "#fff" }} value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                  <option value="annual_leave">Annual Leave</option>
                  <option value="emergency_leave">Emergency Leave</option>
                  <option value="sick_leave">Sick Leave</option>
                  <option value="unpaid_leave">Unpaid Leave</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Leave Start Date</label>
                  <input type="date" required style={{ width: "100%", height: "38px", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0 12px", fontSize: "13px" }} value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Leave End Date</label>
                  <input type="date" required style={{ width: "100%", height: "38px", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0 12px", fontSize: "13px" }} value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Approval Workflow Status</label>
                  <select style={{ width: "100%", height: "38px", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "0 12px", fontSize: "13px", background: "#fff" }} value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option value="Approved">Approved (Final)</option>
                    <option value="Pending">Pending Review</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>Comments / Management Justification</label>
                <textarea placeholder="Enter internal system comment or notes here..." rows="3" style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: "6px", padding: "10px 12px", fontSize: "13px", fontFamily: "inherit", resize: "none" }} value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} />
              </div>

              {/* أزرار الحفظ والإغلاق التفاعلية الفخمة */}
              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px", marginTop: "8px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button type="button" style={{ height: "38px", padding: "0 16px", background: "#f1f5f9", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "600", color: "#475569", cursor: "pointer" }} onClick={() => setIsFormModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" style={{ height: "38px", padding: "0 20px", background: "#2563eb", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: "600", color: "#ffffff", cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(37,99,235,0.2)" }}>
                  {editingRequestId ? "Save Changes" : "Create Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة معاينة استمارة الـ HTML الأصلية المعتمدة */}
      {selectedForm ? (
        <div className="lf-modal-overlay" role="dialog" aria-modal="true">
          <div className="lf-modal">
            <div className="lf-modal-head">
              <div>
                <strong>{selectedForm.employeeName || "Leave Form"}</strong>
                <span>GAS ID: {selectedForm.employeeGasId || "-"} · {selectedForm.leaveTypeLabel || selectedForm.type}</span>
              </div>
              <div className="lf-modal-actions">
                <button className="lf-btn lf-btn-soft" type="button" onClick={printPreview} disabled={!previewHtml || previewLoading}>
                  <Printer size={16} /> Print
                </button>
                <button className="lf-btn lf-btn-primary" type="button" onClick={() => downloadPdf(selectedForm)}>
                  <Download size={16} /> Download PDF
                </button>
                <button className="lf-btn lf-btn-danger" type="button" onClick={() => setSelectedForm(null)}>
                  <X size={16} /> Close
                </button>
              </div>
            </div>
            <div className="lf-frame-wrap">
              {previewLoading ? (
                <div className="lf-empty">Loading official form...</div>
              ) : (
                <iframe
                  id="leave-form-preview-frame"
                  title="Leave Request Form Preview"
                  className="lf-frame"
                  srcDoc={previewHtml}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
