import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Download,
  Eye,
  FileText,
  Filter,
  Pencil,
  Printer,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
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

const defaultDesigner = {
  fontFamily: "Times New Roman",
  fontSize: 11,
  titleSize: 21,
  borderColor: "#000000",
  headerBg: "#f3f3f3",
  textColor: "#000000",
  titleColor: "#000000",
  isBold: true,
  zoom: 100,
  customNote: "",
};

function ModalPortal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function buildQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

function formatShortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function StatCard({ label, value, icon: Icon, tone = "blue" }) {
  return (
    <div className={`lf-stat lf-stat-${tone}`}>
      <div>
        <p>{label}</p>
        <strong>{value ?? 0}</strong>
      </div>
      <span>
        <Icon size={20} />
      </span>
    </div>
  );
}

export default function LeaveFormsPage() {
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState({ total: 0, annual: 0, emergency: 0, sick: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [selectedForm, setSelectedForm] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const [designerOpen, setDesignerOpen] = useState(false);
  const [designerSaving, setDesignerSaving] = useState(false);
  const [designer, setDesigner] = useState(defaultDesigner);

  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [fieldsSaving, setFieldsSaving] = useState(false);
  const [customFields, setCustomFields] = useState({});

  const [filters, setFilters] = useState({
    search: "",
    project: "",
    packageName: "",
    type: "",
    month: "",
    year: String(currentYear),
  });

  const years = useMemo(() => {
    return ["", ...Array.from({ length: 6 }, (_, index) => String(currentYear - index))];
  }, []);

  const checkboxItems = [
    ["vacationSalaryYes", "Vacation Salary - YES"],
    ["vacationSalaryNo", "Vacation Salary - NO"],
    ["exitReentryYes", "Exit Re-Entry - YES"],
    ["exitReentryNo", "Exit Re-Entry - NO"],
    ["ticketYes", "Ticket - YES"],
    ["ticketNo", "Ticket - NO"],
    ["leaveApproved", "Leave Approved"],
    ["leaveNotApproved", "Leave Not Approved"],
    ["leaveRescheduled", "Leave Re-Scheduled"],
    ["leaveApprovedCondition", "Leave Approved With Condition"],
    ["leaveApprovedUnpaid", "Leave Approved Unpaid"],
  ];

  async function loadForms() {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch(`/leave-forms${buildQuery(filters)}`);
      setForms(Array.isArray(data.forms) ? data.forms : []);
      setStats(data.stats || { total: 0, annual: 0, emergency: 0, sick: 0 });
    } catch (err) {
      setError(err.message || "Failed to load leave forms");
      setForms([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDesigner() {
    try {
      const data = await apiFetch("/leave-forms/template");
      setDesigner({ ...defaultDesigner, ...(data.template || {}) });
    } catch {
      setDesigner(defaultDesigner);
    }
  }

  useEffect(() => {
    loadForms();
    loadDesigner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    const next = {
      search: "",
      project: "",
      packageName: "",
      type: "",
      month: "",
      year: String(currentYear),
    };
    setFilters(next);
    setTimeout(() => loadForms(), 0);
  }

  async function openPreview(form) {
    setPreviewLoading(true);
    setSelectedForm(form);
    setPreviewHtml("");

    try {
      const data = await apiFetch(`/leave-forms/${form.requestId}`);
      setPreviewHtml(data.html || "");
      setSelectedForm(data.form || form);
    } catch (err) {
      setPreviewHtml(
        `<div style="font-family:Arial;padding:24px;color:#b91c1c;">${
          err.message || "Failed to load form"
        }</div>`
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  function openEdit(form) {
    setEditForm({
      requestId: form.requestId,
      employeeGasId: form.employeeGasId || "",
      employeeName: form.employeeName || "",
      type: form.type || "annual_leave",
      startDate: toInputDate(form.startDate),
      endDate: toInputDate(form.endDate),
      status: form.status || "approved",
      note: form.note || "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editForm?.requestId) return;

    setEditSaving(true);
    try {
      await apiFetch(`/leave-forms/${editForm.requestId}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });

      setEditOpen(false);
      setEditForm(null);
      await loadForms();

      if (selectedForm?.requestId === editForm.requestId) {
        await openPreview({ ...selectedForm, ...editForm });
      }
    } catch (err) {
      alert(err.message || "Failed to save form");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteForm(form) {
    const ok = window.confirm(`Delete leave form for ${form.employeeName || "employee"}?`);
    if (!ok) return;

    try {
      await apiFetch(`/leave-forms/${form.requestId}`, { method: "DELETE" });
      await loadForms();
      if (selectedForm?.requestId === form.requestId) setSelectedForm(null);
    } catch (err) {
      alert(err.message || "Failed to delete form");
    }
  }

  async function saveDesigner() {
    setDesignerSaving(true);
    try {
      await apiFetch("/leave-forms/template", {
        method: "PUT",
        body: JSON.stringify({ template: designer }),
      });

      setDesignerOpen(false);
      await loadDesigner();

      if (selectedForm) await openPreview(selectedForm);
    } catch (err) {
      alert(err.message || "Failed to save template");
    } finally {
      setDesignerSaving(false);
    }
  }

  function openFields(form) {
    setSelectedForm(form);

    const custom = form.customData || {};

    setCustomFields({
      employeeMobile: custom.employeeMobile || "",
      homeTelephone: custom.homeTelephone || "",
      homeMobile: custom.homeMobile || "",
      homeAddress: custom.homeAddress || "",
      emergencyTelephone: custom.emergencyTelephone || "",
      emergencyMobile: custom.emergencyMobile || "",
      emergencyAddress: custom.emergencyAddress || "",

      departureDate: custom.departureDate || "",
      departureFrom: custom.departureFrom || "",
      departureTo: custom.departureTo || "",
      returnDate: custom.returnDate || "",
      returnFrom: custom.returnFrom || "",
      returnTo: custom.returnTo || "",
      rejoiningDate: custom.rejoiningDate || "",

      vacationSalaryYes: Boolean(custom.vacationSalaryYes),
      vacationSalaryNo: Boolean(custom.vacationSalaryNo),
      exitReentryYes: Boolean(custom.exitReentryYes),
      exitReentryNo: Boolean(custom.exitReentryNo),
      ticketYes: Boolean(custom.ticketYes),
      ticketNo: Boolean(custom.ticketNo),

      leaveApproved: custom.leaveApproved ?? true,
      leaveNotApproved: Boolean(custom.leaveNotApproved),
      leaveRescheduled: Boolean(custom.leaveRescheduled),
      leaveApprovedCondition: Boolean(custom.leaveApprovedCondition),
      leaveApprovedUnpaid: Boolean(custom.leaveApprovedUnpaid),

      customExtraText: custom.customExtraText || "",
    });

    setFieldsOpen(true);
  }

  async function saveCustomFields() {
    if (!selectedForm?.requestId) return;

    setFieldsSaving(true);
    try {
      await apiFetch(`/leave-forms/${selectedForm.requestId}/custom-fields`, {
        method: "PUT",
        body: JSON.stringify({ customData: customFields }),
      });

      setFieldsOpen(false);
      await loadForms();
      await openPreview(selectedForm);
    } catch (err) {
      alert(err.message || "Failed to save form fields");
    } finally {
      setFieldsSaving(false);
    }
  }

  async function downloadPdf(form) {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/leave-forms/${form.requestId}/pdf`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        let message = "Failed to download PDF";
        try {
          const data = await response.json();
          message = data.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const gasId = String(form.employeeGasId || "employee").replace(/[^a-zA-Z0-9_-]+/g, "_");
      a.href = url;
      a.download = `Leave_Request_Form_${gasId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Failed to download PDF");
    }
  }

  function printPreview() {
    const frame = document.getElementById("leave-form-preview-frame");
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }
  }

  return (
    <div className="leave-forms-page">
      <style>{`
        .leave-forms-page {
          min-height: 100%;
          padding: 24px;
          color: #0f172a;
          background:
            radial-gradient(circle at 10% -8%, rgba(37,99,235,.22), transparent 28%),
            radial-gradient(circle at 92% 0%, rgba(14,165,233,.18), transparent 31%),
            radial-gradient(circle at 50% 100%, rgba(15,23,42,.08), transparent 38%),
            linear-gradient(180deg, #f8fafc, #eef4ff);
        }

        .lf-hero {
          border-radius: 36px;
          padding: 30px;
          margin-bottom: 18px;
          background:
            linear-gradient(135deg, rgba(2,6,23,.98), rgba(15,23,42,.96) 42%, rgba(30,64,175,.92)),
            radial-gradient(circle at 92% 12%, rgba(125,211,252,.38), transparent 36%);
          color: #fff;
          box-shadow:
            0 34px 90px rgba(15,23,42,.26),
            inset 0 1px 0 rgba(255,255,255,.16);
          display: flex;
          justify-content: space-between;
          gap: 20px;
          overflow: hidden;
          position: relative;
        }

        .lf-hero::before {
          content: "";
          position: absolute;
          width: 380px;
          height: 380px;
          right: -135px;
          top: -175px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(125,211,252,.36), transparent 70%);
        }

        .lf-hero > * {
          position: relative;
          z-index: 1;
        }

        .lf-hero h1 {
          margin: 0;
          font-size: clamp(2rem, 4vw, 3.7rem);
          letter-spacing: -0.08em;
          line-height: .92;
        }

        .lf-hero p {
          margin: 13px 0 0;
          max-width: 820px;
          color: rgba(226,232,240,.9);
          font-weight: 800;
          line-height: 1.7;
        }

        .lf-oracle-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.20);
          font-weight: 950;
          margin-bottom: 13px;
          backdrop-filter: blur(14px);
        }

        .lf-hero-actions {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .lf-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .lf-stat {
          min-height: 116px;
          border: 1px solid rgba(255,255,255,.84);
          border-radius: 30px;
          padding: 20px;
          background:
            radial-gradient(circle at 96% 0%, rgba(37,99,235,.10), transparent 36%),
            rgba(255,255,255,.82);
          backdrop-filter: blur(22px);
          box-shadow:
            0 24px 65px rgba(15,23,42,.10),
            inset 0 1px 0 rgba(255,255,255,.88);
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          overflow: hidden;
        }

        .lf-stat::after {
          content: "";
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 999px;
          right: -48px;
          bottom: -65px;
          background: rgba(37,99,235,.22);
        }

        .lf-stat-green::after { background: rgba(22,163,74,.25); }
        .lf-stat-orange::after { background: rgba(249,115,22,.24); }
        .lf-stat-red::after { background: rgba(220,38,38,.22); }

        .lf-stat p {
          margin: 0 0 8px;
          color: #64748b;
          font-size: .74rem;
          font-weight: 950;
          letter-spacing: .07em;
          text-transform: uppercase;
        }

        .lf-stat strong {
          font-size: 2.2rem;
          letter-spacing: -.06em;
        }

        .lf-stat span {
          width: 50px;
          height: 50px;
          border-radius: 19px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #eff6ff, #dbeafe);
          color: #2563eb;
          z-index: 1;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
        }

        .lf-shell {
          border-radius: 34px;
          border: 1px solid rgba(255,255,255,.82);
          background:
            linear-gradient(180deg, rgba(255,255,255,.9), rgba(248,250,252,.78));
          box-shadow:
            0 34px 90px rgba(15,23,42,.14),
            inset 0 1px 0 rgba(255,255,255,.9);
          overflow: hidden;
          backdrop-filter: blur(22px);
        }

        .lf-toolbar {
          padding: 18px;
          display: grid;
          grid-template-columns: 1.4fr repeat(5, minmax(120px, 1fr)) auto auto;
          gap: 10px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,250,252,.82));
          border-bottom: 1px solid rgba(226,232,240,.88);
        }

        .lf-input,
        .lf-select,
        .lf-textarea {
          width: 100%;
          border: 1px solid #d7e0ee;
          border-radius: 16px;
          background: #fff;
          color: #0f172a;
          font-weight: 850;
          outline: none;
          transition: .18s ease;
        }

        .lf-input,
        .lf-select {
          min-height: 46px;
          padding: 0 14px;
        }

        .lf-textarea {
          min-height: 96px;
          padding: 13px;
          resize: vertical;
        }

        .lf-input:focus,
        .lf-select:focus,
        .lf-textarea:focus {
          border-color: rgba(37,99,235,.65);
          box-shadow: 0 0 0 4px rgba(37,99,235,.13);
        }

        .lf-search-wrap {
          position: relative;
        }

        .lf-search-wrap svg {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .lf-search-wrap input {
          padding-left: 42px;
        }

        .lf-btn {
          min-height: 46px;
          border: 0;
          border-radius: 16px;
          padding: 0 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 950;
          cursor: pointer;
          white-space: nowrap;
          transition: .18s ease;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.16);
        }

        .lf-btn:hover {
          transform: translateY(-1px);
          filter: saturate(1.05);
        }

        .lf-btn:disabled {
          opacity: .65;
          cursor: not-allowed;
          transform: none;
        }

        .lf-btn-primary {
          color: #fff;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          box-shadow: 0 14px 28px rgba(37,99,235,.25);
        }

        .lf-btn-dark {
          color: #fff;
          background: linear-gradient(135deg, #020617, #1e293b);
        }

        .lf-btn-soft {
          color: #334155;
          background: linear-gradient(135deg, #ffffff, #eef2f7);
          border: 1px solid #dbe3ef;
        }

        .lf-btn-danger {
          color: #b91c1c;
          background: linear-gradient(135deg, #fee2e2, #fecaca);
          border: 1px solid rgba(248,113,113,.35);
        }

        .lf-card-grid {
          padding: 18px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .lf-form-card {
          border: 1px solid rgba(226,232,240,.95);
          border-radius: 30px;
          padding: 20px;
          background:
            radial-gradient(circle at 95% 0%, rgba(59,130,246,.12), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.9));
          box-shadow:
            0 24px 58px rgba(15,23,42,.10),
            inset 0 1px 0 rgba(255,255,255,.9);
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          transition: .2s ease;
        }

        .lf-form-card:hover {
          transform: translateY(-3px);
          box-shadow:
            0 30px 75px rgba(15,23,42,.15),
            inset 0 1px 0 rgba(255,255,255,.9);
        }

        .lf-employee-name {
          margin: 0;
          font-size: 1.12rem;
          letter-spacing: -.035em;
          color: #0f172a;
        }

        .lf-id {
          display: inline-flex;
          margin-top: 8px;
          padding: 7px 10px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: .78rem;
          font-weight: 950;
          border: 1px solid #bfdbfe;
        }

        .lf-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        .lf-meta div {
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 10px;
        }

        .lf-meta span {
          display: block;
          color: #64748b;
          font-size: .7rem;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .06em;
          margin-bottom: 5px;
        }

        .lf-meta strong {
          font-size: .88rem;
          color: #0f172a;
        }

        .lf-side {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: flex-end;
        }

        .lf-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 11px;
          border-radius: 999px;
          font-size: .75rem;
          font-weight: 950;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          white-space: nowrap;
        }

        .lf-chip-ok {
          background: #dcfce7;
          color: #166534;
          border-color: #bbf7d0;
        }

        .lf-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: auto;
          min-width: 268px;
        }

        .lf-empty,
        .lf-error {
          padding: 34px;
          text-align: center;
          font-weight: 950;
          color: #64748b;
        }

        .lf-error {
          margin: 18px;
          border-radius: 20px;
          background: #fee2e2;
          color: #991b1b;
        }

        .lf-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          width: 100vw;
          height: 100vh;
          background:
            radial-gradient(circle at 20% 10%, rgba(59,130,246,.28), transparent 32%),
            radial-gradient(circle at 80% 20%, rgba(14,165,233,.22), transparent 34%),
            rgba(2,6,23,.78);
          backdrop-filter: blur(18px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px;
          overflow: hidden;
        }

        .lf-modal {
          width: min(1240px, calc(100vw - 36px));
          height: min(820px, calc(100vh - 36px));
          max-height: calc(100vh - 36px);
          border-radius: 34px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.96));
          border: 1px solid rgba(255,255,255,.78);
          box-shadow:
            0 40px 120px rgba(0,0,0,.45),
            0 0 0 1px rgba(255,255,255,.28) inset;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: lfModalIn .18s ease-out;
        }

        .lf-modal-sm {
          width: min(900px, calc(100vw - 36px));
          height: auto;
          max-height: calc(100vh - 36px);
        }

        @keyframes lfModalIn {
          from {
            opacity: 0;
            transform: translateY(18px) scale(.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .lf-modal-head {
          padding: 18px 20px;
          background:
            linear-gradient(135deg, #020617, #0f172a 48%, #1e40af);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          border-bottom: 1px solid rgba(255,255,255,.12);
          position: relative;
          overflow: hidden;
        }

        .lf-modal-head::before {
          content: "";
          position: absolute;
          width: 260px;
          height: 260px;
          right: -90px;
          top: -150px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(125,211,252,.38), transparent 68%);
        }

        .lf-modal-head > * {
          position: relative;
          z-index: 1;
        }

        .lf-modal-head strong {
          display: block;
          font-size: 1.15rem;
          letter-spacing: -.035em;
        }

        .lf-modal-head span {
          display: block;
          margin-top: 4px;
          color: rgba(226,232,240,.84);
          font-size: .82rem;
          font-weight: 850;
        }

        .lf-modal-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .lf-form-body {
          padding: 20px;
          overflow: auto;
          background:
            radial-gradient(circle at 0% 0%, rgba(59,130,246,.08), transparent 28%),
            linear-gradient(180deg, #ffffff, #f8fafc);
        }

        .lf-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .lf-field {
          padding: 12px;
          border-radius: 20px;
          background: rgba(255,255,255,.86);
          border: 1px solid rgba(226,232,240,.95);
          box-shadow: 0 12px 28px rgba(15,23,42,.045);
        }

        .lf-field label {
          display: block;
          color: #475569;
          font-size: .72rem;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .07em;
          margin: 0 0 8px;
        }

        .lf-field-full {
          grid-column: 1 / -1;
        }

        .lf-frame-wrap {
          flex: 1;
          padding: 16px;
          background:
            linear-gradient(135deg, #dbeafe, #f8fafc 42%, #e2e8f0);
          overflow: hidden;
        }

        .lf-frame {
          width: 100%;
          height: 100%;
          border: 0;
          border-radius: 22px;
          background: #fff;
          box-shadow:
            0 22px 60px rgba(15,23,42,.2),
            0 0 0 1px rgba(148,163,184,.22);
        }

        .lf-section-label {
          grid-column: 1 / -1;
          padding: 12px 14px;
          border-radius: 18px;
          background:
            linear-gradient(135deg, #020617, #1e3a8a);
          color: #fff;
          font-weight: 950;
          box-shadow: 0 14px 30px rgba(30,64,175,.22);
        }

        .lf-check-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .lf-check-item {
          display: flex;
          gap: 10px;
          align-items: center;
          min-height: 46px;
          padding: 11px 12px;
          border-radius: 16px;
          background: linear-gradient(180deg, #fff, #f8fafc);
          border: 1px solid #e2e8f0;
          font-weight: 950;
          color: #0f172a;
        }

        .lf-check-item input {
          width: 18px;
          height: 18px;
          accent-color: #2563eb;
        }

        .lf-designer-preview {
          margin-top: 14px;
          border: 1px dashed #cbd5e1;
          border-radius: 20px;
          padding: 16px;
          background: #f8fafc;
        }

        .lf-preview-paper {
          margin: 0 auto;
          width: min(100%, 520px);
          min-height: 260px;
          background: #fff;
          border: 2px solid var(--border-color);
          color: var(--text-color);
          font-family: var(--font-family);
          font-size: var(--font-size);
          transform: scale(var(--zoom));
          transform-origin: top center;
          padding: 18px;
        }

        .lf-preview-title {
          color: var(--title-color);
          font-size: var(--title-size);
          font-weight: var(--title-weight);
          text-align: center;
          border-bottom: 2px solid var(--border-color);
          padding-bottom: 10px;
          margin-bottom: 12px;
        }

        .lf-preview-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid var(--border-color);
        }

        .lf-preview-row div {
          padding: 8px;
          border-right: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
        }

        .lf-preview-row div:nth-child(2n) {
          border-right: 0;
        }

        .lf-preview-label {
          background: var(--header-bg);
          font-weight: 700;
        }

        html.dark .leave-forms-page {
          background:
            radial-gradient(circle at 12% -10%, rgba(59,130,246,.22), transparent 28%),
            #020617;
          color: #e5e7eb;
        }

        html.dark .lf-shell,
        html.dark .lf-stat,
        html.dark .lf-form-card,
        html.dark .lf-modal {
          background: rgba(15,23,42,.94);
          border-color: rgba(51,65,85,.8);
        }

        html.dark .lf-toolbar,
        html.dark .lf-meta div,
        html.dark .lf-field,
        html.dark .lf-check-grid {
          background: rgba(2,6,23,.62);
          border-color: rgba(51,65,85,.8);
        }

        html.dark .lf-input,
        html.dark .lf-select,
        html.dark .lf-textarea,
        html.dark .lf-check-item {
          background: #020617;
          color: #e5e7eb;
          border-color: #334155;
        }

        html.dark .lf-employee-name,
        html.dark .lf-meta strong,
        html.dark .lf-check-item {
          color: #fff;
        }

        @media (max-width: 1220px) {
          .lf-toolbar {
            grid-template-columns: 1fr 1fr;
          }

          .lf-card-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .leave-forms-page {
            padding: 14px 12px 92px;
          }

          .lf-hero {
            flex-direction: column;
            border-radius: 26px;
            padding: 22px;
          }

          .lf-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .lf-toolbar,
          .lf-form-grid,
          .lf-check-grid {
            grid-template-columns: 1fr;
          }

          .lf-form-card {
            grid-template-columns: 1fr;
          }

          .lf-side {
            align-items: stretch;
          }

          .lf-actions {
            min-width: 0;
          }

          .lf-meta {
            grid-template-columns: 1fr;
          }

          .lf-modal-backdrop {
            padding: 12px;
          }

          .lf-modal,
          .lf-modal-sm {
            width: calc(100vw - 24px);
            height: calc(100vh - 24px);
            max-height: calc(100vh - 24px);
            border-radius: 24px;
          }

          .lf-modal-head {
            flex-direction: column;
            align-items: flex-start;
          }

          .lf-modal-actions {
            width: 100%;
          }

          .lf-modal-actions .lf-btn {
            flex: 1;
          }
        }
      `}</style>

      <section className="lf-hero">
        <div>
          <div className="lf-oracle-badge">
            <FileText size={15} />
            Oracle Style Leave Forms
          </div>
          <h1>Leave Forms</h1>
          <p>
            Premium control center for GAS official leave request forms with PDF preview,
            editing, custom fields, checkboxes and professional document management.
          </p>
        </div>

        <div className="lf-hero-actions">
          <button className="lf-btn lf-btn-soft" type="button" onClick={() => setDesignerOpen(true)}>
            <Settings2 size={16} /> Form Designer
          </button>
          <button className="lf-btn lf-btn-primary" type="button" onClick={loadForms} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </section>

      <section className="lf-stats">
        <StatCard label="Total Forms" value={stats.total} icon={FileText} tone="blue" />
        <StatCard label="Annual Leave" value={stats.annual} icon={CalendarDays} tone="green" />
        <StatCard label="Emergency Leave" value={stats.emergency} icon={Filter} tone="orange" />
        <StatCard label="Sick Leave" value={stats.sick} icon={FileText} tone="red" />
      </section>

      <section className="lf-shell">
        <div className="lf-toolbar">
          <div className="lf-search-wrap">
            <Search size={18} />
            <input
              className="lf-input"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search by GAS ID or employee name"
            />
          </div>

          <input className="lf-input" value={filters.project} onChange={(e) => updateFilter("project", e.target.value)} placeholder="Project" />
          <input className="lf-input" value={filters.packageName} onChange={(e) => updateFilter("packageName", e.target.value)} placeholder="Package" />

          <select className="lf-select" value={filters.type} onChange={(e) => updateFilter("type", e.target.value)}>
            {leaveTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>

          <select className="lf-select" value={filters.month} onChange={(e) => updateFilter("month", e.target.value)}>
            {months.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>

          <select className="lf-select" value={filters.year} onChange={(e) => updateFilter("year", e.target.value)}>
            {years.map((year) => <option key={year || "all"} value={year}>{year || "All Years"}</option>)}
          </select>

          <button className="lf-btn lf-btn-primary" type="button" onClick={loadForms} disabled={loading}>
            <RefreshCw size={16} /> Apply
          </button>

          <button className="lf-btn lf-btn-soft" type="button" onClick={resetFilters}>
            Reset
          </button>
        </div>

        {error ? <div className="lf-error">{error}</div> : null}

        {loading ? (
          <div className="lf-empty">Loading leave forms...</div>
        ) : forms.length === 0 ? (
          <div className="lf-empty">No approved leave forms found.</div>
        ) : (
          <div className="lf-card-grid">
            {forms.map((form) => (
              <article className="lf-form-card" key={form.requestId}>
                <div>
                  <h3 className="lf-employee-name">{form.employeeName || "-"}</h3>
                  <span className="lf-id">GAS ID: {form.employeeGasId || "-"}</span>

                  <div className="lf-meta">
                    <div><span>Project</span><strong>{form.projectName || "-"}</strong></div>
                    <div><span>Package</span><strong>{form.packageName || "-"}</strong></div>
                    <div><span>Days</span><strong>{form.daysCount || 0}</strong></div>
                    <div><span>From</span><strong>{formatShortDate(form.startDate)}</strong></div>
                    <div><span>To</span><strong>{formatShortDate(form.endDate)}</strong></div>
                    <div><span>Type</span><strong>{form.leaveTypeLabel || form.type}</strong></div>
                  </div>
                </div>

                <div className="lf-side">
                  <span className="lf-chip">{form.leaveTypeLabel || form.type}</span>
                  <span className="lf-chip lf-chip-ok">Approved</span>

                  <div className="lf-actions">
                    <button className="lf-btn lf-btn-soft" type="button" onClick={() => openPreview(form)}>
                      <Eye size={16} /> View
                    </button>
                    <button className="lf-btn lf-btn-dark" type="button" onClick={() => openEdit(form)}>
                      <Pencil size={16} /> Edit
                    </button>
                    <button className="lf-btn lf-btn-dark" type="button" onClick={() => openFields(form)}>
                      <Settings2 size={16} /> Fields
                    </button>
                    <button className="lf-btn lf-btn-primary" type="button" onClick={() => downloadPdf(form)}>
                      <Download size={16} /> PDF
                    </button>
                    <button className="lf-btn lf-btn-danger" type="button" onClick={() => deleteForm(form)}>
                      <Trash2 size={16} /> Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedForm ? (
        <ModalPortal>
          <div className="lf-modal-backdrop" role="dialog" aria-modal="true">
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
                  <button className="lf-btn lf-btn-dark" type="button" onClick={() => openEdit(selectedForm)}>
                    <Pencil size={16} /> Edit
                  </button>
                  <button className="lf-btn lf-btn-dark" type="button" onClick={() => openFields(selectedForm)}>
                    <Settings2 size={16} /> Fields
                  </button>
                  <button className="lf-btn lf-btn-primary" type="button" onClick={() => downloadPdf(selectedForm)}>
                    <Download size={16} /> PDF
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
        </ModalPortal>
      ) : null}

      {editOpen && editForm ? (
        <ModalPortal>
          <div className="lf-modal-backdrop" role="dialog" aria-modal="true">
            <div className="lf-modal lf-modal-sm">
              <div className="lf-modal-head">
                <div>
                  <strong>Edit Leave Form</strong>
                  <span>Update employee and leave request details</span>
                </div>
                <button className="lf-btn lf-btn-danger" type="button" onClick={() => setEditOpen(false)}>
                  <X size={16} /> Close
                </button>
              </div>

              <div className="lf-form-body">
                <div className="lf-form-grid">
                  <div className="lf-field">
                    <label>GAS ID</label>
                    <input className="lf-input" value={editForm.employeeGasId} onChange={(e) => setEditForm({ ...editForm, employeeGasId: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Employee Name</label>
                    <input className="lf-input" value={editForm.employeeName} onChange={(e) => setEditForm({ ...editForm, employeeName: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Leave Type</label>
                    <select className="lf-select" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                      {leaveTypes.filter((x) => x.value).map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="lf-field">
                    <label>Status</label>
                    <select className="lf-select" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div className="lf-field">
                    <label>Start Date</label>
                    <input className="lf-input" type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>End Date</label>
                    <input className="lf-input" type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
                  </div>

                  <div className="lf-field lf-field-full">
                    <label>Note / Comments</label>
                    <textarea className="lf-textarea" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                  <button className="lf-btn lf-btn-soft" type="button" onClick={() => setEditOpen(false)}>Cancel</button>
                  <button className="lf-btn lf-btn-primary" type="button" onClick={saveEdit} disabled={editSaving}>
                    <Save size={16} /> {editSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}

      {fieldsOpen ? (
        <ModalPortal>
          <div className="lf-modal-backdrop" role="dialog" aria-modal="true">
            <div className="lf-modal lf-modal-sm">
              <div className="lf-modal-head">
                <div>
                  <strong>Form Fields Control</strong>
                  <span>Control contact numbers, travel details, addresses and checkboxes</span>
                </div>
                <button className="lf-btn lf-btn-danger" type="button" onClick={() => setFieldsOpen(false)}>
                  <X size={16} /> Close
                </button>
              </div>

              <div className="lf-form-body">
                <div className="lf-form-grid">
                  <div className="lf-section-label">Employee Contact</div>

                  <div className="lf-field">
                    <label>Employee Mobile</label>
                    <input className="lf-input" value={customFields.employeeMobile || ""} onChange={(e) => setCustomFields({ ...customFields, employeeMobile: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Home Telephone</label>
                    <input className="lf-input" value={customFields.homeTelephone || ""} onChange={(e) => setCustomFields({ ...customFields, homeTelephone: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Home Mobile</label>
                    <input className="lf-input" value={customFields.homeMobile || ""} onChange={(e) => setCustomFields({ ...customFields, homeMobile: e.target.value })} />
                  </div>

                  <div className="lf-field lf-field-full">
                    <label>Home Address</label>
                    <textarea className="lf-textarea" value={customFields.homeAddress || ""} onChange={(e) => setCustomFields({ ...customFields, homeAddress: e.target.value })} />
                  </div>

                  <div className="lf-section-label">Emergency Contact</div>

                  <div className="lf-field">
                    <label>Emergency Telephone</label>
                    <input className="lf-input" value={customFields.emergencyTelephone || ""} onChange={(e) => setCustomFields({ ...customFields, emergencyTelephone: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Emergency Mobile</label>
                    <input className="lf-input" value={customFields.emergencyMobile || ""} onChange={(e) => setCustomFields({ ...customFields, emergencyMobile: e.target.value })} />
                  </div>

                  <div className="lf-field lf-field-full">
                    <label>Emergency Address</label>
                    <textarea className="lf-textarea" value={customFields.emergencyAddress || ""} onChange={(e) => setCustomFields({ ...customFields, emergencyAddress: e.target.value })} />
                  </div>

                  <div className="lf-section-label">Travel Details</div>

                  <div className="lf-field">
                    <label>Departure Date</label>
                    <input className="lf-input" type="date" value={customFields.departureDate || ""} onChange={(e) => setCustomFields({ ...customFields, departureDate: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Departure From</label>
                    <input className="lf-input" value={customFields.departureFrom || ""} onChange={(e) => setCustomFields({ ...customFields, departureFrom: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Departure To</label>
                    <input className="lf-input" value={customFields.departureTo || ""} onChange={(e) => setCustomFields({ ...customFields, departureTo: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Return Date</label>
                    <input className="lf-input" type="date" value={customFields.returnDate || ""} onChange={(e) => setCustomFields({ ...customFields, returnDate: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Return From</label>
                    <input className="lf-input" value={customFields.returnFrom || ""} onChange={(e) => setCustomFields({ ...customFields, returnFrom: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Return To</label>
                    <input className="lf-input" value={customFields.returnTo || ""} onChange={(e) => setCustomFields({ ...customFields, returnTo: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Rejoining Date</label>
                    <input className="lf-input" type="date" value={customFields.rejoiningDate || ""} onChange={(e) => setCustomFields({ ...customFields, rejoiningDate: e.target.value })} />
                  </div>

                  <div className="lf-section-label">Checkboxes Control</div>

                  <div className="lf-field lf-field-full">
                    <div className="lf-check-grid">
                      {checkboxItems.map(([key, label]) => (
                        <label key={key} className="lf-check-item">
                          <input
                            type="checkbox"
                            checked={Boolean(customFields[key])}
                            onChange={(e) => setCustomFields({ ...customFields, [key]: e.target.checked })}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="lf-section-label">Additional Text</div>

                  <div className="lf-field lf-field-full">
                    <label>Extra Text Inside Form</label>
                    <textarea className="lf-textarea" value={customFields.customExtraText || ""} onChange={(e) => setCustomFields({ ...customFields, customExtraText: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                  <button className="lf-btn lf-btn-soft" type="button" onClick={() => setFieldsOpen(false)}>
                    Cancel
                  </button>
                  <button className="lf-btn lf-btn-primary" type="button" onClick={saveCustomFields} disabled={fieldsSaving}>
                    <Save size={16} /> {fieldsSaving ? "Saving..." : "Save Fields"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}

      {designerOpen ? (
        <ModalPortal>
          <div className="lf-modal-backdrop" role="dialog" aria-modal="true">
            <div className="lf-modal lf-modal-sm">
              <div className="lf-modal-head">
                <div>
                  <strong>Form Designer</strong>
                  <span>Control font, colors, size, bold, zoom and custom note</span>
                </div>
                <button className="lf-btn lf-btn-danger" type="button" onClick={() => setDesignerOpen(false)}>
                  <X size={16} /> Close
                </button>
              </div>

              <div className="lf-form-body">
                <div className="lf-form-grid">
                  <div className="lf-field">
                    <label>Font Family</label>
                    <select className="lf-select" value={designer.fontFamily} onChange={(e) => setDesigner({ ...designer, fontFamily: e.target.value })}>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Arial">Arial</option>
                      <option value="Calibri">Calibri</option>
                      <option value="Georgia">Georgia</option>
                    </select>
                  </div>

                  <div className="lf-field">
                    <label>Bold Text</label>
                    <select className="lf-select" value={designer.isBold ? "yes" : "no"} onChange={(e) => setDesigner({ ...designer, isBold: e.target.value === "yes" })}>
                      <option value="yes">Enabled</option>
                      <option value="no">Disabled</option>
                    </select>
                  </div>

                  <div className="lf-field">
                    <label>Font Size</label>
                    <input className="lf-input" type="number" min="8" max="18" value={designer.fontSize} onChange={(e) => setDesigner({ ...designer, fontSize: Number(e.target.value) })} />
                  </div>

                  <div className="lf-field">
                    <label>Title Size</label>
                    <input className="lf-input" type="number" min="14" max="34" value={designer.titleSize} onChange={(e) => setDesigner({ ...designer, titleSize: Number(e.target.value) })} />
                  </div>

                  <div className="lf-field">
                    <label>Text Color</label>
                    <input className="lf-input" type="color" value={designer.textColor} onChange={(e) => setDesigner({ ...designer, textColor: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Title Color</label>
                    <input className="lf-input" type="color" value={designer.titleColor} onChange={(e) => setDesigner({ ...designer, titleColor: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Border Color</label>
                    <input className="lf-input" type="color" value={designer.borderColor} onChange={(e) => setDesigner({ ...designer, borderColor: e.target.value })} />
                  </div>

                  <div className="lf-field">
                    <label>Header Background</label>
                    <input className="lf-input" type="color" value={designer.headerBg} onChange={(e) => setDesigner({ ...designer, headerBg: e.target.value })} />
                  </div>

                  <div className="lf-field lf-field-full">
                    <label>Preview Zoom</label>
                    <input className="lf-input" type="range" min="70" max="120" value={designer.zoom} onChange={(e) => setDesigner({ ...designer, zoom: Number(e.target.value) })} />
                  </div>

                  <div className="lf-field lf-field-full">
                    <label>Custom Note Text</label>
                    <textarea className="lf-textarea" value={designer.customNote} onChange={(e) => setDesigner({ ...designer, customNote: e.target.value })} />
                  </div>
                </div>

                <div className="lf-designer-preview">
                  <div
                    className="lf-preview-paper"
                    style={{
                      "--font-family": designer.fontFamily,
                      "--font-size": `${designer.fontSize}px`,
                      "--title-size": `${designer.titleSize}px`,
                      "--border-color": designer.borderColor,
                      "--header-bg": designer.headerBg,
                      "--text-color": designer.textColor,
                      "--title-color": designer.titleColor,
                      "--title-weight": designer.isBold ? 800 : 500,
                      "--zoom": designer.zoom / 100,
                    }}
                  >
                    <div className="lf-preview-title">LEAVE REQUEST FORM</div>
                    <div className="lf-preview-row">
                      <div className="lf-preview-label">EMPLOYEE NO.</div>
                      <div>4379</div>
                      <div className="lf-preview-label">EMPLOYEE NAME</div>
                      <div>Ziyad Harbi</div>
                      <div className="lf-preview-label">LEAVE TYPE</div>
                      <div>Annual Leave</div>
                      <div className="lf-preview-label">CUSTOM NOTE</div>
                      <div>{designer.customNote || "Your custom note will appear here"}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
                  <button className="lf-btn lf-btn-soft" type="button" onClick={() => setDesigner(defaultDesigner)}>
                    Reset Design
                  </button>
                  <button className="lf-btn lf-btn-primary" type="button" onClick={saveDesigner} disabled={designerSaving}>
                    <Save size={16} /> {designerSaving ? "Saving..." : "Save Template"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </div>
  );
}
