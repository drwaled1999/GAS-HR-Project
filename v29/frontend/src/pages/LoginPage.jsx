import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, loginUser, verifyTwoFactorLogin } from "../services/api";
import { useAuth } from "../context/AuthContext";
import TwoFactorSetup from "../components/TwoFactorSetup";

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
  const [challengeToken, setChallengeToken] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [securityAction, setSecurityAction] = useState(() => sessionStorage.getItem("hr_security_action") || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMinLength, setPasswordMinLength] = useState(8);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const isFormValid = useMemo(() => {
    if (securityAction === "password_change") {
      return newPassword.length >= passwordMinLength && newPassword === confirmPassword;
    }
    return challengeToken
      ? verificationCode.trim().length >= 6
      : username.trim() && password.trim();
  }, [challengeToken, username, password, verificationCode, securityAction, newPassword, confirmPassword, passwordMinLength]);

  function startRequiredAction(action, data) {
    [localStorage, sessionStorage].forEach((storage) => {
      storage.removeItem("token"); storage.removeItem("hr_portal_user");
    });
    sessionStorage.setItem("token", data.actionToken);
    sessionStorage.setItem("hr_security_action", action);
    setPasswordMinLength(Number(data.passwordMinLength || 8));
    setSecurityAction(action);
  }

  function finishRequiredAction(message) {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("hr_security_action");
    setSecurityAction(""); setNewPassword(""); setConfirmPassword("");
    setPassword(""); setSuccess(message);
  }

  function cancelRequiredAction() {
    sessionStorage.removeItem("token"); sessionStorage.removeItem("hr_security_action");
    setSecurityAction(""); setError(""); setSuccess("");
  }

  function finishLogin(data) {
    const storage = rememberMe ? localStorage : sessionStorage;
    const otherStorage = rememberMe ? sessionStorage : localStorage;
    otherStorage.removeItem("token");
    otherStorage.removeItem("hr_portal_user");
    storage.setItem("token", data.token);
    storage.setItem("hr_portal_user", JSON.stringify(data.user));
    sessionStorage.removeItem("hr_security_action");
    setUser(data.user);
    navigate("/", { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const data = await loginUser({ username, password });
      if (data.requiresPasswordChange) {
        startRequiredAction("password_change", data);
        return;
      }
      if (data.requiresTwoFactorSetup) {
        startRequiredAction("two_factor_setup", data);
        return;
      }
      if (data.requiresTwoFactor) {
        setChallengeToken(data.challengeToken);
        setVerificationCode("");
        return;
      }
      finishLogin(data);
    } catch (err) {
      setError(err?.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequiredPasswordChange(e) {
    e.preventDefault();
    try {
      setLoading(true); setError(""); setSuccess("");
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
      await apiFetch("/auth/change-required-password", {
        method: "POST", body: JSON.stringify({ newPassword }),
      });
      finishRequiredAction("Password changed successfully. Sign in with your new password.");
    } catch (err) {
      setError(err?.message || "Could not change password");
    } finally { setLoading(false); }
  }

  async function handleTwoFactorSubmit(e) {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      const data = await verifyTwoFactorLogin({
        challengeToken,
        code: verificationCode,
      });
      finishLogin(data);
    } catch (err) {
      setError(err?.message || "رمز التحقق غير صحيح");
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

        <h1>{securityAction === "two_factor_setup" ? "Security Setup Required" : securityAction === "password_change" ? "Change Your Password" : challengeToken ? "Two-Step Verification" : "Welcome Back"}</h1>
        <p>{securityAction === "two_factor_setup" ? "Set up Authenticator before accessing the portal" : securityAction === "password_change" ? `Create a strong password of at least ${passwordMinLength} characters` : challengeToken ? "Enter the 6-digit code from your Authenticator app" : "Sign in to HR Portal"}</p>

        {securityAction === "two_factor_setup" ? <><TwoFactorSetup required onComplete={() => finishRequiredAction("Two-step verification enabled. Sign in again to continue.")}/><button type="button" className="back-login-btn" onClick={cancelRequiredAction}>Restart sign in</button></> : <form onSubmit={securityAction === "password_change" ? handleRequiredPasswordChange : challengeToken ? handleTwoFactorSubmit : handleSubmit}>
          {securityAction === "password_change" ? <>
            <div className="pass"><input type="password" autoComplete="new-password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}/></div>
            <div className="pass"><input type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}/></div>
            <small className="password-rule">Uppercase, lowercase, number and special character are required.</small>
          </> :
          challengeToken ? (
            <>
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code or recovery code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\s/g, ""))}
              />
              <button
                type="button"
                className="back-login-btn"
                onClick={() => {
                  setChallengeToken("");
                  setVerificationCode("");
                  setError("");
                }}
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
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
            </>
          )}

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          {securityAction === "password_change" && <button type="button" className="back-login-btn" onClick={cancelRequiredAction}>Restart sign in</button>}

          <button disabled={!isFormValid || loading}>
            {loading ? "Please wait..." : securityAction === "password_change" ? "Change password" : challengeToken ? "Verify and continue" : "Sign in"}
          </button>
        </form>}
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
.success{margin-top:10px;padding:10px;border-radius:10px;color:#166534;background:#dcfce7;font-weight:750}.password-rule{display:block;margin:8px 0;color:#bfdbfe;line-height:1.5;text-align:left}
`;
