import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";

function normalizeItems(value) {
  return Array.isArray(value) ? value : [];
}

function typeBadgeClass(type) {
  const value = String(type || "").toLowerCase();

  if (value.includes("review")) return "success";
  if (value.includes("adjustment")) return "warning";
  if (value.includes("leave")) return "info";
  return "";
}

function formatDateTime(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [workingAll, setWorkingAll] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadNotifications() {
    try {
      if (!user?.username) {
        setItems([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setMessage("");

      const response = await apiFetch("/notifications");
      setItems(normalizeItems(response?.items));
      setUnreadCount(Number(response?.unreadCount || 0));
    } catch (err) {
      console.error("Load notifications error:", err);
      setError(err.message || "Failed to load notifications");
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [user?.username]);

  async function handleRead(id) {
    try {
      setWorkingId(String(id));
      setError("");
      setMessage("");

      const response = await apiFetch(`/notifications/${id}/read`, {
        method: "POST",
      });

      setUnreadCount(Number(response?.unreadCount || 0));

      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                isRead: true,
                readAt: response?.item?.readAt || item.readAt || new Date().toISOString(),
              }
            : item
        )
      );
    } catch (err) {
      console.error("Mark notification read error:", err);
      setError(err.message || "Failed to mark notification as read");
    } finally {
      setWorkingId("");
    }
  }

  async function handleReadAll() {
    try {
      setWorkingAll(true);
      setError("");
      setMessage("");

      const response = await apiFetch("/notifications/read-all", {
        method: "POST",
      });

      setUnreadCount(Number(response?.unreadCount || 0));
      setItems((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
        }))
      );
      setMessage(`تم تحديث ${response?.updated || 0} إشعار`);
    } catch (err) {
      console.error("Mark all notifications read error:", err);
      setError(err.message || "Failed to mark all notifications as read");
    } finally {
      setWorkingAll(false);
    }
  }

  async function handleOpen(item) {
    try {
      if (!item?.path) return;

      if (!item.isRead) {
        await handleRead(item.id);
      }

      navigate(item.path);
    } catch (err) {
      console.error("Open notification error:", err);
      setError(err.message || "Failed to open notification");
    }
  }

  return (
    <div className="page">
      <section className="card page-header">
        <div>
          <h1>Notifications</h1>
          <p>كل طلب تعديل وموافقة ورفض يظهر لك هنا.</p>
        </div>

        <div className="inline-actions">
          <span className="soft-badge">Unread: {unreadCount}</span>
          <button className="ghost" onClick={handleReadAll} disabled={workingAll || !items.length}>
            {workingAll ? "Updating..." : "Mark all as read"}
          </button>
        </div>
      </section>

      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      <section className="card activity-list">
        {loading ? <div className="muted">Loading notifications...</div> : null}

        {!loading && !items.length ? (
          <div className="muted">No notifications yet.</div>
        ) : null}

        {!loading &&
          items.map((item) => (
            <div
              key={item.id}
              className={`notification-item ${item.isRead ? "is-read" : ""}`}
            >
              <div>
                <strong>{item.message}</strong>
                <p>{formatDateTime(item.createdAt)}</p>
                {item.path ? (
                  <p className="muted small">Path: {item.path}</p>
                ) : null}
              </div>

              <div className="activity-meta">
                <span className={`soft-badge ${item.isRead ? "" : "warning"} ${typeBadgeClass(item.type)}`}>
                  {item.type}
                </span>

                <div className="inline-actions wrap-actions">
                  {item.path ? (
                    <button className="ghost" onClick={() => handleOpen(item)}>
                      Open
                    </button>
                  ) : null}

                  {!item.isRead ? (
                    <button
                      className="ghost"
                      onClick={() => handleRead(item.id)}
                      disabled={workingId === String(item.id)}
                    >
                      {workingId === String(item.id) ? "..." : "Mark read"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
      </section>
    </div>
  );
}
