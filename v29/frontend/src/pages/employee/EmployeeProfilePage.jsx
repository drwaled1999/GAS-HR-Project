import {
  BadgeCheck,
  Briefcase,
  Building2,
  CreditCard,
  FolderKanban,
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

    if (parts.length === 1) {
      return parts[0][0].toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const profileName =
    user?.name ||
    user?.fullName ||
    user?.username ||
    "Employee";

  const profileGasId =
    user?.gasId ||
    user?.employeeCode ||
    user?.gas_id ||
    "-";

  const profileRole =
    user?.role ||
    user?.roleName ||
    "Employee";

  const profileDivision =
    user?.division ||
    user?.nationalityType ||
    user?.department ||
    "-";

  const profileProject =
    user?.projectName ||
    user?.project ||
    user?.projectId ||
    "-";

  const profilePackage =
    user?.packageName ||
    user?.package ||
    user?.packageId ||
    "-";

  const cards = [
    {
      label: "GAS ID",
      value: profileGasId,
      icon: CreditCard,
    },
    {
      label: "Role",
      value: profileRole,
      icon: Briefcase,
    },
    {
      label: "Division",
      value: profileDivision,
      icon: Building2,
    },
    {
      label: "Project",
      value: profileProject,
      icon: FolderKanban,
    },
    {
      label: "Package",
      value: profilePackage,
      icon: Package,
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <section style={styles.hero}>
          <div style={styles.heroGlow}></div>

          <div style={styles.avatarWrapper}>
            <div style={styles.avatar}>
              {getInitials(profileName)}
            </div>

            <div style={styles.verifiedBadge}>
              <BadgeCheck size={18} />
            </div>
          </div>

          <div style={styles.heroContent}>
            <p style={styles.subTitle}>Employee Profile</p>

            <h1 style={styles.name}>
              {valueOrDash(profileName)}
            </h1>

            <div style={styles.roleBadge}>
              <ShieldCheck size={16} />
              <span>{valueOrDash(profileRole)}</span>
            </div>
          </div>
        </section>

        <section style={styles.cardsGrid}>
          {cards.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} style={styles.infoCard}>
                <div style={styles.iconBox}>
                  <Icon size={22} />
                </div>

                <div style={styles.cardContent}>
                  <span style={styles.cardLabel}>
                    {item.label}
                  </span>

                  <strong style={styles.cardValue}>
                    {valueOrDash(item.value)}
                  </strong>
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
            <h3 style={styles.summaryTitle}>
              Account Information
            </h3>

            <p style={styles.summaryText}>
              Your profile data is linked with the HR system.
              If you need any updates to your personal or work
              information, please submit a data update request
              through the system.
            </p>
          </div>
        </section>

        <button
          type="button"
          onClick={logout}
          style={styles.logoutButton}
        >
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
    boxSizing: "border-box",
    fontFamily: "Inter, Segoe UI, sans-serif",
  },

  container: {
    width: "100%",
    maxWidth: "1200px",
    margin: "0 auto",
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    minHeight: "260px",
    borderRadius: "28px",
    padding: "clamp(24px, 4vw, 42px)",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #2563eb 100%)",
    display: "flex",
    alignItems: "center",
    gap: "24px",
    flexWrap: "wrap",
    boxShadow: "0 25px 60px rgba(15,23,42,.22)",
  },

  heroGlow: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(circle at top right, rgba(255,255,255,.25), transparent 30%), radial-gradient(circle at bottom left, rgba(96,165,250,.30), transparent 35%)",
    pointerEvents: "none",
  },

  avatarWrapper: {
    position: "relative",
    zIndex: 2,
  },

  avatar: {
    width: "110px",
    height: "110px",
    borderRadius: "28px",
    background: "#ffffff",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "34px",
    fontWeight: "900",
    boxShadow: "0 20px 45px rgba(0,0,0,.18)",
  },

  verifiedBadge: {
    position: "absolute",
    bottom: "-8px",
    right: "-8px",
    width: "36px",
    height: "36px",
    borderRadius: "14px",
    background: "#22c55e",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  heroContent: {
    position: "relative",
    zIndex: 2,
    flex: 1,
    minWidth: "250px",
  },

  subTitle: {
    margin: 0,
    color: "rgba(255,255,255,.75)",
    textTransform: "uppercase",
    fontWeight: "800",
    fontSize: "13px",
    letterSpacing: "1px",
  },

  name: {
    margin: "10px 0",
    color: "#fff",
    fontWeight: "900",
    fontSize: "clamp(28px, 4vw, 46px)",
    lineHeight: 1.1,
  },

  roleBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "999px",
    background: "rgba(255,255,255,.15)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.25)",
    backdropFilter: "blur(10px)",
    fontWeight: "700",
  },

  cardsGrid: {
    marginTop: "22px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },

  infoCard: {
    background: "#ffffff",
    borderRadius: "22px",
    padding: "18px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    boxShadow: "0 16px 35px rgba(15,23,42,.08)",
    border: "1px solid #e2e8f0",
  },

  iconBox: {
    width: "48px",
    height: "48px",
    borderRadius: "16px",
    background: "#eff6ff",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  cardContent: {
    minWidth: 0,
  },

  cardLabel: {
    display: "block",
    fontSize: "12px",
    fontWeight: "800",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: ".5px",
  },

  cardValue: {
    display: "block",
    marginTop: "4px",
    fontSize: "16px",
    color: "#0f172a",
    wordBreak: "break-word",
  },

  summaryCard: {
    marginTop: "20px",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "22px",
    display: "flex",
    gap: "16px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 16px 35px rgba(15,23,42,.08)",
  },

  summaryIcon: {
    width: "52px",
    height: "52px",
    borderRadius: "18px",
    background: "#f8fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#0f172a",
    flexShrink: 0,
  },

  summaryTitle: {
    margin: "0 0 8px",
    fontSize: "18px",
    color: "#0f172a",
    fontWeight: "800",
  },

  summaryText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.7,
    fontSize: "14px",
  },

  logoutButton: {
    marginTop: "20px",
    width: "100%",
    minHeight: "54px",
    border: "none",
    borderRadius: "18px",
    background: "#ef4444",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontSize: "15px",
    fontWeight: "800",
    cursor: "pointer",
    boxShadow: "0 15px 30px rgba(239,68,68,.22)",
  },
};
