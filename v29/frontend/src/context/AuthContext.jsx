import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';

const AuthContext = createContext(null);

function loadStoredAuth() {
  const raw = localStorage.getItem('hr_portal_auth');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = loadStoredAuth();
    if (!stored?.accessToken) {
      setLoading(false);
      return;
    }

    apiFetch('/auth/session')
      .then((response) => setUser(response.user))
      .catch(() => {
        localStorage.removeItem('hr_portal_auth');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setUser(response.user);
    localStorage.setItem('hr_portal_auth', JSON.stringify({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user
    }));
  }

  async function logout() {
    const stored = loadStoredAuth();
    try {
      if (stored?.refreshToken) {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: stored.refreshToken })
        });
      }
    } catch {}
    localStorage.removeItem('hr_portal_auth');
    setUser(null);
  }

  const value = useMemo(() => ({ user, login, logout, loading }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
