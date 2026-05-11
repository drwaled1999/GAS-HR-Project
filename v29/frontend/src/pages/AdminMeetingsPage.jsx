import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
  Video,
  Building2,
  ShieldCheck,
  Save,
  XCircle,
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
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [roomForm, setRoomForm] = useState({
    name: "",
    location: "",
    capacity: "",
  });

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
      setError(err.message || "Failed loading data");
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
      [meeting.title, meeting.agenda, meeting.location]
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
      setError(err.message || "Failed creating meeting");
    } finally {
      setSaving(false);
    }
  }

  async function createRoom(e) {
    e.preventDefault();

    try {
      await apiFetch("/meetings/rooms", {
        method: "POST",
        body: JSON.stringify(roomForm),
      });

      setRoomForm({
        name: "",
        location: "",
        capacity: "",
      });

      await loadData();
    } catch (err) {
      setError(err.message || "Failed creating room");
    }
  }

  async function deleteRoom(roomId) {
    if (!window.confirm("Delete this room?")) return;

    try {
      await apiFetch(`/meetings/rooms/${roomId}`, {
        method: "DELETE",
      });

      await loadData();
    } catch (err) {
      setError(err.message || "Failed deleting room");
    }
  }

  async function deleteMeeting(meetingId) {
    if (!window.confirm("Delete this meeting?")) return;

    try {
      await apiFetch(`/meetings/${meetingId}`, {
        method: "DELETE",
      });

      await loadData();
    } catch (err) {
      setError(err.message || "Failed deleting meeting");
    }
  }

  async function updateInvites(meetingId, employeeUserIds) {
    try {
      await apiFetch(`/meetings/${meetingId}/invites`, {
        method: "PATCH",
        body: JSON.stringify({
          employeeUserIds,
        }),
      });

      await loadData();
    } catch (err) {
      setError(err.message || "Failed updating access");
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

        .hero {
          border-radius:30px;
          padding:24px;
          color:#fff;
          background:
            radial-gradient(circle at top right, rgba(125,211,252,.35), transparent 30%),
            linear-gradient(135deg,#061b45,#1d4ed8 60%,#0f766e);
          box-shadow:0 24px 70px rgba(15,23,42,.18);
        }

        .hero h1 {
          margin:0;
          font-size:clamp(1.8rem,4vw,2.5rem);
        }

        .hero p {
          margin:10px 0 0;
          max-width:760px;
          line-height:1.7;
          font-weight:800;
          color:rgba(255,255,255,.84);
        }

        .layout {
          display:grid;
          grid-template-columns:430px minmax(0,1fr);
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
          display:flex;
          align-items:center;
          gap:10px;
          font-size:1.05rem;
        }

        .form-grid {
          display:grid;
          gap:14px;
        }

        .form-grid input,
        .form-grid textarea,
        .form-grid select {
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

        .form-grid textarea {
          min-height:100px;
          resize:vertical;
        }

        .split {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }

        .primary-btn {
          min-height:52px;
          border:none;
          border-radius:18px;
          background:linear-gradient(135deg,#2563eb,#0ea5e9);
          color:#fff;
          font-weight:950;
          cursor:pointer;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:10px;
        }

        .employees-box {
          max-height:240px;
          overflow:auto;
          display:grid;
          gap:8px;
        }

        .employee-item {
          display:flex;
          gap:10px;
          align-items:center;
          padding:10px;
          border-radius:16px;
          background:#f8fafc;
          border:1px solid #e2e8f0;
        }

        .employee-item input {
          width:18px;
          height:18px;
        }

        .employee-meta strong {
          display:block;
          font-size:.85rem;
        }

        .employee-meta span {
          display:block;
          margin-top:2px;
          color:#64748b;
          font-size:.72rem;
          font-weight:800;
        }

        .toolbar {
          display:flex;
          gap:10px;
          align-items:center;
          padding:12px 14px;
          border-radius:18px;
          border:1px solid #e2e8f0;
          background:#fff;
          margin-bottom:16px;
        }

        .toolbar input {
          flex:1;
          border:none;
          outline:none;
          font-weight:850;
          background:transparent;
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
        }

        .participants {
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        }

        .participant-pill {
          padding:7px 10px;
          border-radius:999px;
          background:#eff6ff;
          border:1px solid #bfdbfe;
          color:#1d4ed8;
          font-size:.72rem;
          font-weight:950;
        }

        .meeting-actions {
          display:flex;
          flex-wrap:wrap;
          gap:10px;
        }

        .join-btn,
        .danger-btn,
        .save-btn {
          min-height:42px;
          padding:0 14px;
          border:none;
          border-radius:15px;
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

        .danger-btn {
          background:#ef4444;
          color:#fff;
        }

        .save-btn {
          background:#16a34a;
          color:#fff;
        }

        .room-item {
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          padding:12px;
          border-radius:18px;
          background:#f8fafc;
          border:1px solid #e2e8f0;
        }

        .room-meta strong {
          display:block;
        }

        .room-meta span {
          display:block;
          margin-top:3px;
          color:#64748b;
          font-size:.72rem;
          font-weight:800;
        }

        .error-box {
          border-radius:20px;
          padding:16px;
          background:#fef2f2;
          border:1px solid #fecaca;
          color:#991b1b;
          font-weight:850;
        }

        html.dark .card,
        html.dark .toolbar,
        html.dark .meeting-card {
          background:#111827;
          border-color:#24324d;
          color:#e5e7eb;
        }

        html.dark .form-grid input,
        html.dark .form-grid textarea,
        html.dark .form-grid select {
          background:#0f172a;
          border-color:#24324d;
          color:#e5e7eb;
        }

        html.dark .employee-item,
        html.dark .meta,
        html.dark .room-item {
          background:#0f172a;
          border-color:#24324d;
          color:#cbd5e1;
        }

        @media (max-width: 1100px) {
          .layout {
            grid-template-columns:1fr;
          }
        }

        @media (max-width: 640px) {
          .hero,
          .card,
          .meeting-card {
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
          .danger-btn,
          .save-btn {
            width:100%;
          }
        }
      `}</style>

      <section className="hero">
        <h1>Meetings Management</h1>
        <p>
          Enterprise internal meetings system with secure meeting rooms,
          employee access control, live video rooms and HR management tools.
        </p>
      </section>

      {error ? <div className="error-box">{error}</div> : null}

      <div className="layout">
        <aside className="card">
          <h2>
            <Plus size={18} />
            Create Meeting
          </h2>

          <form className="form-grid" onSubmit={createMeeting}>
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
                const room = rooms.find(
                  (r) => r.id === e.target.value
                );

                setForm((prev) => ({
                  ...prev,
                  roomId: e.target.value,
                  location: room?.location || prev.location,
                }));
              }}
            >
              <option value="">Select room</option>

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
              placeholder="External meeting link"
              value={form.meetingLink}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  meetingLink: e.target.value,
                }))
              }
            />

            <div>
              <h2>
                <Users size={18} />
                Meeting Access
              </h2>

              <div className="employees-box">
                {employees.map((employee) => (
                  <label
                    className="employee-item"
                    key={employee.id}
                  >
                    <input
                      type="checkbox"
                      checked={form.employeeUserIds.includes(
                        employee.id
                      )}
                      onChange={() =>
                        toggleEmployee(employee.id)
                      }
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
              className="primary-btn"
              type="submit"
              disabled={saving}
            >
              <Plus size={18} />
              {saving ? "Creating..." : "Create Meeting"}
            </button>
          </form>

          <div style={{ marginTop: 28 }}>
            <h2>
              <Building2 size={18} />
              Meeting Rooms
            </h2>

            <form className="form-grid" onSubmit={createRoom}>
              <input
                placeholder="Room name"
                value={roomForm.name}
                onChange={(e) =>
                  setRoomForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />

              <div className="split">
                <input
                  placeholder="Location"
                  value={roomForm.location}
                  onChange={(e) =>
                    setRoomForm((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                />

                <input
                  placeholder="Capacity"
                  type="number"
                  value={roomForm.capacity}
                  onChange={(e) =>
                    setRoomForm((prev) => ({
                      ...prev,
                      capacity: e.target.value,
                    }))
                  }
                />
              </div>

              <button className="primary-btn" type="submit">
                <Plus size={18} />
                Create Room
              </button>
            </form>

            <div
              style={{
                display: "grid",
                gap: 10,
                marginTop: 16,
              }}
            >
              {rooms.map((room) => (
                <div className="room-item" key={room.id}>
                  <div className="room-meta">
                    <strong>{room.name}</strong>
                    <span>
                      {room.location || "No location"} •{" "}
                      {room.capacity || 0} users
                    </span>
                  </div>

                  <button
                    className="danger-btn"
                    onClick={() => deleteRoom(room.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
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
            <div>Loading meetings...</div>
          ) : null}

          <div className="meetings-list">
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
                      {meeting.createdByName ||
                        "Administration"}
                    </p>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div className="participant-pill">
                      {meeting.status}
                    </div>

                    <div className="participant-pill">
                      {meeting.priority}
                    </div>
                  </div>
                </div>

                {meeting.agenda ? (
                  <p className="agenda">{meeting.agenda}</p>
                ) : null}

                <div className="meta-grid">
                  <div className="meta">
                    <CalendarDays size={18} />
                    <span>
                      {formatDate(meeting.meetingDate)}
                    </span>
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
                    <ShieldCheck size={18} />
                    <span>
                      {meeting.invites?.length || 0} invited
                    </span>
                  </div>
                </div>

                <div className="participants">
                  {(meeting.invites || []).map((invite) => (
                    <div
                      className="participant-pill"
                      key={invite.id}
                    >
                      {invite.employeeName}
                    </div>
                  ))}
                </div>

                <div className="meeting-actions">
                  <Link
                    to={`/meeting-room/${meeting.id}`}
                    className="join-btn"
                  >
                    <Video size={18} />
                    Join Room
                  </Link>

                  <button
                    className="save-btn"
                    onClick={() =>
                      updateInvites(
                        meeting.id,
                        meeting.invites.map(
                          (i) => i.employeeUserId
                        )
                      )
                    }
                  >
                    <Save size={17} />
                    Save Access
                  </button>

                  <button
                    className="danger-btn"
                    onClick={() =>
                      deleteMeeting(meeting.id)
                    }
                  >
                    <XCircle size={17} />
                    Delete Meeting
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
