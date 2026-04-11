import { useSettings } from '../context/SettingsContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useSettings();

  return (
    <button
      type="button"
      className="ghost small-control"
      onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
      aria-label="Toggle language"
      title="Toggle language"
    >
      {language === 'en' ? 'AR' : 'EN'}
    </button>
  );
}
