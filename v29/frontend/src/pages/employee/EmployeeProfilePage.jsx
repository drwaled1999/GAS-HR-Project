import {
  BadgeCheck,
  Briefcase,
  Building2,
  FolderKanban,
  IdCard,
  LogOut,
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

  const profileName = user?.name || user?.fullName || user?.username || "-";
  const profileGasId = user?.gasId || user?.employeeCode || "-";
  const profileRole = user?.role || user?.roleName || "Employee";
  const profileDivision = user?.division || user?.nationalityType || "-";
  const profileProject = user?.projectName || user?.project || user?.projectId || "-";
  const profilePackage = user?.packageName || user?.package || user?.packageId || "-";

  const cards = [
    { label: "GAS ID", value: profileGasId, icon: IdCard },
    { label: "Role", value: profileRole, icon: Briefcase },
    { label: "Division", value: profileDivision, icon: Building2 },
    { label: "Project", value: profileProject, icon: FolderKanban },
    { label: "Package", value: profilePackage, icon: Package },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <section style={styles.hero}>
          <div style={styles.heroPattern} />

          <div style={styles.avatarWrap}>
            <div style={styles.avatar}>{getInitials(profileName)}</div>
            <div style={styles.verified}>
              <BadgeCheck size={18} />
            </div>
          </div>

          <div style={styles.heroContent}>
            <p style={styles.kicker}>Employee Profile</p>
            <h1 style={styles.name}>{profileName}</h1>
            <div style={styles.rolePill}>
              <ShieldCheck size={16} />
              {profileRole}
            </div>
          </div>
        </section>

        <section style={styles.grid}>
          {cards.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} style={styles.card}>
                <div style={styles.iconBox}>
                  <Icon size={22} />
                </div>
                <div style={styles.cardText}>
                  <span style={styles.label}>{item.label}</span>
                  <strong style={styles.value}>{valueOrDash(item.value)}</strong>
                </div>
              </div>
            );
          })}
        </section>

        <section style={styles.summaryCard}>
          <div style={styles.summaryIcon}>
            <UserRound size={24} />
          </div>
          <div>
            <h3 style={styles.summaryTitle}>Account Information</h3>
            <p style={styles.summaryText}>
              Your profile information is linked to the HR system. For any data update,
              please submit an employee data update request or contact HR.
            </p>
          </div>
        </section>

        <button type="button" onClick={logout} style={styles.logout}>
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "clamp(14px, 3vw, 28px)",
    background:
      "linear-gradient(180deg, #f8fafc 0%, #eef2ff 45%, #f8fafc 100%)",
    fontFamily:
      "Inter, Segoe UI, Tahoma, Arial, sans-serif",
    boxSizing: "border-box",
  },
  container: {
    width: "100%",
    maxWidth: 1100,
    margin: "0 auto",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    minHeight: 250,
    borderRadius: 28,
    padding: "clamp(22px, 4vw, 38px)",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e3a8a 48%, #2563eb 100%)",
    color: "#fff",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
    display: "flex",
    alignItems: "center",
    gap: 24,
    flexWrap: "wrap",
  },
  heroPattern: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at top right, rgba(255,255,255,.28), transparent 28%), radial-gradient(circle at bottom left, rgba(96,165,250,.35), transparent 30%)",
    pointerEvents: "none",
  },
  avatarWrap: {
    position: "relative",
    zIndex: 1,
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: "28px",
    background: "rgba(255,255,255,.96)",
    color: "#1e3a8a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 34,
    boxShadow: "0 18px 40px rgba(0,0,0,.22)",
    border: "1px solid rgba(255,255,255,.55)",
  },
  verified: {
    position: "absolute",
    right: -8,
    bottom: -8,
    width: 36,
    height: 36,
    borderRadius: 14,
    background: "#22c55e",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 12px 22px rgba(34,197,94,.35)",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    flex: 1,
    minWidth: 230,
  },
  kicker: {
    margin: "0 0 8px",
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,.76)",
    fontWeight: 800,
  },
  name: {
    margin: 0,
    fontSize: "clamp(27px, 4vw, 44px)",
    lineHeight: 1.08,
    fontWeight: 900,
  },
  rolePill: {
    marginTop: 18,
    width: "fit-content",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,.14)",
    border: "1px solid rgba(255,255,255,.22)",
    color: "#fff",
    fontWeight: 800,
    backdropFilter: "blur(12px)",
  },
  grid: {
    marginTop: 22,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 22,
    background: "rgba(255,255,255,.86)",
    border: "1px solid rgba(226,232,240,.9)",
    boxShadow: "0 16px 35px rgba(15,23,42,.08)",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    background: "#eff6ff",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardText: {
    minWidth: 0,
  },
  label: {
    display: "block",
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    display: "block",
    marginTop: 4,
    color: "#0f172a",
    fontSize: 16,
    wordBreak: "break-word",
  },
  summaryCard: {
    marginTop: 18,
    padding: 20,
    borderRadius: 24,
    background: "#fff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 16px 35px rgba(15,23,42,.07)",
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
  },
  summaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    background: "#f8fafc",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  summaryTitle: {
    margin: "0 0 6px",
    fontSize: 18,
    color: "#0f172a",
  },
  summaryText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.7,
    fontSize: 14,
  },
  logout: {
    marginTop: 18,
    width: "100%",
    minHeight: 52,
    borderRadius: 18,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#be123c",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    boxShadow: "0 14px 28px rgba(190,18,60,.08)",
  },
};
