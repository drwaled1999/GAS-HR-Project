import { Outlet, NavLink } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Bell, Sparkles, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function EmployeeMobileLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className={`employee-mobile ${open ? "open" : ""}`}>
      <style>{`
        .employee-mobile {
          min-height: 100vh;
          background: linear-gradient(180deg, #0f172a, #1e3a8a);
          color: white;
        }

        /* 🔥 الهيدر */
        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
        }

        .menu-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: 12px;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          color: white;
        }

        /* 🔥 الشعار بعد التعديل */
        .brand-logo {
          width: 90px;
          height: 50px;
          background: transparent; /* 💣 حذف المربع الأبيض */
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 8px 20px rgba(0,0,0,0.3));
        }

        /* 🔥 welcome */
        .welcome-card {
          margin: 10px;
          padding: 12px;
          border-radius: 16px;
          background: rgba(255,255,255,0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .spark {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg,#2563eb,#0ea5e9);
          border-radius: 12px;
          display: grid;
          place-items: center;
        }

        /* 🔥 drawer */
        .drawer {
          position: fixed;
          top: 0;
          left: 0;
          width: 260px;
          height: 100%;
          background: #020617;
          transform: translateX(-100%);
          transition: 0.3s;
          z-index: 1000;
          padding: 20px;
        }

        .open .drawer {
          transform: translateX(0);
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: none;
        }

        .open .overlay {
          display: block;
        }

        .drawer a {
          display: block;
          padding: 12px;
          border-radius: 12px;
          color: white;
          text-decoration: none;
          margin-bottom: 6px;
        }

        .drawer a.active {
          background: #2563eb;
        }

        .logout {
          margin-top: auto;
          background: #ef4444;
          border: none;
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          color: white;
        }

        main {
          padding: 12px;
        }
      `}</style>

      {/* 🔥 الهيدر */}
      <div className="top-bar">
        <button className="menu-btn" onClick={() => setOpen(true)}>
          <Menu size={20} />
        </button>

        <div className="brand-logo">
          <img src="/logo.svg" />
        </div>

        <Bell />
      </div>

      {/* 🔥 welcome */}
      <div className="welcome-card">
        <div>
          <p style={{ opacity: 0.7 }}>Welcome</p>
          <h3>{user?.name || "Employee"}</h3>
        </div>
        <div className="spark">
          <Sparkles size={20} />
        </div>
      </div>

      {/* 🔥 المحتوى */}
      <main>
        <Outlet />
      </main>

      {/* 🔥 overlay */}
      <div className="overlay" onClick={() => setOpen(false)} />

      {/* 🔥 drawer */}
      <div className="drawer">
        <button onClick={() => setOpen(false)}>
          <X />
        </button>

        <NavLink to="/" onClick={() => setOpen(false)}>
          Home
        </NavLink>
        <NavLink to="/attendance" onClick={() => setOpen(false)}>
          Attendance
        </NavLink>
        <NavLink to="/requests" onClick={() => setOpen(false)}>
          Requests
        </NavLink>
        <NavLink to="/profile" onClick={() => setOpen(false)}>
          Profile
        </NavLink>

        <button className="logout" onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );
}
