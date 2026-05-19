import {
  BadgeCheck,
  Briefcase,
  Building2,
  ChevronRight,
  CreditCard,
  FolderKanban,
  Globe2,
  Headphones,
  LogOut,
  Mail,
  Package,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function EmployeeProfilePage() {
  const { user, logout } = useAuth();

  const valueOrDash = (value) => {
    if (value === null || value === undefined) return "-";
    if (String(value).trim() === "") return "-";
    return String(value);
  };

  const getInitials = (name) => {
    const safeName = valueOrDash(name);
    if (safeName === "-") return "E";
    const parts = safeName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const profileName = user?.name || user?.fullName || user?.username || "Employee";
  const profileGasId = user?.gasId || user?.employeeCode || user?.gas_id || "-";
  const profileRole = user?.role || user?.roleName || "Employee";
  const profileDivision = user?.division || user?.nationalityType || user?.department || "-";
  const profileProject = user?.projectName || user?.project || user?.projectId || "-";
  const profilePackage = user?.packageName || user?.package || user?.packageId || "-";
  const profileEmail = user?.email || user?.workEmail || user?.username || "-";
  const profileNationality = user?.nationality || user?.nationalityName || "-";

  const topCards = [
    { label: "GAS ID", value: profileGasId, icon: CreditCard },
    { label: "Role", value: profileRole, icon: Briefcase },
    { label: "Project", value: profileProject, icon: FolderKanban },
    { label: "Package", value: profilePackage, icon: Package },
  ];

  const infoRows = [
    { label: "Employee Name", value: profileName, icon: UserRound },
    { label: "Email / Username", value: profileEmail, icon: Mail },
    { label: "Division", value: profileDivision, icon: Building2 },
    { label: "Nationality", value: profileNationality, icon: Globe2 },
  ];

  return (
    <>
      <style>{`
        .profile-page {
          min-height: 100vh;
          padding: clamp(14px, 3vw, 30px);
          padding-bottom: 190px;
          background:
            radial-gradient(circle at top left, rgba(37,99,235,.12), transparent 30%),
            linear-gradient(180deg, #f8fafc 0%, #eef2ff 48%, #f8fafc 100%);
          box-sizing: border-box;
          font-family: Inter, Segoe UI, Arial, sans-serif;
        }

        .profile-container {
          width: 100%;
          max-width: 1220px;
          margin: 0 auto;
        }

        .profile-hero {
          position: relative;
          overflow: hidden;
          border-radius: 34px;
          padding: clamp(22px, 4vw, 42px);
          color: #fff;
          background: linear-gradient(135deg, #020617 0%, #0f172a 36%, #1d4ed8 100%);
          box-shadow: 0 30px 80px rgba(15,23,42,.28);
        }

        .profile-hero::before {
          content: "";
          position: absolute;
          width: 320px;
          height: 320px;
          right: -90px;
          top: -110px;
          border-radius: 999px;
          background: rgba(59,130,246,.45);
          filter: blur(10px);
        }

        .profile-hero::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px);
          background-size: 34px 34px;
          opacity: .35;
        }

        .profile-main {
          position: relative;
          z-index: 2;
        }

        .profile-identity {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .profile-avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .profile-avatar {
          width: 122px;
          height: 122px;
          border-radius: 32px;
          background: linear-gradient(135deg, #ffffff 0%, #dbeafe 100%);
          color: #1e3a8a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          font-weight: 950;
          box-shadow: 0 24px 60px rgba(0,0,0,.26);
          border: 1px solid rgba(255,255,255,.65);
        }

        .profile-verified {
          position: absolute;
          right: -10px;
          bottom: -10px;
          width: 40px;
          height: 40px;
          border-radius: 16px;
          background: #22c55e;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid rgba(255,255,255,.85);
        }

        .profile-kicker {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 13px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.18);
          color: rgba(255,255,255,.82);
          font-size: 13px;
          font-weight: 800;
        }

        .profile-name {
          margin: 16px 0 14px;
          font-size: clamp(30px, 4.8vw, 54px);
          line-height: 1.04;
          font-weight: 950;
          letter-spacing: -1.2px;
        }

        .profile-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .profile-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.18);
          color: #fff;
          font-weight: 800;
          font-size: 13px;
        }

        .profile-pill.active {
          background: rgba(34,197,94,.18);
          border-color: rgba(134,239,172,.35);
          color: #dcfce7;
        }

        .profile-stats {
          margin-top: 34px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 14px;
        }

        .profile-stat {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 16px;
          border-radius: 22px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.16);
          backdrop-filter: blur(14px);
        }

        .profile-stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,.16);
          color: #fff;
          flex-shrink: 0;
        }

        .profile-stat-label {
          display: block;
          font-size: 11px;
          color: rgba(255,255,255,.64);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .6px;
        }

        .profile-stat-value {
          display: block;
          margin-top: 4px;
          color: #fff;
          font-size: 15px;
          font-weight: 900;
          word-break: break-word;
        }

        .profile-grid {
          margin-top: 22px;
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(300px, .85fr);
          gap: 20px;
          align-items: start;
        }

        .profile-column {
          display: grid;
          gap: 20px;
        }

        .profile-panel {
          background: rgba(255,255,255,.94);
          border: 1px solid rgba(226,232,240,.9);
          border-radius: 28px;
          padding: 22px;
          box-shadow: 0 20px 50px rgba(15,23,42,.08);
        }

        .profile-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          margin-bottom: 18px;
        }

        .profile-panel-kicker {
          margin: 0;
          color: #2563eb;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: .7px;
        }

        .profile-panel-title {
          margin: 5px 0 0;
          color: #0f172a;
          font-size: 22px;
          font-weight: 950;
          letter-spacing: -.4px;
        }

        .profile-panel-icon {
          width: 52px;
          height: 52px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #1d4ed8;
          flex-shrink: 0;
        }

        .profile-info-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 14px;
        }

        .profile-info-row {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 15px;
          border-radius: 20px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .profile-info-icon {
          width: 44px;
          height: 44px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          color: #2563eb;
          box-shadow: 0 10px 22px rgba(15,23,42,.06);
          flex-shrink: 0;
        }

        .profile-info-label {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .5px;
        }

        .profile-info-value {
          display: block;
          margin-top: 4px;
          color: #0f172a;
          font-size: 15px;
          font-weight: 900;
          word-break: break-word;
        }

        .assignment-box {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-radius: 24px;
          overflow: hidden;
          background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
          border: 1px solid #dbeafe;
        }

        .assignment-item {
          padding: 20px;
          min-width: 0;
        }

        .assignment-item span {
          display: block;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .5px;
          margin-bottom: 8px;
        }

        .assignment-item strong {
          color: #0f172a;
          font-size: 18px;
          font-weight: 950;
          word-break: break-word;
        }

        .assignment-item + .assignment-item {
          border-left: 1px solid #dbeafe;
        }

        .status-card {
          border-radius: 28px;
          padding: 22px;
          color: #fff;
          background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%);
          box-shadow: 0 24px 60px rgba(29,78,216,.22);
        }

        .status-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .status-kicker {
          margin: 0;
          color: rgba(255,255,255,.68);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .6px;
        }

        .status-title {
          margin: 6px 0 0;
          font-size: 24px;
          font-weight: 950;
        }

        .status-icon {
          width: 54px;
          height: 54px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,.14);
          flex-shrink: 0;
        }

        .status-check {
          margin-top: 24px;
          width: 64px;
          height: 64px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(34,197,94,.18);
          color: #bbf7d0;
          border: 1px solid rgba(134,239,172,.35);
        }

        .status-text {
          margin: 16px 0 0;
          color: rgba(255,255,255,.78);
          line-height: 1.7;
          font-size: 14px;
        }

        .action-panel {
          border-radius: 28px;
          padding: 20px;
          background: #fff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 20px 50px rgba(15,23,42,.08);
        }

        .action-header {
          display: flex;
          gap: 13px;
          align-items: flex-start;
          color: #0f172a;
        }

        .action-header h3 {
          margin: 0 0 6px;
          font-size: 20px;
          font-weight: 950;
        }

        .action-header p {
          margin: 0;
          color: #64748b;
          line-height: 1.6;
        }

        .action-button {
          margin-top: 18px;
          width: 100%;
          min-height: 50px;
          border: none;
          border-radius: 18px;
          background: #0f172a;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 900;
          cursor: pointer;
        }

        .logout-button {
          width: 100%;
          min-height: 58px;
          border: none;
          border-radius: 20px;
          background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 18px 36px rgba(239,68,68,.24);
        }

        @media (max-width: 900px) {
          .profile-grid {
            grid-template-columns: 1fr;
          }

          .profile-right {
            order: 2;
          }

          .profile-left {
            order: 1;
          }
        }

        @media (max-width: 640px) {
          .profile-page {
            padding: 14px;
            padding-bottom: 190px;
          }

          .profile-hero {
            border-radius: 28px;
            padding: 22px;
          }

          .profile-identity {
            align-items: flex-start;
            gap: 16px;
          }

          .profile-avatar {
            width: 82px;
            height: 82px;
            border-radius: 24px;
            font-size: 27px;
          }

          .profile-verified {
            width: 32px;
            height: 32px;
            border-radius: 12px;
          }

          .profile-kicker {
            font-size: 11px;
            padding: 8px 11px;
          }

          .profile-name {
            font-size: 29px;
            letter-spacing: -.7px;
          }

          .profile-pill {
            width: 100%;
            justify-content: center;
          }

          .profile-stats {
            grid-template-columns: 1fr;
            margin-top: 24px;
          }

          .profile-grid {
            gap: 16px;
          }

          .profile-panel,
          .status-card,
          .action-panel {
            border-radius: 24px;
            padding: 18px;
          }

          .profile-panel-title {
            font-size: 20px;
          }

          .profile-info-list {
            grid-template-columns: 1fr;
          }

          .assignment-box {
            grid-template-columns: 1fr;
          }

          .assignment-item {
            padding: 16px;
          }

          .assignment-item + .assignment-item {
            border-left: none;
            border-top: 1px solid #dbeafe;
          }

          .status-card {
            order: unset;
          }

          .status-title {
            font-size: 22px;
          }

          .action-header {
            align-items: flex-start;
          }

          .action-button {
            min-height: 54px;
          }

          .logout-button {
            min-height: 56px;
            margin-bottom: 20px;
          }
        }
      `}</style>

      <div className="profile-page">
        <div className="profile-container">
          <section className="profile-hero">
            <div className="profile-main">
              <div className="profile-identity">
                <div className="profile-avatar-wrap">
                  <div className="profile-avatar">{getInitials(profileName)}</div>
                  <div className="profile-verified">
                    <BadgeCheck size={18} />
                  </div>
                </div>

                <div>
                  <div className="profile-kicker">
                    <ShieldCheck size={15} />
                    Premium Employee Profile
                  </div>

                  <h1 className="profile-name">{valueOrDash(profileName)}</h1>

                  <div className="profile-pills">
                    <span className="profile-pill">
                      <CreditCard size={15} />
                      {valueOrDash(profileGasId)}
                    </span>

                    <span className="profile-pill">
                      <Briefcase size={15} />
                      {valueOrDash(profileRole)}
                    </span>

                    <span className="profile-pill active">
                      <BadgeCheck size={15} />
                      Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="profile-stats">
                {topCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div className="profile-stat" key={item.label}>
                      <div className="profile-stat-icon">
                        <Icon size={20} />
                      </div>
                      <div>
                        <span className="profile-stat-label">{item.label}</span>
                        <strong className="profile-stat-value">
                          {valueOrDash(item.value)}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="profile-grid">
            <div className="profile-column profile-left">
              <section className="profile-panel">
                <div className="profile-panel-header">
                  <div>
                    <p className="profile-panel-kicker">HR Profile</p>
                    <h2 className="profile-panel-title">Employee Information</h2>
                  </div>
                  <div className="profile-panel-icon">
                    <UserRound size={22} />
                  </div>
                </div>

                <div className="profile-info-list">
                  {infoRows.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div className="profile-info-row" key={item.label}>
                        <div className="profile-info-icon">
                          <Icon size={19} />
                        </div>
                        <div>
                          <span className="profile-info-label">{item.label}</span>
                          <strong className="profile-info-value">
                            {valueOrDash(item.value)}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="profile-panel">
                <div className="profile-panel-header">
                  <div>
                    <p className="profile-panel-kicker">Work Assignment</p>
                    <h2 className="profile-panel-title">Project Details</h2>
                  </div>
                  <div className="profile-panel-icon">
                    <FolderKanban size={22} />
                  </div>
                </div>

                <div className="assignment-box">
                  <div className="assignment-item">
                    <span>Project</span>
                    <strong>{valueOrDash(profileProject)}</strong>
                  </div>

                  <div className="assignment-item">
                    <span>Package</span>
                    <strong>{valueOrDash(profilePackage)}</strong>
                  </div>

                  <div className="assignment-item">
                    <span>Division</span>
                    <strong>{valueOrDash(profileDivision)}</strong>
                  </div>
                </div>
              </section>
            </div>

            <div className="profile-column profile-right">
              <section className="status-card">
                <div className="status-top">
                  <div>
                    <p className="status-kicker">Account Status</p>
                    <h2 className="status-title">Verified Access</h2>
                  </div>
                  <div className="status-icon">
                    <ShieldCheck size={26} />
                  </div>
                </div>

                <div className="status-check">
                  <BadgeCheck size={34} />
                </div>

                <p className="status-text">
                  Your account is active and connected with the HR portal access profile.
                </p>
              </section>

              <section className="action-panel">
                <div className="action-header">
                  <Headphones size={22} />
                  <div>
                    <h3>Need changes?</h3>
                    <p>Request HR to update your profile data.</p>
                  </div>
                </div>

                <button type="button" className="action-button">
                  Request Data Update
                  <ChevronRight size={18} />
                </button>
              </section>

              <button type="button" onClick={logout} className="logout-button">
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
