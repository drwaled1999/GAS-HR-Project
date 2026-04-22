import { useAuth } from "../../context/AuthContext";

export default function EmployeeProfilePage() {
  const { user, logout } = useAuth();

  function valueOrDash(value) {
    if (value === null || value === undefined) return "-";
    if (String(value).trim() === "") return "-";
    return String(value);
  }

  function getInitials(name) {
    const safeName = valueOrDash(name);
    if (safeName === "-") return "E";
    const parts = safeName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  const profileName = user?.name || user?.fullName || user?.username || "-";
  const profileGasId = user?.gasId || user?.employeeCode || "-";
  const profileRole = user?.role || user?.roleName || "Employee";
  const profileDivision = user?.division || user?.nationalityType || "-";
  const profileProject = user?.projectName || user?.project || user?.projectId || "-";
  const profilePackage = user?.packageName || user?.package || user?.packageId || "-";

  function InfoCard({ label, value, icon, accent }) {
    return (
      <div style={styles.infoCard}>
        <div style={{ ...styles.infoIconWrap, background: accent }}>
          {icon}
        </div>
        <div>
          <div style={styles.infoLabel}>{label}</div>
          <div style={styles.infoValue}>{valueOrDash(value)}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>

      {/* HEADER */}
      <div style={styles.hero}>
        <div style={styles.avatar}>{getInitials(profileName)}</div>
        <h2 style={styles.name}>{profileName}</h2>
        <p style={styles.role}>{profileRole}</p>
      </div>

      {/* INFO */}
      <div style={styles.section}>
        <InfoCard label="GAS ID" value={profileGasId} icon="🪪" accent="#eef2ff" />
        <InfoCard label="Role" value={profileRole} icon="💼" accent="#ecfeff" />
        <InfoCard label="Division" value={profileDivision} icon="🏢" accent="#f0fdf4" />
        <InfoCard label="Project" value={profileProject} icon="📁" accent="#fff7ed" />
        <InfoCard label="Package" value={profilePackage} icon="📦" accent="#faf5ff" />
      </div>

      {/* LOGOUT */}
      <button onClick={logout} style={styles.logout}>Logout</button>

    </div>
  );
}

const styles = {
  page: {
    padding: 16,
    background: "#f5f7fc",
    minHeight: "100vh",
    fontFamily: "Segoe UI",
  },
  hero: {
    background: "linear-gradient(135deg,#1e3a8a,#2563eb)",
    borderRadius: 20,
    padding: 20,
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: "50%",
    background: "#fff",
    color: "#1e3a8a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: 22,
    margin: "0 auto 10px",
  },
  name: { margin: 0 },
  role: { opacity: 0.8 },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  infoCard: {
    display: "flex",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    background: "#fff",
    alignItems: "center",
  },
  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 12,
    color: "#888",
  },
  infoValue: {
    fontWeight: "bold",
  },
  logout: {
    marginTop: 20,
    width: "100%",
    padding: 14,
    borderRadius: 12,
    border: "none",
    background: "#fee2e2",
    color: "#dc2626",
    fontWeight: "bold",
  },
};
