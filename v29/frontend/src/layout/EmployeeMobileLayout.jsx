import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';

export default function EmployeeMobileLayout() {
  const { user } = useAuth();

  return (
    <div className="mobile-shell theme-shell">
      <header className="mobile-topbar">
        <div>
          <strong>Employee Portal</strong>
          <p>{user?.name}</p>
        </div>
        <div className="toolbar-row">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="mobile-content"><Outlet /></main>
      <BottomNav />
    </div>
  );
}
