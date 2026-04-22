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
      <div style={styles.heroBackground} />
      <div style={styles.darkOverlay} />
      <div style={styles.diagonalBlue} />

      <header style={styles.topbar}>
        <div style={styles.topbarInner}>
          <div style={styles.navLinks}>
            <button type="button" style={styles.navLink}>الصفحة الرئيسية</button>
            <button type="button" style={styles.navLink}>من نحن</button>
            <button type="button" style={styles.navLink}>مجالات أعمالنا</button>
            <button type="button" style={styles.navLink}>الأخبار والأحداث</button>
            {!isMobile && (
              <>
                <button type="button" style={styles.navLink}>علاقات المستثمرين</button>
                <button type="button" style={styles.navLink}>تواصل معنا</button>
              </>
            )}
          </div>

          <div style={styles.logoWrap}>
            <img
              src="/logo-white.png"
              alt="GAS Arabian Services"
              style={styles.logo}
            />
          </div>
        </div>
      </header>

      <div style={styles.contentWrap}>
        <div style={styles.heroTextBlock}>
          <div style={styles.heroBadge}>GAS Arabian Services</div>
          <h1 style={styles.heroTitle}>بوابة الموارد البشرية</h1>
          <p style={styles.heroSubtitle}>
            منصة موحدة وآمنة لإدارة الحضور، الإجازات، الطلبات، والعمليات اليومية
            لموظفي الشركة بشكل احترافي.
          </p>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.title}>Sign in</h2>
              <p style={styles.subtitle}>سجّل الدخول إلى بوابة الموارد البشرية</p>
            </div>

            {!isMobile && <div style={styles.miniBadge}>Secure Access</div>}
          </div>

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
      background: "#0f172a",
      fontFamily: "Segoe UI, Tahoma, Arial, sans-serif",
    },

    heroBackground: {
      position: "absolute",
      inset: 0,
      backgroundImage: "url('/gas-bg.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      transform: "scale(1.02)",
    },

    darkOverlay: {
      position: "absolute",
      inset: 0,
      background: "rgba(14, 23, 42, 0.68)",
    },

    diagonalBlue: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: isMobile ? "40%" : "34%",
      width: isMobile ? "36%" : "28%",
      background:
        "linear-gradient(180deg, rgba(14,165,233,0.18) 0%, rgba(14,165,233,0.42) 50%, rgba(14,165,233,0.16) 100%)",
      transform: "skewX(-34deg)",
      boxShadow: "0 0 80px rgba(14,165,233,0.22)",
    },

    topbar: {
      position: "relative",
      zIndex: 2,
      padding: isMobile ? "18px 16px 0" : "24px 40px 0",
    },

    topbarInner: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 20,
      flexDirection: isMobile ? "column-reverse" : "row",
    },

    navLinks: {
      display: "flex",
      alignItems: "center",
      justifyContent: isMobile ? "center" : "flex-start",
      gap: isMobile ? 10 : 22,
      flexWrap: "wrap",
      width: "100%",
    },

    navLink: {
      background: "transparent",
      border: "none",
      color: "#ffffff",
      fontSize: isMobile ? 13 : 15,
      fontWeight: 700,
      cursor: "pointer",
      opacity: 0.96,
      padding: 0,
    },

    logoWrap: {
      display: "flex",
      alignItems: "center",
      justifyContent: isMobile ? "center" : "flex-end",
      width: isMobile ? "100%" : "auto",
    },

    logo: {
      width: isMobile ? 120 : 165,
      height: "auto",
      objectFit: "contain",
      filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.25))",
    },

    contentWrap: {
      position: "relative",
      zIndex: 2,
      minHeight: isMobile ? "auto" : "calc(100vh - 110px)",
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1.15fr 0.85fr",
      alignItems: "center",
      gap: isMobile ? 20 : 28,
      padding: isMobile ? "20px 16px 28px" : "30px 40px 40px",
    },

    heroTextBlock: {
      color: "#fff",
      maxWidth: 650,
      alignSelf: "end",
      paddingTop: isMobile ? 16 : 80,
      order: isMobile ? 2 : 1,
    },

    heroBadge: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: 36,
      padding: "0 14px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.10)",
      color: "#dbeafe",
      fontSize: 13,
      fontWeight: 800,
      marginBottom: 16,
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,0.12)",
    },

    heroTitle: {
      margin: 0,
      fontSize: isMobile ? 34 : isTablet ? 46 : 58,
      lineHeight: 1.05,
      fontWeight: 900,
      letterSpacing: "-0.04em",
      textShadow: "0 6px 16px rgba(0,0,0,0.20)",
    },

    heroSubtitle: {
      marginTop: 20,
      marginBottom: 0,
      fontSize: isMobile ? 15 : 20,
      lineHeight: 1.9,
      color: "rgba(255,255,255,0.92)",
      maxWidth: 620,
      textShadow: "0 3px 10px rgba(0,0,0,0.18)",
    },

    card: {
      width: "100%",
      maxWidth: isMobile ? "100%" : 460,
      justifySelf: isMobile ? "stretch" : "end",
      background: "rgba(255,255,255,0.97)",
      borderRadius: isMobile ? 24 : 28,
      padding: isMobile ? 20 : isTablet ? 26 : 30,
      boxShadow: "0 24px 60px rgba(15, 23, 42, 0.30)",
      border: "1px solid rgba(234,236,240,0.95)",
      backdropFilter: "blur(12px)",
      order: isMobile ? 1 : 2,
    },

    cardHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 14,
      marginBottom: isMobile ? 18 : 26,
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

    title: {
      margin: 0,
      fontSize: isMobile ? 30 : 36,
      fontWeight: 900,
      color: "#101828",
      letterSpacing: "-0.03em",
    },

    subtitle: {
      marginTop: 10,
      marginBottom: 0,
      fontSize: isMobile ? 14 : 15,
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
      background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
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
