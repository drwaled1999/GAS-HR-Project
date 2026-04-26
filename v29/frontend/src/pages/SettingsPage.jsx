import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

export default function SettingsPage() {
  const { user } = useAuth();

  const [maintenance, setMaintenance] = useState(false);
  const [annualDefaultBalance, setAnnualDefaultBalance] = useState(30);
  const [sickDefaultBalance, setSickDefaultBalance] = useState(15);
  const [emergencyDefaultBalance, setEmergencyDefaultBalance] = useState(5);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  const canEditSettings = useMemo(() => {
    const role = normalizeRole(user?.role || user?.roleName || user?.roleCode);
    return ["system owner", "owner", "system_owner", "systemowner"].includes(role);
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const settingsResponse = await apiFetch("/settings");

      setMaintenance(Boolean(settingsResponse?.settings?.maintenanceMode));
      setAnnualDefaultBalance(
        Number(settingsResponse?.settings?.annualDefaultBalance ?? 30)
      );
      setSickDefaultBalance(
        Number(settingsResponse?.settings?.sickDefaultBalance ?? 15)
      );
      setEmergencyDefaultBalance(
        Number(settingsResponse?.settings?.emergencyDefaultBalance ?? 5)
      );
    } catch (err) {
      console.error("Settings page load error:", err);
      setError(err?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleToggle(enabled) {
    try {
      setSavingMaintenance(true);
      setError("");
      setMessage("");

      const response = await apiFetch("/settings/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      setMaintenance(Boolean(response?.settings?.maintenanceMode));
      setMessage(enabled ? "Maintenance mode enabled." : "Maintenance mode disabled.");
      await loadData();
    } catch (err) {
      console.error("Maintenance toggle error:", err);
      setError(err?.message || "Failed to update maintenance mode");
    } finally {
      setSavingMaintenance(false);
    }
  }

  async function handleSaveLeaveDefaults(e) {
    e.preventDefault();

    try {
      setSavingDefaults(true);
      setError("");
      setMessage("");

      await apiFetch("/settings/leave-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annualDefaultBalance: Number(annualDefaultBalance),
          sickDefaultBalance: Number(sickDefaultBalance),
          emergencyDefaultBalance: Number(emergencyDefaultBalance),
        }),
      });

      setMessage("Leave defaults saved successfully.");
      await loadData();
    } catch (err) {
      console.error("Save leave defaults error:", err);
      setError(err?.message || "Failed to save leave defaults");
    } finally {
      setSavingDefaults(false);
    }
  }

  const totalLeave =
    Number(annualDefaultBalance || 0) +
    Number(sickDefaultBalance || 0) +
    Number(emergencyDefaultBalance || 0);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <div>
            <h3 style={styles.loadingTitle}>Loading settings...</h3>
            <p style={styles.loadingText}>Please wait while system settings are loaded.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.badge}>HR Portal Control Center</div>
          <h1 style={styles.title}>System Settings</h1>
          <p style={styles.subtitle}>
            Manage maintenance mode, default leave balances, and system access rules.
          </p>
        </div>

        <div style={maintenance ? styles.statusDanger : styles.statusSuccess}>
          <span style={styles.statusDot} />
          {maintenance ? "Maintenance Active" : "System Online"}
        </div>
      </div>

      {!canEditSettings ? (
        <div style={styles.warningBox}>
          هذه الصفحة للعرض فقط. التعديل متاح لـ System Owner فقط.
        </div>
      ) : null}

      {message ? <div style={styles.successBox}>{message}</div> : null}
      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <div style={styles.layout}>
        <section style={styles.mainColumn}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Maintenance Mode</h2>
                <p style={styles.cardDesc}>
                  Control access to the HR Portal during updates or maintenance.
                </p>
              </div>

              <label style={styles.switch}>
                <input
                  type="checkbox"
                  checked={maintenance}
                  disabled={!canEditSettings || savingMaintenance}
                  onChange={(e) => handleToggle(e.target.checked)}
                  style={styles.hiddenInput}
                />
                <span
                  style={{
                    ...styles.slider,
                    ...(maintenance ? styles.sliderActive : {}),
                    ...(!canEditSettings || savingMaintenance ? styles.sliderDisabled : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.knob,
                      ...(maintenance ? styles.knobActive : {}),
                    }}
                  />
                </span>
              </label>
            </div>

            <div style={maintenance ? styles.maintenanceOn : styles.maintenanceOff}>
              <strong>{maintenance ? "Maintenance is enabled" : "Maintenance is disabled"}</strong>
              <span>
                {maintenance
                  ? "Only allowed users can access the system."
                  : "All authorized users can access the system normally."}
              </span>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Default Leave Balances</h2>
                <p style={styles.cardDesc}>
                  Set the default leave balance assigned to employee records.
                </p>
              </div>
            </div>

            <form style={styles.formGrid} onSubmit={handleSaveLeaveDefaults}>
              <label style={styles.field}>
                <span style={styles.label}>Annual Leave</span>
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  value={annualDefaultBalance}
                  disabled={!canEditSettings}
                  onChange={(e) => setAnnualDefaultBalance(e.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Sick Leave</span>
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  value={sickDefaultBalance}
                  disabled={!canEditSettings}
                  onChange={(e) => setSickDefaultBalance(e.target.value)}
                />
              </label>

              <label style={styles.field}>
                <span style={styles.label}>Emergency Leave</span>
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  value={emergencyDefaultBalance}
                  disabled={!canEditSettings}
                  onChange={(e) => setEmergencyDefaultBalance(e.target.value)}
                />
              </label>

              <button
                type="submit"
                style={{
                  ...styles.primaryButton,
                  ...(!canEditSettings || savingDefaults ? styles.buttonDisabled : {}),
                }}
                disabled={!canEditSettings || savingDefaults}
              >
                {savingDefaults ? "Saving..." : "Save Leave Defaults"}
              </button>
            </form>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Notes</h2>
            <p style={styles.noteText}>
              Approved leave requests will deduct automatically from employee balances.
              Annual, Sick, and Emergency leave balances are connected to the backend.
            </p>
          </div>
        </section>

        <aside style={styles.sideColumn}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Total Default Balance</span>
            <strong style={styles.summaryNumber}>{totalLeave}</strong>
            <span style={styles.summaryText}>days per employee</span>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Current Defaults</h2>

            <div style={styles.defaultList}>
              <div style={styles.defaultItem}>
                <span>Annual Leave</span>
                <strong>{annualDefaultBalance} days</strong>
              </div>
              <div style={styles.defaultItem}>
                <span>Sick Leave</span>
                <strong>{sickDefaultBalance} days</strong>
              </div>
              <div style={styles.defaultItem}>
                <span>Emergency Leave</span>
                <strong>{emergencyDefaultBalance} days</strong>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Access</h2>
            <div style={styles.accessBox}>
              <span>Current User</span>
              <strong>{user?.fullName || user?.username || "Unknown"}</strong>
            </div>
            <div style={styles.accessBox}>
              <span>Role</span>
              <strong>{user?.role || user?.roleName || user?.roleCode || "-"}</strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px",
    background:
      "radial-gradient(circle at top left, rgba(15, 76, 129, 0.16), transparent 34%), linear-gradient(135deg, #f6f8fb 0%, #eef3f8 100%)",
    color: "#0f172a",
  },

  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "flex-start",
    marginBottom: "22px",
    padding: "28px",
    borderRadius: "28px",
    background:
      "linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 64, 175, 0.88))",
    color: "#fff",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
    flexWrap: "wrap",
  },

  badge: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.2)",
    fontSize: "12px",
    fontWeight: 700,
    marginBottom: "12px",
  },

  title: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },

  subtitle: {
    margin: "10px 0 0",
    maxWidth: "680px",
    color: "rgba(255,255,255,0.78)",
    fontSize: "15px",
    lineHeight: 1.7,
  },

  statusSuccess: {
    display: "inline-flex",
    alignItems: "center",
    gap: "9px",
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(34,197,94,0.16)",
    border: "1px solid rgba(134,239,172,0.35)",
    color: "#dcfce7",
    fontWeight: 800,
    fontSize: "13px",
  },

  statusDanger: {
    display: "inline-flex",
    alignItems: "center",
    gap: "9px",
    padding: "10px 14px",
    borderRadius: "999px",
    background: "rgba(239,68,68,0.16)",
    border: "1px solid rgba(252,165,165,0.38)",
    color: "#fee2e2",
    fontWeight: 800,
    fontSize: "13px",
  },

  statusDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    background: "currentColor",
    boxShadow: "0 0 0 4px rgba(255,255,255,0.12)",
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 0.8fr)",
    gap: "22px",
    alignItems: "start",
  },

  mainColumn: {
    display: "grid",
    gap: "18px",
  },

  sideColumn: {
    display: "grid",
    gap: "18px",
  },

  card: {
    background: "rgba(255,255,255,0.88)",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: "26px",
    padding: "22px",
    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.08)",
    backdropFilter: "blur(14px)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "center",
    marginBottom: "18px",
  },

  cardTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },

  cardDesc: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  switch: {
    position: "relative",
    width: "64px",
    height: "36px",
    flexShrink: 0,
    cursor: "pointer",
  },

  hiddenInput: {
    display: "none",
  },

  slider: {
    position: "absolute",
    inset: 0,
    background: "#cbd5e1",
    borderRadius: "999px",
    transition: "0.25s ease",
    boxShadow: "inset 0 2px 8px rgba(15,23,42,0.12)",
  },

  sliderActive: {
    background: "linear-gradient(135deg, #ef4444, #b91c1c)",
  },

  sliderDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },

  knob: {
    position: "absolute",
    width: "28px",
    height: "28px",
    left: "4px",
    top: "4px",
    background: "#fff",
    borderRadius: "50%",
    transition: "0.25s ease",
    boxShadow: "0 6px 14px rgba(15,23,42,0.25)",
  },

  knobActive: {
    transform: "translateX(28px)",
  },

  maintenanceOn: {
    display: "grid",
    gap: "5px",
    padding: "16px",
    borderRadius: "20px",
    background: "rgba(254, 226, 226, 0.8)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "#991b1b",
    lineHeight: 1.5,
  },

  maintenanceOff: {
    display: "grid",
    gap: "5px",
    padding: "16px",
    borderRadius: "20px",
    background: "rgba(220, 252, 231, 0.8)",
    border: "1px solid rgba(34,197,94,0.22)",
    color: "#166534",
    lineHeight: 1.5,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },

  field: {
    display: "grid",
    gap: "8px",
  },

  label: {
    fontSize: "13px",
    fontWeight: 800,
    color: "#334155",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid rgba(148,163,184,0.35)",
    background: "#fff",
    borderRadius: "16px",
    padding: "13px 14px",
    fontSize: "15px",
    outline: "none",
    color: "#0f172a",
  },

  primaryButton: {
    gridColumn: "1 / -1",
    border: 0,
    borderRadius: "18px",
    padding: "14px 18px",
    background: "linear-gradient(135deg, #0f172a, #1d4ed8)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 16px 28px rgba(29, 78, 216, 0.24)",
  },

  buttonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
    boxShadow: "none",
  },

  noteText: {
    margin: "10px 0 0",
    color: "#64748b",
    lineHeight: 1.8,
  },

  summaryCard: {
    padding: "26px",
    borderRadius: "28px",
    background: "linear-gradient(135deg, #ffffff, #eff6ff)",
    border: "1px solid rgba(59,130,246,0.18)",
    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.08)",
    display: "grid",
    gap: "4px",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 800,
  },

  summaryNumber: {
    fontSize: "48px",
    fontWeight: 950,
    color: "#1d4ed8",
    letterSpacing: "-0.06em",
  },

  summaryText: {
    color: "#475569",
    fontSize: "14px",
  },

  defaultList: {
    display: "grid",
    gap: "12px",
    marginTop: "14px",
  },

  defaultItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "center",
    padding: "14px",
    borderRadius: "16px",
    background: "#f8fafc",
    border: "1px solid rgba(148,163,184,0.18)",
    color: "#334155",
  },

  accessBox: {
    display: "grid",
    gap: "5px",
    padding: "14px",
    borderRadius: "16px",
    background: "#f8fafc",
    border: "1px solid rgba(148,163,184,0.18)",
    marginTop: "12px",
    color: "#475569",
  },

  warningBox: {
    marginBottom: "14px",
    padding: "14px 16px",
    borderRadius: "18px",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    fontWeight: 700,
  },

  successBox: {
    marginBottom: "14px",
    padding: "14px 16px",
    borderRadius: "18px",
    background: "#dcfce7",
    border: "1px solid #86efac",
    color: "#166534",
    fontWeight: 800,
  },

  errorBox: {
    marginBottom: "14px",
    padding: "14px 16px",
    borderRadius: "18px",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 800,
  },

  loadingCard: {
    maxWidth: "520px",
    margin: "80px auto",
    display: "flex",
    gap: "16px",
    alignItems: "center",
    background: "#fff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.08)",
  },

  spinner: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    border: "4px solid #dbeafe",
    borderTopColor: "#2563eb",
  },

  loadingTitle: {
    margin: 0,
    color: "#0f172a",
  },

  loadingText: {
    margin: "5px 0 0",
    color: "#64748b",
  },
};
