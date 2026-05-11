import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  Search,
  Users,
  Video,
  CheckCircle2,
  XCircle,
  TimerReset,
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "../services/api";

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Intl.DateTimeFormat("en", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AdminMeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    agenda: "",
    meetingDate: "",
    startTime: "",
    endTime: "",
    location: "",
    meetingLink: "",
    roomId: "",
    employeeUserIds: [],
    priority: "normal",
  });

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [meetingsRes, employeesRes, roomsRes] = await Promise.all([
        apiFetch("/meetings/admin"),
        apiFetch("/meetings/employees"),
        apiFetch("/meetings/rooms"),
      ]);

      setMeetings(meetingsRes.meetings || []);
      setEmployees(employeesRes.employees || []);
      setRooms(roomsRes.rooms || []);
    } catch (err) {
      setError(err.message || "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredMeetings = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return meetings;

    return meetings.filter((meeting) =>
      [
        meeting.title,
        meeting.agenda,
        meeting.location,
        meeting.roomName,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(keyword)
        )
    );
  }, [meetings, search]);

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

  async function createMeeting(e) {
    e.preventDefault();

    setSaving(true);
    setError("");

    try {
      await apiFetch("/meetings", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setForm({
        title: "",
        agenda: "",
        meetingDate: "",
        startTime: "",
        endTime: "",
        location: "",
        meetingLink: "",
        roomId: "",
        employeeUserIds: [],
        priority: "normal",
      });

      await loadData();
    } catch (err) {
      setError(err.message || "Failed to create meeting");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(meetingId, status) {
    try {
      await apiFetch(`/meetings/${meetingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      await loadData();
    } catch (err) {
      setError(err.message || "Failed to update status");
    }
  }

  return (
    <div className="admin-meetings-page">
      <style>{`
        .admin-meetings-page {
          display:grid;
          gap:18px;
          color:#0f172a;
        }

        .meetings-hero {
          border-radius:32px;
          padding:24px;
          color:#fff;
          background:
            radial-gradient(circle at top right, rgba(125,211,252,.35), transparent 28%),
            linear-gradient(135deg,#061b45,#1d4ed8 60%,#0f766e);
          box-shadow:0 24px 70px rgba(15,23,42,.18);
        }

        .meetings-hero h1 {
          margin:0;
          font-size:clamp(1.7rem,4vw,2.4rem);
          letter-spacing:-.04em;
        }

        .meetings-hero p {
          margin:10px 0 0;
          max-width:760px;
          line-height:1.7;
          font-weight:800;
          color:rgba(255,255,255,.84);
        }

        .meeting-grid {
          display:grid;
          grid-template-columns:420px minmax(0,1fr);
          gap:18px;
          align-items:start;
        }

        .card {
          border-radius:28px;
          background:#fff;
          border:1px solid #e2e8f0;
          padding:20px;
          box-shadow:0 16px 42px rgba(15,23,42,.08);
        }

        .card h2 {
          margin:0 0 16px;
          font-size:1.08rem;
          letter-spacing:-.02em;
        }

        .meeting-form {
          display:grid;
          gap:14px;
        }

        .meeting-form input,
        .meeting-form textarea,
        .meeting-form select {
          width:100%;
          box-sizing:border-box;
          border:1px solid #dbe4ef;
          border-radius:16px;
          min-height:48px;
          padding:12px 14px;
          background:#fff;
          color:#0f172a;
          font-weight:800;
          outline:none;
        }

        .meeting-form textarea {
          min-height:110px;
          resize:vertical;
        }

        .split {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }

        .employee-list {
          max-height:260px;
          overflow:auto;
          display:grid;
          gap:8px;
          padding-right:4px;
        }

        .employee-item {
          display:flex;
          align-items:center;
          gap:10px;
          border:1px solid #e2e8f0;
          background:#f8fafc;
          border-radius:16px;
          padding:10px;
        }

        .employee-item input {
          width:18px;
          height:18px;
        }

        .employee-meta strong {
          display:block;
          font-size:.88rem;
        }

        .employee-meta span {
          display:block;
          color:#64748b;
          margin-top:2px;
          font-size:.74rem;
          font-weight:800;
        }

        .create-btn {
          min-height:52px;
          border:none;
          border-radius:18px;
          background:linear-gradient(135deg,#2563eb,#0ea5e9);
          color:#fff;
          font-weight:950;
          font-size:.95rem;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          cursor:pointer;
          box-shadow:0 16px 32px rgba(37,99,235,.24);
        }

        .toolbar {
          display:flex;
          gap:10px;
          align-items:center;
          border-radius:18px;
          background:#fff;
          border:1px solid #e2e8f0;
          padding:12px 14px;
          margin-bottom:16px;
        }

        .toolbar input {
          flex:1;
          border:none;
          outline:none;
          background:transparent;
          font-weight:850;
        }

        .meetings-list {
          display:grid;
          gap:14px;
        }

        .meeting-card {
          border-radius:24px;
          border:1px solid #e2e8f0;
          background:#fff;
          padding:18px;
          display:grid;
          gap:14px;
          box-shadow:0 16px 42px rgba(15,23,42,.07);
        }

        .meeting-head {
          display:flex;
          justify-content:space-between;
          gap:12px;
          align-items:flex-start;
        }

        .meeting-head h3 {
          margin:0;
          font-size:1.05rem;
          letter-spacing:-.02em;
        }

        .status-pill {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-height:34px;
          padding:0 12px;
          border-radius:999px;
          font-size:.74rem;
          font-weight:950;
          background:#dbeafe;
          color:#1d4ed8;
        }

        .status-pill.completed {
          background:#dcfce7;
          color:#166534;
        }

        .status-pill.cancelled {
          background:#fee2e2;
          color:#991b1b;
        }

        .agenda {
          margin:0;
          color:#475569;
          line-height:1.7;
          font-weight:800;
        }

        .meta-grid {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;
        }

        .meta {
          border-radius:16px;
          background:#f8fafc;
          border:1px solid #eef2f7;
          padding:11px;
          display:flex;
          align-items:center;
          gap:9px;
          font-weight:850;
          color:#334155;
          min-width:0;
        }

        .meta span {
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .meeting-actions {
          display:flex;
          flex-wrap:wrap;
          gap:10px;
        }

        .join-btn,
        .status-btn {
          min-height:42px;
          padding:0 14px;
          border-radius:15px;
          border:none;
          font-weight:950;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          cursor:pointer;
          text-decoration:none;
        }

        .join-btn {
          background:linear-gradient(135deg,#2563eb,#0ea5e9);
          color:#fff;
        }

        .status-btn.complete {
          background:#16a34a;
          color:#fff;
        }

        .status-btn.cancel {
          background:#ef4444;
          color:#fff;
        }

        .participants {
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        }

        .participant-pill {
          padding:7px 10px;
          border-radius:999px;
          background:#f1f5f9;
          border:1px solid #e2e8f0;
          font-size:.74rem;
          font-weight:900;
          color:#334155;
        }

        .error-box,
        .empty-box {
          border-radius:22px;
          padding:20px;
          text-align:center;
          font-weight:850;
          border:1px solid #e2e8f0;
          background:#fff;
          color:#64748b;
        }

        .error-box {
          background:#fef2f2;
          border-color:#fecaca;
          color:#991b1b;
        }

        html.dark .card,
        html.dark .toolbar,
        html.dark .meeting-card,
        html.dark .empty-box {
          background:#111827;
          border-color:#24324d;
          color:#e5e7eb;
        }

        html.dark .meeting-form input,
        html.dark .meeting-form textarea,
        html.dark .meeting-form select {
          background:#0f172a;
          border-color:#24324d;
          color:#e5e7eb;
        }

        html.dark .employee-item,
        html.dark .meta {
          background:#0f172a;
          border-color:#24324d;
          color:#cbd5e1;
        }

        html.dark .participant-pill {
          background:#0f172a;
          border-color:#24324d;
          color:#cbd5e1;
        }

        @media (max-width: 1100px) {
          .meeting-grid {
            grid-template-columns:1fr;
          }
        }

        @media (max-width: 640px) {
          .card,
          .meeting-card,
          .meetings-hero {
            border-radius:22px;
            padding:16px;
          }

          .split,
          .meta-grid {
            grid-template-columns:1fr;
          }

          .meeting-head {
            flex-direction:column;
          }

          .meeting-actions {
            display:grid;
            grid-template-columns:1fr;
          }

          .join-btn,
          .status-btn {
            width:100%;
          }
        }
      `}</style>

      <section className="meetings-hero">
        <h1>Meetings Management</h1>
        <p>
          Create internal HR meetings, invite employees, manage meeting rooms,
          monitor attendance and launch secure video rooms directly inside your HR portal.
        </p>
      </section>

      {error ? <div className="error-box">{error}</div> : null}

      <div className="meeting-grid">
        <aside className="card">
          <h2>Create New Meeting</h2>

          <form className="meeting-form" onSubmit={createMeeting}>
            <input
              placeholder="Meeting title"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  title: e.target.value,
                }))
              }
            />

            <textarea
              placeholder="Meeting agenda"
              value={form.agenda}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  agenda: e.target.value,
                }))
              }
            />

            <div className="split">
              <input
                type="date"
                value={form.meetingDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    meetingDate: e.target.value,
                  }))
                }
              />

              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    priority: e.target.value,
                  }))
                }
              >
                <option value="normal">Normal</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="split">
              <input
                type="time"
                value={form.startTime}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    startTime: e.target.value,
                  }))
                }
              />

              <input
                type="time"
                value={form.endTime}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    endTime: e.target.value,
                  }))
                }
              />
            </div>

            <select
              value={form.roomId}
              onChange={(e) => {
                const room = rooms.find((r) => r.id === e.target.value);

                setForm((prev) => ({
                  ...prev,
                  roomId: e.target.value,
                  location: room?.location || prev.location,
                }));
              }}
            >
              <option value="">Select meeting room</option>

              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>

            <input
              placeholder="Location"
              value={form.location}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  location: e.target.value,
                }))
              }
            />

            <input
              placeholder="External meeting link (optional)"
              value={form.meetingLink}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  meetingLink: e.target.value,
                }))
              }
            />

            <div>
              <h2 style={{ marginBottom: 12 }}>Select Employees</h2>

              <div className="employee-list">
                {employees.map((employee) => (
                  <label
                    className="employee-item"
                    key={employee.id}
                  >
                    <input
                      type="checkbox"
                      checked={form.employeeUserIds.includes(employee.id)}
                      onChange={() => toggleEmployee(employee.id)}
                    />

                    <div className="employee-meta">
                      <strong>{employee.name}</strong>
                      <span>
                        {employee.gasId || "-"} •{" "}
                        {employee.projectName || "No Project"}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              className="create-btn"
              type="submit"
              disabled={saving}
            >
              <Plus size={18} />
              {saving ? "Creating..." : "Create Meeting"}
            </button>
          </form>
        </aside>

        <section className="card">
          <div className="toolbar">
            <Search size={18} />
            <input
              placeholder="Search meetings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="empty-box">Loading meetings...</div>
          ) : null}

          <div className="meetings-list">
            {!loading && !filteredMeetings.length ? (
              <div className="empty-box">
                No meetings created yet.
              </div>
            ) : null}

            {filteredMeetings.map((meeting) => (
              <article
                className="meeting-card"
                key={meeting.id}
              >
                <div className="meeting-head">
                  <div>
                    <h3>{meeting.title}</h3>

                    <p
                      style={{
                        margin: "6px 0 0",
                        color: "#64748b",
                        fontWeight: 850,
                        fontSize: ".82rem",
                      }}
                    >
                      Created by{" "}
                      {meeting.createdByName || "Administration"}
                    </p>
                  </div>

                  <span
                    className={`status-pill ${meeting.status || "scheduled"}`}
                  >
                    {meeting.status || "scheduled"}
                  </span>
                </div>

                {meeting.agenda ? (
                  <p className="agenda">{meeting.agenda}</p>
                ) : null}

                <div className="meta-grid">
                  <div className="meta">
                    <CalendarDays size={18} />
                    <span>{formatDate(meeting.meetingDate)}</span>
                  </div>

                  <div className="meta">
                    <Clock3 size={18} />
                    <span>
                      {meeting.startTime}
                      {meeting.endTime
                        ? ` - ${meeting.endTime}`
                        : ""}
                    </span>
                  </div>

                  <div className="meta">
                    <MapPin size={18} />
                    <span>
                      {meeting.location ||
                        meeting.roomName ||
                        "No location"}
                    </span>
                  </div>

                  <div className="meta">
                    <Users size={18} />
                    <span>
                      {meeting.invites?.length || 0} Participants
                    </span>
                  </div>
                </div>

                <div className="participants">
                  {(meeting.invites || []).map((invite) => (
                    <div
                      className="participant-pill"
                      key={invite.id}
                    >
                      {invite.employeeName} •{" "}
                      {invite.responseStatus || "pending"}
                    </div>
                  ))}
                </div>

                <div className="meeting-actions">
                  <Link
                    to={`/meeting-room/${meeting.id}`}
                    className="join-btn"
                  >
                    <Video size={18} />
                    Join Internal Room
                  </Link>

                  <button
                    className="status-btn complete"
                    onClick={() =>
                      updateStatus(meeting.id, "completed")
                    }
                  >
                    <CheckCircle2 size={17} />
                    Complete
                  </button>

                  <button
                    className="status-btn cancel"
                    onClick={() =>
                      updateStatus(meeting.id, "cancelled")
                    }
                  >
                    <XCircle size={17} />
                    Cancel
                  </button>

                  <button
                    className="status-btn"
                    style={{
                      background: "#f59e0b",
                      color: "#fff",
                    }}
                    onClick={() =>
                      updateStatus(meeting.id, "scheduled")
                    }
                  >
                    <TimerReset size={17} />
                    Reset
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
