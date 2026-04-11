import { useSettings } from '../context/SettingsContext';

export default function ThemeToggle() {
  const { theme, setTheme } = useSettings();

  return (
    <button
      type="button"
      className="ghost small-control"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
