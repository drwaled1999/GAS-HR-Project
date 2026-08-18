import { useSettings } from '../context/SettingsContext';

export default function LanguageSwitcher() {
  const { language, toggleLanguage } = useSettings();

  return (
    <button
      type="button"
      className="ghost small-control"
      onClick={toggleLanguage}
      aria-label={language === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
      title={language === 'en' ? 'العربية' : 'English'}
    >
      {language === 'en' ? 'العربية' : 'English'}
    </button>
  );
}
