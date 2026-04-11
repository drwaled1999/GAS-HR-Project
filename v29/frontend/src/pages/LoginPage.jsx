import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: 'owner', password: 'owner123' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>HR Portal</h1>
        <p>تسجيل الدخول الموحد للموقع حسب الصلاحيات والمشروع والبكج.</p>
        <label>
          Username
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label>
          Password
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <div className="alert error">{error}</div>}
        <button disabled={submitting}>{submitting ? 'Signing in...' : 'Sign in'}</button>
        <div className="demo-box">
          <strong>Demo users:</strong>
          <div>owner / owner123</div>
          <div>hrmanager / hr123</div>
          <div>engineer / eng123</div>
          <div>pmzuluf / pm123</div>
          <div>cmzuluf / cm123</div>
        </div>
      </form>
    </div>
  );
}
