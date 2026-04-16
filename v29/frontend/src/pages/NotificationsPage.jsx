import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  FileText,
  CircleCheckBig,
  CircleX,
  Clock3,
} from "lucide-react";
import api from "../services/api";

function getStoredToken() {
  const possibleKeys = [
    "hr_portal_auth",
    "employee_portal_auth",
    "auth",
    "user_auth",
    "portal_auth",
    "token",
  ];

  for (const key of possibleKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    if (key === "token") return raw;

    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string" && parsed.trim()) return parsed;
      if (parsed?.token) return parsed.token;
      if (parsed?.accessToken) return parsed.accessToken;
      if (parsed?.authToken) return parsed.authToken;
      if (parsed?.jwt) return parsed.jwt;
    } catch {
      if (raw.trim()) return raw;
    }
  }

  const commonAuth =
    api?.defaults?.headers?.common?.Authorization ||
    api?.defaults?.headers?.common?.authorization;

  if (commonAuth && String(commonAuth).startsWith("Bearer ")) {
    return String(commonAuth).replace(/^Bearer\s+/i, "").trim();
  }

  return "";
}

function buildAuthConfig() {
  const token = getStoredToken();
  return token
    ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    : {};
}

function safeParseData(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeNotification(item) {
  const data = safeParseData(item?.data ?? item?.metadata);

  return {
    id: item?.id,
    userId: item?.userId ?? item?.user_id ?? null,
    message: item?.message ?? "",
    type: item?.type ?? "general",
    link: item?.link ?? item?.path ?? "/notifications",
    data,
    isRead: item?.isRead ?? item?.is_read ?? false,
    createdAt: item?.createdAt ?? item?.created_at ?? null,
  };
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function getNotificationMeta(item) {
  const type = String(item?.type || "").toLowerCase();
  const message = String(item?.message || "");
  const data = item?.data || {};
  const decision = String(data?.decision || "").toLowerCase();

  if (type === "leave_request") {
    return {
      title: "New Leave Request",
      subtitle: data?.employeeName
        ? `${data.employeeName} submitted a new request`
        : message,
      badge: "New Request",
      badgeBg: "#E8F1FF",
      badgeColor: "#1D4ED8",
      iconBg: "#EFF6FF",
      iconColor: "#2563EB",
      borderColor: item.isRead ? "#E5E7EB" : "#BFDBFE",
      unreadDot: "#2563EB",
      Icon: FileText,
    };
  }

  if (type === "leave_review") {
    if (decision === "approved" || message.toLowerCase().includes("approved")) {
      return {
        title: "Request Approved",
        subtitle: message,
        badge: "Approved",
        badgeBg: "#ECFDF3",
        badgeColor: "#047857",
        iconBg: "#ECFDF3",
        iconColor: "#059669",
        borderColor: item.isRead ? "#E5E7EB" : "#A7F3D0",
        unreadDot: "#059669",
        Icon: CircleCheckBig,
      };
    }

    if (decision === "rejected" || message.toLowerCase().includes("rejected")) {
      return {
        title: "Request Rejected",
        subtitle: message,
        badge: "Rejected",
        badgeBg: "#FEF2F2",
        badgeColor: "#B91C1C",
        iconBg: "#FEF2F2",
        iconColor: "#DC2626",
        borderColor: item.isRead ? "#E5E7EB" : "#FECACA",
        unreadDot: "#DC2626",
        Icon: CircleX,
      };
    }

    return {
      title: "Request Update",
      subtitle: message,
      badge: "Review",
      badgeBg: "#FFF7ED",
      badgeColor: "#C2410C",
      iconBg: "#FFF7ED",
      iconColor: "#EA580C",
      borderColor: item.isRead ? "#E5E7EB" : "#FED7AA",
      unreadDot: "#EA580C",
      Icon: Clock3,
    };
  }

  return {
    title: "Notification",
    subtitle: message,
    badge: "General",
    badgeBg: "#F3F4F6",
    badgeColor: "#374151",
    iconBg: "#F8FAFC",
    iconColor: "#334155",
    borderColor: item.isRead ? "#E5E7EB" : "#CBD5E1",
    unreadDot: "#475569",
    Icon: Bell,
  };
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#F5F7FB",
    padding: "32px 28px",
  },
  container: {
    maxWidth: "1180px",
    margin: "0 auto",
  },
  hero: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: "28px",
    padding: "28px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
    marginBottom: "22px",
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  heroLeft: {
    display: "flex",
    gap: "18px",
    alignItems: "flex-start",
    flex: "1 1 520px",
  },
  heroIcon: {
    width: "58px",
    height: "58px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #0F172A, #1E293B)",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 20px rgba(15,23,42,0.15)",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: "46px",
    lineHeight: 1.05,
    fontWeight: 800,
    color: "#0F172A",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: "12px 0 0 0",
    color: "#475569",
    fontSize: "17px",
    lineHeight: 1.7,
  },
  tabsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "20px",
  },
  tabActive: {
    border: "none",
    background: "#0F172A",
    color: "#FFFFFF",
    borderRadius: "14px",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(15,23,42,0.18)",
  },
  tab: {
    border: "1px solid #E2E8F0",
    background: "#FFFFFF",
    color: "#334155",
    borderRadius: "14px",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  heroRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  unreadPill: {
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: "16px",
    padding: "13px 16px",
    fontSize: "14px",
    fontWeight: 700,
    color: "#334155",
    minWidth: "110px",
    textAlign: "center",
  },
  primaryButton: {
    border: "none",
    background: "linear-gradient(135deg, #0F172A, #1E293B)",
    color: "#FFFFFF",
    borderRadius: "16px",
    padding: "13px 18px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    boxShadow: "0 12px 24px rgba(15,23,42,0.16)",
  },
  emptyState: {
    background: "#FFFFFF",
    border: "1px dashed #CBD5E1",
    borderRadius: "28px",
    padding: "70px 24px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  },
  emptyIcon: {
    width: "64px",
    height: "64px",
    borderRadius: "20px",
    background: "#F8FAFC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748B",
    margin: "0 auto",
  },
  emptyTitle: {
    margin: "18px 0 8px 0",
    fontSize: "24px",
    fontWeight: 800,
    color: "#0F172A",
  },
  emptyText: {
    margin: 0,
    color: "#64748B",
    fontSize: "15px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  card: (borderColor, isRead) => ({
    background: "#FFFFFF",
    border: `1px solid ${borderColor}`,
    borderRadius: "26px",
    padding: "22px 22px",
    boxShadow: isRead
      ? "0 8px 24px rgba(15, 23, 42, 0.05)"
      : "0 14px 36px rgba(37, 99, 235, 0.08)",
    transition: "all 0.2s ease",
  }),
  cardRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  cardLeft: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    flex: "1 1 620px",
    minWidth: 0,
  },
  iconBox: (bg, color) => ({
    width: "56px",
    height: "56px",
    borderRadius: "18px",
    background: bg,
    color,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flexShrink: 0,
  }),
  unreadDot: (color) => ({
    position: "absolute",
    top: "-4px",
    right: "-4px",
    width: "14px",
    height: "14px",
    borderRadius: "999px",
    background: color,
    border: "3px solid #FFFFFF",
  }),
  content: {
    minWidth: 0,
    flex: 1,
  },
  topLine: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  cardTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
    color: "#0F172A",
    letterSpacing: "-0.015em",
  },
  badge: (bg, color) => ({
    background: bg,
    color,
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.02em",
  }),
  unreadBadge: {
    background: "#DBEAFE",
    color: "#1D4ED8",
    borderRadius: "999px",
    padding: "7px 12px",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.02em",
  },
  cardText: {
    margin: "10px 0 0 0",
    fontSize: "17px",
    lineHeight: 1.8,
    color: "#475569",
  },
  timeRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "14px",
    color: "#64748B",
    fontSize: "14px",
    fontWeight: 600,
  },
  actionWrap: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  readButton: {
    border: "1px solid #E2E8F0",
    background: "#FFFFFF",
    color: "#334155",
    borderRadius: "16px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  readLabel: {
    background: "#ECFDF3",
    color: "#047857",
    borderRadius: "16px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  authBox: {
    background: "#FFFFFF",
    border: "1px solid #FECACA",
    borderRadius: "28px",
    padding: "50px 20px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  },
};

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState("all");
  const [authError, setAuthError] = useState("");

  async function loadNotifications() {
    try {
      setLoading(true);
      setAuthError("");

      const res = await api.get("/notifications", buildAuthConfig());
      const rawItems = res?.data?.items || res?.data?.notifications || [];
      const normalizedItems = Array.isArray(rawItems)
        ? rawItems.map(normalizeNotification)
        : [];

      setItems(normalizedItems);
      setUnreadCount(
        Number(
          res?.data?.unreadCount ??
            normalizedItems.filter((item) => !item.isRead).length ??
            0
        )
      );
    } catch (error) {
      console.error("Failed to load notifications:", error);
      if (error?.response?.status === 401) {
        setAuthError("Your session has expired. Please log in again.");
      }
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleMarkRead(id) {
    try {
      setBusyId(id);

      const res = await api.post(
        `/notifications/${id}/read`,
        {},
        buildAuthConfig()
      );

      const updatedItem = res?.data?.item
        ? normalizeNotification(res.data.item)
        : null;

      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...(updatedItem || {}), isRead: true }
            : item
        )
      );

      setUnreadCount(
        Number(res?.data?.unreadCount ?? Math.max(0, unreadCount - 1))
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAllRead() {
    try {
      setMarkingAll(true);

      const res = await api.post(
        "/notifications/read-all",
        {},
        buildAuthConfig()
      );

      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(Number(res?.data?.unreadCount ?? 0));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    } finally {
      setMarkingAll(false);
    }
  }

  const filteredItems = useMemo(() => {
    if (filter === "unread") return items.filter((item) => !item.isRead);
    if (filter === "requests") {
      return items.filter((item) => item.type === "leave_request");
    }
    if (filter === "reviews") {
      return items.filter((item) => item.type === "leave_review");
    }
    return items;
  }, [items, filter]);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.hero}>
          <div style={styles.heroTop}>
            <div style={styles.heroLeft}>
              <div style={styles.heroIcon}>
                <Bell size={28} />
              </div>

              <div style={{ flex: 1 }}>
                <h1 style={styles.title}>Notifications</h1>
                <p style={styles.subtitle}>
                  Track new requests, approvals, and important updates in one place.
                </p>

                <div style={styles.tabsWrap}>
                  {[
                    ["all", "All"],
                    ["unread", "Unread"],
                    ["requests", "Requests"],
                    ["reviews", "Reviews"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      style={filter === value ? styles.tabActive : styles.tab}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.heroRight}>
              <div style={styles.unreadPill}>
                Unread: <span style={{ color: "#0F172A" }}>{unreadCount}</span>
              </div>

              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll || unreadCount === 0}
                style={{
                  ...styles.primaryButton,
                  opacity: markingAll || unreadCount === 0 ? 0.6 : 1,
                  cursor:
                    markingAll || unreadCount === 0 ? "not-allowed" : "pointer",
                }}
              >
                <CheckCheck size={16} />
                {markingAll ? "Please wait..." : "Mark all as read"}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={styles.list}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                style={{
                  height: "130px",
                  borderRadius: "26px",
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                }}
              />
            ))}
          </div>
        ) : authError ? (
          <div style={styles.authBox}>
            <div style={styles.emptyIcon}>
              <Bell size={28} />
            </div>
            <h2 style={styles.emptyTitle}>Authentication error</h2>
            <p style={styles.emptyText}>{authError}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <Bell size={28} />
            </div>
            <h2 style={styles.emptyTitle}>No notifications found</h2>
            <p style={styles.emptyText}>
              New activity and request updates will appear here.
            </p>
          </div>
        ) : (
          <div style={styles.list}>
            {filteredItems.map((item) => {
              const meta = getNotificationMeta(item);
              const Icon = meta.Icon;

              return (
                <div
                  key={item.id}
                  style={styles.card(meta.borderColor, item.isRead)}
                >
                  <div style={styles.cardRow}>
                    <div style={styles.cardLeft}>
                      <div style={styles.iconBox(meta.iconBg, meta.iconColor)}>
                        <Icon size={24} />
                        {!item.isRead && (
                          <span style={styles.unreadDot(meta.unreadDot)} />
                        )}
                      </div>

                      <div style={styles.content}>
                        <div style={styles.topLine}>
                          <h3 style={styles.cardTitle}>{meta.title}</h3>
                          <span style={styles.badge(meta.badgeBg, meta.badgeColor)}>
                            {meta.badge}
                          </span>
                          {!item.isRead && (
                            <span style={styles.unreadBadge}>Unread</span>
                          )}
                        </div>

                        <p style={styles.cardText}>
                          {meta.subtitle || item.message}
                        </p>

                        <div style={styles.timeRow}>
                          <Clock3 size={16} />
                          <span>{formatDateTime(item.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div style={styles.actionWrap}>
                      {!item.isRead ? (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(item.id)}
                          disabled={busyId === item.id}
                          style={{
                            ...styles.readButton,
                            opacity: busyId === item.id ? 0.7 : 1,
                            cursor: busyId === item.id ? "not-allowed" : "pointer",
                          }}
                        >
                          <Check size={16} />
                          {busyId === item.id ? "Updating..." : "Mark read"}
                        </button>
                      ) : (
                        <div style={styles.readLabel}>
                          <Check size={16} />
                          Read
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
