import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../services/api";
import BottomNav from "../components/BottomNav";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ThemeToggle from "../components/ThemeToggle";
import { useSettings } from "../context/SettingsContext";

export default function AdminMobileLayout() {
  const { user } = useAuth();
  const { language } = useSettings();
  const [canManageRequests, setCanManageRequests] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  useEffect(() => {
    apiFetch("/requests-center/access").then((r) => { setCanManageRequests(Boolean(r?.canManage)); setPendingRequestCount(Number(r?.pendingCount || 0)); }).catch(() => setCanManageRequests(false));
  }, [user?.id]);

  return (
    <div className="mobile-shell theme-shell">
      <header className="mobile-topbar">
        <div>
          <strong>{language === "ar" ? "بوابة الإدارة" : "Admin Portal"}</strong>
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

      <BottomNav admin hideRequests={!canManageRequests} pendingRequestCount={pendingRequestCount} />
    </div>
  );
}
