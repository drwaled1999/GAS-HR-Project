import { useAuth } from "../../context/AuthContext";

function valueOrDash(value) {
  if (value === null || value === undefined) return "-";
  if (String(value).trim() === "") return "-";
  return String(value);
}

function getInitials(name) {
  const safeName = valueOrDash(name);
  if (safeName === "-") return "E";

  const parts = safeName.trim().split(" ");
  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
}

export default function EmployeeProfilePage() {
  const { user, logout } = useAuth();

  const profileName =
    user?.name ||
    user?.fullName ||
    user?.username ||
    "-";

  const profileGasId =
    user?.gasId ||
    user?.employeeCode ||
    "-";

  const profileRole =
    user?.role ||
    user?.roleName ||
    "Employee";

  const profileDivision =
    user?.division ||
    user?.nationalityType ||
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

  return (
    <div style={styles.page}>
      
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.avatarBox}>
          <div style={styles.avatar}>
            {getInitials(profileName)}
          </div>
          <span style={styles.status}></span>
        </div>

        <div>
          <h2 style={styles.name}>{valueOrDash(profileName)}</h2>
          <p style={styles.role}>{valueOrDash(profileRole)}</p>
        </div>
      </div>

      {/* CARD */}
      <div style={styles.card}>

        <Row label="GAS ID" value={profileGasId} icon="🪪" />
        <Row label="Role" value={profileRole} icon="💼" />
        <Row label="Division" value={profileDivision} icon="🏢" />
        <Row label="Project" value={profileProject} icon="📁" />
        <Row label="Package" value={profilePackage} icon="📦" />

        <button onClick={logout} style={styles.logout}>
          ↪ Logout
        </button>

      </div>
    </div>
  );
}

/* Row Component */
function Row({ label, value, icon }) {
  return (
    <div style={styles.row}>
      <div style={styles.left}>
        <div style={styles.icon}>{icon}</div>
        <span style={styles.label}>{label}</span>
      </div>
      <strong style={styles.value}>{valueOrDash(value)}</strong>
    </div>
  );
}

/* STYLES */
const styles = {
  page: {
    padding: "16px",
    background: "#f5f7fc",
    minHeight: "100vh",
    fontFamily: "Segoe UI",
  },

  header: {
    background: "linear-gradient(135deg,#2563eb,#1e40af)",
    borderRadius: "20px",
    padding: "20px",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: "15px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
  },

  avatarBox: {
    position: "relative",
  },

  avatar: {
    width: "65px",
    height: "65px",
    borderRadius: "50%",
    background: "#fff",
    color: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "22px",
  },

  status: {
    position: "absolute",
    bottom: "3px",
    right: "3px",
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    background: "#22c55e",
    border: "2px solid #fff",
  },

  name: {
    margin: 0,
    fontSize: "20px",
  },

  role: {
    margin: 0,
    opacity: 0.8,
  },

  card: {
    marginTop: "-20px",
    background: "#fff",
    borderRadius: "20px",
    padding: "15px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px",
    borderRadius: "12px",
    marginBottom: "10px",
    border: "1px solid #eee",
  },

  left: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  icon: {
    background: "#eef2ff",
    padding: "8px",
    borderRadius: "10px",
  },

  label: {
    color: "#555",
  },

  value: {
    fontWeight: "bold",
  },

  logout: {
    marginTop: "15px",
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    background: "#fee2e2",
    color: "#dc2626",
    fontWeight: "bold",
    cursor: "pointer",
  },
};
