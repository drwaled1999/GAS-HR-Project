import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSession } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
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

        const session = await getSession();
        setUser(session?.user || null);
      } catch (error) {
        console.error("SESSION ERROR:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("username");
        localStorage.removeItem("fullName");
        localStorage.removeItem("role");
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
        localStorage.removeItem("username");
        localStorage.removeItem("fullName");
        localStorage.removeItem("role");
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
