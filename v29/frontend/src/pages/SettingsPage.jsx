import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

const currentYear = 2026;

export default function SettingsPage() {
  const { user } = useAuth();
  const [maintenance, setMaintenance] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [months, setMonths] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [balances, setBalances] = useState([]);
  const [message, setMessage] = useState('');
  const [monthForm, setMonthForm] = useState({ month: 4, year: currentYear, note: '' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [settingsResponse, monthResponse, policyResponse, balanceResponse] = await Promise.all([
      apiFetch('/settings'),
      apiFetch('/attendance/month-locks'),
      apiFetch('/requests-center/policies'),
      apiFetch('/requests-center/balances')
    ]);
    setMaintenance(Boolean(settingsResponse.settings.maintenanceMode));
    setAuditLogs(settingsResponse.auditLogs || []);
    setMonths(monthResponse.months || []);
    setPolicies(policyResponse.policies || []);
    setBalances(balanceResponse.balances || []);
  }

  async function handleToggle(enabled) {
    const response = await apiFetch('/settings/maintenance', {
      method: 'POST',
      headers: { 'x-actor-name': user?.name || 'System Owner' },
      body: JSON.stringify({ enabled })
    });
    setMaintenance(Boolean(response.settings.maintenanceMode));
    setMessage(enabled ? 'Maintenance mode enabled.' : 'Maintenance mode disabled.');
    loadData();
  }

  async function handleMonthLock(lock) {
    const endpoint = lock ? '/attendance/month-locks' : '/attendance/month-locks/open';
    await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(monthForm)
    });
    setMessage(lock ? 'Attendance month locked successfully.' : 'Attendance month reopened successfully.');
    loadData();
  }

  async function handlePolicyChange(code, field, value) {
    const next = policies.map((item) => item.code === code ? { ...item, [field]: value } : item);
    setPolicies(next);
  }

  async function savePolicy(policy) {
    await apiFetch(`/requests-center/policies/${policy.code}`, {
      method: 'POST',
      body: JSON.stringify(policy)
    });
    setMessage(`Policy updated: ${policy.label}`);
    loadData();
  }

  return (
    <div className="page grid-two">
      <section className="card settings-grid">
        <div className="page-header compact"><div><h1>System Settings</h1><p>Maintenance mode, month closing, and leave policies.</p></div></div>
        <label className="toggle-row">
          <span>Maintenance Mode</span>
          <input type="checkbox" checked={maintenance} onChange={(e) => handleToggle(e.target.checked)} />
        </label>
        <p className="muted">When enabled, only allowed users can access the system.</p>
        <hr className="spacer" />
        <div className="page-header compact"><div><h1>Attendance Month Closing</h1><p>Lock a month to stop attendance edits and imports.</p></div></div>
        <div className="form-grid compact-form">
          <label>
            Month
            <select value={monthForm.month} onChange={(e) => setMonthForm((prev) => ({ ...prev, month: Number(e.target.value) }))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
          <label>
            Year
            <input value={monthForm.year} onChange={(e) => setMonthForm((prev) => ({ ...prev, year: Number(e.target.value) }))} />
          </label>
          <label className="span-2">
            Note
            <input value={monthForm.note} onChange={(e) => setMonthForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Month approved by payroll" />
          </label>
        </div>
        <div className="inline-actions wrap-actions">
          <button type="button" onClick={() => handleMonthLock(true)}>Lock Month</button>
          <button type="button" className="ghost" onClick={() => handleMonthLock(false)}>Reopen Month</button>
        </div>
        <div className="settings-list">
          {months.length === 0 ? <p className="muted small">No month lock history yet.</p> : months.slice(0, 6).map((item) => (
            <div className="list-row" key={item.key}>
              <div>
                <strong>{item.key}</strong>
                <p>{item.closed ? 'Locked' : 'Open'} {item.note ? `• ${item.note}` : ''}</p>
              </div>
              <span className={`soft-badge ${item.closed ? 'warning' : ''}`}>{item.closed ? 'Locked' : 'Open'}</span>
            </div>
          ))}
        </div>
        {message && <div className="alert success">{message}</div>}
      </section>
      <section className="page">
        <section className="card table-wrap">
          <div className="page-header compact"><div><h1>Leave Policies</h1><p>Adjust annual, emergency, and sick leave rules.</p></div></div>
          <div className="policy-grid">
            {policies.map((policy) => (
              <div className="permission-box" key={policy.code}>
                <div className="page-header compact">
                  <div><h1>{policy.label}</h1><p className="small muted">{policy.code}</p></div>
                  <button type="button" onClick={() => savePolicy(policy)}>Save</button>
                </div>
                <label>
                  Default Days
                  <input type="number" value={policy.defaultDays} onChange={(e) => handlePolicyChange(policy.code, 'defaultDays', Number(e.target.value))} />
                </label>
                <label className="checkbox-row"><input type="checkbox" checked={policy.requiresAttachment} onChange={(e) => handlePolicyChange(policy.code, 'requiresAttachment', e.target.checked)} />Requires attachment</label>
                <label className="checkbox-row"><input type="checkbox" checked={policy.deductFromBalance} onChange={(e) => handlePolicyChange(policy.code, 'deductFromBalance', e.target.checked)} />Deduct from balance</label>
              </div>
            ))}
          </div>
        </section>
        <section className="card table-wrap compact-table">
          <div className="page-header compact"><div><h1>Leave Balances Snapshot</h1><p>Quick view of current annual, emergency, and sick balances.</p></div></div>
          <table>
            <thead><tr><th>Employee ID</th><th>Annual Remaining</th><th>Emergency Remaining</th><th>Sick Remaining</th></tr></thead>
            <tbody>
              {balances.map((item) => (
                <tr key={item.employeeId}><td>{item.employeeId}</td><td>{item.annualLeaveRemaining}</td><td>{item.emergencyLeaveRemaining}</td><td>{item.sickLeaveRemaining}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card table-wrap">
          <div className="page-header compact"><div><h1>Audit Log</h1><p>Latest actions inside the system.</p></div></div>
          <table>
            <thead><tr><th>Action</th><th>Actor</th><th>Time</th></tr></thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}><td>{log.action}</td><td>{log.actorName}</td><td>{new Date(log.createdAt).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>
    </div>
  );
}
