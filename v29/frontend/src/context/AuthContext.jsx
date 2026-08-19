import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const LAST_ACTIVITY_KEY = "hr_portal_last_activity";

function clearAuthStorage() {
  [localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem("token");
    storage.removeItem("authToken");
    storage.removeItem("accessToken");
    storage.removeItem("hr_portal_user");
    storage.removeItem("hr_portal_auth");
  });
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ دالة قراءة المستخدم من التخزين
  function loadUserFromStorage() {
    try {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("authToken");

      if (!token) return null;

      const storedUser = localStorage.getItem("hr_portal_user");

      if (storedUser) {
        return JSON.parse(storedUser);
      }

      return { role: "Employee" };
    } catch (e) {
      console.error("AUTH LOAD ERROR:", e);
      return null;
    }
  }

  // ✅ أول تحميل
  useEffect(() => {
    const u = loadUserFromStorage();
    setUser(u);
    setLoading(false);
  }, []);

  // تسجيل خروج تلقائي بعد 15 دقيقة كاملة بدون أي نشاط.
  useEffect(() => {
    if (!user) return undefined;

    let inactivityTimer;
    let lastActivity = Date.now();
    let lastSharedUpdate = 0;
    let lastTimerReset = 0;

    const forceLogout = () => {
      const sharedActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
      const latestActivity = Math.max(lastActivity, sharedActivity);
      if (Date.now() - latestActivity < INACTIVITY_LIMIT_MS) {
        scheduleLogout();
        return;
      }
      clearAuthStorage();
      setUser(null);
      window.location.replace("/login");
    };

    const scheduleLogout = () => {
      window.clearTimeout(inactivityTimer);
      const sharedActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0;
      const latestActivity = Math.max(lastActivity, sharedActivity);
      const remaining = INACTIVITY_LIMIT_MS - (Date.now() - latestActivity);

      if (remaining <= 0) {
        forceLogout();
        return;
      }

      inactivityTimer = window.setTimeout(forceLogout, remaining);
    };

    const recordActivity = () => {
      const now = Date.now();
      lastActivity = now;

      // مشاركة النشاط مع التبويبات الأخرى بدون الكتابة مع كل حركة ماوس.
      if (now - lastSharedUpdate >= 15000) {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
        lastSharedUpdate = now;
      }

      if (now - lastTimerReset >= 1000) {
        lastTimerReset = now;
        scheduleLogout();
      }
    };

    const handleStorage = (event) => {
      if (event.key === LAST_ACTIVITY_KEY && event.newValue) {
        lastActivity = Math.max(lastActivity, Number(event.newValue) || 0);
        scheduleLogout();
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) scheduleLogout();
    };

    const activityEvents = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((eventName) =>
      window.addEventListener(eventName, recordActivity, { passive: true })
    );
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    recordActivity();

    return () => {
      window.clearTimeout(inactivityTimer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user]);

  // ✅ مهم: مزامنة بين التابات + تحديث مباشر
  useEffect(() => {
    function syncAuth() {
      const u = loadUserFromStorage();
      setUser(u);
    }

    window.addEventListener("storage", syncAuth);

    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,

      // ✅ هذا أهم شيء
      setUser: (userData) => {
        if (userData) {
          localStorage.setItem("hr_portal_user", JSON.stringify(userData));
        }
        setUser(userData);
      },

      logout() {
        clearAuthStorage();

        setUser(null);

        window.location.href = "/login";
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
