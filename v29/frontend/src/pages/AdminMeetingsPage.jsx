import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  CalendarDays,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Video,
  Users,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "https://gas-hr-project.onrender.com";

function getToken() {
  const token = localStorage.getItem("token") || localStorage.getItem("authToken");
  return token ? String(token).replace("Bearer ", "").trim() : "";
}

function authHeaders() {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeEmployee(emp = {}) {
  return {
    id:
      emp.userId ||
      emp.user_id ||
      emp.id ||
      emp.employeeUserId ||
      emp.employee_user_id ||
      emp.employeeId ||
      emp.employee_id ||
      "",
    name:
      emp.name ||
      emp.fullName ||
      emp.full_name ||
      emp.employeeName ||
      emp.employee_name ||
      "Employee",
    username: emp.username || "",
    email: emp.email || emp.employeeEmail || emp.employee_email || "",
    gasId:
      emp.gasId ||
      emp.gas_id ||
      emp.employeeGasId ||
      emp.employee_gas_id ||
      "",
    projectName: emp.projectName || emp.project_name || "",
    packageName: emp.packageName || emp.package_name || "",
    roleName: emp.roleName || emp.role_name || "Employee",
  };
}

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString("en-GB");
  } catch {
    return value;
  }
}

function statusClass(status) {
  if (status === "completed") return "done";
  if (status === "cancelled") return "cancelled";
  return "scheduled";
}

function priorityClass(priority) {
  if (priority === "high") return "high";
  if (priority === "low") return "low";
  return "normal";
}

export default function AdminMeetingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [employeeSearch, setEmployeeSearch] = useState("");

  const [form, setForm] = useState({
    title: "",
    agenda: "",
    meetingDate: "",
    startTime: "",
    endTime: "",
    location: "",
    meetingLink: "",
    priority: "normal",
    roomId: "",
    employeeUserIds: [],
  });

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();

    if (!q) return employees;

    return employees.filter((emp) => {
      return [
        emp.name,
        emp.username,
        emp.email,
        emp.gasId,
        emp.projectName,
        emp.packageName,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [employees, employeeSearch]);

  async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  async function apiSend(path, method, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body || {}),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }

  async function loadEmployeesFallback() {
    if (!user?.username) return [];

    const requestsData = await apiFetch(
      `/requests-center/list?username=${encodeURIComponent(user.username)}`
    );

    return asArray(requestsData?.employees)
      .map(normalizeEmployee)
      .filter((emp) => emp.id);
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const [meetingsData, roomsData] = await Promise.all([
        apiGet("/meetings/admin"),
        apiGet("/meetings/rooms"),
      ]);

      let finalEmployees = [];

      try {
        const employeesData = await apiGet("/meetings/employees");
        finalEmployees = asArray(employeesData?.employees)
          .map(normalizeEmployee)
          .filter((emp) => emp.id);
      } catch (employeesError) {
        console.warn("GET /meetings/employees failed:", employeesError);
      }

      if (!finalEmployees.length) {
        try {
          finalEmployees = await loadEmployeesFallback();
        } catch (fallbackError) {
          console.warn("Requests employees fallback failed:", fallbackError);
        }
      }

      setMeetings(asArray(meetingsData?.meetings));
      setEmployees(finalEmployees);
      setRooms(asArray(roomsData?.rooms));

      if (!finalEmployees.length) {
        setError("No employees found. Please check employees source or backend route.");
      }
    } catch (err) {
      console.error("Admin meetings load error:", err);
      setError(err.message || "Failed to load meetings");
      setMeetings([]);
      setEmployees([]);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [user?.username]);

  function updateForm(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function toggleEmployee(userId) {
    setForm((prev) => {
      const exists = prev.employeeUserIds.includes(userId);

      return {
        ...prev,
        employeeUserIds: exists
          ? prev.employeeUserIds.filter((id) => id !== userId)
          : [...prev.employeeUserIds, userId],
      };
    });
  }

  function selectAllFilteredEmployees() {
    const ids = filteredEmployees.map((e) => e.id).filter(Boolean);

    setForm((prev) => ({
      ...prev,
      employeeUserIds: Array.from(new Set([...prev.employeeUserIds, ...ids])),
    }));
  }

  function clearSelectedEmployees() {
    setForm((prev) => ({
      ...prev,
      employeeUserIds: [],
    }));
  }

  async function createMeeting(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (!form.title.trim()) throw new Error("Meeting title is required");
      if (!form.meetingDate) throw new Error("Meeting date is required");
      if (!form.startTime) throw new Error("Start time is required");

      if (!form.employeeUserIds.length) {
        throw new Error("Please select at least one employee");
      }

      await apiSend("/meetings", "POST", {
        title: form.title.trim(),
        agenda: form.agenda,
        meetingDate: form.meetingDate,
        startTime: form.startTime,
        endTime: form.endTime,
        location: form.location,
        meetingLink: form.meetingLink,
        priority: form.priority,
        roomId: form.roomId || null,
        employeeUserIds: form.employeeUserIds,
      });

      setMessage("Meeting created successfully");

      setForm({
        title: "",
        agenda: "",
        meetingDate: "",
        startTime: "",
        endTime: "",
        location: "",
        meetingLink: "",
        priority: "normal",
        roomId: "",
        employeeUserIds: [],
      });

      setEmployeeSearch("");

      await loadData();
    } catch (err) {
      console.error("Create meeting error:", err);
      setError(err.message || "Failed to create meeting");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(meetingId, status) {
    try {
      setError("");
      setMessage("");

      await apiSend(`/meetings/${meetingId}/status`, "PATCH", { status });

      setMessage("Meeting status updated");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to update status");
    }
  }

  async function deleteMeeting(meetingId) {
    const ok = window.confirm("Are you sure you want to delete this meeting?");
    if (!ok) return;

    try {
      setError("");
      setMessage("");

      const res = await fetch(`${API_BASE}/meetings/${meetingId}`, {
        method: "DELETE",
        headers: authHeaders(),
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "Failed to delete meeting");
      }

      setMessage("Meeting deleted successfully");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to delete meeting");
    }
  }

  function openMeetingRoom(meetingId) {
    navigate(`/meeting-room/${meetingId}`);
  }

  return (
    <div className="admin-meetings-page">
      <style>{`
        .admin-meetings-page {
          display: grid;
          gap: 22px;
          padding: 22px;
          color: #0f172a;
        }

        .meetings-hero {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          padding: 22px;
          border-radius: 28px;
          background:
            radial-gradient(circle at top left, rgba(37,99,235,.18), transparent 34%),
            linear-gradient(135deg, #ffffff, #f8fafc);
          border: 1px solid rgba(148,163,184,.25);
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
        }

        .hero-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 900;
          font-size: .78rem;
          margin-bottom: 10px;
        }

        .meetings-hero h1 {
          margin: 0;
          font-size: clamp(1.35rem, 2vw, 2rem);
          font-weight: 950;
          letter-spacing: -.04em;
        }

        .meetings-hero p {
          margin: 8px 0 0;
          color: #64748b;
          font-weight: 750;
        }

        .hero-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn {
          border: none;
          border-radius: 16px;
          padding: 11px 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 900;
          transition: .18s ease;
          white-space: nowrap;
        }

        .btn:hover {
          transform: translateY(-1px);
        }

        .btn:disabled {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
          box-shadow: 0 12px 25px rgba(37,99,235,.22);
        }

        .btn-soft {
          background: #f1f5f9;
          color: #0f172a;
        }

        .btn-danger {
          background: #fee2e2;
          color: #b91c1c;
        }

        .btn-success {
          background: #dcfce7;
          color: #166534;
        }

        .btn-warning {
          background: #fef3c7;
          color: #92400e;
        }

        .alert {
          padding: 13px 15px;
          border-radius: 18px;
          font-weight: 850;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .alert.error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .alert.success {
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
        }

        .meetings-grid {
          display: grid;
          grid-template-columns: 410px minmax(0, 1fr);
          gap: 22px;
          align-items: start;
        }

        .panel {
          background: #fff;
          border: 1px solid rgba(148,163,184,.25);
          border-radius: 28px;
          box-shadow: 0 18px 45px rgba(15,23,42,.07);
          overflow: hidden;
        }

        .panel-header {
          padding: 18px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 950;
        }

        .panel-header span {
          color: #64748b;
          font-size: .8rem;
          font-weight: 800;
        }

        .meeting-form {
          padding: 18px;
          display: grid;
          gap: 14px;
        }

        .field {
          display: grid;
          gap: 7px;
        }

        .field label {
          font-size: .78rem;
          font-weight: 950;
          color: #334155;
        }

        .field input,
        .field textarea,
        .field select {
          width: 100%;
          border: 1px solid #cbd5e1;
          background: #fff;
          border-radius: 16px;
          padding: 12px 13px;
          outline: none;
          font-weight: 800;
          color: #0f172a;
          box-sizing: border-box;
        }

        .field textarea {
          min-height: 90px;
          resize: vertical;
        }

        .two-cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .employee-picker {
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          overflow: hidden;
          background: #f8fafc;
        }

        .employee-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          border-bottom: 1px solid #e2e8f0;
          background: #fff;
        }

        .employee-search input {
          border: none;
          outline: none;
          flex: 1;
          font-weight: 800;
          min-width: 0;
        }

        .employee-actions {
          display: flex;
          gap: 8px;
          padding: 10px;
          border-bottom: 1px solid #e2e8f0;
          flex-wrap: wrap;
        }

        .employee-list {
          max-height: 250px;
          overflow: auto;
          padding: 10px;
          display: grid;
          gap: 8px;
        }

        .employee-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: 16px;
          background: #fff;
          border: 1px solid #e2e8f0;
          cursor: pointer;
        }

        .employee-row input {
          width: 17px;
          height: 17px;
          flex-shrink: 0;
        }

        .employee-row strong {
          display: block;
          font-size: .84rem;
        }

        .employee-row span {
          display: block;
          color: #64748b;
          font-size: .72rem;
          margin-top: 2px;
          font-weight: 750;
        }

        .meetings-list {
          padding: 16px;
          display: grid;
          gap: 14px;
        }

        .meeting-card {
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 16px;
          background:
            radial-gradient(circle at top right, rgba(37,99,235,.08), transparent 26%),
            #ffffff;
          display: grid;
          gap: 14px;
        }

        .meeting-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .meeting-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 950;
        }

        .meeting-agenda {
          margin: 6px 0 0;
          color: #64748b;
          font-weight: 750;
          line-height: 1.5;
        }

        .badges {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .badge {
          padding: 7px 10px;
          border-radius: 999px;
          font-size: .72rem;
          font-weight: 950;
        }

        .badge.scheduled {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .badge.done {
          background: #dcfce7;
          color: #166534;
        }

        .badge.cancelled {
          background: #fee2e2;
          color: #b91c1c;
        }

        .badge.high {
          background: #fef2f2;
          color: #b91c1c;
        }

        .badge.normal {
          background: #f1f5f9;
          color: #334155;
        }

        .badge.low {
          background: #ecfdf5;
          color: #047857;
        }

        .meeting-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .meta-box {
          padding: 11px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 9px;
          color: #334155;
          font-weight: 850;
          font-size: .8rem;
        }

        .invites-box {
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 12px;
        }

        .invites-title {
          font-weight: 950;
          margin-bottom: 9px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .invite-tags {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
        }

        .invite-tag {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: .72rem;
          font-weight: 900;
        }

        .meeting-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .empty {
          padding: 28px;
          text-align: center;
          color: #64748b;
          font-weight: 850;
        }

        @media (max-width: 1100px) {
          .meetings-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .admin-meetings-page {
            padding: 14px;
          }

          .meetings-hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .two-cols,
          .meeting-meta {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="meetings-hero">
        <div>
          <div className="hero-kicker">
            <Video size={16} />
            Meetings Management
          </div>

          <h1>Admin Meetings Center</h1>
          <p>Create meetings, invite employees, manage rooms and open live meeting rooms.</p>
        </div>

        <div className="hero-actions">
          <button className="btn btn-soft" type="button" onClick={loadData}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div className="alert error">
          <XCircle size={18} />
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="alert success">
          <CheckCircle2 size={18} />
          {message}
        </div>
      ) : null}

      <section className="meetings-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Create New Meeting</h2>
              <span>Select date, room and employees</span>
            </div>
            <Plus size={20} />
          </div>

          <form className="meeting-form" onSubmit={createMeeting}>
            <div className="field">
              <label>Meeting Title</label>
              <input
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                placeholder="Example: HR Investigation Meeting"
              />
            </div>

            <div className="field">
              <label>Agenda / Notes</label>
              <textarea
                value={form.agenda}
                onChange={(e) => updateForm("agenda", e.target.value)}
                placeholder="Write meeting agenda..."
              />
            </div>

            <div className="two-cols">
              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  value={form.meetingDate}
                  onChange={(e) => updateForm("meetingDate", e.target.value)}
                />
              </div>

              <div className="field">
                <label>Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => updateForm("priority", e.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="two-cols">
              <div className="field">
                <label>Start Time</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => updateForm("startTime", e.target.value)}
                />
              </div>

              <div className="field">
                <label>End Time</label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => updateForm("endTime", e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>Meeting Room</label>
              <select
                value={form.roomId}
                onChange={(e) => updateForm("roomId", e.target.value)}
              >
                <option value="">No room selected</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} {room.location ? `- ${room.location}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Location</label>
              <input
                value={form.location}
                onChange={(e) => updateForm("location", e.target.value)}
                placeholder="Example: HR Office / Online"
              />
            </div>

            <div className="field">
              <label>External Meeting Link Optional</label>
              <input
                value={form.meetingLink}
                onChange={(e) => updateForm("meetingLink", e.target.value)}
                placeholder="Teams / Google Meet link"
              />
            </div>

            <div className="field">
              <label>Employees Selected: {form.employeeUserIds.length}</label>

              <div className="employee-picker">
                <div className="employee-search">
                  <Search size={16} />
                  <input
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search employee, GAS ID, project..."
                  />
                </div>

                <div className="employee-actions">
                  <button
                    type="button"
                    className="btn btn-soft"
                    onClick={selectAllFilteredEmployees}
                    disabled={!filteredEmployees.length}
                  >
                    Select Filtered
                  </button>

                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={clearSelectedEmployees}
                    disabled={!form.employeeUserIds.length}
                  >
                    Clear
                  </button>
                </div>

                <div className="employee-list">
                  {filteredEmployees.map((emp) => (
                    <label className="employee-row" key={emp.id}>
                      <input
                        type="checkbox"
                        checked={form.employeeUserIds.includes(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                      />

                      <div>
                        <strong>{emp.name || emp.username || "Employee"}</strong>
                        <span>
                          GAS ID: {emp.gasId || "-"} •{" "}
                          {emp.projectName || "No Project"}
                        </span>
                      </div>
                    </label>
                  ))}

                  {!filteredEmployees.length ? (
                    <div className="empty">
                      {loading ? "Loading employees..." : "No employees found"}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={saving}>
              <Plus size={17} />
              {saving ? "Creating..." : "Create Meeting"}
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Meetings List</h2>
              <span>{meetings.length} meetings</span>
            </div>
            <CalendarDays size={20} />
          </div>

          <div className="meetings-list">
            {loading ? (
              <div className="empty">Loading meetings...</div>
            ) : meetings.length ? (
              meetings.map((meeting) => (
                <article className="meeting-card" key={meeting.id}>
                  <div className="meeting-top">
                    <div>
                      <h3 className="meeting-title">{meeting.title}</h3>
                      {meeting.agenda ? (
                        <p className="meeting-agenda">{meeting.agenda}</p>
                      ) : null}
                    </div>

                    <div className="badges">
                      <span className={`badge ${statusClass(meeting.status)}`}>
                        {meeting.status}
                      </span>
                      <span className={`badge ${priorityClass(meeting.priority)}`}>
                        {meeting.priority}
                      </span>
                    </div>
                  </div>

                  <div className="meeting-meta">
                    <div className="meta-box">
                      <CalendarDays size={16} />
                      {formatDate(meeting.meetingDate)}
                    </div>

                    <div className="meta-box">
                      <Clock size={16} />
                      {meeting.startTime || "-"}{" "}
                      {meeting.endTime ? `- ${meeting.endTime}` : ""}
                    </div>

                    <div className="meta-box">
                      <MapPin size={16} />
                      {meeting.roomName || meeting.location || "No location"}
                    </div>
                  </div>

                  <div className="invites-box">
                    <div className="invites-title">
                      <Users size={16} />
                      Invited Employees ({meeting.invites?.length || 0})
                    </div>

                    <div className="invite-tags">
                      {(meeting.invites || []).slice(0, 12).map((invite) => (
                        <span className="invite-tag" key={invite.id}>
                          {invite.employeeName || "Employee"} •{" "}
                          {invite.responseStatus}
                        </span>
                      ))}

                      {(meeting.invites || []).length > 12 ? (
                        <span className="invite-tag">
                          +{meeting.invites.length - 12} more
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="meeting-actions">
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => openMeetingRoom(meeting.id)}
                    >
                      <Video size={16} />
                      Open Room
                    </button>

                    <button
                      className="btn btn-success"
                      type="button"
                      onClick={() => updateStatus(meeting.id, "completed")}
                    >
                      <CheckCircle2 size={16} />
                      Completed
                    </button>

                    <button
                      className="btn btn-warning"
                      type="button"
                      onClick={() => updateStatus(meeting.id, "cancelled")}
                    >
                      <AlertTriangle size={16} />
                      Cancel
                    </button>

                    <button
                      className="btn btn-danger"
                      type="button"
                      onClick={() => deleteMeeting(meeting.id)}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty">No meetings created yet</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
