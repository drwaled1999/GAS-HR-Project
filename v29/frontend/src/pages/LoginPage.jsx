import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";

export default function LoginPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      }

      navigate("/", { replace: true });
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError(err?.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={backgroundGlowStyle} />
      <div style={backgroundGlowStyleTwo} />

      <div style={layoutStyle}>
        <div style={brandPanelStyle}>
          <div style={brandBadgeStyle}>GAS Arabian Services</div>
          <h1 style={brandTitleStyle}>HR Portal</h1>
          <p style={brandTextStyle}>
            منصة موارد بشرية موحدة لإدارة الحضور، الإجازات، الطلبات، والعمليات اليومية بشكل احترافي.
          </p>

          <div style={featureListStyle}>
            <div style={featureItemStyle}>
              <span style={featureIconStyle}>✓</span>
              <span>Secure unified access</span>
            </div>
            <div style={featureItemStyle}>
              <span style={featureIconStyle}>✓</span>
              <span>Attendance and leave workflows</span>
            </div>
            <div style={featureItemStyle}>
              <span style={featureIconStyle}>✓</span>
              <span>Role-based HR operations</span>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div>
              <h2 style={titleStyle}>Sign in</h2>
              <p style={subtitleStyle}>سجّل الدخول إلى بوابة الموارد البشرية</p>
            </div>
            <div style={miniBadgeStyle}>Secure Access</div>
          </div>

          <form onSubmit={handleSubmit} style={formStyle}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Username</label>
              <input
                style={inputStyle}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Password</label>

              <div style={passwordWrapStyle}>
                <input
                  style={passwordInputStyle}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={togglePasswordStyle}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div style={rowStyle}>
              <label style={rememberWrapStyle}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <span style={helperTextStyle}>Access according to your role</span>
            </div>

            {error ? <div style={errorStyle}>{error}</div> : null}

            <button
              type="submit"
              style={{
                ...buttonStyle,
                ...(loading || !isFormValid ? disabledButtonStyle : {}),
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

const pageStyle = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(135deg, #0b1220 0%, #0f172a 35%, #111827 100%)",
  padding: 24,
};

const backgroundGlowStyle = {
  position: "absolute",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(37, 99, 235, 0.20)",
  filter: "blur(90px)",
  top: -40,
  left: -80,
};

const backgroundGlowStyleTwo = {
  position: "absolute",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(14, 165, 233, 0.14)",
  filter: "blur(100px)",
  bottom: -60,
  right: -60,
};

const layoutStyle = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth: 1180,
  display: "grid",
  gridTemplateColumns: "1.05fr 0.95fr",
  gap: 24,
};

const brandPanelStyle = {
  color: "#fff",
  padding: "40px 28px",
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(14px)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const brandBadgeStyle = {
  display: "inline-flex",
  width: "fit-content",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 34,
  padding: "0 14px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.10)",
  color: "#dbeafe",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 18,
};

const brandTitleStyle = {
  margin: 0,
  fontSize: 56,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: "-0.04em",
};

const brandTextStyle = {
  marginTop: 18,
  marginBottom: 26,
  color: "rgba(255,255,255,0.82)",
  fontSize: 18,
  lineHeight: 1.8,
  maxWidth: 560,
};

const featureListStyle = {
  display: "grid",
  gap: 12,
};

const featureItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#e5e7eb",
  fontSize: 16,
  fontWeight: 600,
};

const featureIconStyle = {
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
};

const cardStyle = {
  width: "100%",
  background: "rgba(255,255,255,0.98)",
  borderRadius: 28,
  padding: 34,
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.24)",
  border: "1px solid rgba(234,236,240,0.95)",
};

const cardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  marginBottom: 28,
};

const miniBadgeStyle = {
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
};

const titleStyle = {
  margin: 0,
  fontSize: 38,
  fontWeight: 900,
  color: "#101828",
  letterSpacing: "-0.03em",
};

const subtitleStyle = {
  marginTop: 10,
  marginBottom: 0,
  fontSize: 16,
  color: "#667085",
  lineHeight: 1.7,
};

const formStyle = {
  display: "grid",
  gap: 18,
};

const fieldGroupStyle = {
  display: "grid",
  gap: 8,
};

const labelStyle = {
  fontSize: 15,
  color: "#344054",
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  padding: "16px 18px",
  borderRadius: 16,
  border: "1px solid #d0d5dd",
  fontSize: 17,
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
  color: "#101828",
};

const passwordWrapStyle = {
  position: "relative",
};

const passwordInputStyle = {
  width: "100%",
  padding: "16px 86px 16px 18px",
  borderRadius: 16,
  border: "1px solid #d0d5dd",
  fontSize: 17,
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
  color: "#101828",
};

const togglePasswordStyle = {
  position: "absolute",
  top: "50%",
  right: 10,
  transform: "translateY(-50%)",
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 12,
  border: "none",
  background: "#f2f4f7",
  color: "#344054",
  fontWeight: 700,
  cursor: "pointer",
};

const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const rememberWrapStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "#344054",
  fontSize: 14,
  fontWeight: 600,
};

const helperTextStyle = {
  color: "#667085",
  fontSize: 13,
  fontWeight: 600,
};

const buttonStyle = {
  marginTop: 4,
  width: "100%",
  padding: "16px 18px",
  borderRadius: 16,
  border: "none",
  background: "linear-gradient(135deg, #155eef, #1849a9)",
  color: "#fff",
  fontSize: 20,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 14px 30px rgba(21, 94, 239, 0.24)",
};

const disabledButtonStyle = {
  opacity: 0.65,
  cursor: "not-allowed",
  boxShadow: "none",
};

const errorStyle = {
  background: "#fef3f2",
  color: "#b42318",
  border: "1px solid #fecdca",
  padding: "12px 14px",
  borderRadius: 14,
  fontSize: 14,
  fontWeight: 700,
};
