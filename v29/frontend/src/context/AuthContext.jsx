import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function bootstrap() {
      try {
        const token =
          localStorage.getItem("token") ||
          localStorage.getItem("authToken") ||
          "";

        if (!token) {
          setUser(null);
          setLoading(false);
          return;
        }

        // 🔥 الحل هنا: نقرأ user من localStorage بدل السيرفر
        const storedUser = localStorage.getItem("hr_portal_user");

        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          // fallback لو ما فيه user
          setUser({ role: "Employee" });
        }
      } catch (error) {
        console.error("AUTH ERROR:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      setUser,
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
