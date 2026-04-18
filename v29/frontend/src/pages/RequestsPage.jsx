import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";

const initialForm = {
  employeeId: "",
  employeeGasId: "",
  type: "annual_leave",
  startDate: "",
  endDate: "",
  note: "",
  attachment: null,
  currentBank: "",
  newBank: "",
  newIban: "",
};

const fallbackTypes = [
  { code: "annual_leave", label: "إجازة سنوية", requiresAttachment: false, requiresDateRange: true, requiresBankFields: false },
  { code: "sick_leave", label: "إجازة مرضية", requiresAttachment: true, requiresDateRange: true, requiresBankFields: false },
  { code: "emergency_leave", label: "إجازة اضطرارية", requiresAttachment: false, requiresDateRange: true, requiresBankFields: false },
  { code: "salary_transfer", label: "تحويل راتب", requiresAttachment: true, requiresDateRange: false, requiresBankFields: true },
  { code: "payslip_request", label: "طلب تعريف بالراتب / Payslip", requiresAttachment: false, requiresDateRange: false, requiresBankFields: false },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "success";
  if (s === "rejected") return "danger";
  return "warning";
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDisplayDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function formatDateRange(start, end) {
  const startLabel = formatDisplayDate(start);
  const endLabel = formatDisplayDate(end);

  if (!start && !end) return "-";
  if (start && end && String(start) !== String(end)) {
    return `${startLabel} → ${endLabel}`;
  }
  return startLabel;
}

function getAuthToken() {
  const raw = localStorage.getItem("hr_portal_auth");
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return parsed?.token || "";
  } catch {
    return raw;
  }
}

/* ✅ التعديل هنا فقط */
function getApiBaseUrl() {
  return "https://gas-hr-project.onrender.com";
}

function buildFileUrl(requestId) {
  return `${getApiBaseUrl()}/files/request/${requestId}`;
}

function extractFilenameFromDisposition(disposition) {
  if (!disposition) return "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  return match?.[1] || "";
}

function requestTypeLabel(typeCode, types) {
  const found = (types || []).find((t) => t.code === typeCode);
  return found?.label || typeCode || "-";
}

export default function RequestsPage() {
  const { user } = useAuth();

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [fileBusyId, setFileBusyId] = useState("");
  const [error, setError] = useState("");

  async function fetchAttachmentResponse(requestId) {
    const token = getAuthToken();
    const url = buildFileUrl(requestId);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load attachment");
    }

    return response;
  }

  async function handlePreview(id) {
    try {
      setFileBusyId(`preview-${id}`);
      setError("");

      const res = await fetchAttachmentResponse(id);
      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");

    } catch (e) {
      setError("Preview failed");
    } finally {
      setFileBusyId("");
    }
  }

  async function handleDownload(id, name) {
    try {
      setFileBusyId(`download-${id}`);
      setError("");

      const res = await fetchAttachmentResponse(id);
      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name || "file";
      a.click();

    } catch (e) {
      setError("Download failed");
    } finally {
      setFileBusyId("");
    }
  }

  return (
    <div>
      <h1>Requests</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {leaveRequests.map((item) => (
        <div key={item.id}>
          <span>{item.employeeName}</span>

          <button onClick={() => handlePreview(item.id)}>
            Preview
          </button>

          <button onClick={() => handleDownload(item.id, item.attachmentName)}>
            Download
          </button>
        </div>
      ))}
    </div>
  );
}