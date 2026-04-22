import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [showLoader, setShowLoader] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [screenWidth, setScreenWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 1600);

    return () => clearTimeout(timer);
  }, []);

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

  if (showLoader) {
    return (
      <div style={styles.loaderPage}>
        <div style={styles.loaderGlowOne} />
        <div style={styles.loaderGlowTwo} />

        <div style={styles.loaderCard}>
          <img
            src="/logo.svg"
            alt="GAS Arabian Services"
            style={styles.loaderLogo}
          />

          <div style={styles.spinnerWrap}>
            <div style={styles.spinnerRing}></div>
            <div style={styles.spinnerCore}></div>
          </div>

          <h2 style={styles.loaderTitle}>Loading portal...</h2>
          <p style={styles.loaderSubtitle}>
            Preparing secure access to HR services
          </p>

          <div style={styles.progressTrack}>
            <div style={styles.progressBar}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.heroBackground} />
      <div style={styles.darkOverlay} />
      <div style={styles.diagonalBlue} />
      <div style={styles.diagonalBlueSoft} />
      <div style={styles.edgeGlow} />

      <div style={styles.logoWrap}>
        <img
          src="/logo.svg"
          alt="GAS Arabian Services"
          style={styles.logo}
        />
      </div>

      <div style={styles.contentWrap}>
        <div style={styles.leftSection}>
          <div style={styles.heroTextBlock}>
            <div style={styles.heroKicker}>HR PORTAL</div>

            <h1 style={styles.heroTitle}>بوابة الموارد البشرية</h1>

            <p style={styles.heroSubtitle}>
              منصة موحدة وآمنة لإدارة الحضور، الإجازات، الطلبات، والعمليات اليومية
              لموظفي الشركة بشكل احترافي.
            </p>

            {!isMobile && (
              <div style={styles.heroMeta}>
                <div style={styles.heroMetaItem}>دخول آمن</div>
                <div style={styles.heroMetaDot} />
                <div style={styles.heroMetaItem}>إدارة الحضور والإجازات</div>
                <div style={styles.heroMetaDot} />
                <div style={styles.heroMetaItem}>خدمات الموارد البشرية</div>
              </div>
            )}
          </div>
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
    loaderPage: {
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      background:
        "linear-gradient(135deg, #051128 0%, #081a3a 45%, #041020 100%)",
      fontFamily: "Segoe UI, Tahoma, Arial, sans-serif",
    },

    loaderGlowOne: {
      position: "absolute",
      width: isMobile ? 240 : 340,
      height: isMobile ? 240 : 340,
      borderRadius: "50%",
      background: "rgba(14,165,233,0.16)",
      filter: "blur(80px)",
      top: -80,
      left: -80,
    },

    loaderGlowTwo: {
      position: "absolute",
      width: isMobile ? 220 : 300,
      height: isMobile ? 220 : 300,
      borderRadius: "50%",
      background: "rgba(59,130,246,0.14)",
      filter: "blur(70px)",
      bottom: -80,
      right: -80,
    },

    loaderCard: {
      position: "relative",
      zIndex: 2,
      width: "min(92%, 420px)",
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 28,
      padding: isMobile ? "26px 20px" : "30px 24px",
      backdropFilter: "blur(14px)",
      boxShadow: "0 20px 50px rgba(0,0,0,0.24)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
    },

    loaderLogo: {
      width: isMobile ? 88 : 100,
      height: "auto",
      objectFit: "contain",
      marginBottom: 18,
      filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.25))",
    },

    spinnerWrap: {
      position: "relative",
      width: 82,
      height: 82,
      marginBottom: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },

    spinnerRing: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      border: "4px solid rgba(255,255,255,0.16)",
      borderTop: "4px solid #38bdf8",
      animation: "spin 0.9s linear infinite",
    },

    spinnerCore: {
      width: 46,
      height: 46,
      borderRadius: "50%",
      background:
        "radial-gradient(circle, rgba(56,189,248,0.25) 0%, rgba(56,189,248,0.05) 60%, rgba(56,189,248,0) 100%)",
      boxShadow: "0 0 22px rgba(56,189,248,0.28)",
    },

    loaderTitle: {
      margin: "0 0 8px 0",
      color: "#ffffff",
      fontSize: isMobile ? 22 : 24,
      fontWeight: 900,
      letterSpacing: "-0.03em",
    },

    loaderSubtitle: {
      margin: 0,
      color: "rgba(255,255,255,0.78)",
      fontSize: 14,
      lineHeight: 1.7,
      maxWidth: 280,
    },

    progressTrack: {
      width: "100%",
      height: 8,
      marginTop: 20,
      borderRadius: 999,
      background: "rgba(255,255,255,0.10)",
      overflow: "hidden",
    },

    progressBar: {
      width: "42%",
      height: "100%",
      borderRadius: 999,
      background: "linear-gradient(90deg, #38bdf8, #60a5fa)",
      animation: "progressMove 1.4s ease-in-out infinite",
      transformOrigin: "left center",
    },

    page: {
      minHeight: "100vh",
      position: "relative",
      overflow: "hidden",
      background: "#051128",
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
      background:
        "linear-gradient(90deg, rgba(2,9,24,0.92) 0%, rgba(4,16,38,0.78) 44%, rgba(2,9,24,0.92) 100%)",
    },

    diagonalBlue: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: isMobile ? "33%" : "29%",
      width: isMobile ? "48%" : "23%",
      background:
        "linear-gradient(180deg, rgba(14,165,233,0.10) 0%, rgba(14,165,233,0.32) 50%, rgba(14,165,233,0.10) 100%)",
      transform: "skewX(-35deg)",
      boxShadow: "0 0 90px rgba(14,165,233,0.14)",
    },

    diagonalBlueSoft: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: isMobile ? "51%" : "43%",
      width: isMobile ? "18%" : "9%",
      background:
        "linear-gradient(180deg, rgba(56,189,248,0.04) 0%, rgba(56,189,248,0.16) 50%, rgba(56,189,248,0.04) 100%)",
      transform: "skewX(-35deg)",
    },

    edgeGlow: {
      position: "absolute",
      left: isMobile ? -100 : -140,
      bottom: isMobile ? -100 : -140,
      width: isMobile ? 260 : 360,
      height: isMobile ? 260 : 360,
      borderRadius: "50%",
      background: "rgba(14,165,233,0.10)",
      filter: "blur(80px)",
    },

    logoWrap: {
      position: "absolute",
      top: isMobile ? 22 : 34,
      left: isMobile ? 18 : 44,
      zIndex: 3,
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
    },

    logo: {
      width: isMobile ? 104 : isTablet ? 138 : 160,
      height: "auto",
      display: "block",
      objectFit: "contain",
      filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.34))",
    },

    contentWrap: {
      position: "relative",
      zIndex: 2,
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1.08fr 0.92fr",
      alignItems: "center",
      gap: isMobile ? 26 : 36,
      padding: isMobile ? "130px 16px 28px" : "40px 56px 40px 56px",
    },

    leftSection: {
      display: "flex",
      alignItems: "center",
      justifyContent: isMobile ? "center" : "flex-start",
      minHeight: isMobile ? "auto" : "100%",
      order: 1,
    },

    heroTextBlock: {
      width: "100%",
      maxWidth: isMobile ? "100%" : 700,
      color: "#ffffff",
      textAlign: isMobile ? "center" : "right",
      paddingTop: isMobile ? 18 : 36,
    },

    heroKicker: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 34,
      padding: "0 14px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.06)",
      color: "#dbeafe",
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "0.18em",
      marginBottom: isMobile ? 16 : 20,
      backdropFilter: "blur(10px)",
    },

    heroTitle: {
      margin: 0,
      fontSize: isMobile ? 42 : isTablet ? 54 : 70,
      lineHeight: 1.04,
      fontWeight: 900,
      letterSpacing: "-0.05em",
      textShadow: "0 8px 22px rgba(0,0,0,0.22)",
    },

    heroSubtitle: {
      marginTop: 18,
      marginBottom: 0,
      fontSize: isMobile ? 17 : 22,
      lineHeight: 1.95,
      color: "rgba(255,255,255,0.94)",
      maxWidth: isMobile ? "100%" : 620,
      textShadow: "0 4px 12px rgba(0,0,0,0.16)",
    },

    heroMeta: {
      marginTop: 26,
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 12,
      flexWrap: "wrap",
      color: "rgba(255,255,255,0.85)",
      fontSize: 14,
      fontWeight: 700,
    },

    heroMetaItem: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: 34,
      padding: "0 12px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.10)",
      backdropFilter: "blur(8px)",
    },

    heroMetaDot: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.46)",
    },

    card: {
      width: "100%",
      maxWidth: isMobile ? "100%" : 480,
      justifySelf: isMobile ? "stretch" : "end",
      background: "rgba(255,255,255,0.98)",
      borderRadius: isMobile ? 28 : 30,
      padding: isMobile ? 22 : isTablet ? 28 : 34,
      boxShadow: "0 28px 60px rgba(15, 23, 42, 0.34)",
      border: "1px solid rgba(234,236,240,0.98)",
      backdropFilter: "blur(12px)",
      order: 2,
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
      fontSize: isMobile ? 34 : 40,
      fontWeight: 900,
      color: "#101828",
      letterSpacing: "-0.04em",
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
      transition: "0.2s ease",
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
      transition: "0.2s ease",
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
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
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
      background: "linear-gradient(135deg, #55c2f6, #6b95f4)",
      color: "#fff",
      fontSize: isMobile ? 18 : 20,
      fontWeight: 800,
      cursor: "pointer",
      boxShadow: "0 14px 30px rgba(21, 94, 239, 0.24)",
      transition: "0.2s ease",
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
