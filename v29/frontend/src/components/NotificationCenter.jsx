import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { apiFetch } from "../services/api";
import {
  initializePushNotifications,
  playNotificationSound,
  requestBrowserNotificationPermission,
} from "../services/notificationService";

export default function NotificationCenter({ user }) {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const preferences = useRef({ notificationSound: true, browserNotifications: true, notificationDurationSeconds: 7 });
  const newestId = useRef(null);
  const primed = useRef(false);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    let cleanupNative = () => {};

    const show = (item) => {
      if (!active) return;
      setToast(item);
      window.clearTimeout(show.timer);
      show.timer = window.setTimeout(() => setToast(null),
        Math.max(3, Number(preferences.current.notificationDurationSeconds || 7)) * 1000);
    };

    initializePushNotifications(show).then((cleanup) => { cleanupNative = cleanup; });

    const unlock = () => {
      requestBrowserNotificationPermission();
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });

    async function poll() {
      try {
        const response = await apiFetch("/notifications");
        preferences.current = { ...preferences.current, ...(response?.preferences || {}) };
        const latest = response?.items?.[0];
        if (!latest) return;
        const id = String(latest.id);
        if (!primed.current) {
          newestId.current = id;
          primed.current = true;
          return;
        }
        if (id === newestId.current) return;
        newestId.current = id;
        if (preferences.current.notificationSound) playNotificationSound();
        const item = {
          title: "GAS HR",
          message: latest.message,
          link: latest.link || "/notifications",
        };
        show(item);
        if (preferences.current.browserNotifications && document.hidden && "Notification" in window && Notification.permission === "granted") {
          const browserNotice = new Notification(item.title, { body: item.message, icon: "/logo.svg" });
          browserNotice.onclick = () => { window.focus(); navigate(item.link); browserNotice.close(); };
        }
      } catch {
        // A temporary network error should not interrupt the application.
      }
    }

    poll();
    const timer = window.setInterval(poll, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearTimeout(show.timer);
      window.removeEventListener("pointerdown", unlock);
      cleanupNative();
    };
  }, [navigate, user?.id]);

  if (!toast) return null;
  return (
    <div className="global-notification-toast" role="alert" onClick={() => navigate(toast.link || "/notifications")}>
      <span className="global-notification-icon"><Bell size={20} /></span>
      <span className="global-notification-copy"><strong>{toast.title}</strong><span>{toast.message}</span></span>
      <button type="button" aria-label="Close" onClick={(event) => { event.stopPropagation(); setToast(null); }}><X size={18} /></button>
      <i className="global-notification-progress" style={{ animationDuration: `${Math.max(3, Number(preferences.current.notificationDurationSeconds || 7))}s` }} />
    </div>
  );
}
