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

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const isFormValid = useMemo(() => {
    return username.trim() && password.trim();
  }, [username, password]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const data = await loginUser({ username, password });

      const storage = rememberMe ? localStorage : sessionStorage;

      storage.setItem("token", data.token);
      storage.setItem("hr_portal_user", JSON.stringify(data.user));

      setUser(data.user);
      const fcmToken = localStorage.getItem("fcm_token");

        if (fcmToken) {
          try {
          await fetch(
      "https://gas-hr-project.onrender.com/auth/fcm-token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: data.user.id,
          token: fcmToken,
        }),
      }
    );

    console.log("FCM TOKEN SENT TO SERVER");
  } catch (error) {
    console.error("FCM TOKEN SAVE ERROR:", error);
  }
}
      navigate("/", { replace: true });
    } catch (err) {
      setError("فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  if (showLoader) {
    return (
      <div style={styles.loader}>
        <img src="/logo.svg" style={{ width: 120 }} />
      </div>
    );
  }

  return (
    <div className="gas-login-bg">
      <style>{loginCSS}</style>

      {/* 🔥 الخلفية */}
      <div className="gas-watermark">
        <img src="/logo.svg" />
      </div>

      <div className="gas-orb orb1" />
      <div className="gas-orb orb2" />
      <div className="gas-grid" />

      {/* 🔥 الكرت */}
      <div className="login-card">
        <img src="/logo.svg" className="logo" />

        <h1>Welcome Back</h1>
        <p>Sign in to HR Portal</p>

        <form onSubmit={handleSubmit}>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <div className="pass">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "Hide" : "Show"}
            </span>
          </div>

          <label className="remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>

          {error && <div className="error">{error}</div>}

          <button disabled={!isFormValid || loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  loader: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#020617",
  },
};

const loginCSS = `
/* 🔥 الخلفية */
.gas-login-bg {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  background:
    radial-gradient(circle at 25% 25%, rgba(37, 99, 235, 0.45), transparent 35%),
    radial-gradient(circle at 75% 75%, rgba(14, 165, 233, 0.35), transparent 40%),
    linear-gradient(135deg, #020617 0%, #0f172a 40%, #1e3a8a 100%);
  background-size: 300% 300%;
  animation: bgMove 12s ease infinite;
}

/* 🎬 حركة */
@keyframes bgMove {
  0% { background-position: 0% 50% }
  50% { background-position: 100% 50% }
  100% { background-position: 0% 50% }
}

/* ✨ شعار بالخلف */
.gas-watermark {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  opacity: 0.12;
  animation: pulse 6s ease-in-out infinite;
}

.gas-watermark img {
  width: min(600px, 70vw);
  filter: drop-shadow(0 0 40px rgba(56,189,248,0.4));
}

/* 🌫️ glow */
.gas-orb {
  position: absolute;
  width: 400px;
  height: 400px;
  border-radius: 999px;
  filter: blur(18px);
  opacity: 0.4;
}

.orb1 { top: -100px; left: -100px; background: #2563eb; }
.orb2 { bottom: -120px; right: -120px; background: #38bdf8; }

/* 🔲 grid */
.gas-grid {
  position: absolute;
  inset: 0;
  opacity: 0.3;
  background-image:
    linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px);
  background-size: 50px 50px;
}

/* 🧊 الكرت */
.login-card {
  z-index: 2;
  width: 350px;
  padding: 30px;
  border-radius: 20px;
  backdrop-filter: blur(20px);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  text-align: center;
}

.logo {
  width: 120px;
  margin-bottom: 15px;
}

input {
  width: 100%;
  margin: 8px 0;
  padding: 12px;
  border-radius: 10px;
  border: none;
}

.pass {
  position: relative;
}

.pass span {
  position: absolute;
  right: 10px;
  top: 12px;
  cursor: pointer;
}

button {
  width: 100%;
  margin-top: 10px;
  padding: 12px;
  border-radius: 12px;
  border: none;
  background: #2563eb;
  color: white;
  font-weight: bold;
}

.error {
  color: red;
  margin-top: 10px;
}
`;
