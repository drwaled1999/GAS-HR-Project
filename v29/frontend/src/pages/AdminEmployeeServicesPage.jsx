import { useEffect, useMemo, useState } from "react";
import { apiFetch, API_BASE } from "../services/api";
import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UploadCloud,
  UserRound,
  Users,
  X,
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

export default function AdminEmployeeServicesPage() {
  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [updateRequests, setUpdateRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("requests");
  const [modalTab, setModalTab] = useState("profile");
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

  function hasActiveRequestForEmployee(employeeId) {
    return updateRequests.some(
      (r) =>
        r.employee_id === employeeId &&
        ["pending_employee", "needs_correction", "submitted"].includes(r.status)
    );
  }

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const text = `${e.full_name || ""} ${e.gas_id || ""} ${e.project_name || ""} ${
        e.job_title || ""
      } ${e.email || ""}`.toLowerCase();

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

  const compactRequests = useMemo(() => {
    if (activeTab === "requests") return updateRequests;
    return updateRequests.filter((r) => r.status === "submitted");
  }, [activeTab, updateRequests]);

  function openEmployee(emp) {
    setSelected(emp);
    setModalTab("profile");
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
    if (!selected?.id || uploading) return;

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
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("OPEN DOCUMENT ERROR:", err);
      alert("Cannot open document");
    }
  }

  async function downloadDocument(docId, fileName) {
    try {
      const res = await fetch(
        `${API_BASE}/admin/employees/documents/${docId}/view?download=1`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
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
        { headers: { Authorization: `Bearer ${getToken()}` } }
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

      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
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

      await loadUpdateRequests();
      await loadEmployees();
      alert("Request approved and employee data updated successfully.");
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
        body: JSON.stringify({ status: "needs_correction", hr_note: note }),
      });

      await loadUpdateRequests();
      alert("Request sent back for correction.");
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
        body: JSON.stringify({ status: "rejected", hr_note: note }),
      });

      await loadUpdateRequests();
      alert("Request rejected.");
    } catch (err) {
      console.error("REJECT REQUEST ERROR:", err);
      alert("Failed to reject request");
    }
  }

  return (
    <>
      <style>{`
        .emp-admin-page {
          min-height: 100vh;
          padding: 22px;
          background: #f4f7fb;
          color: #0f172a;
          font-family: Inter, Segoe UI, Arial, sans-serif;
        }

        .emp-admin-shell {
          max-width: 1440px;
          margin: 0 auto;
        }

        .emp-hero {
          background: linear-gradient(135deg, #071326 0%, #0f2f67 55%, #1d4ed8 100%);
          color: white;
          border-radius: 28px;
          padding: 24px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 20px;
          align-items: center;
          box-shadow: 0 24px 60px rgba(15,23,42,.22);
          position: relative;
          overflow: hidden;
        }

        .emp-hero::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
          background-size: 34px 34px;
          opacity: .35;
        }

        .emp-hero-content,
        .emp-hero-actions {
          position: relative;
          z-index: 2;
        }

        .emp-chip {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.12);
          color: #dbeafe;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .emp-title {
          margin: 12px 0 6px;
          font-size: clamp(28px, 4vw, 42px);
          letter-spacing: -1px;
          font-weight: 950;
          line-height: 1.1;
        }

        .emp-subtitle {
          margin: 0;
          color: #dbeafe;
          max-width: 820px;
          font-weight: 700;
          line-height: 1.7;
        }

        .emp-hero-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .emp-btn {
          border: none;
          border-radius: 14px;
          padding: 11px 14px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
        }

        .emp-btn-light {
          background: rgba(255,255,255,.14);
          color: white;
          border: 1px solid rgba(255,255,255,.16);
        }

        .emp-btn-white {
          background: white;
          color: #1d4ed8;
        }

        .emp-btn-primary {
          background: #2563eb;
          color: white;
        }

        .emp-btn-green {
          background: #16a34a;
          color: white;
        }

        .emp-btn-red {
          background: #dc2626;
          color: white;
        }

        .emp-btn-amber {
          background: #f59e0b;
          color: white;
        }

        .emp-btn-muted {
          background: #eef2f7;
          color: #334155;
        }

        .emp-stats {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(4, minmax(160px, 1fr));
          gap: 12px;
        }

        .emp-stat {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 16px;
          display: flex;
          gap: 12px;
          align-items: center;
          box-shadow: 0 12px 32px rgba(15,23,42,.06);
        }

        .emp-stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .emp-stat strong {
          display: block;
          font-size: 27px;
          font-weight: 950;
        }

        .emp-stat span {
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
        }

        .emp-tabs {
          margin-top: 16px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 6px;
          display: flex;
          gap: 6px;
          width: fit-content;
          box-shadow: 0 10px 24px rgba(15,23,42,.04);
        }

        .emp-tab {
          border: none;
          padding: 10px 14px;
          border-radius: 13px;
          background: transparent;
          color: #64748b;
          font-weight: 900;
          cursor: pointer;
        }

        .emp-tab.active {
          background: #0f172a;
          color: white;
        }

        .emp-card {
          margin-top: 16px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 18px;
          box-shadow: 0 18px 44px rgba(15,23,42,.07);
        }

        .emp-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 14px;
        }

        .emp-card-title {
          margin: 0;
          font-size: 22px;
          font-weight: 950;
        }

        .emp-card-subtitle {
          margin: 5px 0 0;
          color: #64748b;
          font-weight: 750;
        }

        .emp-toolbar {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .emp-search {
          flex: 1;
          min-width: 280px;
          height: 46px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 13px;
          color: #64748b;
        }

        .emp-search input {
          border: none;
          outline: none;
          background: transparent;
          flex: 1;
          font-weight: 800;
          min-width: 0;
        }

        .requests-list {
          display: grid;
          gap: 10px;
        }

        .request-row {
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 18px;
          padding: 13px;
          display: grid;
          grid-template-columns: minmax(240px, 1fr) 180px minmax(220px, 1fr) auto;
          gap: 12px;
          align-items: center;
        }

        .person-cell {
          display: flex;
          gap: 11px;
          align-items: center;
          min-width: 0;
        }

        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 15px;
          background: #dbeafe;
          color: #1e3a8a;
          display: grid;
          place-items: center;
          font-weight: 950;
          flex-shrink: 0;
        }

        .person-name {
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .person-sub {
          margin-top: 2px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .status-pill {
          display: inline-flex;
          width: fit-content;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 950;
          text-transform: capitalize;
        }

        .status-approved { background: #dcfce7; color: #166534; }
        .status-submitted { background: #dbeafe; color: #1d4ed8; }
        .status-needs_correction { background: #fef3c7; color: #92400e; }
        .status-rejected { background: #fee2e2; color: #991b1b; }
        .status-default { background: #f1f5f9; color: #475569; }

        .chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .chip {
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .red-chip {
          background: #fee2e2;
          color: #991b1b;
          border: none;
        }

        .row-actions {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .small-btn {
          border: none;
          border-radius: 12px;
          padding: 9px 11px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .table-wrap {
          overflow: auto;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
        }

        .emp-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1050px;
          background: white;
        }

        .emp-table th {
          text-align: left;
          background: #f8fafc;
          color: #475569;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .04em;
          padding: 13px 14px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .emp-table td {
          padding: 13px 14px;
          border-bottom: 1px solid #eef2f7;
          vertical-align: middle;
        }

        .emp-table tr:hover td {
          background: #f8fafc;
        }

        .completion {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 130px;
        }

        .bar {
          flex: 1;
          height: 8px;
          border-radius: 999px;
          background: #e5e7eb;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 999px;
        }

        .empty {
          border: 1px dashed #cbd5e1;
          background: #f8fafc;
          color: #64748b;
          border-radius: 18px;
          padding: 26px;
          text-align: center;
          font-weight: 850;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15,23,42,.66);
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }

        .modal {
          width: min(1060px, 100%);
          max-height: 92vh;
          overflow: auto;
          background: white;
          border-radius: 26px;
          box-shadow: 0 35px 90px rgba(0,0,0,.34);
        }

        .modal-head {
          padding: 18px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          position: sticky;
          top: 0;
          background: white;
          z-index: 3;
        }

        .modal-body {
          padding: 18px;
        }

        .modal-tabs {
          display: flex;
          gap: 8px;
          padding: 0 18px 14px;
          border-bottom: 1px solid #e2e8f0;
          flex-wrap: wrap;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(180px, 1fr));
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 6px;
        }

        .field span {
          font-size: 12px;
          font-weight: 900;
          color: #64748b;
        }

        .input,
        .textarea,
        .select {
          border: 1px solid #e2e8f0;
          border-radius: 13px;
          padding: 0 12px;
          min-height: 44px;
          outline: none;
          font-weight: 800;
          background: white;
        }

        .textarea {
          min-height: 130px;
          padding: 12px;
          width: 100%;
          resize: vertical;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 16px;
          flex-wrap: wrap;
        }

        .upload-panel {
          border: 1px dashed #93c5fd;
          background: #eff6ff;
          border-radius: 18px;
          padding: 16px;
          display: grid;
          gap: 12px;
          margin-bottom: 14px;
        }

        .upload-row {
          display: grid;
          grid-template-columns: 180px 1fr auto;
          gap: 10px;
        }

        .file-picker {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px dashed #93c5fd;
          background: white;
          color: #1d4ed8;
          border-radius: 13px;
          padding: 0 12px;
          min-height: 44px;
          font-weight: 900;
          cursor: pointer;
        }

        .docs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
        }

        .doc-card {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 13px;
          background: white;
        }

        .doc-name {
          margin-top: 8px;
          font-weight: 900;
          word-break: break-word;
        }

        .doc-meta {
          margin-top: 5px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .smart-box {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 16px;
          background: #f8fafc;
          margin-bottom: 14px;
        }

        @media (max-width: 1050px) {
          .emp-hero {
            grid-template-columns: 1fr;
          }

          .emp-hero-actions {
            justify-content: flex-start;
          }

          .emp-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .request-row {
            grid-template-columns: 1fr;
          }

          .row-actions {
            justify-content: flex-start;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .upload-row {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .emp-admin-page {
            padding: 14px;
            padding-bottom: 160px;
          }

          .emp-hero {
            border-radius: 22px;
            padding: 18px;
          }

          .emp-stats {
            grid-template-columns: 1fr;
          }

          .emp-tabs {
            width: 100%;
            overflow-x: auto;
          }

          .emp-tab {
            white-space: nowrap;
          }

          .emp-card {
            border-radius: 20px;
            padding: 14px;
          }
        }
      `}</style>

      <div className="emp-admin-page">
        <div className="emp-admin-shell">
          <section className="emp-hero">
            <div className="emp-hero-content">
              <div className="emp-chip">
                <ShieldCheck size={15} />
                Enterprise HR Operations
              </div>
              <h1 className="emp-title">Employee Services Center</h1>
              <p className="emp-subtitle">
                مركز احترافي لإدارة بيانات الموظفين، مراجعة طلبات تحديث البيانات،
                متابعة النواقص، والمستندات بطريقة منظمة وآمنة.
              </p>
            </div>

            <div className="emp-hero-actions">
              <button className="emp-btn emp-btn-light" onClick={loadUpdateRequests}>
                <RefreshCw size={16} /> Requests
              </button>
              <button className="emp-btn emp-btn-light" onClick={loadEmployees}>
                <RefreshCw size={16} /> Refresh
              </button>
              <button className="emp-btn emp-btn-white" onClick={exportExcel}>
                <Download size={16} /> Export Excel
              </button>
            </div>
          </section>

          <section className="emp-stats">
            <Stat icon={<Users />} label="Total Employees" value={stats.total} bg="#eff6ff" color="#2563eb" />
            <Stat icon={<CheckCircle2 />} label="Completed Files" value={stats.complete} bg="#ecfdf3" color="#16a34a" />
            <Stat icon={<AlertTriangle />} label="Missing Data" value={stats.missing} bg="#fffbeb" color="#f59e0b" />
            <Stat icon={<ClipboardCheck />} label="Pending HR Review" value={stats.submitted} bg="#f5f3ff" color="#7c3aed" />
          </section>

          <nav className="emp-tabs">
            <button
              className={`emp-tab ${activeTab === "requests" ? "active" : ""}`}
              onClick={() => setActiveTab("requests")}
            >
              Update Requests
            </button>
            <button
              className={`emp-tab ${activeTab === "employees" ? "active" : ""}`}
              onClick={() => setActiveTab("employees")}
            >
              Employees Directory
            </button>
            <button
              className={`emp-tab ${activeTab === "submitted" ? "active" : ""}`}
              onClick={() => setActiveTab("submitted")}
            >
              HR Review Queue
            </button>
          </nav>

          {activeTab !== "employees" && (
            <section className="emp-card">
              <div className="emp-card-header">
                <div>
                  <h2 className="emp-card-title">
                    {activeTab === "submitted" ? "HR Review Queue" : "Profile Update Requests"}
                  </h2>
                  <p className="emp-card-subtitle">
                    طلبات تحديث البيانات مع المرفقات وحالة الاعتماد.
                  </p>
                </div>
                <button className="emp-btn emp-btn-muted" onClick={loadUpdateRequests}>
                  <RefreshCw size={16} /> Refresh
                </button>
              </div>

              {loadingRequests ? (
                <div className="empty">Loading requests...</div>
              ) : compactRequests.length === 0 ? (
                <div className="empty">No requests found.</div>
              ) : (
                <div className="requests-list">
                  {compactRequests.map((req) => {
                    const fields = Array.isArray(req.requested_fields)
                      ? req.requested_fields
                      : [];
                    const attachments = getRequestAttachments(req);

                    return (
                      <article key={req.id} className="request-row">
                        <div className="person-cell">
                          <div className="avatar">{initials(req.full_name)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div className="person-name">{req.full_name || "-"}</div>
                            <div className="person-sub">
                              GAS ID: {req.gas_id || "-"} · {req.project_name || "-"}
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className={`status-pill status-${req.status || "default"}`}>
                            {req.status || "-"}
                          </span>
                          <div className="person-sub" style={{ marginTop: 6 }}>
                            Created: {formatDate(req.created_at)}
                          </div>
                        </div>

                        <div>
                          <div className="chips">
                            {fields.length ? (
                              fields.slice(0, 6).map((f) => (
                                <span key={f} className="chip">
                                  {fieldLabel(f)}
                                </span>
                              ))
                            ) : (
                              <span className="person-sub">No requested fields</span>
                            )}
                          </div>

                          <div className="chips" style={{ marginTop: 8 }}>
                            {attachments.length ? (
                              attachments.slice(0, 3).map((att, index) => (
                                <button
                                  key={`${att.public_id || index}`}
                                  className="small-btn"
                                  style={{ background: "#eff6ff", color: "#1d4ed8" }}
                                  onClick={() => openUpdateAttachment(att, false)}
                                >
                                  <Eye size={14} /> File {index + 1}
                                </button>
                              ))
                            ) : (
                              <span className="person-sub">No attachments</span>
                            )}
                          </div>
                        </div>

                        <div className="row-actions">
                          {req.status === "submitted" ? (
                            <>
                              <button className="small-btn emp-btn-green" onClick={() => approveRequest(req.id)}>
                                Approve
                              </button>
                              <button className="small-btn emp-btn-amber" onClick={() => sendBackRequest(req.id)}>
                                Correction
                              </button>
                              <button className="small-btn emp-btn-red" onClick={() => rejectRequest(req.id)}>
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="person-sub">No action required</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activeTab === "employees" && (
            <section className="emp-card">
              <div className="emp-card-header">
                <div>
                  <h2 className="emp-card-title">Employee Master Data</h2>
                  <p className="emp-card-subtitle">
                    جدول احترافي لاستعراض بيانات الموظفين ونسبة اكتمال الملف.
                  </p>
                </div>
              </div>

              <div className="emp-toolbar">
                <div className="emp-search">
                  <Search size={18} />
                  <input
                    placeholder="Search by name, GAS ID, project, job title..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <button
                  className={`emp-btn ${onlyMissing ? "emp-btn-amber" : "emp-btn-muted"}`}
                  onClick={() => setOnlyMissing((v) => !v)}
                >
                  Missing data only
                </button>
              </div>

              {loading ? (
                <div className="empty">Loading employees...</div>
              ) : filtered.length === 0 ? (
                <div className="empty">No employees found.</div>
              ) : (
                <div className="table-wrap">
                  <table className="emp-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>GAS ID</th>
                        <th>Project</th>
                        <th>Job Title</th>
                        <th>Status</th>
                        <th>Completion</th>
                        <th>Missing</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((emp) => {
                        const completion = getCompletion(emp);
                        const missing = getMissingFields(emp);
                        const color =
                          completion >= 90 ? "#16a34a" : completion >= 60 ? "#f59e0b" : "#dc2626";

                        return (
                          <tr key={emp.id}>
                            <td>
                              <div className="person-cell">
                                <div className="avatar">{initials(emp.full_name)}</div>
                                <div style={{ minWidth: 0 }}>
                                  <div className="person-name">{emp.full_name || "-"}</div>
                                  <div className="person-sub">{emp.email || "No email"}</div>
                                </div>
                              </div>
                            </td>
                            <td><strong>{emp.gas_id || "-"}</strong></td>
                            <td>{emp.project_name || "-"}</td>
                            <td>{emp.job_title || "-"}</td>
                            <td>
                              <span className="status-pill status-approved">
                                {emp.status || "active"}
                              </span>
                            </td>
                            <td>
                              <div className="completion">
                                <strong>{completion}%</strong>
                                <div className="bar">
                                  <div
                                    className="bar-fill"
                                    style={{ width: `${completion}%`, background: color }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="chips">
                                {missing.length ? (
                                  <>
                                    {missing.slice(0, 3).map((m) => (
                                      <span key={m.key} className="chip red-chip">
                                        {m.label}
                                      </span>
                                    ))}
                                    {missing.length > 3 && (
                                      <span className="chip">+{missing.length - 3}</span>
                                    )}
                                  </>
                                ) : (
                                  <span className="status-pill status-approved">Complete</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <button className="small-btn emp-btn-primary" onClick={() => openEmployee(emp)}>
                                Manage <ChevronRight size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {selected && (
            <div className="modal-overlay">
              <div className="modal">
                <div className="modal-head">
                  <div className="person-cell">
                    <div className="avatar">{initials(selected.full_name)}</div>
                    <div>
                      <h2 style={{ margin: 0, fontWeight: 950 }}>{selected.full_name}</h2>
                      <div className="person-sub">
                        GAS ID: {selected.gas_id || "-"} · {selected.project_name || "-"}
                      </div>
                    </div>
                  </div>

                  <button className="small-btn emp-btn-muted" onClick={() => setSelected(null)}>
                    <X size={16} />
                  </button>
                </div>

                <div className="modal-tabs">
                  {[
                    ["profile", "Profile Data"],
                    ["documents", "Documents Vault"],
                    ["request", "Request Update"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={`emp-tab ${modalTab === key ? "active" : ""}`}
                      onClick={() => setModalTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="modal-body">
                  {modalTab === "profile" && (
                    <>
                      <div className="form-grid">
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

                      <div className="modal-actions">
                        <button className="emp-btn emp-btn-muted" onClick={() => setSelected(null)}>Cancel</button>
                        <button className="emp-btn emp-btn-green" onClick={saveEmployee}>Save Changes</button>
                      </div>
                    </>
                  )}

                  {modalTab === "documents" && (
                    <>
                      <div className="upload-panel">
                        <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <FolderOpen size={18} /> Employee Document Vault
                        </strong>
                        <div className="upload-row">
                          <select className="select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                            {DOC_TYPES.map((d) => (
                              <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </select>

                          <label className="file-picker">
                            <UploadCloud size={18} />
                            {docFile ? docFile.name : "Choose PDF"}
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              hidden
                              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                            />
                          </label>

                          <button className="emp-btn emp-btn-green" onClick={uploadDocument} disabled={uploading}>
                            {uploading ? "Uploading..." : "Upload"}
                          </button>
                        </div>
                      </div>

                      <div className="docs-grid">
                        {documents.length === 0 ? (
                          <div className="empty">No documents uploaded.</div>
                        ) : (
                          documents.map((doc) => (
                            <div key={doc.id} className="doc-card">
                              <FileText size={22} color="#2563eb" />
                              <div className="doc-name">{doc.file_name}</div>
                              <div className="doc-meta">Uploaded by: {doc.uploaded_by || "-"}</div>
                              <div className="doc-meta">Uploaded at: {formatDate(doc.uploaded_at)}</div>

                              <div className="row-actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                                <button className="small-btn emp-btn-muted" onClick={() => openDocument(doc.id)}>
                                  <Eye size={14} /> Preview
                                </button>
                                <button className="small-btn emp-btn-green" onClick={() => downloadDocument(doc.id, doc.file_name)}>
                                  <Download size={14} /> Download
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {modalTab === "request" && (
                    <>
                      <div className="smart-box">
                        <h3 style={{ marginTop: 0 }}>Smart Missing Data Request</h3>
                        <p className="person-sub">
                          النظام يحدد البيانات الناقصة تلقائيًا ويرسل طلب استكمال للموظف.
                        </p>

                        <div className="chips" style={{ marginTop: 12 }}>
                          {getMissingFields(selected).length ? (
                            getMissingFields(selected).map((f) => (
                              <span key={f.key} className="chip red-chip">{f.label}</span>
                            ))
                          ) : (
                            <span className="status-pill status-approved">No missing fields</span>
                          )}
                        </div>

                        {hasActiveRequestForEmployee(selected.id) ? (
                          <div className="smart-box" style={{ marginTop: 12, background: "#fff7ed", color: "#9a3412" }}>
                            يوجد طلب تحديث بيانات نشط لهذا الموظف. راجع الطلب الحالي قبل إرسال طلب جديد.
                          </div>
                        ) : null}

                        <button
                          className="emp-btn emp-btn-amber"
                          style={{ marginTop: 14 }}
                          onClick={sendSmartDataUpdateRequest}
                        >
                          <Send size={16} /> Request Missing Data
                        </button>
                      </div>

                      <div className="smart-box">
                        <h3 style={{ marginTop: 0 }}>Normal Notification</h3>
                        <textarea
                          className="textarea"
                          value={requestMessage}
                          onChange={(e) => setRequestMessage(e.target.value)}
                        />
                        <div className="modal-actions">
                          <button className="emp-btn emp-btn-primary" onClick={sendNormalNotification}>
                            <Send size={16} /> Send Notification
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ icon, label, value, bg, color }) {
  return (
    <div className="emp-stat">
      <div className="emp-stat-icon" style={{ background: bg, color }}>
        {icon}
      </div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
