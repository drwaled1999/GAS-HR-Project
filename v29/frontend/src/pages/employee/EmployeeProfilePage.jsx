import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileText,
  FolderKanban,
  Globe2,
  Home,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { apiFetch } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

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

function valueOrDash(value) {
  if (value === null || value === undefined) return "-";
  if (String(value).trim() === "") return "-";
  return String(value);
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "E";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getToken() {
  return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
}

function getApiBaseUrl() {
  const fromWindow = window?.__API_BASE_URL__;
  if (fromWindow) return String(fromWindow).replace(/\/+$/, "");

  const fromEnv = import.meta?.env?.VITE_API_BASE_URL;
  if (fromEnv) return String(fromEnv).replace(/\/+$/, "");

  return "https://gas-hr-project.onrender.com";
}

function docTypeLabel(type) {
  const map = {
    id: "ID / Iqama",
    contract: "Contract",
    certificate: "Certificate",
    cv: "CV",
    other: "Other",
  };
  return map[type] || type || "Document";
}

export default function EmployeeProfilePage() {
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [balances, setBalances] = useState({
    annual: 30,
    annualUsed: 0,
    annualRemaining: 30,
    sick: 15,
    sickUsed: 0,
    sickRemaining: 15,
    emergency: 5,
    emergencyUsed: 0,
    emergencyRemaining: 5,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fileBusyId, setFileBusyId] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const username = user?.username ? encodeURIComponent(user.username) : "";

      const [profileRes, docsRes, balancesRes] = await Promise.allSettled([
        apiFetch("/employee-profile/me"),
        apiFetch("/employee-profile/documents"),
        apiFetch(`/requests-center/balances?username=${username}`),
      ]);

      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value);
      } else {
        setError(profileRes.reason?.message || "Failed to load profile");
      }

      if (docsRes.status === "fulfilled") {
        setDocuments(Array.isArray(docsRes.value) ? docsRes.value : []);
      }

      if (balancesRes.status === "fulfilled") {
        const b = balancesRes.value?.balances || {};
        setBalances({
          annual: Number(b.annual ?? 30),
          annualUsed: Number(b.annualUsed ?? 0),
          annualRemaining: Number(b.annualRemaining ?? 30),
          sick: Number(b.sick ?? 15),
          sickUsed: Number(b.sickUsed ?? 0),
          sickRemaining: Number(b.sickRemaining ?? 15),
          emergency: Number(b.emergency ?? 5),
          emergencyUsed: Number(b.emergencyUsed ?? 0),
          emergencyRemaining: Number(b.emergencyRemaining ?? 5),
        });
      }
    } catch (err) {
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [user?.username]);

  const employee = profile || user || {};

  const completion = useMemo(() => {
    const filled = REQUIRED_FIELDS.filter((field) => {
      const value = employee?.[field.key];
      return value !== null && value !== undefined && String(value).trim() !== "";
    }).length;

    return Math.round((filled / REQUIRED_FIELDS.length) * 100);
  }, [employee]);

  const missingFields = useMemo(() => {
    return REQUIRED_FIELDS.filter((field) => {
      const value = employee?.[field.key];
      return value === null || value === undefined || String(value).trim() === "";
    });
  }, [employee]);

  const profileName =
    employee?.full_name ||
    employee?.name ||
    employee?.fullName ||
    employee?.username ||
    "Employee";

  const profileGasId =
    employee?.gas_id ||
    employee?.gasId ||
    employee?.employeeCode ||
    "-";

  const profileRole =
    employee?.job_title ||
    employee?.role ||
    employee?.roleName ||
    "Employee";

  const profileProject =
    employee?.project_name ||
    employee?.projectName ||
    employee?.project ||
    "-";

  const profilePackage =
    employee?.package_name ||
    employee?.packageName ||
    employee?.package ||
    "-";

  const documentStats = useMemo(() => {
    const verified = documents.filter((doc) => doc.verified).length;
    const total = documents.length;
    return { total, verified };
  }, [documents]);

  function buildDocumentUrl(docId, download = false) {
    const base = getApiBaseUrl();
    return `${base}/employee-profile/documents/${docId}/view${download ? "?download=1" : ""}`;
  }

  async function previewDocument(doc) {
    try {
      setFileBusyId(`preview-${doc.id}`);
      const url = buildDocumentUrl(doc.id, false);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message || "Cannot open document");
    } finally {
      setFileBusyId("");
    }
  }

  async function downloadDocument(doc) {
    try {
      setFileBusyId(`download-${doc.id}`);

      const response = await fetch(buildDocumentUrl(doc.id, true), {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const fileUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = fileUrl;
      a.download = doc.file_name || "document.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => window.URL.revokeObjectURL(fileUrl), 60000);
    } catch (err) {
      setError(err.message || "Cannot download document");
    } finally {
      setFileBusyId("");
    }
  }

  return (
    <>
      <style>{`
        .profile-page {
          min-height: 100vh;
          padding: clamp(14px, 3vw, 30px);
          padding-bottom: 190px;
          background:
            radial-gradient(circle at top left, rgba(37,99,235,.13), transparent 32%),
            linear-gradient(180deg, #f8fafc 0%, #eef2ff 48%, #f8fafc 100%);
          font-family: Inter, Segoe UI, Arial, sans-serif;
          box-sizing: border-box;
        }

        .profile-container {
          max-width: 1240px;
          margin: 0 auto;
        }

        .profile-hero {
          position: relative;
          overflow: hidden;
          border-radius: 34px;
          padding: clamp(24px, 4vw, 42px);
          color: #fff;
          background: linear-gradient(135deg, #020617 0%, #0f172a 38%, #1d4ed8 100%);
          box-shadow: 0 30px 80px rgba(15,23,42,.28);
        }

        .profile-hero::before {
          content: "";
          position: absolute;
          width: 360px;
          height: 360px;
          right: -120px;
          top: -130px;
          border-radius: 999px;
          background: rgba(59,130,246,.45);
          filter: blur(12px);
        }

        .profile-hero::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px);
          background-size: 34px 34px;
          opacity: .34;
        }

        .profile-hero-inner {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .profile-main-id {
          display: flex;
          align-items: center;
          gap: 22px;
          flex-wrap: wrap;
        }

        .profile-avatar-wrap {
          position: relative;
        }

        .profile-avatar {
          width: 120px;
          height: 120px;
          border-radius: 32px;
          background: linear-gradient(135deg, #ffffff 0%, #dbeafe 100%);
          color: #1e3a8a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          font-weight: 950;
          box-shadow: 0 24px 60px rgba(0,0,0,.26);
        }

        .profile-verified {
          position: absolute;
          right: -10px;
          bottom: -10px;
          width: 40px;
          height: 40px;
          border-radius: 16px;
          background: #22c55e;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid rgba(255,255,255,.85);
        }

        .profile-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 13px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.18);
          color: rgba(255,255,255,.82);
          font-size: 13px;
          font-weight: 900;
        }

        .profile-name {
          margin: 15px 0 12px;
          font-size: clamp(31px, 4.8vw, 54px);
          line-height: 1.04;
          font-weight: 950;
          letter-spacing: -1.2px;
        }

        .profile-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .profile-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.18);
          color: #fff;
          font-size: 13px;
          font-weight: 850;
        }

        .completion-card {
          min-width: 280px;
          border-radius: 28px;
          padding: 20px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.18);
          backdrop-filter: blur(14px);
        }

        .completion-card span {
          color: rgba(255,255,255,.7);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .completion-card strong {
          display: block;
          margin-top: 6px;
          font-size: 34px;
          font-weight: 950;
        }

        .completion-track {
          margin-top: 12px;
          height: 10px;
          background: rgba(255,255,255,.18);
          border-radius: 999px;
          overflow: hidden;
        }

        .completion-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #22c55e, #bfdbfe);
        }

        .profile-grid {
          margin-top: 22px;
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(320px, .85fr);
          gap: 20px;
          align-items: start;
        }

        .profile-column {
          display: grid;
          gap: 20px;
        }

        .panel {
          background: rgba(255,255,255,.94);
          border: 1px solid rgba(226,232,240,.9);
          border-radius: 30px;
          padding: 22px;
          box-shadow: 0 22px 55px rgba(15,23,42,.08);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .panel-kicker {
          margin: 0;
          color: #2563eb;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .7px;
        }

        .panel-title {
          margin: 5px 0 0;
          color: #0f172a;
          font-size: 22px;
          font-weight: 950;
        }

        .panel-icon {
          width: 52px;
          height: 52px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #1d4ed8;
          flex-shrink: 0;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }

        .info-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px;
          border-radius: 20px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          min-width: 0;
        }

        .info-icon {
          width: 44px;
          height: 44px;
          border-radius: 15px;
          background: #fff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 10px 22px rgba(15,23,42,.06);
        }

        .info-card span {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .5px;
        }

        .info-card strong {
          display: block;
          margin-top: 5px;
          color: #0f172a;
          font-size: 15px;
          font-weight: 950;
          word-break: break-word;
        }

        .balance-grid {
          display: grid;
          gap: 14px;
        }

        .balance-card {
          border-radius: 22px;
          padding: 17px;
          border: 1px solid #dbeafe;
          background: linear-gradient(135deg, #eff6ff, #ffffff);
        }

        .balance-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .balance-top span {
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .balance-top strong {
          display: block;
          margin-top: 5px;
          color: #0f172a;
          font-size: 30px;
          font-weight: 950;
        }

        .balance-meta {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 9px;
        }

        .balance-meta div {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 15px;
          padding: 10px;
          text-align: center;
        }

        .balance-meta small {
          display: block;
          color: #64748b;
          font-weight: 850;
          margin-bottom: 5px;
        }

        .balance-meta b {
          color: #0f172a;
          font-weight: 950;
        }

        .documents-list {
          display: grid;
          gap: 12px;
        }

        .document-card {
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          background: #fff;
          padding: 15px;
          box-shadow: 0 12px 28px rgba(15,23,42,.05);
        }

        .document-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .document-name {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          min-width: 0;
        }

        .document-icon {
          width: 44px;
          height: 44px;
          border-radius: 15px;
          background: #eff6ff;
          color: #1d4ed8;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .document-name strong {
          display: block;
          color: #0f172a;
          font-size: 15px;
          font-weight: 950;
        }

        .document-name span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          word-break: break-word;
        }

        .doc-badge {
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 950;
          white-space: nowrap;
        }

        .doc-badge.ok {
          background: #dcfce7;
          color: #166534;
        }

        .doc-badge.pending {
          background: #f1f5f9;
          color: #475569;
        }

        .document-actions {
          margin-top: 13px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .doc-btn {
          border: none;
          min-height: 38px;
          padding: 0 13px;
          border-radius: 13px;
          background: #eef4ff;
          color: #1d4ed8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 950;
          cursor: pointer;
        }

        .doc-btn.green {
          background: #ecfdf3;
          color: #047857;
        }

        .missing-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .missing-chip {
          border-radius: 999px;
          padding: 8px 11px;
          background: #fff1f2;
          color: #be123c;
          font-size: 12px;
          font-weight: 900;
        }

        .empty {
          border-radius: 20px;
          padding: 24px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          color: #64748b;
          text-align: center;
          font-weight: 850;
          line-height: 1.7;
        }

        .alert {
          margin-top: 16px;
          border-radius: 18px;
          padding: 13px 15px;
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #be123c;
          font-weight: 900;
        }

        .logout-btn {
          width: 100%;
          min-height: 56px;
          border: none;
          border-radius: 20px;
          background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
          color: #fff;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 0 18px 36px rgba(239,68,68,.22);
        }

        @media (max-width: 940px) {
          .profile-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .profile-page {
            padding: 14px;
            padding-bottom: 190px;
          }

          .profile-hero {
            border-radius: 28px;
            padding: 22px;
          }

          .profile-avatar {
            width: 84px;
            height: 84px;
            border-radius: 24px;
            font-size: 28px;
          }

          .profile-verified {
            width: 32px;
            height: 32px;
            border-radius: 12px;
          }

          .profile-name {
            font-size: 31px;
          }

          .profile-pill {
            width: 100%;
            justify-content: center;
          }

          .completion-card {
            width: 100%;
            min-width: 0;
          }

          .panel {
            border-radius: 24px;
            padding: 18px;
          }

          .info-grid,
          .balance-meta {
            grid-template-columns: 1fr;
          }

          .document-top {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="profile-page">
        <div className="profile-container">
          <section className="profile-hero">
            <div className="profile-hero-inner">
              <div className="profile-main-id">
                <div className="profile-avatar-wrap">
                  <div className="profile-avatar">{initials(profileName)}</div>
                  <div className="profile-verified">
                    <BadgeCheck size={18} />
                  </div>
                </div>

                <div>
                  <div className="profile-kicker">
                    <ShieldCheck size={15} />
                    Employee 360° Profile
                  </div>

                  <h1 className="profile-name">{valueOrDash(profileName)}</h1>

                  <div className="profile-pills">
                    <span className="profile-pill">
                      <CreditCard size={15} />
                      {valueOrDash(profileGasId)}
                    </span>
                    <span className="profile-pill">
                      <Briefcase size={15} />
                      {valueOrDash(profileRole)}
                    </span>
                    <span className="profile-pill">
                      <FolderKanban size={15} />
                      {valueOrDash(profileProject)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="completion-card">
                <span>Profile Completion</span>
                <strong>{completion}%</strong>
                <div className="completion-track">
                  <div className="completion-fill" style={{ width: `${completion}%` }} />
                </div>
              </div>
            </div>
          </section>

          {error ? <div className="alert">{error}</div> : null}

          {loading ? (
            <div className="panel" style={{ marginTop: 22 }}>
              <div className="empty">
                <Loader2 size={24} /> Loading employee profile...
              </div>
            </div>
          ) : (
            <section className="profile-grid">
              <div className="profile-column">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="panel-kicker">Personal Information</p>
                      <h2 className="panel-title">Employee Details</h2>
                    </div>
                    <div className="panel-icon">
                      <UserRound size={22} />
                    </div>
                  </div>

                  <div className="info-grid">
                    <InfoCard icon={<UserRound size={19} />} label="Full Name" value={profileName} />
                    <InfoCard icon={<CreditCard size={19} />} label="GAS ID" value={profileGasId} />
                    <InfoCard icon={<Mail size={19} />} label="Email" value={employee.email} />
                    <InfoCard icon={<Phone size={19} />} label="Phone" value={employee.phone} />
                    <InfoCard icon={<IdCard size={19} />} label="ID / Iqama" value={employee.id_number} />
                    <InfoCard icon={<CalendarDays size={19} />} label="Join Date" value={formatDate(employee.join_date)} />
                    <InfoCard icon={<Globe2 size={19} />} label="Nationality" value={employee.nationality} />
                    <InfoCard icon={<Home size={19} />} label="Address" value={employee.address} />
                    <InfoCard icon={<MapPin size={19} />} label="Sabul Short Address" value={employee.sabul_short_address} />
                    <InfoCard icon={<FileText size={19} />} label="Education" value={employee.education} />
                    <InfoCard icon={<Phone size={19} />} label="Emergency Contact" value={employee.emergency_contact} />
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="panel-kicker">Work Assignment</p>
                      <h2 className="panel-title">Project Information</h2>
                    </div>
                    <div className="panel-icon">
                      <Building2 size={22} />
                    </div>
                  </div>

                  <div className="info-grid">
                    <InfoCard icon={<Briefcase size={19} />} label="Job Title" value={profileRole} />
                    <InfoCard icon={<FolderKanban size={19} />} label="Project" value={profileProject} />
                    <InfoCard icon={<Package size={19} />} label="Package" value={profilePackage} />
                    <InfoCard icon={<CheckCircle2 size={19} />} label="Status" value={employee.status || "Active"} />
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="panel-kicker">Documents Vault</p>
                      <h2 className="panel-title">My Documents</h2>
                    </div>
                    <div className="panel-icon">
                      <FileText size={22} />
                    </div>
                  </div>

                  {documents.length ? (
                    <div className="documents-list">
                      {documents.map((doc) => (
                        <article key={doc.id} className="document-card">
                          <div className="document-top">
                            <div className="document-name">
                              <div className="document-icon">
                                <FileText size={20} />
                              </div>
                              <div>
                                <strong>{docTypeLabel(doc.document_type)}</strong>
                                <span>{doc.file_name || "document.pdf"}</span>
                                <span>Uploaded: {formatDate(doc.uploaded_at)}</span>
                              </div>
                            </div>

                            <span className={`doc-badge ${doc.verified ? "ok" : "pending"}`}>
                              {doc.verified ? "Verified" : "Uploaded"}
                            </span>
                          </div>

                          <div className="document-actions">
                            <button
                              type="button"
                              className="doc-btn"
                              onClick={() => previewDocument(doc)}
                              disabled={fileBusyId === `preview-${doc.id}`}
                            >
                              <Eye size={14} />
                              {fileBusyId === `preview-${doc.id}` ? "..." : "Preview"}
                            </button>

                            <button
                              type="button"
                              className="doc-btn green"
                              onClick={() => downloadDocument(doc)}
                              disabled={fileBusyId === `download-${doc.id}`}
                            >
                              <Download size={14} />
                              {fileBusyId === `download-${doc.id}` ? "..." : "Download"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="empty">
                      No documents uploaded yet.
                    </div>
                  )}
                </section>
              </div>

              <div className="profile-column">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="panel-kicker">Leave Balance</p>
                      <h2 className="panel-title">Available Days</h2>
                    </div>
                    <div className="panel-icon">
                      <CalendarDays size={22} />
                    </div>
                  </div>

                  <div className="balance-grid">
                    <BalanceCard label="Annual Leave" total={balances.annual} used={balances.annualUsed} remaining={balances.annualRemaining} />
                    <BalanceCard label="Sick Leave" total={balances.sick} used={balances.sickUsed} remaining={balances.sickRemaining} />
                    <BalanceCard label="Emergency Leave" total={balances.emergency} used={balances.emergencyUsed} remaining={balances.emergencyRemaining} />
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="panel-kicker">Data Quality</p>
                      <h2 className="panel-title">Missing Information</h2>
                    </div>
                    <div className="panel-icon">
                      <ShieldCheck size={22} />
                    </div>
                  </div>

                  {missingFields.length ? (
                    <div className="missing-list">
                      {missingFields.map((field) => (
                        <span key={field.key} className="missing-chip">
                          {field.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="empty">
                      Your profile information is complete.
                    </div>
                  )}
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="panel-kicker">Document Summary</p>
                      <h2 className="panel-title">Files Status</h2>
                    </div>
                    <div className="panel-icon">
                      <FileText size={22} />
                    </div>
                  </div>

                  <div className="info-grid">
                    <InfoCard icon={<FileText size={19} />} label="Total Documents" value={documentStats.total} />
                    <InfoCard icon={<BadgeCheck size={19} />} label="Verified Documents" value={documentStats.verified} />
                  </div>
                </section>

                <button type="button" onClick={logout} className="logout-btn">
                  Logout
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function InfoCard({ icon, label, value }) {
  return (
    <div className="info-card">
      <div className="info-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{valueOrDash(value)}</strong>
      </div>
    </div>
  );
}

function BalanceCard({ label, total, used, remaining }) {
  return (
    <article className="balance-card">
      <div className="balance-top">
        <div>
          <span>{label}</span>
          <strong>{remaining}</strong>
        </div>
        <CalendarDays size={30} color="#1d4ed8" />
      </div>

      <div className="balance-meta">
        <div>
          <small>Total</small>
          <b>{total}</b>
        </div>
        <div>
          <small>Used</small>
          <b>{used}</b>
        </div>
      </div>
    </article>
  );
}
