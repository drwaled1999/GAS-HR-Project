import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  MessageSquareText,
  Search,
  XCircle,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../services/api";

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

function responseLabel(value) {
  const map = {
    pending: "Pending",
    accepted: "Accepted",
    declined: "Declined",
    tentative: "Tentative",
  };
  return map[value] || "Pending";
}

export default function EmployeeMeetingsPage() {
  const [meetings, setMeetings] = useState([]);
  const [search, setSearch] = useState("");
  const [noteByMeeting, setNoteByMeeting] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  async function loadMeetings() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/meetings/my");
      setMeetings(res.meetings || []);
    } catch (err) {
      setError(err.message || "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMeetings();
  }, []);

  const filteredMeetings = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return meetings;
    return meetings.filter((meeting) =>
      [meeting.title, meeting.agenda, meeting.location, meeting.responseStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [meetings, search]);

  const upcomingCount = meetings.filter(
    (item) => item.status === "scheduled" && item.responseStatus === "pending"
  ).length;

  async function respond(meetingId, responseStatus) {
    setSavingId(`${meetingId}-${responseStatus}`);
    setError("");
    try {
      await apiFetch(`/meetings/${meetingId}/respond`, {
        method: "POST",
        body: JSON.stringify({
          responseStatus,
          responseNote: noteByMeeting[meetingId] || "",
        }),
      });
      await loadMeetings();
    } catch (err) {
      setError(err.message || "Failed to send response");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="employee-meetings-page">
      <style>{`
        .employee-meetings-page { display:grid; gap:18px; color:#0f172a; }
        .emp-meetings-hero { border-radius:30px; padding:22px; color:#fff; background:radial-gradient(circle at 85% 18%, rgba(125,211,252,.5), transparent 28%), linear-gradient(135deg,#061b45,#164da6 60%,#0f766e); box-shadow:0 22px 60px rgba(15,23,42,.18); }
        .hero-top { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
        .emp-meetings-hero h1 { margin:0; font-size:clamp(1.5rem,4vw,2.2rem); letter-spacing:-.04em; }
        .emp-meetings-hero p { margin:8px 0 0; color:rgba(255,255,255,.84); font-weight:750; line-height:1.65; }
        .hero-count { min-width:96px; border-radius:22px; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.22); padding:12px; text-align:center; backdrop-filter:blur(14px); }
        .hero-count strong { display:block; font-size:1.9rem; line-height:1; }
        .hero-count span { display:block; margin-top:4px; font-size:.72rem; font-weight:900; opacity:.86; }
        .meeting-toolbar { display:flex; gap:10px; align-items:center; border-radius:22px; background:rgba(255,255,255,.96); border:1px solid #e2e8f0; padding:10px 13px; box-shadow:0 14px 38px rgba(15,23,42,.08); }
        .meeting-toolbar input { border:0; outline:0; flex:1; min-height:38px; background:transparent; font-weight:850; color:#0f172a; }
        .meetings-list { display:grid; gap:13px; }
        .employee-meeting-card { border:1px solid #e2e8f0; border-radius:26px; background:rgba(255,255,255,.97); padding:18px; box-shadow:0 16px 42px rgba(15,23,42,.09); display:grid; gap:14px; }
        .meeting-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
        .meeting-head h2 { margin:0; font-size:1.08rem; letter-spacing:-.02em; }
        .pill { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:7px 11px; font-size:.72rem; font-weight:950; white-space:nowrap; background:#e0f2fe; color:#075985; }
        .pill.accepted { background:#dcfce7; color:#166534; }
        .pill.declined { background:#fee2e2; color:#991b1b; }
        .pill.tentative { background:#fef3c7; color:#92400e; }
        .pill.pending { background:#e0f2fe; color:#075985; }
        .agenda { margin:0; color:#475569; font-weight:750; line-height:1.7; }
        .meta-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
        .meta { min-width:0; border-radius:16px; background:#f8fafc; border:1px solid #eef2f7; padding:10px; display:flex; align-items:center; gap:9px; color:#334155; font-weight:850; font-size:.84rem; }
        .meta span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

        .meeting-links-row {
          display:flex;
          flex-wrap:wrap;
          gap:10px;
          align-items:center;
        }

        .meeting-link {
          color:#2563eb;
          text-decoration:none;
          font-weight:950;
          display:inline-flex;
          align-items:center;
          gap:7px;
        }

        .join-room-btn {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:8px;
          min-height:42px;
          padding:0 15px;
          border-radius:15px;
          background:linear-gradient(135deg,#2563eb,#0ea5e9);
          color:#fff;
          text-decoration:none;
          font-weight:950;
          box-shadow:0 14px 28px rgba(37,99,235,.24);
          border:1px solid rgba(255,255,255,.18);
        }

        .join-room-btn:hover {
          transform:translateY(-1px);
        }

        .response-box { display:grid; gap:10px; padding:12px; border-radius:20px; border:1px solid #e2e8f0; background:#f8fafc; }
        .response-box textarea { width:100%; box-sizing:border-box; border:1px solid #dbe4ef; border-radius:16px; min-height:78px; padding:12px; outline:none; resize:vertical; font-weight:750; background:#fff; color:#0f172a; }
        .actions { display:flex; gap:8px; flex-wrap:wrap; }
        .actions button { border:0; min-height:40px; border-radius:15px; padding:0 13px; font-weight:950; cursor:pointer; display:flex; align-items:center; gap:7px; }
        .actions button.accept { background:#16a34a; color:#fff; }
        .actions button.tentative { background:#f59e0b; color:#fff; }
        .actions button.decline { background:#ef4444; color:#fff; }
        .actions button:disabled { opacity:.62; cursor:not-allowed; }
        .empty-state, .error-state { border-radius:24px; padding:24px; text-align:center; background:#fff; border:1px solid #e2e8f0; font-weight:850; color:#64748b; }
        .error-state { background:#fef2f2; color:#991b1b; border-color:#fecaca; }
        html.dark .meeting-toolbar, html.dark .employee-meeting-card, html.dark .empty-state { background:#111827; border-color:#24324d; color:#e5e7eb; }
        html.dark .meeting-toolbar input, html.dark .response-box textarea { color:#e5e7eb; background:transparent; }
        html.dark .agenda { color:#cbd5e1; }
        html.dark .meta, html.dark .response-box { background:#0f172a; border-color:#24324d; color:#cbd5e1; }
        html.dark .response-box textarea { background:#0b1220; border-color:#24324d; }
        @media (max-width: 640px) {
          .emp-meetings-hero, .employee-meeting-card { border-radius:22px; padding:16px; }
          .hero-top, .meeting-head { flex-direction:column; }
          .hero-count { width:100%; box-sizing:border-box; }
          .meta-grid { grid-template-columns:1fr; }
          .meeting-links-row { display:grid; grid-template-columns:1fr; }
          .join-room-btn, .meeting-link { width:100%; box-sizing:border-box; justify-content:center; }
          .actions { display:grid; grid-template-columns:1fr; }
          .actions button { justify-content:center; }
        }
      `}</style>

      <section className="emp-meetings-hero">
        <div className="hero-top">
          <div>
            <h1>My Meetings</h1>
            <p>
              Review official meeting invitations from the administration and respond directly from your employee portal.
            </p>
          </div>
          <div className="hero-count">
            <strong>{upcomingCount}</strong>
            <span>Pending</span>
          </div>
        </div>
      </section>

      <div className="meeting-toolbar">
        <Search size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search meetings..."
        />
      </div>

      {error ? <div className="error-state">{error}</div> : null}
      {loading ? <div className="empty-state">Loading meetings...</div> : null}

      <div className="meetings-list">
        {!loading && !filteredMeetings.length ? (
          <div className="empty-state">No meeting invitations yet.</div>
        ) : null}

        {filteredMeetings.map((meeting) => (
          <article className="employee-meeting-card" key={meeting.id}>
            <div className="meeting-head">
              <div>
                <h2>{meeting.title}</h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#64748b",
                    fontWeight: 850,
                    fontSize: ".82rem",
                  }}
                >
                  Created by {meeting.createdByName || "Administration"}
                </p>
              </div>
              <span className={`pill ${meeting.responseStatus || "pending"}`}>
                {responseLabel(meeting.responseStatus)}
              </span>
            </div>

            {meeting.agenda ? <p className="agenda">{meeting.agenda}</p> : null}

            <div className="meta-grid">
              <div className="meta">
                <CalendarDays size={18} />
                <span>{formatDate(meeting.meetingDate)}</span>
              </div>
              <div className="meta">
                <Clock3 size={18} />
                <span>
                  {meeting.startTime}
                  {meeting.endTime ? ` - ${meeting.endTime}` : ""}
                </span>
              </div>
              <div className="meta">
                <MapPin size={18} />
                <span>{meeting.location || meeting.roomName || "No location"}</span>
              </div>
              <div className="meta">
                <MessageSquareText size={18} />
                <span>{meeting.status || "scheduled"}</span>
              </div>
            </div>

            <div className="meeting-links-row">
              <Link to={`/meeting-room/${meeting.id}`} className="join-room-btn">
                <Video size={17} />
                Join Internal Room
              </Link>

              {meeting.meetingLink ? (
                <a
                  className="meeting-link"
                  href={meeting.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open external link <ExternalLink size={16} />
                </a>
              ) : null}
            </div>

            <div className="response-box">
              <textarea
                value={noteByMeeting[meeting.id] ?? meeting.responseNote ?? ""}
                onChange={(e) =>
                  setNoteByMeeting((prev) => ({
                    ...prev,
                    [meeting.id]: e.target.value,
                  }))
                }
                placeholder="Optional note to administration..."
              />

              <div className="actions">
                <button
                  className="accept"
                  type="button"
                  disabled={savingId === `${meeting.id}-accepted`}
                  onClick={() => respond(meeting.id, "accepted")}
                >
                  <CheckCircle2 size={17} /> Accept
                </button>
                <button
                  className="tentative"
                  type="button"
                  disabled={savingId === `${meeting.id}-tentative`}
                  onClick={() => respond(meeting.id, "tentative")}
                >
                  <MessageSquareText size={17} /> Tentative
                </button>
                <button
                  className="decline"
                  type="button"
                  disabled={savingId === `${meeting.id}-declined`}
                  onClick={() => respond(meeting.id, "declined")}
                >
                  <XCircle size={17} /> Decline
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
