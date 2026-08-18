import { useSettings } from '../context/SettingsContext';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, setTheme, language } = useSettings();
  const isDark = theme === 'dark';
  const label = language === 'ar'
    ? (isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن')
    : (isDark ? 'Switch to light mode' : 'Switch to dark mode');

  return (
    <button
      type="button"
      className="ghost small-control"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
