import { useEffect, useState } from "react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();

  const [maintenance, setMaintenance] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [balances, setBalances] = useState({
    annual: 30,
    sick: 15,
    emergency: 5,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const settingsResponse = await apiFetch("/settings");
      setMaintenance(Boolean(settingsResponse?.settings?.maintenanceMode));
      setAuditLogs(Array.isArray(settingsResponse?.auditLogs) ? settingsResponse.auditLogs : []);

      try {
        const balanceResponse = await apiFetch("/requests-center/balances");
        setBalances({
          annual: Number(balanceResponse?.balances?.annual ?? 30),
          sick: Number(balanceResponse?.balances?.sick ?? 15),
          emergency: Number(balanceResponse?.balances?.emergency ?? 5),
        });
      } catch {
        setBalances({
          annual: 30,
          sick: 15,
          emergency: 5,
        });
      }
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
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="page grid-two">
      <section className="card settings-grid">
        <div className="page-header compact">
          <div>
            <h1>System Settings</h1>
            <p>Maintenance mode and system snapshot.</p>
          </div>
        </div>

        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        <label className="toggle-row">
          <span>Maintenance Mode</span>
          <input
            type="checkbox"
            checked={maintenance}
            disabled={user?.role !== "System Owner"}
            onChange={(e) => handleToggle(e.target.checked)}
          />
        </label>

        <p className="muted">
          When enabled, only allowed users can access the system.
        </p>

        <hr className="spacer" />

        <div className="page-header compact">
          <div>
            <h1>Leave Balance Snapshot</h1>
            <p>Current default balances from the connected backend.</p>
          </div>
        </div>

        <div className="settings-list">
          <div className="list-row">
            <div>
              <strong>Annual Leave</strong>
              <p>{balances.annual} day(s)</p>
            </div>
          </div>

          <div className="list-row">
            <div>
              <strong>Sick Leave</strong>
              <p>{balances.sick} day(s)</p>
            </div>
          </div>

          <div className="list-row">
            <div>
              <strong>Emergency Leave</strong>
              <p>{balances.emergency} day(s)</p>
            </div>
          </div>
        </div>

        <hr className="spacer" />

        <div className="page-header compact">
          <div>
            <h1>Unavailable Sections</h1>
            <p>هذه الأجزاء موجودة بالواجهة لكن الباكند الحالي لا يوفّرها بعد.</p>
          </div>
        </div>

        <div className="card" style={{ marginTop: 10 }}>
          <p className="muted">
            Attendance Month Locking and Leave Policies are not connected in the
            current backend build, so they were disabled to prevent page crashes.
          </p>
        </div>
      </section>

      <section className="card table-wrap">
        <div className="page-header compact">
          <div>
            <h1>Audit Log</h1>
            <p>Latest actions inside the system.</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>Actor</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length ? (
              auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.action}</td>
                  <td>{log.actorName}</td>
                  <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3">No audit logs available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
