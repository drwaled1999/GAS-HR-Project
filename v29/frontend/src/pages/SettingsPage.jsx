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

  const canEditSettings = useMemo(() => {
    const role = normalizeRole(user?.role || user?.roleName || user?.roleCode);
    return ["system owner", "owner", "system_owner"].includes(role);
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const settingsResponse = await apiFetch("/settings");

      setMaintenance(Boolean(settingsResponse?.settings?.maintenanceMode));
      setAnnualDefaultBalance(Number(settingsResponse?.settings?.annualDefaultBalance ?? 30));
      setSickDefaultBalance(Number(settingsResponse?.settings?.sickDefaultBalance ?? 15));
      setEmergencyDefaultBalance(Number(settingsResponse?.settings?.emergencyDefaultBalance ?? 5));
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
            disabled={!canEditSettings}
            onChange={(e) => handleToggle(e.target.checked)}
          />
        </label>

        <p className="muted">
          When enabled, only allowed users can access the system.
        </p>

        <hr className="spacer" />

        <div className="page-header compact">
          <div>
            <h1>Default Leave Balances</h1>
            <p>Set default leave balances for employee records.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSaveLeaveDefaults}>
          <label>
            Annual Leave
            <input
              type="number"
              min="0"
              value={annualDefaultBalance}
              onChange={(e) => setAnnualDefaultBalance(e.target.value)}
            />
          </label>

          <label>
            Sick Leave
            <input
              type="number"
              min="0"
              value={sickDefaultBalance}
              onChange={(e) => setSickDefaultBalance(e.target.value)}
            />
          </label>

          <label>
            Emergency Leave
            <input
              type="number"
              min="0"
              value={emergencyDefaultBalance}
              onChange={(e) => setEmergencyDefaultBalance(e.target.value)}
            />
          </label>

          <div className="span-2 modal-actions">
            <button type="submit" disabled={!canEditSettings || savingDefaults}>
              {savingDefaults ? "Saving..." : "Save Leave Defaults"}
            </button>
          </div>
        </form>

        <hr className="spacer" />

        <div className="page-header compact">
          <div>
            <h1>Notes</h1>
            <p>Approved leave requests will deduct automatically from balances.</p>
          </div>
        </div>

        <div className="card" style={{ marginTop: 10 }}>
          <p className="muted">
            Annual, Sick, and Emergency leave balances are now connected to the backend.
          </p>
        </div>
      </section>

      <section className="card table-wrap">
        <div className="page-header compact">
          <div>
            <h1>Current Defaults</h1>
            <p>Current values saved in the backend.</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Days</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Annual Leave</td>
              <td>{annualDefaultBalance}</td>
            </tr>
            <tr>
              <td>Sick Leave</td>
              <td>{sickDefaultBalance}</td>
            </tr>
            <tr>
              <td>Emergency Leave</td>
              <td>{emergencyDefaultBalance}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
