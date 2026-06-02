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

  // فلاتر البحث
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [type, setType] = useState("");

  // حالات المعاينة المنبثقة
  const [selectedForm, setSelectedForm] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // حالات نافذة الإضافة والتعديل المنبثقة (Form Modal)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [formData, setFormData] = useState({
    employeeGasId: "",
    employeeName: "",
    type: "annual_leave",
    startDate: "",
    endDate: "",
    status: "Approved",
    note: ""
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

  // فتح الفورم لإنشاء استمارة جديدة
  function handleOpenCreate() {
    setEditingRequestId(null);
    setFormData({
      employeeGasId: "",
      employeeName: "",
      type: "annual_leave",
      startDate: "",
      endDate: "",
      status: "Approved",
      note: ""
    });
    setIsFormModalOpen(true);
  }

  // فتح الفورم لتعديل استمارة الحالية
  function handleOpenEdit(item) {
    setEditingRequestId(item.requestId);
    setFormData({
      employeeGasId: item.employeeGasId || "",
      employeeName: item.employeeName || "",
      type: item.type || "annual_leave",
      startDate: item.startDate ? item.startDate.substring(0, 10) : "",
      endDate: item.endDate ? item.endDate.substring(0, 10) : "",
      status: item.status || "Approved",
      note: item.note || ""
    });
    setIsFormModalOpen(true);
  }

  // حفظ الإضافة أو التعديل وإرسالها للسيرفر
  async function handleSaveForm(e) {
    e.preventDefault();
    try {
      if (editingRequestId) {
        // تحديث استمارة موجودة
        await apiFetch(`/leave-forms/${editingRequestId}`, {
          method: "PUT",
          body: JSON.stringify(formData)
        });
      } else {
        // إضافة استمارة جديدة يدوياً
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

  // حذف الاستمارة نهائياً
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
          <p className="lf-subtitle">Review, edit, add and manage official company leave documents</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="lf-btn lf-btn-soft" type="button" onClick={fetchForms} disabled={loading}>
            <RefreshCw size={16} className={loading ? "lf-spin" : ""} /> Refresh
          </button>
          <button className="lf-btn lf-btn-primary" type="button" onClick={handleOpenCreate}>
            <Plus size={16} /> Create New Form
          </button>
        </div>
      </div>

      {/* شريط الفلاتر والبحث */}
      <div className="lf-filters-card">
        <form onSubmit={(e) => { e.preventDefault(); fetchForms(); }} className="lf-filters-grid">
          <div className="lf-input-group">
            <Search size={16} className="lf-input-icon" />
            <input
              className="lf-input"
              type="text"
              placeholder="Search by Gas ID, Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="lf-input-group">
            <Filter size={16} className="lf-input-icon" />
            <input
              className="lf-input"
              type="text"
              placeholder="Filter by Division / Project..."
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
          <button className="lf-btn lf-btn-primary" type="submit" disabled={loading}>Apply Filters</button>
        </form>
      </div>

      {error && <div className="lf-alert lf-alert-danger">{error}</div>}

      {/* جدول عرض النماذج والتحكم بها */}
      <div className="lf-table-card">
        {loading && forms.length === 0 ? (
          <div className="lf-empty">Loading records...</div>
        ) : forms.length === 0 ? (
          <div className="lf-empty">No matching leave forms found.</div>
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
                        <button className="lf-action-btn" title="Preview HTML" onClick={() => handlePreview(item)}><Eye size={15} /></button>
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

      {/* نافذة الإضافة والتعديل المنبثقة (Form Modal) */}
      {isFormModalOpen && (
        <div className="lf-modal-overlay">
          <div className="lf-modal" style={{ maxWidth: "500px" }}>
            <div className="lf-modal-head">
              <div><strong>{editingRequestId ? "Edit Leave Form" : "Create New Leave Form"}</strong></div>
              <button className="lf-btn lf-btn-danger" style={{ padding: "4px" }} onClick={() => setIsFormModalOpen(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveForm} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Employee Gas ID</label>
                <input type="text" required className="lf-input" value={formData.employeeGasId} onChange={(e) => setFormData({...formData, employeeGasId: e.target.value})} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Employee Full Name</label>
                <input type="text" required className="lf-input" value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Leave Type</label>
                <select className="lf-select" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                  <option value="annual_leave">Annual Leave</option>
                  <option value="emergency_leave">Emergency Leave</option>
                  <option value="sick_leave">Sick Leave</option>
                  <option value="unpaid_leave">Unpaid Leave</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Start Date</label>
                  <input type="date" required className="lf-input" value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>End Date</label>
                  <input type="date" required className="lf-input" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Status</label>
                <select className="lf-select" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "4px" }}>Comments / Note</label>
                <textarea className="lf-input" rows="3" value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} />
              </div>
              <button type="submit" className="lf-btn lf-btn-primary" style={{ marginTop: "10px" }}>Save Form Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* نافذة معاينة الطباعة الحالية */}
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
