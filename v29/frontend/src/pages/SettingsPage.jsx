import { useEffect, useState } from "react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();

  const [maintenance, setMaintenance] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [defaults, setDefaults] = useState({ annual: 30, sick: 15, emergency: 5 });
  const [form, setForm] = useState({ annual: "30", sick: "15", emergency: "5" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);

  const isSystemOwner = ["System Owner", "system owner", "system_owner", "owner"].includes(
    user?.role || user?.roleName || user?.roleCode
  );

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const settingsResponse = await apiFetch("/settings");
      setMaintenance(Boolean(settingsResponse?.settings?.maintenanceMode));
      setAuditLogs(Array.isArray(settingsResponse?.auditLogs) ? settingsResponse.auditLogs : []);

      const leaveDefaults = {
        annual: Number(settingsResponse?.leaveDefaults?.annual ?? 30),
        sick: Number(settingsResponse?.leaveDefaults?.sick ?? 15),
        emergency: Number(settingsResponse?.leaveDefaults?.emergency ?? 5),
      };

      setDefaults(leaveDefaults);
      setForm({
        annual: String(leaveDefaults.annual),
        sick: String(leaveDefaults.sick),
        emergency: String(leaveDefaults.emergency),
      });
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

  async function handleSaveDefaults(event) {
    event.preventDefault();

    try {
      setSavingDefaults(true);
      setError("");
      setMessage("");

      const payload = {
        annual: Number(form.annual),
        sick: Number(form.sick),
        emergency: Number(form.emergency),
      };

      if (Object.values(payload).some((value) => Number.isNaN(value) || value < 0)) {
        throw new Error("Please enter valid leave balances");
      }

      const response = await apiFetch("/settings/leave-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setDefaults({
        annual: Number(response?.leaveDefaults?.annual ?? payload.annual),
        sick: Number(response?.leaveDefaults?.sick ?? payload.sick),
        emergency: Number(response?.leaveDefaults?.emergency ?? payload.emergency),
      });

      setMessage("Leave defaults saved successfully.");
      await loadData();
    } catch (err) {
      console.error("Save defaults error:", err);
      setError(err?.message || "Failed to save leave defaults");
    } finally {
      setSavingDefaults(false);
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
            <p>Maintenance mode and leave defaults.</p>
          </div>
        </div>

        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        <label className="toggle-row">
          <span>Maintenance Mode</span>
          <input
            type="checkbox"
            checked={maintenance}
            disabled={!isSystemOwner}
            onChange={(e) => handleToggle(e.target.checked)}
          />
        </label>

        <p className="muted">
          When enabled, only allowed users can access the system.
        </p>

        <hr className="spacer" />

        <div className="page-header compact">
          <div>
            <h1>Leave Defaults</h1>
            <p>These values are used when creating leave balances for employees.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSaveDefaults}>
          <label>
            Annual Leave
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.annual}
              disabled={!isSystemOwner}
              onChange={(e) => setForm((prev) => ({ ...prev, annual: e.target.value }))}
            />
          </label>

          <label>
            Sick Leave
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.sick}
              disabled={!isSystemOwner}
              onChange={(e) => setForm((prev) => ({ ...prev, sick: e.target.value }))}
            />
          </label>

          <label>
            Emergency Leave
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.emergency}
              disabled={!isSystemOwner}
              onChange={(e) => setForm((prev) => ({ ...prev, emergency: e.target.value }))}
            />
          </label>

          <div className="settings-list" style={{ gridColumn: "1 / -1" }}>
            <div className="list-row">
              <div>
                <strong>Current Defaults</strong>
                <p>
                  Annual: {defaults.annual} day(s) • Sick: {defaults.sick} day(s) • Emergency: {defaults.emergency} day(s)
                </p>
              </div>
            </div>
          </div>

          <div className="inline-actions" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
            <button type="submit" disabled={!isSystemOwner || savingDefaults}>
              {savingDefaults ? "Saving..." : "Save Leave Defaults"}
            </button>
          </div>
        </form>
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
