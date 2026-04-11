import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const SettingsContext = createContext(null);

const defaultSettings = {
  language: 'en',
  theme: 'light'
};

function loadSettings() {
  const raw = localStorage.getItem('hr_portal_settings');
  if (!raw) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function SettingsProvider({ children }) {
  const [language, setLanguage] = useState(defaultSettings.language);
  const [theme, setTheme] = useState(defaultSettings.theme);

  useEffect(() => {
    const stored = loadSettings();
    setLanguage(stored.language || 'en');
    setTheme(stored.theme || 'light');
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('hr_portal_settings', JSON.stringify({ language, theme }));
  }, [language, theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const value = useMemo(() => ({ language, setLanguage, theme, setTheme }), [language, theme]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
