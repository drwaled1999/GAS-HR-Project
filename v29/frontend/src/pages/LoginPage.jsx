import { useState } from "react";
import { loginUser } from "../services/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    try {
      const res = await loginUser({
        username,
        password,
      });

      // ✅ حفظ التوكن
      localStorage.setItem("token", res.token);

      // تحويل
      window.location.href = "/dashboard";
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <input
        placeholder="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button type="submit">Sign in</button>
    </form>
  );
}