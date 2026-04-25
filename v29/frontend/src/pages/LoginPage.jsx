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
        <style>{loginAnimations}</style>

        <div style={styles.loaderAuraOne} />
        <div style={styles.loaderAuraTwo} />
        <div style={styles.loaderAuraThree} />

        <div style={styles.loaderCenter}>
          <div style={styles.loaderLogoShell}>
            <img src="/logo.svg" alt="GAS Arabian Services" style={styles.loaderLogo} />
          </div>

          <div style={styles.loaderOrbitWrap}>
            <div style={styles.loaderOrbitOne}></div>
            <div style={styles.loaderOrbitTwo}></div>
            <div style={styles.loaderOrbitThree}></div>
            <div style={styles.loaderCore}></div>
          </div>

          <div style={styles.loaderTextBlock}>
            <h2 style={styles.loaderTitle}>HR Portal</h2>
            <p style={styles.loaderSubtitle}>Loading secure workspace...</p>
          </div>

          <div style={styles.loaderBarTrack}>
            <div style={styles.loaderBarFill}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gas-login-bg">
      <style>{loginAnimations}</style>

      <div className="gas-watermark">
        <img src="/logo.svg" alt="GAS Arabian Services" />
      </div>

      <div className="gas-orb orb1" />
      <div className="gas-orb orb2" />
      <div className="gas-orb orb3" />
      <div className="gas-grid" />

      <div style={styles.heroBackground} />
      <div style={styles.darkOverlay} />
      <div style={styles.diagonalBlue} />
      <div style={styles.diagonalBlueSoft} />
      <div style={styles.edgeGlow} />

      <div style={styles.logoWrap}>
        <img src="/logo.svg" alt="GAS Arabian Services" style={styles.logo} />
      </div>

      <div style={styles.contentWrap}>
        <div style={styles.leftSection}>
          <div style={styles.heroTextBlock}>
            <div style={styles.heroKicker}>GAS HR PORTAL</div>

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
          <div style={styles.cardGlow} />

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

              {!isMobile && <span style={styles.helperText}>Access according to your role</span>}
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

const loginAnimations = `
  .gas-login-bg {
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 20% 20%, rgba(37, 99, 235, .36), transparent 28%),
      radial-gradient(circle at 78% 70%, rgba(14, 165, 233, .24), transparent 32%),
      linear-gradient(135deg, #020617 0%, #0f172a 48%, #111827 100%);
    background-size: 400% 400%;
    animation: gasBgMove 16s ease infinite;
  }

  .gas-watermark {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    opacity: .055;
    z-index: 1;
    animation: gasLogoPulse 7s ease-in-out infinite;
    pointer-events: none;
  }

  .gas-watermark img {
    width: min(720px, 82vw);
    filter: drop-shadow(0 0 35px rgba(56, 189, 248, .32));
  }

  .gas-orb {
    position: absolute;
    border-radius: 999px;
    filter: blur(28px);
    opacity: .32;
    z-index: 0;
    animation: gasOrbFloat 9s ease-in-out infinite;
  }

  .orb1 {
    width: 430px;
    height: 430px;
    top: -150px;
    left: -130px;
    background: #2563eb;
  }

  .orb2 {
    width: 420px;
    height: 420px;
    right: -130px;
    bottom: -140px;
    background: #38bdf8;
    animation-delay: 2s;
  }

  .orb3 {
    width: 260px;
    height: 260px;
    left: 48%;
    top: 18%;
    background: rgba(125, 211, 252, .55);
    opacity: .18;
    animation-delay: 4s;
  }

  .gas-grid {
    position: absolute;
    inset: 0;
    z-index: 1;
    background-image:
      linear-gradient(rgba(255,255,255,.055) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.055) 1px, transparent 1px);
    background-size: 54px 54px;
    mask-image: radial-gradient(circle, black 35%, transparent 78%);
    animation: gasGridMove 20s linear infinite;
    pointer-events: none;
  }

  @keyframes gasBgMove {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes gasOrbFloat {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(28px, -22px) scale(1.08); }
  }

  @keyframes gasGridMove {
    from { transform: translateY(0); }
    to { transform: translateY(54px); }
  }

  @keyframes gasLogoPulse {
    0%, 100% { transform: scale(1); opacity: .045; }
    50% { transform: scale(1.045); opacity: .082; }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes spinReverse {
    from { transform: rotate(360deg); }
    to { transform: rotate(0deg); }
  }

  @keyframes progressMove {
    0% { transform: translateX(-40%) scaleX(.7); opacity: .75; }
    50% { transform: translateX(90%) scaleX(1); opacity: 1; }
    100% { transform: translateX(180%) scaleX(.7); opacity: .75; }
  }
`;

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
        "radial-gradient(circle at top left, #0b2c54 0%, #051128 35%, #020817 100%)",
      fontFamily: "Segoe UI, Tahoma, Arial, sans-serif",
    },

    loaderAuraOne: {
      position: "absolute",
      width: isMobile ? 280 : 420,
      height: isMobile ? 280 : 420,
      borderRadius: "50%",
      background: "rgba(14,165,233,0.14)",
      filter: "blur(90px)",
      top: -120,
      left: -120,
    },

    loaderAuraTwo: {
      position: "absolute",
      width: isMobile ? 260 : 360,
      height: isMobile ? 260 : 360,
      borderRadius: "50%",
      background: "rgba(59,130,246,0.12)",
      filter: "blur(85px)",
      bottom: -120,
      right: -100,
    },

    loaderAuraThree: {
      position: "absolute",
      width: isMobile ? 200 : 280,
      height: isMobile ? 200 : 280,
      borderRadius: "50%",
      background: "rgba(56,189,248,0.10)",
      filter: "blur(75px)",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    },

    loaderCenter: {
      position: "relative",
      zIndex: 2,
      width: "min(92%, 430px)",
      padding: isMobile ? "24px 20px" : "30px 28px",
      borderRadius: 30,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 30px 80px rgba(0,0,0,0.28)",
      backdropFilter: "blur(18px)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
    },

    loaderLogoShell: {
      width: 104,
      height: 104,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
      border: "1px solid rgba(255,255,255,0.10)",
      boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
      marginBottom: 22,
    },

    loaderLogo: {
      width: 66,
      height: "auto",
      objectFit: "contain",
      filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.22))",
    },

    loaderOrbitWrap: {
      position: "relative",
      width: 116,
      height: 116,
      marginBottom: 20,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },

    loaderOrbitOne: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.10)",
      borderTop: "2px solid #38bdf8",
      animation: "spin 1.2s linear infinite",
    },

    loaderOrbitTwo: {
      position: "absolute",
      inset: 12,
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.08)",
      borderBottom: "2px solid #60a5fa",
      animation: "spinReverse 1.5s linear infinite",
    },

    loaderOrbitThree: {
      position: "absolute",
      inset: 24,
      borderRadius: "50%",
      border: "2px solid rgba(255,255,255,0.06)",
      borderLeft: "2px solid #22d3ee",
      animation: "spin 1.8s linear infinite",
    },

    loaderCore: {
      width: 34,
      height: 34,
      borderRadius: "50%",
      background:
        "radial-gradient(circle, rgba(96,165,250,0.50) 0%, rgba(56,189,248,0.18) 60%, rgba(56,189,248,0.02) 100%)",
      boxShadow: "0 0 26px rgba(56,189,248,0.30)",
    },

    loaderTextBlock: {
      display: "grid",
      gap: 8,
      marginBottom: 18,
    },

    loaderTitle: {
      margin: 0,
      color: "#ffffff",
      fontSize: isMobile ? 24 : 28,
      fontWeight: 900,
      letterSpacing: "-0.03em",
    },

    loaderSubtitle: {
      margin: 0,
      color: "rgba(255,255,255,0.74)",
      fontSize: 14,
      lineHeight: 1.7,
    },

    loaderBarTrack: {
      width: "100%",
      height: 10,
      borderRadius: 999,
      overflow: "hidden",
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.06)",
    },

    loaderBarFill: {
      width: "38%",
      height: "100%",
      borderRadius: 999,
      background: "linear-gradient(90deg, #22d3ee, #60a5fa, #38bdf8)",
      animation: "progressMove 1.6s ease-in-out infinite",
    },

    heroBackground: {
      position: "absolute",
      inset: 0,
      backgroundImage: "url('/gas-bg.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      transform: "scale(1.02)",
      opacity: 0.22,
      zIndex: 0,
    },

    darkOverlay: {
      position: "absolute",
      inset: 0,
      zIndex: 1,
      background:
        "linear-gradient(90deg, rgba(2,9,24,0.82) 0%, rgba(4,16,38,0.58) 44%, rgba(2,9,24,0.82) 100%)",
    },

    diagonalBlue: {
      position: "absolute",
      zIndex: 1,
      top: 0,
      bottom: 0,
      left: isMobile ? "33%" : "29%",
      width: isMobile ? "48%" : "23%",
      background:
        "linear-gradient(180deg, rgba(14,165,233,0.10) 0%, rgba(14,165,233,0.30) 50%, rgba(14,165,233,0.10) 100%)",
      transform: "skewX(-35deg)",
      boxShadow: "0 0 90px rgba(14,165,233,0.14)",
    },

    diagonalBlueSoft: {
      position: "absolute",
      zIndex: 1,
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
      zIndex: 1,
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
      zIndex: 4,
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: "10px 14px",
      borderRadius: 22,
      background: "rgba(255,255,255,0.90)",
      boxShadow: "0 18px 46px rgba(15,23,42,0.22)",
      backdropFilter: "blur(16px)",
    },

    logo: {
      width: isMobile ? 94 : isTablet ? 126 : 148,
      height: "auto",
      display: "block",
      objectFit: "contain",
      filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.12))",
    },

    contentWrap: {
      position: "relative",
      zIndex: 3,
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "1.08fr 0.92fr",
      alignItems: "center",
      gap: isMobile ? 26 : 36,
      padding: isMobile ? "130px 16px 28px" : "40px 56px",
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
      background: "rgba(255,255,255,0.08)",
      color: "#dbeafe",
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: "0.16em",
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
      background: "rgba(255,255,255,0.08)",
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
      position: "relative",
      overflow: "hidden",
      width: "100%",
      maxWidth: isMobile ? "100%" : 480,
      justifySelf: isMobile ? "stretch" : "end",
      background: "rgba(255,255,255,0.13)",
      borderRadius: isMobile ? 28 : 30,
      padding: isMobile ? 22 : isTablet ? 28 : 34,
      boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
      border: "1px solid rgba(255,255,255,0.18)",
      backdropFilter: "blur(22px)",
      order: 2,
      color: "#fff",
    },

    cardGlow: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: "50%",
      top: -120,
      right: -90,
      background: "rgba(56,189,248,0.22)",
      filter: "blur(35px)",
      pointerEvents: "none",
    },

    cardHeader: {
      position: "relative",
      zIndex: 2,
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
      background: "rgba(37,99,235,0.20)",
      color: "#dbeafe",
      border: "1px solid rgba(255,255,255,0.12)",
      fontSize: 13,
      fontWeight: 800,
      whiteSpace: "nowrap",
    },

    title: {
      margin: 0,
      fontSize: isMobile ? 34 : 40,
      fontWeight: 900,
      color: "#ffffff",
      letterSpacing: "-0.04em",
    },

    subtitle: {
      marginTop: 10,
      marginBottom: 0,
      fontSize: isMobile ? 14 : 15,
      color: "rgba(255,255,255,0.72)",
      lineHeight: 1.7,
    },

    form: {
      position: "relative",
      zIndex: 2,
      display: "grid",
      gap: isMobile ? 16 : 18,
    },

    fieldGroup: {
      display: "grid",
      gap: 8,
    },

    label: {
      fontSize: isMobile ? 14 : 15,
      color: "rgba(255,255,255,0.88)",
      fontWeight: 800,
    },

    input: {
      width: "100%",
      padding: isMobile ? "14px 14px" : "16px 18px",
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.20)",
      fontSize: isMobile ? 16 : 17,
      outline: "none",
      boxSizing: "border-box",
      background: "rgba(255,255,255,0.13)",
      color: "#ffffff",
      transition: "0.2s ease",
    },

    passwordWrap: {
      position: "relative",
    },

    passwordInput: {
      width: "100%",
      padding: isMobile ? "14px 78px 14px 14px" : "16px 86px 16px 18px",
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.20)",
      fontSize: isMobile ? 16 : 17,
      outline: "none",
      boxSizing: "border-box",
      background: "rgba(255,255,255,0.13)",
      color: "#ffffff",
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
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.14)",
      color: "#ffffff",
      fontWeight: 800,
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
      color: "rgba(255,255,255,0.86)",
      fontSize: 14,
      fontWeight: 700,
    },

    helperText: {
      color: "rgba(255,255,255,0.58)",
      fontSize: 13,
      fontWeight: 700,
    },

    button: {
      marginTop: 4,
      width: "100%",
      padding: isMobile ? "14px 16px" : "16px 18px",
      borderRadius: 16,
      border: "none",
      background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
      color: "#fff",
      fontSize: isMobile ? 18 : 20,
      fontWeight: 900,
      cursor: "pointer",
      boxShadow: "0 18px 38px rgba(37,99,235,0.34)",
      transition: "0.2s ease",
    },

    disabledButton: {
      opacity: 0.65,
      cursor: "not-allowed",
      boxShadow: "none",
    },

    error: {
      background: "rgba(254,242,242,0.96)",
      color: "#b42318",
      border: "1px solid #fecdca",
      padding: "12px 14px",
      borderRadius: 14,
      fontSize: 14,
      fontWeight: 800,
    },
  };
}
