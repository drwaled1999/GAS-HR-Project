import {
  Activity,
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
  Sparkles,
  UserRound,
} from "lucide-react";
import { motion } from "framer-motion";
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

  const profileEmail =
    user?.email ||
    user?.workEmail ||
    user?.username ||
    "-";

  const profileNationality =
    user?.nationality ||
    user?.nationalityName ||
    "-";

  const topCards = [
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

  const infoRows = [
    {
      label: "Employee Name",
      value: profileName,
      icon: UserRound,
    },
    {
      label: "Email / Username",
      value: profileEmail,
      icon: Mail,
    },
    {
      label: "Division",
      value: profileDivision,
      icon: Building2,
    },
    {
      label: "Nationality",
      value: profileNationality,
      icon: Globe2,
    },
  ];

  return (
    <div style={styles.page}>
      <motion.div
        style={styles.container}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <section style={styles.hero}>
          <div style={styles.heroOrbOne} />
          <div style={styles.heroOrbTwo} />
          <div style={styles.heroGrid} />

          <div style={styles.heroTop}>
            <div style={styles.profileBlock}>
              <div style={styles.avatarWrap}>
                <div style={styles.avatar}>
                  {getInitials(profileName)}
                </div>

                <div style={styles.verified}>
                  <BadgeCheck size={18} />
                </div>
              </div>

              <div style={styles.identity}>
                <div style={styles.kicker}>
                  <Sparkles size={15} />
                  Premium Employee Profile
                </div>

                <h1 style={styles.name}>
                  {valueOrDash(profileName)}
                </h1>

                <div style={styles.metaRow}>
                  <span style={styles.metaPill}>
                    <CreditCard size={15} />
                    {valueOrDash(profileGasId)}
                  </span>

                  <span style={styles.metaPill}>
                    <ShieldCheck size={15} />
                    {valueOrDash(profileRole)}
                  </span>

                  <span style={styles.activePill}>
                    <Activity size={15} />
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.heroBottom}>
            {topCards.map((item, index) => {
              const Icon = item.icon;

              return (
                <motion.div
                  key={item.label}
                  style={styles.heroStat}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: 0.1 + index * 0.05,
                  }}
                >
                  <div style={styles.heroStatIcon}>
                    <Icon size={20} />
                  </div>

                  <div>
                    <span style={styles.heroStatLabel}>
                      {item.label}
                    </span>
                    <strong style={styles.heroStatValue}>
                      {valueOrDash(item.value)}
                    </strong>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section style={styles.mainGrid}>
          <div style={styles.leftColumn}>
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <p style={styles.panelKicker}>HR Profile</p>
                  <h2 style={styles.panelTitle}>
                    Employee Information
                  </h2>
                </div>
                <div style={styles.panelIcon}>
                  <UserRound size={22} />
                </div>
              </div>

              <div style={styles.infoList}>
                {infoRows.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.label} style={styles.infoRow}>
                      <div style={styles.infoIcon}>
                        <Icon size={19} />
                      </div>

                      <div style={styles.infoText}>
                        <span style={styles.infoLabel}>
                          {item.label}
                        </span>
                        <strong style={styles.infoValue}>
                          {valueOrDash(item.value)}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <p style={styles.panelKicker}>Work Assignment</p>
                  <h2 style={styles.panelTitle}>
                    Project Details
                  </h2>
                </div>
                <div style={styles.panelIconBlue}>
                  <FolderKanban size={22} />
                </div>
              </div>

              <div style={styles.assignmentCard}>
                <div style={styles.assignmentItem}>
                  <span>Project</span>
                  <strong>{valueOrDash(profileProject)}</strong>
                </div>

                <div style={styles.assignmentDivider} />

                <div style={styles.assignmentItem}>
                  <span>Package</span>
                  <strong>{valueOrDash(profilePackage)}</strong>
                </div>

                <div style={styles.assignmentDivider} />

                <div style={styles.assignmentItem}>
                  <span>Division</span>
                  <strong>{valueOrDash(profileDivision)}</strong>
                </div>
              </div>
            </section>
          </div>

          <div style={styles.rightColumn}>
            <section style={styles.statusCard}>
              <div style={styles.statusTop}>
                <div>
                  <p style={styles.statusKicker}>Account Status</p>
                  <h2 style={styles.statusTitle}>Verified Access</h2>
                </div>
                <div style={styles.statusIcon}>
                  <ShieldCheck size={26} />
                </div>
              </div>

              <div style={styles.statusBody}>
                <div style={styles.bigCheck}>
                  <BadgeCheck size={34} />
                </div>

                <p style={styles.statusText}>
                  Your account is active and connected with the HR
                  portal access profile.
                </p>
              </div>
            </section>

            <section style={styles.actionPanel}>
              <div style={styles.actionHeader}>
                <Headphones size={21} />
                <div>
                  <h3>Need changes?</h3>
                  <p>Request HR to update your profile data.</p>
                </div>
              </div>

              <button type="button" style={styles.actionButton}>
                Request Data Update
                <ChevronRight size={18} />
              </button>
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
        </section>
      </motion.div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "clamp(14px, 3vw, 30px)",
    paddingBottom: "180px",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,.12), transparent 30%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 48%, #f8fafc 100%)",
    boxSizing: "border-box",
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
  },

  container: {
    width: "100%",
    maxWidth: "1220px",
    margin: "0 auto",
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "34px",
    padding: "clamp(22px, 4vw, 42px)",
    minHeight: "360px",
    color: "#fff",
    background:
      "linear-gradient(135deg, #020617 0%, #0f172a 36%, #1d4ed8 100%)",
    boxShadow: "0 30px 80px rgba(15,23,42,.28)",
  },

  heroOrbOne: {
    position: "absolute",
    width: "320px",
    height: "320px",
    right: "-90px",
    top: "-110px",
    borderRadius: "999px",
    background: "rgba(59,130,246,.45)",
    filter: "blur(10px)",
  },

  heroOrbTwo: {
    position: "absolute",
    width: "260px",
    height: "260px",
    left: "-100px",
    bottom: "-120px",
    borderRadius: "999px",
    background: "rgba(14,165,233,.28)",
    filter: "blur(10px)",
  },

  heroGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)",
    backgroundSize: "34px 34px",
    maskImage:
      "linear-gradient(180deg, rgba(0,0,0,.75), transparent)",
    opacity: 0.45,
  },

  heroTop: {
    position: "relative",
    zIndex: 2,
  },

  profileBlock: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
    flexWrap: "wrap",
  },

  avatarWrap: {
    position: "relative",
    flexShrink: 0,
  },

  avatar: {
    width: "122px",
    height: "122px",
    borderRadius: "32px",
    background:
      "linear-gradient(135deg, #ffffff 0%, #dbeafe 100%)",
    color: "#1e3a8a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "38px",
    fontWeight: "950",
    boxShadow: "0 24px 60px rgba(0,0,0,.26)",
    border: "1px solid rgba(255,255,255,.65)",
  },

  verified: {
    position: "absolute",
    right: "-10px",
    bottom: "-10px",
    width: "40px",
    height: "40px",
    borderRadius: "16px",
    background: "#22c55e",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 14px 30px rgba(34,197,94,.35)",
    border: "3px solid rgba(255,255,255,.85)",
  },

  identity: {
    flex: 1,
    minWidth: "250px",
  },

  kicker: {
    width: "fit-content",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "9px 13px",
    borderRadius: "999px",
    background: "rgba(255,255,255,.12)",
    border: "1px solid rgba(255,255,255,.18)",
    color: "rgba(255,255,255,.82)",
    fontSize: "13px",
    fontWeight: "800",
    backdropFilter: "blur(12px)",
  },

  name: {
    margin: "16px 0 14px",
    fontSize: "clamp(30px, 4.8vw, 54px)",
    lineHeight: 1.04,
    fontWeight: "950",
    letterSpacing: "-1.4px",
  },

  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },

  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(255,255,255,.12)",
    border: "1px solid rgba(255,255,255,.18)",
    color: "#fff",
    fontWeight: "800",
    fontSize: "13px",
    backdropFilter: "blur(12px)",
  },

  activePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(34,197,94,.18)",
    border: "1px solid rgba(134,239,172,.35)",
    color: "#dcfce7",
    fontWeight: "900",
    fontSize: "13px",
    backdropFilter: "blur(12px)",
  },

  heroBottom: {
    position: "relative",
    zIndex: 2,
    marginTop: "34px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
  },

  heroStat: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
    padding: "16px",
    borderRadius: "22px",
    background: "rgba(255,255,255,.12)",
    border: "1px solid rgba(255,255,255,.16)",
    backdropFilter: "blur(14px)",
  },

  heroStatIcon: {
    width: "46px",
    height: "46px",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,.16)",
    color: "#fff",
    flexShrink: 0,
  },

  heroStatLabel: {
    display: "block",
    fontSize: "11px",
    color: "rgba(255,255,255,.64)",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: ".6px",
  },

  heroStatValue: {
    display: "block",
    marginTop: "4px",
    color: "#fff",
    fontSize: "15px",
    fontWeight: "900",
    wordBreak: "break-word",
  },

  mainGrid: {
    marginTop: "22px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(300px, .8fr)",
    gap: "20px",
  },

  leftColumn: {
    display: "grid",
    gap: "20px",
  },

  rightColumn: {
    display: "grid",
    gap: "20px",
    alignContent: "start",
  },

  panel: {
    background: "rgba(255,255,255,.92)",
    border: "1px solid rgba(226,232,240,.9)",
    borderRadius: "28px",
    padding: "22px",
    boxShadow: "0 20px 50px rgba(15,23,42,.08)",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    marginBottom: "18px",
  },

  panelKicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: "950",
    textTransform: "uppercase",
    letterSpacing: ".7px",
  },

  panelTitle: {
    margin: "5px 0 0",
    color: "#0f172a",
    fontSize: "22px",
    fontWeight: "950",
    letterSpacing: "-.4px",
  },

  panelIcon: {
    width: "52px",
    height: "52px",
    borderRadius: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8fafc",
    color: "#0f172a",
  },

  panelIconBlue: {
    width: "52px",
    height: "52px",
    borderRadius: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eff6ff",
    color: "#1d4ed8",
  },

  infoList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "14px",
  },

  infoRow: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
    padding: "15px",
    borderRadius: "20px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  infoIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "15px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    color: "#2563eb",
    boxShadow: "0 10px 22px rgba(15,23,42,.06)",
    flexShrink: 0,
  },

  infoText: {
    minWidth: 0,
  },

  infoLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: ".5px",
  },

  infoValue: {
    display: "block",
    marginTop: "4px",
    color: "#0f172a",
    fontSize: "15px",
    fontWeight: "900",
    wordBreak: "break-word",
  },

  assignmentCard: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    borderRadius: "24px",
    overflow: "hidden",
    background:
      "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
  },

  assignmentItem: {
    padding: "20px",
  },

  assignmentDivider: {
    width: "1px",
    background: "#dbeafe",
  },

  statusCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "28px",
    padding: "22px",
    color: "#fff",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)",
    boxShadow: "0 24px 60px rgba(29,78,216,.22)",
  },

  statusTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
  },

  statusKicker: {
    margin: 0,
    color: "rgba(255,255,255,.68)",
    fontSize: "12px",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: ".6px",
  },

  statusTitle: {
    margin: "6px 0 0",
    fontSize: "24px",
    fontWeight: "950",
  },

  statusIcon: {
    width: "54px",
    height: "54px",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,.14)",
  },

  statusBody: {
    marginTop: "24px",
  },

  bigCheck: {
    width: "64px",
    height: "64px",
    borderRadius: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(34,197,94,.18)",
    color: "#bbf7d0",
    border: "1px solid rgba(134,239,172,.35)",
  },

  statusText: {
    margin: "16px 0 0",
    color: "rgba(255,255,255,.78)",
    lineHeight: 1.7,
    fontSize: "14px",
  },

  actionPanel: {
    borderRadius: "28px",
    padding: "20px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 50px rgba(15,23,42,.08)",
  },

  actionHeader: {
    display: "flex",
    gap: "13px",
    alignItems: "flex-start",
    color: "#0f172a",
  },

  actionButton: {
    marginTop: "18px",
    width: "100%",
    minHeight: "50px",
    border: "none",
    borderRadius: "18px",
    background: "#0f172a",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    fontWeight: "900",
    cursor: "pointer",
  },

  logoutButton: {
    width: "100%",
    minHeight: "58px",
    border: "none",
    borderRadius: "20px",
    background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontSize: "15px",
    fontWeight: "950",
    cursor: "pointer",
    boxShadow: "0 18px 36px rgba(239,68,68,.24)",
  },
};
