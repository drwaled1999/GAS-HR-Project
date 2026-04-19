import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import BottomNav from "../components/BottomNav";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeToggle from "../components/ThemeToggle";

export default function AdminMobileLayout() {
  const { user } = useAuth();

  return (
    <div className="mobile-shell theme-shell">
      <header className="mobile-topbar">
        <div>
          <strong>Admin Portal</strong>
          <p>{user?.name || user?.username || "-"}</p>
        </div>

        <div className="toolbar-row">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="mobile-content admin-mobile-content">
        <Outlet />
      </main>

      <BottomNav admin />
    </div>
  );
}