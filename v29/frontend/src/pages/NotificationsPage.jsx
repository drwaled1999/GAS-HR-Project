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
      title: "New leave request",
      subtitle: data?.employeeName
        ? `${data.employeeName} submitted a new request`
        : message,
      badge: "New Request",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      iconWrapClass: "bg-blue-50 text-blue-700",
      Icon: FileText,
    };
  }

  if (type === "leave_review") {
    if (decision === "approved" || message.toLowerCase().includes("approved")) {
      return {
        title: "Request approved",
        subtitle: message,
        badge: "Approved",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        iconWrapClass: "bg-emerald-50 text-emerald-700",
        Icon: CircleCheckBig,
      };
    }

    if (decision === "rejected" || message.toLowerCase().includes("rejected")) {
      return {
        title: "Request rejected",
        subtitle: message,
        badge: "Rejected",
        badgeClass: "bg-red-50 text-red-700 border-red-200",
        iconWrapClass: "bg-red-50 text-red-700",
        Icon: CircleX,
      };
    }

    return {
      title: "Request update",
      subtitle: message,
      badge: "Review",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      iconWrapClass: "bg-amber-50 text-amber-700",
      Icon: Clock3,
    };
  }

  return {
    title: "Notification",
    subtitle: message,
    badge: "General",
    badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
    iconWrapClass: "bg-slate-50 text-slate-700",
    Icon: Bell,
  };
}

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
            ? {
                ...item,
                ...(updatedItem || {}),
                isRead: true,
              }
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
    if (filter === "requests") return items.filter((item) => item.type === "leave_request");
    if (filter === "reviews") return items.filter((item) => item.type === "leave_review");
    return items;
  }, [items, filter]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <Bell className="h-7 w-7" />
              </div>

              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                  Notifications
                </h1>
                <p className="mt-2 text-base text-slate-600">
                  Track new requests, approvals, and important updates in one place.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
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
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        filter === value
                          ? "bg-slate-900 text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                Unread: <span className="text-slate-900">{unreadCount}</span>
              </div>

              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll || unreadCount === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" />
                {markingAll ? "Please wait..." : "Mark all as read"}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : authError ? (
          <div className="rounded-3xl border border-red-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Bell className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-900">
              Authentication error
            </h2>
            <p className="mt-2 text-slate-500">{authError}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-14 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Bell className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-900">
              No notifications found
            </h2>
            <p className="mt-2 text-slate-500">
              New activity and request updates will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => {
              const meta = getNotificationMeta(item);
              const Icon = meta.Icon;

              return (
                <div
                  key={item.id}
                  className={`rounded-3xl border bg-white px-5 py-5 shadow-sm transition hover:shadow-md ${
                    item.isRead
                      ? "border-slate-200"
                      : "border-blue-200 ring-1 ring-blue-100"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div
                        className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${meta.iconWrapClass}`}
                      >
                        <Icon className="h-6 w-6" />
                        {!item.isRead && (
                          <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-blue-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold text-slate-900">
                            {meta.title}
                          </h3>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}
                          >
                            {meta.badge}
                          </span>

                          {!item.isRead && (
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              Unread
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-base leading-7 text-slate-600">
                          {meta.subtitle || item.message}
                        </p>

                        <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                          <Clock3 className="h-4 w-4" />
                          <span>{formatDateTime(item.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center lg:pl-6">
                      {!item.isRead ? (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(item.id)}
                          disabled={busyId === item.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                          {busyId === item.id ? "Updating..." : "Mark read"}
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                          <Check className="h-4 w-4" />
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
