import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";

export default function LoginPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const data = await loginUser({
        username,
        password,
      });

      console.log("LOGIN RESPONSE:", data);

      if (!data?.token) {
        throw new Error("لم يرجع السيرفر token");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("authToken", data.token);

      if (data?.user?.username) {
        localStorage.setItem("username", data.user.username);
      }

      if (data?.user?.fullName) {
        localStorage.setItem("fullName", data.user.fullName);
      }

      if (data?.user?.role) {
        localStorage.setItem("role", data.user.role);
      }

      window.location.href = "/dashboard";
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError(err.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>HR Portal</h1>
        <p style={subtitleStyle}>تسجيل الدخول الموحد (حسب المشروع)</p>

        <form onSubmit={handleSubmit} style={formStyle}>
          <label style={labelStyle}>Username</label>
          <input
            style={inputStyle}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
          />

          <label style={labelStyle}>Password</label>
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />

          {error ? <div style={errorStyle}>{error}</div> : null}

          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f5f7fb",
  padding: 20,
};

const cardStyle = {
  width: "100%",
  maxWidth: 560,
  background: "#fff",
  borderRadius: 22,
  padding: 36,
  boxShadow: "0 20px 50px rgba(16,24,40,0.08)",
  border: "1px solid #eaecf0",
};

const titleStyle = {
  margin: 0,
  fontSize: 48,
  fontWeight: 800,
  color: "#101828",
};

const subtitleStyle = {
  marginTop: 28,
  marginBottom: 28,
  fontSize: 18,
  color: "#475467",
};

const formStyle = {
  display: "grid",
  gap: 16,
};

const labelStyle = {
  fontSize: 16,
  color: "#344054",
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  padding: "16px 18px",
  borderRadius: 14,
  border: "1px solid #d0d5dd",
  fontSize: 18,
  outline: "none",
  boxSizing: "border-box",
};

const buttonStyle = {
  marginTop: 8,
  width: "100%",
  padding: "16px 18px",
  borderRadius: 14,
  border: "none",
  background: "#155eef",
  color: "#fff",
  fontSize: 22,
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle = {
  background: "#fef3f2",
  color: "#b42318",
  border: "1px solid #fecdca",
  padding: "12px 14px",
  borderRadius: 12,
};