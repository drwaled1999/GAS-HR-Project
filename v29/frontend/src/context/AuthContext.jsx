import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

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
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("hr_portal_user");
        localStorage.removeItem("hr_portal_auth");

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