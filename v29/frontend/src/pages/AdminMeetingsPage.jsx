import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Link as LinkIcon,
  MapPin,
  MessageSquareText,
  Plus,
  Search,
  Send,
  Users,
  XCircle,
} from "lucide-react";
import { apiFetch } from "../services/api";

const emptyForm = {
  title: "",
  agenda: "",
  meetingDate: new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endTime: "",
  location: "",
  meetingLink: "",
  priority: "normal",
  employeeUserIds: [],
};

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusLabel(value) {
  const map = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled" };
  return map[value] || value || "Scheduled";
}

function inviteStats(invites = []) {
  return invites.reduce(
    (acc, item) => {
      const key = item.responseStatus || "pending";
      acc[key] = (acc[key] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { total: 0, pending: 0, accepted: 0, declined: 0, tentative: 0 }
  );
}

export default function AdminMeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [meetingsRes, employeesRes] = await Promise.all([
        apiFetch("/meetings/admin"),
        apiFetch("/meetings/employees"),
      ]);
      setMeetings(meetingsRes.meetings || []);
      setEmployees(employeesRes.employees || []);
    } catch (err) {
      setError(err.message || "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredEmployees = useMemo(() => {
    const keyword = employeeSearch.trim().toLowerCase();
    if (!keyword) return employees.slice(0, 60);
    return employees.filter((item) =>
      [item.name, item.gasId, item.email, item.projectName, item.packageName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [employees, employeeSearch]);

  const filteredMeetings = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return meetings;
    return meetings.filter((meeting) =>
      [meeting.title, meeting.agenda, meeting.location, meeting.status, meeting.priority]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [meetings, search]);

  function updateForm(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
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

  async function submitMeeting(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await apiFetch("/meetings", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setEmployeeSearch("");
      setSuccess("Meeting invitation sent successfully.");
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to create meeting");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(meetingId, status) {
    setError("");
    try {
      const res = await apiFetch(`/meetings/${meetingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMeetings((prev) => prev.map((item) => (item.id === meetingId ? res.meeting : item)));
    } catch (err) {
      setError(err.message || "Failed to update meeting status");
    }
  }

  return (
    <div className="meetings-page">
      <style>{`
        .meetings-page { display: grid; gap: 18px; color: #0f172a; }
        .meetings-hero {
          border-radius: 30px; padding: 24px; color: #fff; overflow: hidden; position: relative;
          background: radial-gradient(circle at 82% 16%, rgba(125,211,252,.55), transparent 28%), linear-gradient(135deg, #06214f, #1554b7 58%, #0f76aa);
          box-shadow: 0 24px 70px rgba(15,23,42,.18);
        }
        .meetings-hero h1 { margin: 0; font-size: clamp(1.55rem, 3vw, 2.35rem); letter-spacing: -.04em; }
        .meetings-hero p { margin: 8px 0 0; max-width: 780px; color: rgba(255,255,255,.84); font-weight: 700; line-height: 1.7; }
        .meeting-grid { display: grid; grid-template-columns: minmax(340px, .85fr) minmax(0, 1.15fr); gap: 18px; align-items: start; }
        .meeting-card { background: rgba(255,255,255,.96); border: 1px solid rgba(226,232,240,.9); border-radius: 28px; padding: 20px; box-shadow: 0 18px 46px rgba(15,23,42,.10); }
        .card-title { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
        .card-title h2 { margin:0; font-size:1.1rem; letter-spacing:-.02em; }
        .icon-badge { width:42px; height:42px; border-radius:16px; display:grid; place-items:center; background:#e0f2fe; color:#0369a1; }
        .form-grid { display:grid; gap:12px; }
        .field { display:grid; gap:7px; }
        .field label { font-size:.78rem; font-weight:900; color:#475569; text-transform:uppercase; letter-spacing:.04em; }
        .field input, .field textarea, .field select {
          width:100%; box-sizing:border-box; border:1px solid #dbe4ef; border-radius:16px; padding:12px 13px; background:#fff; color:#0f172a; outline:none; font-weight:750;
        }
        .field textarea { min-height:94px; resize:vertical; line-height:1.6; }
        .two-cols { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .employee-picker { border:1px solid #e2e8f0; border-radius:20px; padding:12px; background:#f8fafc; display:grid; gap:10px; }
        .employee-list { display:grid; gap:8px; max-height:300px; overflow:auto; padding-right:4px; }
        .employee-row { display:flex; align-items:center; gap:10px; padding:10px; border-radius:16px; background:#fff; border:1px solid #e8eef7; cursor:pointer; }
        .employee-row input { width:18px; height:18px; }
        .employee-row strong { display:block; font-size:.9rem; }
        .employee-row span { display:block; font-size:.74rem; color:#64748b; font-weight:800; margin-top:2px; }
        .submit-btn { border:0; border-radius:18px; padding:13px 16px; background:linear-gradient(135deg,#2563eb,#0ea5e9); color:#fff; font-weight:950; display:flex; align-items:center; justify-content:center; gap:9px; cursor:pointer; box-shadow:0 14px 30px rgba(37,99,235,.24); }
        .submit-btn:disabled { opacity:.65; cursor:not-allowed; }
        .alert { padding:12px 14px; border-radius:16px; font-weight:850; }
        .alert.error { background:#fef2f2; color:#991b1b; border:1px solid #fecaca; }
        .alert.success { background:#ecfdf5; color:#065f46; border:1px solid #bbf7d0; }
        .search-box { display:flex; align-items:center; gap:10px; border:1px solid #dbe4ef; border-radius:17px; padding:0 12px; background:#fff; }
        .search-box input { border:0; outline:0; min-height:44px; flex:1; font-weight:800; background:transparent; }
        .meeting-list { display:grid; gap:12px; }
        .meeting-item { border:1px solid #e2e8f0; border-radius:22px; padding:15px; background:linear-gradient(180deg,#fff,#f8fafc); display:grid; gap:12px; }
        .meeting-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
        .meeting-head h3 { margin:0; font-size:1.02rem; }
        .pill { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:6px 10px; font-size:.72rem; font-weight:950; background:#e0f2fe; color:#075985; white-space:nowrap; }
        .pill.high { background:#fef2f2; color:#991b1b; }
        .pill.completed { background:#dcfce7; color:#166534; }
        .pill.cancelled { background:#fee2e2; color:#991b1b; }
        .meta-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
        .meta { display:flex; gap:8px; align-items:center; color:#475569; font-size:.82rem; font-weight:850; min-width:0; }
        .meta span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .invite-stats { display:flex; gap:8px; flex-wrap:wrap; }
        .mini-stat { border-radius:14px; padding:8px 10px; background:#f1f5f9; font-weight:950; font-size:.76rem; color:#334155; }
        .invite-names { display:flex; flex-wrap:wrap; gap:6px; }
        .invite-chip { border-radius:999px; padding:6px 9px; background:#fff; border:1px solid #e2e8f0; font-size:.72rem; font-weight:850; color:#475569; }
        .meeting-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .meeting-actions button { border:1px solid #dbe4ef; background:#fff; border-radius:14px; min-height:36px; padding:0 11px; font-weight:900; cursor:pointer; color:#334155; }
        .meeting-actions button.ok { background:#ecfdf5; color:#047857; border-color:#bbf7d0; }
        .meeting-actions button.no { background:#fef2f2; color:#b91c1c; border-color:#fecaca; }
        .empty { padding:26px; text-align:center; color:#64748b; font-weight:850; }
        html.dark .meeting-card, html.dark .meeting-item { background:#111827; border-color:#24324d; color:#e5e7eb; }
        html.dark .field input, html.dark .field textarea, html.dark .field select, html.dark .search-box, html.dark .employee-row { background:#0b1220; border-color:#24324d; color:#e5e7eb; }
        html.dark .employee-picker { background:#0f172a; border-color:#24324d; }
        html.dark .field label, html.dark .meta, html.dark .employee-row span { color:#94a3b8; }
        html.dark .mini-stat { background:#0f172a; color:#cbd5e1; }
        @media (max-width: 980px) { .meeting-grid { grid-template-columns:1fr; } }
        @media (max-width: 640px) { .meetings-hero, .meeting-card { border-radius:22px; padding:16px; } .two-cols, .meta-grid { grid-template-columns:1fr; } .meeting-head { flex-direction:column; } }
      `}</style>

      <section className="meetings-hero">
        <h1>Meetings & Employee Invitations</h1>
        <p>Create formal meeting invitations for employees. Once sent, the employee will see it in the Meetings page and can accept, decline, or mark tentative.</p>
      </section>

      <div className="meeting-grid">
        <form className="meeting-card" onSubmit={submitMeeting}>
          <div className="card-title">
            <h2>New Meeting</h2>
            <span className="icon-badge"><Plus size={20} /></span>
          </div>

          <div className="form-grid">
            {error ? <div className="alert error">{error}</div> : null}
            {success ? <div className="alert success">{success}</div> : null}

            <div className="field">
              <label>Meeting Title</label>
              <input value={form.title} onChange={(e) => updateForm("title", e.target.value)} placeholder="Example: HR Investigation Meeting" required />
            </div>

            <div className="field">
              <label>Agenda / Notes</label>
              <textarea value={form.agenda} onChange={(e) => updateForm("agenda", e.target.value)} placeholder="Write the meeting purpose, required documents, or instructions..." />
            </div>

            <div className="two-cols">
              <div className="field">
                <label>Date</label>
                <input type="date" value={form.meetingDate} onChange={(e) => updateForm("meetingDate", e.target.value)} required />
              </div>
              <div className="field">
                <label>Priority</label>
                <select value={form.priority} onChange={(e) => updateForm("priority", e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="two-cols">
              <div className="field">
                <label>Start Time</label>
                <input type="time" value={form.startTime} onChange={(e) => updateForm("startTime", e.target.value)} required />
              </div>
              <div className="field">
                <label>End Time</label>
                <input type="time" value={form.endTime} onChange={(e) => updateForm("endTime", e.target.value)} />
              </div>
            </div>

            <div className="two-cols">
              <div className="field">
                <label>Location</label>
                <input value={form.location} onChange={(e) => updateForm("location", e.target.value)} placeholder="Office / Site / Meeting Room" />
              </div>
              <div className="field">
                <label>Meeting Link</label>
                <input value={form.meetingLink} onChange={(e) => updateForm("meetingLink", e.target.value)} placeholder="Google Meet / Teams link" />
              </div>
            </div>

            <div className="field">
              <label>Invite Employees ({form.employeeUserIds.length} selected)</label>
              <div className="employee-picker">
                <div className="search-box">
                  <Search size={18} />
                  <input value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} placeholder="Search by name, GAS ID, project..." />
                </div>
                <div className="employee-list">
                  {filteredEmployees.map((employee) => (
                    <label className="employee-row" key={employee.id}>
                      <input type="checkbox" checked={form.employeeUserIds.includes(employee.id)} onChange={() => toggleEmployee(employee.id)} />
                      <div>
                        <strong>{employee.name || "Employee"}</strong>
                        <span>GAS ID: {employee.gasId || "-"} • {employee.projectName || "No Project"}</span>
                      </div>
                    </label>
                  ))}
                  {!filteredEmployees.length ? <div className="empty">No employees found.</div> : null}
                </div>
              </div>
            </div>

            <button className="submit-btn" type="submit" disabled={saving}>
              <Send size={18} />
              {saving ? "Sending..." : "Send Meeting Invitation"}
            </button>
          </div>
        </form>

        <section className="meeting-card">
          <div className="card-title">
            <h2>All Meetings</h2>
            <span className="icon-badge"><CalendarDays size={20} /></span>
          </div>

          <div className="search-box" style={{ marginBottom: 14 }}>
            <Search size={18} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search meetings..." />
          </div>

          {loading ? <div className="empty">Loading meetings...</div> : null}

          <div className="meeting-list">
            {!loading && !filteredMeetings.length ? <div className="empty">No meetings yet.</div> : null}
            {filteredMeetings.map((meeting) => {
              const stats = inviteStats(meeting.invites || []);
              return (
                <article className="meeting-item" key={meeting.id}>
                  <div className="meeting-head">
                    <div>
                      <h3>{meeting.title}</h3>
                      <div style={{ marginTop: 7, display: "flex", gap: 7, flexWrap: "wrap" }}>
                        <span className={`pill ${meeting.priority === "high" || meeting.priority === "urgent" ? "high" : ""}`}>{meeting.priority}</span>
                        <span className={`pill ${meeting.status}`}>{statusLabel(meeting.status)}</span>
                      </div>
                    </div>
                  </div>

                  {meeting.agenda ? <p style={{ margin: 0, color: "#64748b", fontWeight: 750, lineHeight: 1.6 }}>{meeting.agenda}</p> : null}

                  <div className="meta-grid">
                    <div className="meta"><CalendarDays size={17} /><span>{formatDate(meeting.meetingDate)}</span></div>
                    <div className="meta"><Clock3 size={17} /><span>{meeting.startTime}{meeting.endTime ? ` - ${meeting.endTime}` : ""}</span></div>
                    <div className="meta"><MapPin size={17} /><span>{meeting.location || "No location"}</span></div>
                    <div className="meta"><LinkIcon size={17} /><span>{meeting.meetingLink || "No link"}</span></div>
                  </div>

                  <div className="invite-stats">
                    <span className="mini-stat"><Users size={14} /> {stats.total} Invited</span>
                    <span className="mini-stat"><CheckCircle2 size={14} /> {stats.accepted} Accepted</span>
                    <span className="mini-stat"><MessageSquareText size={14} /> {stats.pending} Pending</span>
                    <span className="mini-stat"><XCircle size={14} /> {stats.declined} Declined</span>
                  </div>

                  <div className="invite-names">
                    {(meeting.invites || []).slice(0, 8).map((invite) => (
                      <span className="invite-chip" key={invite.id}>{invite.employeeName || "Employee"} • {invite.responseStatus}</span>
                    ))}
                    {(meeting.invites || []).length > 8 ? <span className="invite-chip">+{meeting.invites.length - 8} more</span> : null}
                  </div>

                  <div className="meeting-actions">
                    <button type="button" className="ok" onClick={() => updateStatus(meeting.id, "completed")}>Mark Completed</button>
                    <button type="button" className="no" onClick={() => updateStatus(meeting.id, "cancelled")}>Cancel</button>
                    <button type="button" onClick={() => updateStatus(meeting.id, "scheduled")}>Reopen</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
