import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch, API_BASE } from "../services/api";
import {
  AlertTriangle,
  BadgeCheck,
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

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "st-approved";
  if (s === "submitted") return "st-submitted";
  if (s === "rejected") return "st-rejected";
  if (s === "needs_correction") return "st-correction";
  if (s === "pending_employee") return "st-pending";
  return "st-default";
}

export default function AdminEmployeeServicesPage() {
  const [employees, setEmployees] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [updateRequests, setUpdateRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("employees");
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

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

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

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const text = `${emp.full_name || ""} ${emp.gas_id || ""} ${emp.email || ""} ${
        emp.project_name || ""
      } ${emp.package_name || ""} ${emp.job_title || ""}`.toLowerCase();

      const matches = text.includes(search.toLowerCase());
      const missing = getMissingFields(emp).length > 0;

      return matches && (!onlyMissing || missing);
    });
  }, [employees, search, onlyMissing]);

  const stats = useMemo(() => {
    const total = employees.length;
    const completed = employees.filter((e) => getCompletion(e) === 100).length;
    const missing = total - completed;
    const submitted = updateRequests.filter((r) => r.status === "submitted").length;
    return { total, completed, missing, submitted };
  }, [employees, updateRequests]);

  const reviewRequests = useMemo(() => {
    if (activeTab === "review") {
      return updateRequests.filter((r) => r.status === "submitted");
    }
    return updateRequests;
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
      await apiFetch(`/admin/employees/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          phone: selected.phone || "",
          email: selected.email || "",
          id_number: selected.id_number || "",
          join_date: selected.join_date || null,
          address: selected.address || "",
          sabul_short_address: selected.sabul_short_address || "",
          education: selected.education || "",
          emergency_contact: selected.emergency_contact || "",
          status: selected.status || "Active",
        }),
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

      if (!res.ok) return alert(download ? "Download failed" : "Cannot open attachment");

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
        body: JSON.stringify({
          status: "needs_correction",
          hr_note: note,
        }),
      });

      await loadUpdateRequests();
      alert("Request sent back for correction.");
    } catch (err) {
      console.error("CORRECTION REQUEST ERROR:", err);
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
        .aes-page {
          min-height: 100vh;
          padding: 22px;
          background: radial-gradient(circle at top left, rgba(37,99,235,.10), transparent 28%), linear-gradient(180deg,#f8fafc 0%,#eef2f7 100%);
          color: #0f172a;
          font-family: Inter, Segoe UI, Arial, sans-serif;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        .aes-shell {
          width: min(100%, 1320px);
          margin: 0 auto;
        }

        .aes-hero {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          padding: 26px;
          background: linear-gradient(135deg,#020617 0%,#0f2f67 54%,#2563eb 100%);
          color: white;
          box-shadow: 0 26px 70px rgba(15,23,42,.25);
        }

        .aes-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
          background-size: 32px 32px;
          opacity: .38;
        }

        .aes-hero-inner {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 22px;
          align-items: center;
        }

        .aes-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.12);
          color: #dbeafe;
          font-size: 12px;
          font-weight: 900;
        }

        .aes-title {
          margin: 13px 0 8px;
          font-size: clamp(30px, 4vw, 46px);
          line-height: 1.05;
          letter-spacing: -1.2px;
          font-weight: 950;
        }

        .aes-subtitle {
          margin: 0;
          max-width: 820px;
          color: #dbeafe;
          font-size: 15px;
          line-height: 1.8;
          font-weight: 700;
        }

        .aes-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .aes-btn {
          border: none;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          white-space: nowrap;
          transition: .18s ease;
        }

        .aes-btn:hover { transform: translateY(-1px); }

        .btn-light {
          background: rgba(255,255,255,.14);
          color: white;
          border: 1px solid rgba(255,255,255,.18);
        }

        .btn-white { background: white; color: #1d4ed8; }
        .btn-primary { background: #2563eb; color: white; }
        .btn-muted { background: #eef2f7; color: #334155; }
        .btn-green { background: #16a34a; color: white; }
        .btn-red { background: #dc2626; color: white; }
        .btn-amber { background: #f59e0b; color: white; }
        .btn-blue-soft { background: #eff6ff; color: #1d4ed8; }
        .btn-green-soft { background: #ecfdf3; color: #15803d; }

        .aes-stats {
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .aes-stat {
          background: rgba(255,255,255,.96);
          border: 1px solid rgba(226,232,240,.95);
          border-radius: 20px;
          padding: 16px;
          box-shadow: 0 16px 36px rgba(15,23,42,.07);
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
        }

        .aes-stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .aes-stat strong {
          display: block;
          font-size: 28px;
          line-height: 1;
          font-weight: 950;
        }

        .aes-stat span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
        }

        .aes-tabs {
          margin-top: 16px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          background: white;
          border: 1px solid #e2e8f0;
          padding: 7px;
          border-radius: 18px;
          width: fit-content;
          box-shadow: 0 10px 26px rgba(15,23,42,.05);
        }

        .aes-tab {
          border: none;
          background: transparent;
          color: #64748b;
          border-radius: 13px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .aes-tab.active {
          background: #0f172a;
          color: white;
        }

        .aes-card {
          margin-top: 16px;
          background: rgba(255,255,255,.98);
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 18px;
          box-shadow: 0 18px 45px rgba(15,23,42,.075);
        }

        .aes-card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }

        .aes-card-title {
          margin: 0;
          font-size: 23px;
          font-weight: 950;
          letter-spacing: -.3px;
        }

        .aes-card-subtitle {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 14px;
          font-weight: 750;
        }

        .aes-toolbar {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .aes-search {
          flex: 1;
          min-width: 260px;
          height: 48px;
          border-radius: 15px;
          border: 1px solid #dbe3ef;
          background: #f8fafc;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 13px;
          color: #64748b;
        }

        .aes-search input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          font-weight: 850;
          color: #0f172a;
        }

        .person {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
        }

        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 15px;
          background: linear-gradient(135deg,#dbeafe,#eff6ff);
          color: #1e40af;
          display: grid;
          place-items: center;
          font-weight: 950;
          flex-shrink: 0;
        }

        .p-name {
          font-size: 14px;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .p-sub {
          margin-top: 3px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
        }

        .status {
          display: inline-flex;
          width: fit-content;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 950;
          text-transform: capitalize;
        }

        .st-approved { background: #dcfce7; color: #166534; }
        .st-submitted { background: #dbeafe; color: #1d4ed8; }
        .st-rejected { background: #fee2e2; color: #991b1b; }
        .st-correction { background: #fef3c7; color: #92400e; }
        .st-pending { background: #f1f5f9; color: #334155; }
        .st-default { background: #f1f5f9; color: #475569; }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .chip {
          display: inline-flex;
          border-radius: 999px;
          padding: 6px 9px;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          font-size: 11px;
          font-weight: 900;
        }

        .chip-red {
          background: #fee2e2;
          color: #991b1b;
          border-color: #fecaca;
        }

        .small-btn {
          border: none;
          border-radius: 12px;
          min-height: 36px;
          padding: 0 11px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          white-space: nowrap;
        }

        .req-list {
          display: grid;
          gap: 10px;
        }

        .req-row {
          display: grid;
          grid-template-columns: minmax(220px, 1.1fr) 150px minmax(260px, 1.2fr) auto;
          gap: 14px;
          align-items: center;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 10px 24px rgba(15,23,42,.045);
        }

        .req-actions {
          display: flex;
          justify-content: flex-end;
          gap: 7px;
          flex-wrap: wrap;
        }

        .empty {
          padding: 26px;
          border-radius: 18px;
          border: 1px dashed #cbd5e1;
          background: #f8fafc;
          color: #64748b;
          text-align: center;
          font-weight: 850;
        }

        .premium-employee-list {
          display: grid;
          gap: 14px;
        }

        .premium-employee-card {
          display: grid;
          grid-template-columns: minmax(280px, 1.3fr) minmax(220px, .8fr) minmax(260px, 1fr) auto;
          gap: 18px;
          align-items: center;
          padding: 18px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,250,252,.96));
          border: 1px solid #dbe3ef;
          box-shadow: 0 16px 38px rgba(15,23,42,.07);
          transition: .18s ease;
        }

        .premium-employee-card:hover {
          border-color: #93c5fd;
          box-shadow: 0 22px 50px rgba(37,99,235,.12);
          transform: translateY(-1px);
        }

        .premium-emp-main {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .premium-avatar {
          width: 58px;
          height: 58px;
          border-radius: 20px;
          font-size: 18px;
        }

        .premium-emp-info {
          min-width: 0;
        }

        .premium-emp-info h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 950;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .premium-emp-info p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 800;
        }

        .premium-tags {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .premium-tags span {
          padding: 6px 9px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 11px;
          font-weight: 900;
        }

        .premium-work-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .premium-work-grid div {
          padding: 12px;
          border-radius: 17px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .premium-work-grid span,
        .premium-completion-head span {
          display: block;
          color: #64748b;
          font-size: 11px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .premium-work-grid strong {
          display: block;
          margin-top: 6px;
          font-size: 14px;
          font-weight: 950;
        }

        .premium-completion {
          min-width: 0;
        }

        .premium-completion-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 8px;
        }

        .premium-completion-head strong {
          font-size: 16px;
          font-weight: 950;
        }

        .bar {
          width: 100%;
          height: 9px;
          border-radius: 999px;
          overflow: hidden;
          background: #e5e7eb;
        }

        .bar span {
          display: block;
          height: 100%;
          border-radius: 999px;
        }

        .premium-card-actions {
          display: flex;
          justify-content: flex-end;
        }

        .premium-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          background:
            radial-gradient(circle at top left, rgba(37,99,235,.24), transparent 34%),
            rgba(15,23,42,.72);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px;
        }

        .premium-modal {
          width: min(1060px, calc(100vw - 32px));
          max-height: calc(100vh - 44px);
          background: white;
          border-radius: 30px;
          box-shadow: 0 45px 130px rgba(0,0,0,.45);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: modalIn .2s ease-out;
          border: 1px solid rgba(255,255,255,.55);
        }

        @keyframes modalIn {
          from { transform: translateY(18px) scale(.97); opacity: .4; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }

        .modal-head {
          padding: 22px;
          background:
            radial-gradient(circle at top right, rgba(37,99,235,.22), transparent 34%),
            linear-gradient(135deg,#020617 0%,#0f172a 52%,#1d4ed8 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-shrink: 0;
        }

        .modal-head .avatar {
          width: 62px;
          height: 62px;
          border-radius: 22px;
          background: white;
          color: #1d4ed8;
          box-shadow: 0 18px 38px rgba(0,0,0,.22);
        }

        .modal-head .p-sub {
          color: #dbeafe;
        }

        .modal-close {
          width: 44px;
          height: 44px;
          border: none;
          border-radius: 16px;
          background: rgba(255,255,255,.14);
          color: white;
          cursor: pointer;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.18);
        }

        .modal-tabs {
          padding: 12px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          flex-shrink: 0;
          background: #f8fafc;
        }

        .modal-body {
          padding: 20px;
          overflow: auto;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 6px;
        }

        .field span {
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe3ef;
          border-radius: 14px;
          background: #fff;
          min-height: 44px;
          padding: 0 12px;
          outline: none;
          color: #0f172a;
          font-weight: 800;
        }

        .textarea {
          min-height: 130px;
          padding: 12px;
          resize: vertical;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 16px;
          flex-wrap: wrap;
        }

        .upload-panel,
        .smart-panel {
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 16px;
          background: #f8fafc;
          margin-bottom: 14px;
        }

        .upload-row {
          margin-top: 12px;
          display: grid;
          grid-template-columns: 180px minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
        }

        .file-picker {
          min-height: 44px;
          border: 1px dashed #93c5fd;
          background: white;
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          color: #1d4ed8;
          font-weight: 900;
          cursor: pointer;
          overflow: hidden;
        }

        .file-picker span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .docs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(235px, 1fr));
          gap: 12px;
        }

        .doc-card {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 14px;
          background: #fff;
        }

        .doc-name {
          margin-top: 9px;
          font-size: 13px;
          font-weight: 950;
          word-break: break-word;
        }

        .doc-meta {
          margin-top: 5px;
          color: #64748b;
          font-size: 12px;
          font-weight: 750;
        }

        .doc-actions {
          margin-top: 12px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .warning-box {
          margin-top: 12px;
          padding: 12px;
          border-radius: 15px;
          background: #fff7ed;
          color: #9a3412;
          border: 1px solid #fed7aa;
          font-size: 13px;
          font-weight: 850;
        }

        @media (max-width: 1180px) {
          .premium-employee-card {
            grid-template-columns: 1fr 1fr;
          }

          .premium-card-actions {
            justify-content: flex-start;
          }

          .req-row {
            grid-template-columns: 1fr;
          }

          .req-actions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 820px) {
          .aes-page {
            padding: 14px;
            padding-bottom: 160px;
          }

          .aes-hero-inner {
            grid-template-columns: 1fr;
          }

          .aes-actions {
            justify-content: flex-start;
          }

          .aes-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .upload-row {
            grid-template-columns: 1fr;
          }

          .premium-modal-overlay {
            align-items: flex-start;
            padding: 14px;
            padding-top: 18px;
          }

          .premium-modal {
            max-height: calc(100vh - 36px);
            border-radius: 22px;
          }
        }

        @media (max-width: 680px) {
          .premium-employee-card {
            grid-template-columns: 1fr;
          }

          .premium-work-grid {
            grid-template-columns: 1fr;
          }

          .premium-card-actions .aes-btn {
            width: 100%;
          }
        }

        @media (max-width: 560px) {
          .aes-stats {
            grid-template-columns: 1fr;
          }

          .aes-tabs {
            width: 100%;
            overflow-x: auto;
            flex-wrap: nowrap;
          }

          .aes-tab {
            white-space: nowrap;
          }
        }
      `}</style>

      <div className="aes-page">
        <div className="aes-shell">
          <section className="aes-hero">
            <div className="aes-hero-inner">
              <div>
                <div className="aes-badge">
                  <ShieldCheck size={15} />
                  Enterprise HR Operations
                </div>
                <h1 className="aes-title">Employee Services Center</h1>
                <p className="aes-subtitle">
                  مركز احترافي لإدارة بيانات الموظفين، مراجعة طلبات تحديث البيانات،
                  متابعة المستندات، واستكمال النواقص بشكل منظم وآمن.
                </p>
              </div>

              <div className="aes-actions">
                <button className="aes-btn btn-light" onClick={loadUpdateRequests}>
                  <RefreshCw size={16} />
                  Requests
                </button>
                <button className="aes-btn btn-light" onClick={loadEmployees}>
                  <RefreshCw size={16} />
                  Refresh
                </button>
                <button className="aes-btn btn-white" onClick={exportExcel}>
                  <Download size={16} />
                  Export Excel
                </button>
              </div>
            </div>
          </section>

          <section className="aes-stats">
            <Stat icon={<Users />} label="Total Employees" value={stats.total} bg="#eff6ff" color="#2563eb" />
            <Stat icon={<BadgeCheck />} label="Completed Files" value={stats.completed} bg="#ecfdf3" color="#16a34a" />
            <Stat icon={<AlertTriangle />} label="Missing Data" value={stats.missing} bg="#fffbeb" color="#f59e0b" />
            <Stat icon={<ClipboardCheck />} label="Pending HR Review" value={stats.submitted} bg="#f5f3ff" color="#7c3aed" />
          </section>

          <nav className="aes-tabs">
            <button className={`aes-tab ${activeTab === "employees" ? "active" : ""}`} onClick={() => setActiveTab("employees")}>
              Employees Directory
            </button>
            <button className={`aes-tab ${activeTab === "requests" ? "active" : ""}`} onClick={() => setActiveTab("requests")}>
              Update Requests
            </button>
            <button className={`aes-tab ${activeTab === "review" ? "active" : ""}`} onClick={() => setActiveTab("review")}>
              HR Review Queue
            </button>
          </nav>

          {activeTab !== "employees" ? (
            <RequestsPanel
              title={activeTab === "review" ? "HR Review Queue" : "Profile Update Requests"}
              loading={loadingRequests}
              requests={reviewRequests}
              onRefresh={loadUpdateRequests}
              onPreview={openUpdateAttachment}
              onApprove={approveRequest}
              onCorrection={sendBackRequest}
              onReject={rejectRequest}
            />
          ) : (
            <section className="aes-card">
              <div className="aes-card-head">
                <div>
                  <h2 className="aes-card-title">Employee Master Data</h2>
                  <p className="aes-card-subtitle">
                    Directory .
                  </p>
                </div>
              </div>

              <div className="aes-toolbar">
                <div className="aes-search">
                  <Search size={18} />
                  <input
                    placeholder="Search by name, GAS ID, project, job title..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <button
                  className={`aes-btn ${onlyMissing ? "btn-amber" : "btn-muted"}`}
                  onClick={() => setOnlyMissing((v) => !v)}
                >
                  Missing data only
                </button>
              </div>

              {loading ? (
                <div className="empty">Loading employees...</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="empty">No employees found.</div>
              ) : (
                <div className="premium-employee-list">
                  {filteredEmployees.map((emp) => {
                    const completion = getCompletion(emp);
                    const missing = getMissingFields(emp);
                    const color =
                      completion >= 90 ? "#16a34a" : completion >= 60 ? "#f59e0b" : "#dc2626";

                    return (
                      <article key={emp.id} className="premium-employee-card">
                        <div className="premium-emp-main">
                          <div className="avatar premium-avatar">{initials(emp.full_name)}</div>

                          <div className="premium-emp-info">
                            <h3>{emp.full_name || "-"}</h3>
                            <p>{emp.email || "No email"}</p>

                            <div className="premium-tags">
                              <span>GAS ID: {emp.gas_id || "-"}</span>
                              <span>{emp.project_name || "No Project"}</span>
                              <span>PKG {emp.package_name || "-"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="premium-work-grid">
                          <div>
                            <span>Job Title</span>
                            <strong>{emp.job_title || "-"}</strong>
                          </div>

                          <div>
                            <span>Status</span>
                            <strong className="status st-approved">{emp.status || "active"}</strong>
                          </div>
                        </div>

                        <div className="premium-completion">
                          <div className="premium-completion-head">
                            <span>Profile Completion</span>
                            <strong>{completion}%</strong>
                          </div>

                          <div className="bar">
                            <span style={{ width: `${completion}%`, background: color }} />
                          </div>

                          <div className="chips" style={{ marginTop: 10 }}>
                            {missing.length ? (
                              <>
                                {missing.slice(0, 3).map((m) => (
                                  <span key={m.key} className="chip chip-red">
                                    {m.label}
                                  </span>
                                ))}
                                {missing.length > 3 && (
                                  <span className="chip">+{missing.length - 3}</span>
                                )}
                              </>
                            ) : (
                              <span className="status st-approved">Complete</span>
                            )}
                          </div>
                        </div>

                        <div className="premium-card-actions">
                          <button className="aes-btn btn-primary" onClick={() => openEmployee(emp)}>
                            Manage Employee
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {selected
            ? createPortal(
                <EmployeeModal
                  selected={selected}
                  setSelected={setSelected}
                  modalTab={modalTab}
                  setModalTab={setModalTab}
                  documents={documents}
                  docType={docType}
                  setDocType={setDocType}
                  docFile={docFile}
                  setDocFile={setDocFile}
                  uploading={uploading}
                  requestMessage={requestMessage}
                  setRequestMessage={setRequestMessage}
                  getMissingFields={getMissingFields}
                  hasActiveRequestForEmployee={hasActiveRequestForEmployee}
                  onClose={() => setSelected(null)}
                  onSave={saveEmployee}
                  onUpload={uploadDocument}
                  onOpenDoc={openDocument}
                  onDownloadDoc={downloadDocument}
                  onSmartRequest={sendSmartDataUpdateRequest}
                  onNormalNotification={sendNormalNotification}
                />,
                document.body
              )
            : null}
        </div>
      </div>
    </>
  );
}

function RequestsPanel({
  title,
  loading,
  requests,
  onRefresh,
  onPreview,
  onApprove,
  onCorrection,
  onReject,
}) {
  return (
    <section className="aes-card">
      <div className="aes-card-head">
        <div>
          <h2 className="aes-card-title">{title}</h2>
          <p className="aes-card-subtitle">مراجعة طلبات تحديث البيانات مع المرفقات والإجراءات.</p>
        </div>

        <button className="aes-btn btn-muted" onClick={onRefresh}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="empty">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="empty">No requests found.</div>
      ) : (
        <div className="req-list">
          {requests.map((req) => {
            const fields = Array.isArray(req.requested_fields) ? req.requested_fields : [];
            const attachments = getRequestAttachments(req);

            return (
              <article key={req.id} className="req-row">
                <div className="person">
                  <div className="avatar">{initials(req.full_name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="p-name">{req.full_name || "-"}</div>
                    <div className="p-sub">GAS ID: {req.gas_id || "-"} · {req.project_name || "-"}</div>
                  </div>
                </div>

                <div>
                  <span className={`status ${statusClass(req.status)}`}>{req.status || "-"}</span>
                  <div className="p-sub" style={{ marginTop: 6 }}>{formatDate(req.created_at)}</div>
                </div>

                <div>
                  <div className="chips">
                    {fields.length ? (
                      fields.slice(0, 6).map((f) => <span key={f} className="chip">{fieldLabel(f)}</span>)
                    ) : (
                      <span className="p-sub">No requested fields</span>
                    )}
                  </div>

                  <div className="chips" style={{ marginTop: 8 }}>
                    {attachments.length ? (
                      attachments.slice(0, 4).map((att, index) => (
                        <button
                          key={`${att.public_id || index}`}
                          className="small-btn btn-blue-soft"
                          onClick={() => onPreview(att, false)}
                        >
                          <Eye size={14} />
                          File {index + 1}
                        </button>
                      ))
                    ) : (
                      <span className="p-sub">No attachments</span>
                    )}
                  </div>
                </div>

                <div className="req-actions">
                  {req.status === "submitted" ? (
                    <>
                      <button className="small-btn btn-green" onClick={() => onApprove(req.id)}>Approve</button>
                      <button className="small-btn btn-amber" onClick={() => onCorrection(req.id)}>Correction</button>
                      <button className="small-btn btn-red" onClick={() => onReject(req.id)}>Reject</button>
                    </>
                  ) : (
                    <span className="p-sub">No action required</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EmployeeModal({
  selected,
  setSelected,
  modalTab,
  setModalTab,
  documents,
  docType,
  setDocType,
  docFile,
  setDocFile,
  uploading,
  requestMessage,
  setRequestMessage,
  getMissingFields,
  hasActiveRequestForEmployee,
  onClose,
  onSave,
  onUpload,
  onOpenDoc,
  onDownloadDoc,
  onSmartRequest,
  onNormalNotification,
}) {
  return (
    <div className="premium-modal-overlay">
      <div className="premium-modal">
        <div className="modal-head">
          <div className="person">
            <div className="avatar">{initials(selected.full_name)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="p-name" style={{ fontSize: 22, color: "white" }}>
                {selected.full_name || "-"}
              </div>
              <div className="p-sub">
                GAS ID: {selected.gas_id || "-"} · {selected.project_name || "-"} · {selected.job_title || "-"}
              </div>
            </div>
          </div>

          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-tabs">
          <button className={`aes-tab ${modalTab === "profile" ? "active" : ""}`} onClick={() => setModalTab("profile")}>Profile Data</button>
          <button className={`aes-tab ${modalTab === "documents" ? "active" : ""}`} onClick={() => setModalTab("documents")}>Documents Vault</button>
          <button className={`aes-tab ${modalTab === "request" ? "active" : ""}`} onClick={() => setModalTab("request")}>Request Update</button>
        </div>

        <div className="modal-body">
          {modalTab === "profile" ? (
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
                <button className="aes-btn btn-muted" onClick={onClose}>Cancel</button>
                <button className="aes-btn btn-green" onClick={onSave}>Save Changes</button>
              </div>
            </>
          ) : null}

          {modalTab === "documents" ? (
            <>
              <div className="upload-panel">
                <strong style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <FolderOpen size={18} />
                  Employee Document Vault
                </strong>

                <div className="upload-row">
                  <select className="select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                    {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>

                  <label className="file-picker">
                    <UploadCloud size={18} />
                    <span>{docFile ? docFile.name : "Choose PDF"}</span>
                    <input
                      type="file"
                      hidden
                      accept="application/pdf,.pdf"
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    />
                  </label>

                  <button className="aes-btn btn-green" onClick={onUpload} disabled={uploading}>
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>

              {documents.length === 0 ? (
                <div className="empty">No documents uploaded.</div>
              ) : (
                <div className="docs-grid">
                  {documents.map((doc) => (
                    <div key={doc.id} className="doc-card">
                      <FileText size={23} color="#2563eb" />
                      <div className="doc-name">{doc.file_name || "document.pdf"}</div>
                      <div className="doc-meta">Uploaded by: {doc.uploaded_by || "-"}</div>
                      <div className="doc-meta">Uploaded at: {formatDate(doc.uploaded_at)}</div>

                      <div className="doc-actions">
                        <button className="small-btn btn-blue-soft" onClick={() => onOpenDoc(doc.id)}>
                          <Eye size={14} />
                          Preview
                        </button>
                        <button className="small-btn btn-green-soft" onClick={() => onDownloadDoc(doc.id, doc.file_name)}>
                          <Download size={14} />
                          Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {modalTab === "request" ? (
            <>
              <div className="smart-panel">
                <h3 style={{ margin: 0, fontSize: 18 }}>Smart Missing Data Request</h3>
                <p className="p-sub" style={{ marginTop: 8 }}>النظام يحدد البيانات الناقصة ويرسل طلب استكمال للموظف.</p>

                <div className="chips" style={{ marginTop: 12 }}>
                  {getMissingFields(selected).length ? (
                    getMissingFields(selected).map((f) => (
                      <span key={f.key} className="chip chip-red">{f.label}</span>
                    ))
                  ) : (
                    <span className="status st-approved">No missing fields</span>
                  )}
                </div>

                {hasActiveRequestForEmployee(selected.id) ? (
                  <div className="warning-box">يوجد طلب تحديث بيانات نشط لهذا الموظف. راجع الطلب الحالي قبل إرسال طلب جديد.</div>
                ) : null}

                <button className="aes-btn btn-amber" style={{ marginTop: 14 }} onClick={onSmartRequest}>
                  <Send size={16} />
                  Request Missing Data
                </button>
              </div>

              <div className="smart-panel">
                <h3 style={{ margin: 0, fontSize: 18 }}>Normal Notification</h3>
                <textarea
                  className="textarea"
                  style={{ marginTop: 12 }}
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                />
                <div className="modal-actions">
                  <button className="aes-btn btn-primary" onClick={onNormalNotification}>
                    <Send size={16} />
                    Send Notification
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, bg, color }) {
  return (
    <div className="aes-stat">
      <div className="aes-stat-icon" style={{ background: bg, color }}>
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
