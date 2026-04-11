import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { translations } from '../i18n/translations';
import PermissionGroup from '../components/PermissionGroup';

const roleOptions = [
  { id: 1, name: 'System Owner' },
  { id: 2, name: 'HR Manager' },
  { id: 3, name: 'HR' },
  { id: 4, name: 'Engineer' },
  { id: 5, name: 'Supervisor' },
  { id: 6, name: 'Employee' },
  { id: 7, name: 'CM' },
  { id: 8, name: 'Project Manager' }
];

const accessScopes = ['Self Only', 'Team Only', 'Package Only', 'Project Only', 'Division Only', 'Multiple Projects', 'Full System'];

const permissionCatalog = {
  users: [
    { key: 'view_users', label: 'View users' },
    { key: 'create_user', label: 'Create user' },
    { key: 'edit_user', label: 'Edit user' },
    { key: 'delete_user', label: 'Delete user' },
    { key: 'unlock_user', label: 'Lock / unlock users' },
    { key: 'reset_password', label: 'Reset password' },
    { key: 'change_permissions', label: 'Change custom permissions' },
    { key: 'change_job_title', label: 'Change job title' }
  ],
  attendance: [
    { key: 'view_attendance', label: 'View attendance' },
    { key: 'upload_attendance', label: 'Upload fingerprint file' },
    { key: 'edit_attendance', label: 'Edit attendance directly' },
    { key: 'request_attendance_edit', label: 'Request attendance adjustment' },
    { key: 'approve_attendance', label: 'Approve attendance adjustment' },
    { key: 'reject_attendance', label: 'Reject attendance adjustment' },
    { key: 'export_excel', label: 'Export attendance to Excel' },
    { key: 'view_attendance_issues', label: 'View attendance issues' },
    { key: 'lock_month', label: 'Lock monthly attendance' },
    { key: 'unlock_month', label: 'Unlock monthly attendance' }
  ],
  requests: [
    { key: 'view_requests', label: 'View requests' },
    { key: 'create_requests', label: 'Create requests' },
    { key: 'approve_requests', label: 'Approve requests' },
    { key: 'reject_requests', label: 'Reject requests' },
    { key: 'view_attachments', label: 'View attachments' },
    { key: 'download_attachments', label: 'Download attachments' },
    { key: 'review_salary_transfer', label: 'Review salary transfer' },
    { key: 'review_leave', label: 'Review leave requests' },
    { key: 'review_sick', label: 'Review sick leave' }
  ],
  projects: [
    { key: 'view_projects', label: 'View projects' },
    { key: 'create_project', label: 'Create project' },
    { key: 'edit_project', label: 'Edit project' },
    { key: 'delete_project', label: 'Delete project' },
    { key: 'create_package', label: 'Create package' },
    { key: 'edit_package', label: 'Edit package' },
    { key: 'assign_managers', label: 'Assign managers and CM' },
    { key: 'transfer_employees', label: 'Transfer employees' }
  ],
  reports: [
    { key: 'view_reports', label: 'View reports' },
    { key: 'export_reports_excel', label: 'Export reports to Excel' },
    { key: 'export_reports_pdf', label: 'Export reports to PDF' }
  ],
  security: [
    { key: 'view_security_logs', label: 'View security logs' },
    { key: 'maintenance_mode', label: 'Enable / disable maintenance mode' },
    { key: 'unlock_accounts', label: 'Unlock locked accounts' },
    { key: 'change_password_policy', label: 'Change password policies' },
    { key: 'manage_banks', label: 'Manage banks' },
    { key: 'manage_leave_types', label: 'Manage leave types' }
  ],
  payroll: [
    { key: 'view_salary_transfer', label: 'View salary transfer requests' },
    { key: 'approve_salary_transfer', label: 'Approve salary transfer' },
    { key: 'reject_salary_transfer', label: 'Reject salary transfer' },
    { key: 'view_iban', label: 'View IBAN data' },
    { key: 'update_bank_after_approval', label: 'Update bank after approval' }
  ]
};

const roleTemplates = {
  1: Array.from(new Set(Object.values(permissionCatalog).flat().map((item) => item.key))),
  2: ['view_users', 'create_user', 'edit_user', 'change_job_title', 'view_attendance', 'edit_attendance', 'approve_attendance', 'export_excel', 'view_requests', 'approve_requests', 'view_reports'],
  3: ['view_users', 'create_user', 'edit_user', 'view_attendance', 'view_requests', 'review_leave', 'review_sick'],
  4: ['view_users', 'create_user', 'upload_attendance', 'request_attendance_edit', 'view_requests', 'review_salary_transfer'],
  5: ['view_attendance', 'view_requests'],
  6: ['view_attendance', 'create_requests'],
  7: ['view_attendance', 'approve_attendance', 'view_requests', 'approve_requests', 'view_reports'],
  8: ['view_attendance', 'approve_attendance', 'view_requests', 'approve_requests', 'view_reports', 'transfer_employees']
};

const initialForm = {
  id: null,
  name: '',
  username: '',
  password: '',
  gasId: '',
  nationalityType: 'SAUDI',
  division: 'Saudi Division',
  jobTitle: 'HR',
  roleId: 3,
  projectId: 1,
  packageId: 1,
  supervisorId: '',
  accessScope: 'Project Only',
  status: 'active',
  permissions: roleTemplates[3],
  allowDuringMaintenance: false,
  forcePasswordChange: true,
  lockUser: false
};

export default function UsersPage() {
  const { user } = useAuth();
  const { language } = useSettings();
  const t = translations[language] || translations.en;
  const isArabic = language === 'ar';

  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [packages, setPackages] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [usersResponse, projectsResponse] = await Promise.all([
      apiFetch('/users'),
      apiFetch('/projects')
    ]);
    setUsers(usersResponse.users);
    setProjects(projectsResponse.projects);
    setPackages(projectsResponse.packages);
  }

  const filteredPackages = useMemo(() => {
    if (!form.projectId) return packages;
    return packages.filter((pkg) => pkg.projectId === Number(form.projectId));
  }, [packages, form.projectId]);

  const supervisors = useMemo(() => users.filter((item) => item.role !== 'Employee'), [users]);

  const visibleUsers = useMemo(() => {
    let rows = [...users];
    const q = search.trim().toLowerCase();
    if (roleFilter !== 'all') rows = rows.filter((item) => item.role === roleFilter);
    if (statusFilter !== 'all') rows = rows.filter((item) => item.status === statusFilter);
    if (q) rows = rows.filter((item) => [item.name, item.gasId, item.role, item.projectName, item.packageName].filter(Boolean).join(' ').toLowerCase().includes(q));
    return rows;
  }, [users, search, roleFilter, statusFilter]);

  function applyTemplate(roleId) {
    setForm((current) => ({ ...current, permissions: roleTemplates[roleId] || [] }));
  }

  function togglePermission(permission) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission]
    }));
  }

  function beginEdit(userRow) {
    setEditingId(userRow.id);
    setForm({
      id: userRow.id,
      name: userRow.name,
      username: userRow.username,
      password: '',
      gasId: userRow.gasId,
      nationalityType: userRow.nationalityType || 'SAUDI',
      division: userRow.division,
      jobTitle: userRow.jobTitle,
      roleId: roleOptions.find((option) => option.name === userRow.role)?.id || 3,
      projectId: userRow.projectId || '',
      packageId: userRow.packageId || '',
      supervisorId: userRow.supervisorId || '',
      accessScope: userRow.accessScope || 'Project Only',
      status: userRow.status,
      permissions: userRow.permissions || [],
      allowDuringMaintenance: Boolean(userRow.allowDuringMaintenance),
      forcePasswordChange: false,
      lockUser: userRow.status === 'locked'
    });
    setActiveTab('basic');
    setMessage('');
    setError('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(initialForm);
    setActiveTab('basic');
    setMessage('');
    setError('');
  }


  async function handleUnlock(userRow) {
    try {
      const response = await apiFetch(`/users/${userRow.id}/unlock`, { method: 'POST' });
      setUsers((current) => current.map((item) => item.id === userRow.id ? response.user : item));
      setMessage(isArabic ? t.unlockedDone : t.unlockedDone);
    } catch (err) { setError(err.message); }
  }

  async function handleArchive(userRow) {
    if (!window.confirm(isArabic ? 'هل تريد أرشفة هذا المستخدم؟' : 'Archive this user?')) return;
    try {
      const response = await apiFetch(`/users/${userRow.id}/archive`, { method: 'POST' });
      setUsers((current) => current.map((item) => item.id === userRow.id ? response.user : item));
      setMessage(t.archivedDone);
    } catch (err) { setError(err.message); }
  }

  async function handleResetPassword(userRow) {
    const password = window.prompt(t.enterNewPassword);
    if (!password) return;
    try {
      const response = await apiFetch(`/users/${userRow.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      setUsers((current) => current.map((item) => item.id === userRow.id ? response.user : item));
      setMessage(t.passwordResetDone);
    } catch (err) { setError(err.message); }
  }

  async function handleTransfer(userRow) {
    const targetProject = window.prompt(`${t.targetProject} ID`, userRow.projectId || '');
    if (!targetProject) return;
    const projectPackages = packages.filter((pkg) => pkg.projectId === Number(targetProject));
    const defaultPackage = projectPackages[0]?.id || '';
    const targetPackage = window.prompt(`${t.targetPackage} ID`, defaultPackage);
    try {
      const response = await apiFetch(`/users/${userRow.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: Number(targetProject),
          packageId: targetPackage ? Number(targetPackage) : null,
          division: userRow.division,
          accessScope: userRow.accessScope
        })
      });
      setUsers((current) => current.map((item) => item.id === userRow.id ? response.user : item));
      setMessage(t.transferSaved);
    } catch (err) { setError(err.message); }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      const payload = {
        ...form,
        roleId: Number(form.roleId),
        projectId: form.projectId ? Number(form.projectId) : null,
        packageId: form.packageId ? Number(form.packageId) : null,
        supervisorId: form.supervisorId ? Number(form.supervisorId) : null,
        status: form.lockUser ? 'locked' : form.status
      };

      if (editingId) {
        const response = await apiFetch(`/users/${editingId}`, {
          method: 'PUT',
          headers: { 'x-actor-name': user?.name || 'System Owner' },
          body: JSON.stringify(payload)
        });
        setUsers((current) => current.map((item) => item.id === editingId ? response.user : item));
        resetForm();
        setMessage(isArabic ? 'تم تحديث المستخدم وحفظ التعديلات في النظام بنجاح' : 'User was updated and saved successfully.');
        return;
      }

      const response = await apiFetch('/users', {
        method: 'POST',
        headers: { 'x-actor-name': user?.name || 'System Owner' },
        body: JSON.stringify(payload)
      });
      setUsers((current) => [response.user, ...current]);
      setMessage(isArabic ? 'تم إنشاء المستخدم بنجاح' : 'User created successfully');
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page users-pro-layout">
      <section className="card users-pro-card">
        <div className="page-header users-header">
          <div>
            <h1>{editingId ? t.editUser : t.createUser}</h1>
            <p>{t.createAndManage}</p>
          </div>
          <div className="toolbar-row wrap-actions">
            <button type="button" className="ghost" onClick={() => applyTemplate(Number(form.roleId))}>{t.resetRoleTemplate}</button>
            <button type="button" className="ghost" onClick={() => setForm((current) => ({ ...current, permissions: [] }))}>{t.resetPermissions}</button>
            {editingId && <button type="button" className="ghost" onClick={resetForm}>{t.newUser}</button>}
          </div>
        </div>

        <div className="info-strip">
          <span>{t.selectedTemplate}</span>
          <span>{t.editableJobTitle}</span>
        </div>

        <div className="tabs-row">
          {[
            ['basic', t.basicInfo],
            ['organization', t.organization],
            ['permissions', t.permissions],
            ['security', t.security]
          ].map(([key, label]) => (
            <button key={key} type="button" className={`tab-pill ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>{label}</button>
          ))}
        </div>

        <form className="users-form" onSubmit={handleSubmit}>
          {activeTab === 'basic' && (
            <div className="form-grid">
              <label>{t.fullName}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>{t.username}<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
              <label>{t.password}<input type="password" value={form.password} placeholder={editingId ? '••••••••' : ''} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
              <label>{t.gasId}<input value={form.gasId} onChange={(e) => setForm({ ...form, gasId: e.target.value })} /></label>
              <label>{t.jobTitle}<input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></label>
              <label>{t.systemRole}<select value={form.roleId} onChange={(e) => { const nextRoleId = Number(e.target.value); setForm({ ...form, roleId: nextRoleId, permissions: roleTemplates[nextRoleId] || [] }); }}>{roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
              <label>{t.nationalityType}<select value={form.nationalityType} onChange={(e) => setForm({ ...form, nationalityType: e.target.value })}><option value="SAUDI">{t.saudi}</option><option value="NON-SAUDI">{t.nonSaudi}</option><option value="SYSTEM">{t.system}</option></select></label>
              <label>{t.status}<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">{t.active}</option><option value="inactive">{t.inactive}</option></select></label>
            </div>
          )}

          {activeTab === 'organization' && (
            <div className="form-grid">
              <label>{t.division}<select value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })}><option>Saudi Division</option><option>Non-Saudi Division</option><option>Full System</option></select></label>
              <label>{t.project}<select value={form.projectId || ''} onChange={(e) => setForm({ ...form, projectId: Number(e.target.value), packageId: '' })}><option value="">{t.selectProject}</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              <label>{t.package}<select value={form.packageId || ''} onChange={(e) => setForm({ ...form, packageId: Number(e.target.value) })}><option value="">{t.selectPackage}</option>{filteredPackages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}</select></label>
              <label>{t.supervisor}<select value={form.supervisorId || ''} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}><option value="">{t.selectSupervisor}</option>{supervisors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>{t.accessScope}<select value={form.accessScope} onChange={(e) => setForm({ ...form, accessScope: e.target.value })}>{accessScopes.map((scope) => <option key={scope}>{scope}</option>)}</select></label>
              <label className="checkbox-row info-checkbox"><input type="checkbox" checked={form.allowDuringMaintenance} onChange={(e) => setForm({ ...form, allowDuringMaintenance: e.target.checked })} /> {t.allowMaintenance}</label>
              <div className="helper-card span-2">
                <strong>{t.statusHint}</strong>
                <p className="muted">{t.permissionGroupsHint}</p>
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="permissions-wrap">
              <div className="helper-card">
                <strong>{t.permissionGroupsHint}</strong>
                <p className="muted">{t.selectedTemplate}</p>
              </div>
              <PermissionGroup title={t.usersGroup} items={permissionCatalog.users} selected={form.permissions} onToggle={togglePermission} />
              <PermissionGroup title={t.attendanceGroup} items={permissionCatalog.attendance} selected={form.permissions} onToggle={togglePermission} />
              <PermissionGroup title={t.requestsGroup} items={permissionCatalog.requests} selected={form.permissions} onToggle={togglePermission} />
              <PermissionGroup title={t.projectsGroup} items={permissionCatalog.projects} selected={form.permissions} onToggle={togglePermission} />
              <PermissionGroup title={t.reportsGroup} items={permissionCatalog.reports} selected={form.permissions} onToggle={togglePermission} />
              <PermissionGroup title={t.securityGroup} items={permissionCatalog.security} selected={form.permissions} onToggle={togglePermission} />
              <PermissionGroup title={t.payrollGroup} items={permissionCatalog.payroll} selected={form.permissions} onToggle={togglePermission} />
            </div>
          )}

          {activeTab === 'security' && (
            <div className="form-grid">
              <label className="checkbox-row info-checkbox"><input type="checkbox" checked={form.forcePasswordChange} onChange={(e) => setForm({ ...form, forcePasswordChange: e.target.checked })} /> {t.forcePasswordChange}</label>
              <label className="checkbox-row info-checkbox"><input type="checkbox" checked={form.lockUser} onChange={(e) => setForm({ ...form, lockUser: e.target.checked })} /> {t.lockUser}</label>
              <div className="helper-card span-2">
                <strong>{t.lockHint}</strong>
                <p className="muted">{t.statusHint}</p>
              </div>
            </div>
          )}

          {message && <div className="alert success">{message}</div>}
          {error && <div className="alert error">{error}</div>}

          <div className="modal-actions top-divider">
            <button type="button" className="ghost" onClick={resetForm}>{t.cancel}</button>
            <button type="submit">{editingId ? t.saveChanges : t.saveUser}</button>
          </div>
        </form>
      </section>

      <section className="card table-wrap users-table-card">
        <div className="page-header compact">
          <div>
            <h1>{t.usersList}</h1>
            <p>{t.currentUsers}</p>
          </div>
          <div className="toolbar-row wrap-actions">
            <input className="users-search" placeholder={t.searchUsers} value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="users-search" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">{t.all} - {t.roleFilter}</option>
              {roleOptions.map((role) => <option key={role.id} value={role.name}>{role.name}</option>)}
            </select>
            <select className="users-search" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t.all} - {t.statusFilter}</option>
              <option value="active">{t.active}</option>
              <option value="inactive">{t.inactive}</option>
              <option value="locked">Locked</option>
              <option value="archived">{t.archived}</option>
            </select>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>{t.name}</th>
              <th>{t.gasId}</th>
              <th>{t.role}</th>
              <th>{t.division}</th>
              <th>{t.projectName}</th>
              <th>{t.packageName}</th>
              <th>{t.status}</th>
              <th>{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.length === 0 && (
              <tr>
                <td colSpan="8" className="muted">{t.noUsers}</td>
              </tr>
            )}
            {visibleUsers.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.gasId}</td>
                <td>{item.role}</td>
                <td>{item.division}</td>
                <td>{item.projectName}</td>
                <td>{item.packageName}</td>
                <td><span className={`status-chip ${item.status}`}>{item.status}</span></td>
                <td>
                  <div className="toolbar-row wrap-actions">
                    <button type="button" className="ghost small-control" onClick={() => beginEdit(item)}>{t.edit}</button>
                    {item.status === 'locked' && <button type="button" className="ghost small-control" onClick={() => handleUnlock(item)}>{t.unlock}</button>}
                    <button type="button" className="ghost small-control" onClick={() => handleResetPassword(item)}>{t.resetPassword}</button>
                    <button type="button" className="ghost small-control" onClick={() => handleTransfer(item)}>{t.transfer}</button>
                    {item.status !== 'archived' && <button type="button" className="ghost small-control danger" onClick={() => handleArchive(item)}>{t.archive}</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
