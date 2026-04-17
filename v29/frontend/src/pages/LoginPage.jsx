import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [screenWidth, setScreenWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = screenWidth <= 768;
  const isTablet = screenWidth > 768 && screenWidth <= 1024;

  const isFormValid = useMemo(() => {
    return username.trim().length > 0 && password.trim().length > 0;
  }, [username, password]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isFormValid) {
      setError("الرجاء إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await loginUser({
        username: username.trim(),
        password,
      });

      if (!data?.token) {
        throw new Error("لم يرجع السيرفر token");
      }

      const storage = rememberMe ? localStorage : sessionStorage;

      storage.setItem(
        "hr_portal_auth",
        JSON.stringify({
          token: data.token,
          user: data.user || null,
        })
      );

      storage.setItem("token", data.token);

      if (data?.user) {
        storage.setItem("hr_portal_user", JSON.stringify(data.user));
        setUser(data.user);
      } else {
        setUser({ username: username.trim() });
      }

      navigate("/", { replace: true });
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError(err?.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  const styles = getStyles({ isMobile, isTablet });

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlowOne} />
      <div style={styles.backgroundGlowTwo} />

      <div style={styles.layout}>
        {!isMobile && (
          <div style={styles.brandPanel}>
            <div style={styles.brandBadge}>GAS Arabian Services</div>

            <h1 style={styles.brandTitle}>HR Portal</h1>

            <p style={styles.brandText}>
              منصة موارد بشرية موحدة لإدارة الحضور، الإجازات، الطلبات، والعمليات
              اليومية بشكل احترافي وآمن.
            </p>

            <div style={styles.featureList}>
              <div style={styles.featureItem}>
                <span style={styles.featureIcon}>✓</span>
                <span>Secure unified access</span>
              </div>
              <div style={styles.featureItem}>
                <span style={styles.featureIcon}>✓</span>
                <span>Attendance and leave workflows</span>
              </div>
              <div style={styles.featureItem}>
                <span style={styles.featureIcon}>✓</span>
                <span>Role-based HR operations</span>
              </div>
            </div>
          </div>
        )}

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.title}>Sign in</h2>
              <p style={styles.subtitle}>سجّل الدخول إلى بوابة الموارد البشرية</p>
            </div>

            {!isMobile && <div style={styles.miniBadge}>Secure Access</div>}
          </div>

          {isMobile && (
            <div style={styles.mobileTopBlock}>
              <div style={styles.brandBadge}>GAS Arabian Services</div>
              <h3 style={styles.mobileBrandTitle}>HR Portal</h3>
              <p style={styles.mobileBrandText}>
                تسجيل دخول سريع وآمن للوصول إلى خدمات الموارد البشرية.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Username</label>
              <input
                style={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Password</label>

              <div style={styles.passwordWrap}>
                <input
                  style={styles.passwordInput}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={styles.togglePassword}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div style={styles.row}>
              <label style={styles.rememberWrap}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              {!isMobile && (
                <span style={styles.helperText}>Access according to your role</span>
              )}
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}

            <button
              type="submit"
              style={{
                ...styles.button,
                ...(loading || !isFormValid ? styles.disabledButton : {}),
              }}
              disabled={loading || !isFormValid}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function getStyles({ isMobile, isTablet }) {
  return {
    page: {
      minHeight: "100vh",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background:
        "linear-gradient(135deg, #0b1220 0%, #0f172a 35%, #111827 100%)",
      padding: isMobile ? 14 : 24,
    },

    backgroundGlowOne: {
      position: "absolute",
      width: isMobile ? 220 : 420,
      height: isMobile ? 220 : 420,
      borderRadius: "50%",
      background: "rgba(37, 99, 235, 0.20)",
      filter: `blur(${isMobile ? 60 : 90}px)`,
      top: isMobile ? -40 : -40,
      left: isMobile ? -60 : -80,
    },

    backgroundGlowTwo: {
      position: "absolute",
      width: isMobile ? 220 : 420,
      height: isMobile ? 220 : 420,
      borderRadius: "50%",
      background: "rgba(14, 165, 233, 0.14)",
      filter: `blur(${isMobile ? 65 : 100}px)`,
      bottom: isMobile ? -40 : -60,
      right: isMobile ? -40 : -60,
    },

    layout: {
      position: "relative",
      zIndex: 1,
      width: "100%",
      maxWidth: isMobile ? 420 : isTablet ? 920 : 1180,
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1.05fr 0.95fr",
      gap: isMobile ? 0 : 24,
      alignItems: "stretch",
    },

    brandPanel: {
      color: "#fff",
      padding: isTablet ? "32px 24px" : "40px 28px",
      borderRadius: 28,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.06)",
      backdropFilter: "blur(14px)",
      boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    },

    brandBadge: {
      display: "inline-flex",
      width: "fit-content",
      alignItems: "center",
      justifyContent: "center",
      minHeight: isMobile ? 30 : 34,
      padding: isMobile ? "0 12px" : "0 14px",
      borderRadius: 999,
      background: isMobile ? "#eff6ff" : "rgba(255,255,255,0.10)",
      color: isMobile ? "#1d4ed8" : "#dbeafe",
      fontSize: isMobile ? 12 : 13,
      fontWeight: 700,
      marginBottom: isMobile ? 12 : 18,
    },

    brandTitle: {
      margin: 0,
      fontSize: isTablet ? 44 : 56,
      lineHeight: 1,
      fontWeight: 900,
      letterSpacing: "-0.04em",
    },

    brandText: {
      marginTop: 18,
      marginBottom: 26,
      color: "rgba(255,255,255,0.82)",
      fontSize: isTablet ? 16 : 18,
      lineHeight: 1.8,
      maxWidth: 560,
    },

    featureList: {
      display: "grid",
      gap: 12,
    },

    featureItem: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      color: "#e5e7eb",
      fontSize: isTablet ? 15 : 16,
      fontWeight: 600,
    },

    featureIcon: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 24,
      height: 24,
      borderRadius: "50%",
      background: "rgba(34,197,94,0.18)",
      color: "#86efac",
      fontSize: 14,
      fontWeight: 900,
    },

    card: {
      width: "100%",
      background: "rgba(255,255,255,0.98)",
      borderRadius: isMobile ? 24 : 28,
      padding: isMobile ? 20 : isTablet ? 26 : 34,
      boxShadow: "0 24px 60px rgba(15, 23, 42, 0.24)",
      border: "1px solid rgba(234,236,240,0.95)",
      alignSelf: "center",
    },

    cardHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 14,
      marginBottom: isMobile ? 18 : 28,
    },

    miniBadge: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 34,
      padding: "0 12px",
      borderRadius: 999,
      background: "#eff6ff",
      color: "#1d4ed8",
      fontSize: 13,
      fontWeight: 800,
      whiteSpace: "nowrap",
    },

    mobileTopBlock: {
      marginBottom: 14,
    },

    mobileBrandTitle: {
      margin: "0 0 8px 0",
      fontSize: 26,
      fontWeight: 900,
      color: "#101828",
      letterSpacing: "-0.03em",
    },

    mobileBrandText: {
      margin: 0,
      color: "#667085",
      fontSize: 14,
      lineHeight: 1.7,
    },

    title: {
      margin: 0,
      fontSize: isMobile ? 30 : isTablet ? 34 : 38,
      fontWeight: 900,
      color: "#101828",
      letterSpacing: "-0.03em",
    },

    subtitle: {
      marginTop: 10,
      marginBottom: 0,
      fontSize: isMobile ? 14 : 16,
      color: "#667085",
      lineHeight: 1.7,
    },

    form: {
      display: "grid",
      gap: isMobile ? 16 : 18,
    },

    fieldGroup: {
      display: "grid",
      gap: 8,
    },

    label: {
      fontSize: isMobile ? 14 : 15,
      color: "#344054",
      fontWeight: 700,
    },

    input: {
      width: "100%",
      padding: isMobile ? "14px 14px" : "16px 18px",
      borderRadius: 16,
      border: "1px solid #d0d5dd",
      fontSize: isMobile ? 16 : 17,
      outline: "none",
      boxSizing: "border-box",
      background: "#fff",
      color: "#101828",
    },

    passwordWrap: {
      position: "relative",
    },

    passwordInput: {
      width: "100%",
      padding: isMobile ? "14px 78px 14px 14px" : "16px 86px 16px 18px",
      borderRadius: 16,
      border: "1px solid #d0d5dd",
      fontSize: isMobile ? 16 : 17,
      outline: "none",
      boxSizing: "border-box",
      background: "#fff",
      color: "#101828",
    },

    togglePassword: {
      position: "absolute",
      top: "50%",
      right: 10,
      transform: "translateY(-50%)",
      minHeight: isMobile ? 34 : 36,
      padding: "0 12px",
      borderRadius: 12,
      border: "none",
      background: "#f2f4f7",
      color: "#344054",
      fontWeight: 700,
      cursor: "pointer",
      fontSize: isMobile ? 12 : 13,
    },

    row: {
      display: "flex",
      alignItems: isMobile ? "flex-start" : "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      flexDirection: isMobile ? "column" : "row",
    },

    rememberWrap: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      color: "#344054",
      fontSize: 14,
      fontWeight: 600,
    },

    helperText: {
      color: "#667085",
      fontSize: 13,
      fontWeight: 600,
    },

    button: {
      marginTop: 4,
      width: "100%",
      padding: isMobile ? "14px 16px" : "16px 18px",
      borderRadius: 16,
      border: "none",
      background: "linear-gradient(135deg, #155eef, #1849a9)",
      color: "#fff",
      fontSize: isMobile ? 18 : 20,
      fontWeight: 800,
      cursor: "pointer",
      boxShadow: "0 14px 30px rgba(21, 94, 239, 0.24)",
    },

    disabledButton: {
      opacity: 0.65,
      cursor: "not-allowed",
      boxShadow: "none",
    },

    error: {
      background: "#fef3f2",
      color: "#b42318",
      border: "1px solid #fecdca",
      padding: "12px 14px",
      borderRadius: 14,
      fontSize: 14,
      fontWeight: 700,
    },
  };
}