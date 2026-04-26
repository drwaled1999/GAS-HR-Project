import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  Search,
  ShieldCheck,
  BadgeCheck,
  KeyRound,
  Save,
  Trash2,
  RotateCcw,
  UserCog,
  CalendarDays,
} from "lucide-react";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  saveUserPermissions,
  deleteUser,
  getManagedLeaveBalance,
  updateManagedLeaveBalance,
} from "../services/api";

const PERMISSION_OPTIONS = [
  { code: "dashboard.view", label: "Dashboard View" },
  { code: "users.view", label: "Users View" },
  { code: "users.create", label: "Create Users" },
  { code: "users.edit", label: "Edit Users" },
  { code: "users.delete", label: "Delete Users" },
  { code: "users.permissions", label: "Manage Permissions" },
  { code: "attendance.view", label: "Attendance View" },
  { code: "attendance.upload", label: "Upload Attendance" },
  { code: "attendance.edit", label: "Edit Attendance" },
  { code: "attendance.approve", label: "Approve Attendance" },
  { code: "requests.view", label: "Requests View" },
  { code: "requests.create", label: "Create Requests" },
  { code: "requests.review", label: "Review Requests" },
  { code: "leave.manage", label: "Manage Leave" },
  { code: "payroll.view", label: "Payroll View" },
  { code: "reports.view", label: "Reports View" },
  { code: "projects.view", label: "Projects View" },
  { code: "projects.manage", label: "Manage Projects" },
];

const ROLE_DEFAULT_PERMISSIONS = {
  owner: PERMISSION_OPTIONS.map((item) => item.code),

  hr_manager: [
    "dashboard.view",
    "users.view",
    "users.create",
    "users.edit",
    "users.permissions",
    "attendance.view",
    "attendance.upload",
    "attendance.edit",
    "attendance.approve",
    "requests.view",
    "requests.review",
    "leave.manage",
    "payroll.view",
    "reports.view",
    "projects.view",
  ],

  hr_admin: [
    "dashboard.view",
    "users.view",
    "users.create",
    "users.edit",
    "attendance.view",
    "attendance.upload",
    "attendance.edit",
    "requests.view",
    "requests.review",
    "leave.manage",
    "reports.view",
    "projects.view",
  ],

  hr: [
    "dashboard.view",
    "users.view",
    "attendance.view",
    "attendance.upload",
    "requests.view",
    "requests.review",
    "leave.manage",
    "reports.view",
    "projects.view",
  ],

  admin: [
    "dashboard.view",
    "users.view",
    "users.create",
    "users.edit",
    "attendance.view",
    "attendance.upload",
    "attendance.edit",
    "requests.view",
    "requests.review",
    "leave.manage",
    "reports.view",
    "projects.view",
  ],

  admin_assistant: [
    "dashboard.view",
    "users.view",
    "attendance.view",
    "requests.view",
    "requests.create",
    "reports.view",
    "projects.view",
  ],

  site_admin: [
    "dashboard.view",
    "attendance.view",
    "attendance.upload",
    "attendance.edit",
    "requests.view",
    "requests.review",
    "reports.view",
    "projects.view",
  ],

  project_manager: [
    "dashboard.view",
    "attendance.view",
    "requests.view",
    "requests.review",
    "reports.view",
    "projects.view",
  ],

  cm: [
    "dashboard.view",
    "attendance.view",
    "requests.view",
    "requests.review",
    "reports.view",
    "projects.view",
  ],

  supervisor: ["dashboard.view", "attendance.view", "requests.view"],
  engineer: ["dashboard.view", "attendance.view", "requests.view"],
  employee: ["dashboard.view", "requests.create", "requests.view"],
};

const emptyForm = {
  id: "",
  employeeId: "",
  name: "",
  username: "",
  email: "",
  password: "",
  gasId: "",
  jobTitle: "",
  roleCode: "employee",
  nationality: "Saudi",
  projectName: "",
  packageName: "",
  status: "active",
  permissions: ROLE_DEFAULT_PERMISSIONS.employee,
};

function normalizeRoleCodeFromUser(user) {
  const raw =
    user?.roleCode ||
    user?.role_code ||
    user?.role ||
    user?.roleName ||
    user?.role_name ||
    "";

  const value = String(raw).trim().toLowerCase();

  if (["owner", "system owner", "system_owner"].includes(value)) return "owner";
  if (["hr manager", "hr_manager"].includes(value)) return "hr_manager";
  if (["hr admin", "hr_admin"].includes(value)) return "hr_admin";
  if (["hr"].includes(value)) return "hr";
  if (["admin"].includes(value)) return "admin";

  if (
    ["admin assistant", "admin_assistant", "admin assist", "admin_assist"].includes(
      value
    )
  ) {
    return "admin_assistant";
  }

  if (
    ["site admin", "site_admin", "site administrator", "site_administrator"].includes(
      value
    )
  ) {
    return "site_admin";
  }

  if (["engineer"].includes(value)) return "engineer";
  if (["supervisor"].includes(value)) return "supervisor";
  if (["employee"].includes(value)) return "employee";
  if (["cm"].includes(value)) return "cm";

  if (["project manager", "project_manager"].includes(value)) {
    return "project_manager";
  }

  return "employee";
}

function roleLabelFromCode(code) {
  const map = {
    owner: "System Owner",
    hr_manager: "HR Manager",
    hr_admin: "HR Admin",
    hr: "HR",
    admin: "Admin",
    admin_assistant: "Admin Assistant",
    site_admin: "Site Admin",
    engineer: "Engineer",
    supervisor: "Supervisor",
    employee: "Employee",
    cm: "CM",
    project_manager: "Project Manager",
  };

  return map[code] || "Employee";
}

function mapUserToForm(user) {
  const roleCode = normalizeRoleCodeFromUser(user);

  return {
    id: user?.id || "",
    employeeId: user?.employeeId || user?.employee_id || "",
    name: user?.name || user?.full_name || "",
    username: user?.username || "",
    email: user?.email || "",
    password: "",
    gasId: user?.gasId || user?.gas_id || "",
    jobTitle: user?.jobTitle || user?.job_title || "",
    roleCode,
    nationality: user?.nationality || user?.nationalityType || "Saudi",
    projectName: user?.projectName || user?.project_name || "",
    packageName: user?.packageName || user?.package_name || "",
    status: user?.status || "active",
    permissions: Array.isArray(user?.permissions)
      ? user.permissions
      : ROLE_DEFAULT_PERMISSIONS[roleCode] || [],
  };
}

function normalizeUserPreview(user) {
  const roleCode = normalizeRoleCodeFromUser(user);

  return {
    ...user,
    name: user?.name || user?.full_name || "",
    gasId: user?.gasId || user?.gas_id || "",
    employeeId: user?.employeeId || user?.employee_id || "",
    jobTitle: user?.jobTitle || user?.job_title || "",
    projectName: user?.projectName || user?.project_name || "",
    packageName: user?.packageName || user?.package_name || "",
    roleCode,
    role: roleLabelFromCode(roleCode),
    permissions: Array.isArray(user?.permissions) ? user.permissions : [],
  };
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <article className="users-kpi-card">
      <div className="users-kpi-icon">
        <Icon size={19} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [mode, setMode] = useState("edit");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    annual: 30,
    annualUsed: 0,
    sick: 15,
    sickUsed: 0,
    emergency: 5,
    emergencyUsed: 0,
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("basic");

  async function loadUsers(preferredUserId = null) {
    try {
      setLoading(true);
      setError("");

      const data = await getUsers();
      const resolvedUsers = Array.isArray(data) ? data : data?.users || [];
      const normalizedUsers = resolvedUsers.map(normalizeUserPreview);

      setUsers(normalizedUsers);

      const targetId = preferredUserId || selectedUser?.id;
      if (targetId) {
        const previewUser = normalizedUsers.find((user) => user.id === targetId);
        if (previewUser) {
          await loadUserDetails(previewUser.id, previewUser);
        }
      }
    } catch (err) {
      console.error("Load users error:", err);
      setError(err.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLeaveBalance(employeeId) {
    if (!employeeId) {
      setLeaveForm({
        annual: 30,
        annualUsed: 0,
        sick: 15,
        sickUsed: 0,
        emergency: 5,
        emergencyUsed: 0,
      });
      return;
    }

    try {
      setLeaveLoading(true);

      const response = await getManagedLeaveBalance(employeeId);

      setLeaveForm({
        annual: Number(response?.balances?.annual ?? 30),
        annualUsed: Number(response?.balances?.annualUsed ?? 0),
        sick: Number(response?.balances?.sick ?? 15),
        sickUsed: Number(response?.balances?.sickUsed ?? 0),
        emergency: Number(response?.balances?.emergency ?? 5),
        emergencyUsed: Number(response?.balances?.emergencyUsed ?? 0),
      });
    } catch (err) {
      console.error("Load leave balance error:", err);
      setError(err.message || "Failed to load leave balance");
    } finally {
      setLeaveLoading(false);
    }
  }

  async function loadUserDetails(userId, fallbackUser = null) {
    try {
      setDetailLoading(true);
      setError("");

      const response = await getUserById(userId);
      const fullUser = normalizeUserPreview(response?.user || fallbackUser || {});

      setSelectedUser(fullUser);
      setFormData(mapUserToForm(fullUser));
      await loadLeaveBalance(fullUser.employeeId);

      setMode("edit");
      setActiveTab("basic");
    } catch (err) {
      console.error("Load user details error:", err);

      if (fallbackUser) {
        const fallback = normalizeUserPreview(fallbackUser);
        setSelectedUser(fallback);
        setFormData(mapUserToForm(fallback));
        await loadLeaveBalance(fallback.employeeId);
        setMode("edit");
      } else {
        setError(err.message || "Failed to load user details");
      }
    } finally {
      setDetailLoading(false);
    }
  }

  function handleSelectUser(user) {
    setMessage("");
    setError("");
    loadUserDetails(user.id, user);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };

      if (name === "roleCode") {
        next.permissions = ROLE_DEFAULT_PERMISSIONS[value] || [];
      }

      return next;
    });
  }

  function handleLeaveChange(event) {
    const { name, value } = event.target;

    setLeaveForm((prev) => ({
      ...prev,
      [name]: value === "" ? "" : Number(value),
    }));
  }

  function handlePermissionToggle(permissionCode) {
    setFormData((prev) => {
      const exists = prev.permissions.includes(permissionCode);

      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((code) => code !== permissionCode)
          : [...prev.permissions, permissionCode],
      };
    });
  }

  function handleCreateNew() {
    setMode("create");
    setSelectedUser(null);
    setFormData({
      ...emptyForm,
      permissions: ROLE_DEFAULT_PERMISSIONS.employee,
    });
    setLeaveForm({
      annual: 30,
      annualUsed: 0,
      sick: 15,
      sickUsed: 0,
      emergency: 5,
      emergencyUsed: 0,
    });
    setMessage("");
    setError("");
    setActiveTab("basic");
  }

  async function handleSaveLeaveBalance() {
    if (!selectedUser?.employeeId) {
      setError("This user does not have an employee record linked");
      return;
    }

    try {
      setLeaveSaving(true);
      setError("");
      setMessage("");

      const payload = {
        employeeId: selectedUser.employeeId,
        annual: Number(leaveForm.annual || 0),
        annualUsed: Number(leaveForm.annualUsed || 0),
        sick: Number(leaveForm.sick || 0),
        sickUsed: Number(leaveForm.sickUsed || 0),
        emergency: Number(leaveForm.emergency || 0),
        emergencyUsed: Number(leaveForm.emergencyUsed || 0),
      };

      const response = await updateManagedLeaveBalance(payload);

      setLeaveForm({
        annual: Number(response?.balances?.annual ?? 0),
        annualUsed: Number(response?.balances?.annualUsed ?? 0),
        sick: Number(response?.balances?.sick ?? 0),
        sickUsed: Number(response?.balances?.sickUsed ?? 0),
        emergency: Number(response?.balances?.emergency ?? 0),
        emergencyUsed: Number(response?.balances?.emergencyUsed ?? 0),
      });

      setMessage(response?.message || "Leave balance updated successfully");
    } catch (err) {
      console.error("Save leave balance error:", err);
      setError(err.message || "Failed to save leave balance");
    } finally {
      setLeaveSaving(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        employeeId: formData.employeeId || undefined,
        name: formData.name,
        username: formData.username,
        email: formData.email,
        password: formData.password || undefined,
        gasId: formData.gasId,
        nationality: formData.nationality,
        projectName: formData.projectName,
        packageName: formData.packageName,
        jobTitle: formData.jobTitle,
        roleCode: formData.roleCode,
        status: formData.status,
        permissions: formData.permissions,
      };

      if (mode === "create") {
        if (!formData.password) {
          setError("Password is required for new users");
          setSaving(false);
          return;
        }

        const response = await createUser(payload);
        const createdUser = normalizeUserPreview(response?.user || payload);

        setMessage(response?.message || "User created successfully");

        const fresh = await getUserById(createdUser.id);
        const freshUser = normalizeUserPreview(fresh?.user || createdUser);

        setUsers((prev) => {
          const exists = prev.some((user) => user.id === freshUser.id);

          if (exists) {
            return prev.map((user) =>
              user.id === freshUser.id ? freshUser : user
            );
          }

          return [freshUser, ...prev];
        });

        setSelectedUser(freshUser);
        setFormData(mapUserToForm(freshUser));
        setMode("edit");
        setActiveTab("basic");
      } else {
        if (!selectedUser?.id) {
          setError("Select a user first");
          setSaving(false);
          return;
        }

        const response = await updateUser(selectedUser.id, payload);

        await saveUserPermissions(selectedUser.id, formData.permissions);

        const fresh = await getUserById(selectedUser.id);
        const freshUser = normalizeUserPreview(
          fresh?.user || response?.user || selectedUser
        );

        setMessage(response?.message || "User updated successfully");

        setUsers((prev) =>
          prev.map((user) => (user.id === selectedUser.id ? freshUser : user))
        );

        setSelectedUser(freshUser);
        setFormData(mapUserToForm(freshUser));
      }
    } catch (err) {
      console.error("Save user error:", err);
      setError(err.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedUser?.id) {
      setError("Select a user first");
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من أرشفة المستخدم: ${
        selectedUser.name || selectedUser.username
      } ؟`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");
      setMessage("");

      const response = await deleteUser(selectedUser.id);

      setMessage(response?.message || "User archived successfully");
      setUsers((prev) => prev.filter((user) => user.id !== selectedUser.id));
      setSelectedUser(null);
      setFormData(emptyForm);
      setMode("create");
    } catch (err) {
      console.error("Archive user error:", err);
      setError(err.message || "Failed to archive user");
    } finally {
      setDeleting(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((user) =>
      [
        user.name,
        user.username,
        user.email,
        user.gasId,
        user.employeeId,
        user.role,
        user.jobTitle,
        user.projectName,
        user.packageName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [users, search]);

  const isCreateMode = mode === "create";

  const activeUsers = users.filter(
    (user) => String(user.status || "active").toLowerCase() === "active"
  ).length;

  return (
    <div className="users-pro-page">
      <style>{usersPageStyles}</style>

      <section className="users-hero">
        <div className="users-hero-main">
          <div className="users-hero-badge">
            <UserCog size={16} />
            Users Control Center
          </div>

          <h1>Users Management</h1>
          <p>
            Create users, edit profiles, assign roles, manage permissions, and
            control leave balances from one professional HR workspace.
          </p>

          <div className="users-kpi-grid">
            <StatCard icon={Users} label="Total Users" value={users.length} />
            <StatCard icon={BadgeCheck} label="Active Users" value={activeUsers} />
            <StatCard icon={Search} label="Filtered" value={filteredUsers.length} />
            <StatCard
              icon={ShieldCheck}
              label="Permissions"
              value={formData.permissions.length}
            />
          </div>
        </div>

        <aside className="users-hero-side">
          <div className="users-side-title">
            <ShieldCheck size={18} />
            Current Snapshot
          </div>

          <div className="users-side-list">
            <div className="users-side-row">
              <span>Mode</span>
              <strong>{isCreateMode ? "Create" : "Edit"}</strong>
            </div>
            <div className="users-side-row">
              <span>Selected User</span>
              <strong>{selectedUser?.name || "-"}</strong>
            </div>
            <div className="users-side-row">
              <span>Role</span>
              <strong>{roleLabelFromCode(formData.roleCode)}</strong>
            </div>
            <div className="users-side-row">
              <span>GAS ID</span>
              <strong>{formData.gasId || "-"}</strong>
            </div>
          </div>
        </aside>
      </section>

      {message ? <div className="users-alert success">{message}</div> : null}
      {error ? <div className="users-alert error">{error}</div> : null}

      <section className="users-main-grid">
        <aside className="users-list-panel">
          <div className="users-panel-head">
            <div>
              <h2>Users Directory</h2>
              <p>Search and select employees by role, GAS ID, project, or username.</p>
            </div>

            <button type="button" onClick={handleCreateNew} className="users-primary-btn">
              <UserPlus size={17} />
              Add User
            </button>
          </div>

          <div className="users-search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, username, GAS ID..."
            />
          </div>

          {loading ? (
            <div className="users-empty-state">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="users-empty-state">No users found.</div>
          ) : (
            <div className="users-list">
              {filteredUsers.map((user) => {
                const active = selectedUser?.id === user.id && !isCreateMode;
                const roleCode = normalizeRoleCodeFromUser(user);

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className={`users-list-item ${active ? "active" : ""}`}
                  >
                    <div className="users-avatar">
                      {(user.name || user.username || "U").slice(0, 1).toUpperCase()}
                    </div>

                    <div className="users-item-content">
                      <div className="users-name">{user.name || "-"}</div>
                      <div className="users-username">@{user.username || "-"}</div>

                      <div className="users-badges">
                        <span>{roleLabelFromCode(roleCode)}</span>
                        <span>GAS: {user.gasId || "-"}</span>
                        <span
                          className={
                            String(user.status || "active").toLowerCase() === "active"
                              ? "active-status"
                              : "inactive-status"
                          }
                        >
                          {user.status || "active"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <main className="users-editor-panel">
          <div className="users-editor-head">
            <div>
              <h2>{isCreateMode ? "Create User" : "Edit User"}</h2>
              <p>
                {isCreateMode
                  ? "Create a new user profile and assign permissions."
                  : "Update user information, organization details, permissions, and leave balance."}
              </p>
            </div>

            {detailLoading ? (
              <span className="users-loading-pill">Loading details...</span>
            ) : null}
          </div>

          {!isCreateMode && !selectedUser ? (
            <div className="users-empty-editor">
              <UserCog size={34} />
              <strong>Select a user to edit</strong>
              <span>Choose an employee from the left list to view their profile.</span>
            </div>
          ) : (
            <>
              <div className="users-tabs">
                {[
                  ["basic", "Basic Info"],
                  ["organization", "Organization"],
                  ["permissions", "Permissions"],
                  ["leave", "Leave Balance"],
                  ["security", "Security"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={activeTab === key ? "active" : ""}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "basic" && (
                <div className="users-form-grid">
                  <label>
                    <span>Full Name</span>
                    <input name="name" value={formData.name} onChange={handleChange} />
                  </label>

                  <label>
                    <span>Username</span>
                    <input name="username" value={formData.username} onChange={handleChange} />
                  </label>

                  <label>
                    <span>Email</span>
                    <input name="email" value={formData.email} onChange={handleChange} />
                  </label>

                  <label>
                    <span>Employee ID</span>
                    <input name="employeeId" value={formData.employeeId} onChange={handleChange} />
                  </label>

                  <label>
                    <span>GAS ID</span>
                    <input name="gasId" value={formData.gasId} onChange={handleChange} />
                  </label>

                  <label>
                    <span>Job Title</span>
                    <input name="jobTitle" value={formData.jobTitle} onChange={handleChange} />
                  </label>

                  <label>
                    <span>Nationality</span>
                    <input name="nationality" value={formData.nationality} onChange={handleChange} />
                  </label>
                </div>
              )}

              {activeTab === "organization" && (
                <div className="users-form-grid">
                  <label>
                    <span>Project Name</span>
                    <input name="projectName" value={formData.projectName} onChange={handleChange} />
                  </label>

                  <label>
                    <span>Package Name</span>
                    <input name="packageName" value={formData.packageName} onChange={handleChange} />
                  </label>

                  <label>
                    <span>Status</span>
                    <select name="status" value={formData.status} onChange={handleChange}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              )}

              {activeTab === "permissions" && (
                <div className="users-permissions-shell">
                  <label className="users-role-field">
                    <span>Role</span>
                    <select name="roleCode" value={formData.roleCode} onChange={handleChange}>
                      <option value="owner">System Owner</option>
                      <option value="hr_manager">HR Manager</option>
                      <option value="hr_admin">HR Admin</option>
                      <option value="hr">HR</option>
                      <option value="admin">Admin</option>
                      <option value="admin_assistant">Admin Assistant</option>
                      <option value="site_admin">Site Admin</option>
                      <option value="engineer">Engineer</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="employee">Employee</option>
                      <option value="cm">CM</option>
                      <option value="project_manager">Project Manager</option>
                    </select>
                  </label>

                  <div className="users-info-box">
                    <div className="users-permission-top">
                      <div>
                        <strong>Permission Matrix</strong>
                        <p>Enable or disable access per module and action.</p>
                      </div>

                      <div className="users-mini-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              permissions: ROLE_DEFAULT_PERMISSIONS[prev.roleCode] || [],
                            }))
                          }
                        >
                          Role Default
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              permissions: PERMISSION_OPTIONS.map((item) => item.code),
                            }))
                          }
                        >
                          Select All
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              permissions: [],
                            }))
                          }
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="users-permissions-grid">
                      {PERMISSION_OPTIONS.map((permission) => {
                        const checked = formData.permissions.includes(permission.code);

                        return (
                          <label
                            key={permission.code}
                            className={`permission-card ${checked ? "checked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handlePermissionToggle(permission.code)}
                            />

                            <div>
                              <strong>{permission.label}</strong>
                              <small>{permission.code}</small>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "leave" && (
                <>
                  {isCreateMode ? (
                    <div className="users-info-box">
                      <strong>Leave Balance</strong>
                      <p>Save the user first, then you can manage their leave balance.</p>
                    </div>
                  ) : !selectedUser?.employeeId ? (
                    <div className="users-info-box">
                      <strong>Leave Balance</strong>
                      <p className="danger-text">
                        This user does not have a linked employee record.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="users-info-box">
                        <div className="leave-head">
                          <div>
                            <strong>Manage Leave Balance</strong>
                            <p>Edit employee leave balances and used values manually.</p>
                          </div>

                          {leaveLoading ? <span>Loading balance...</span> : null}
                        </div>
                      </div>

                      <div className="users-form-grid">
                        <label>
                          <span>Annual Balance</span>
                          <input
                            type="number"
                            min="0"
                            name="annual"
                            value={leaveForm.annual}
                            onChange={handleLeaveChange}
                          />
                        </label>

                        <label>
                          <span>Annual Used</span>
                          <input
                            type="number"
                            min="0"
                            name="annualUsed"
                            value={leaveForm.annualUsed}
                            onChange={handleLeaveChange}
                          />
                        </label>

                        <label>
                          <span>Sick Balance</span>
                          <input
                            type="number"
                            min="0"
                            name="sick"
                            value={leaveForm.sick}
                            onChange={handleLeaveChange}
                          />
                        </label>

                        <label>
                          <span>Sick Used</span>
                          <input
                            type="number"
                            min="0"
                            name="sickUsed"
                            value={leaveForm.sickUsed}
                            onChange={handleLeaveChange}
                          />
                        </label>

                        <label>
                          <span>Emergency Balance</span>
                          <input
                            type="number"
                            min="0"
                            name="emergency"
                            value={leaveForm.emergency}
                            onChange={handleLeaveChange}
                          />
                        </label>

                        <label>
                          <span>Emergency Used</span>
                          <input
                            type="number"
                            min="0"
                            name="emergencyUsed"
                            value={leaveForm.emergencyUsed}
                            onChange={handleLeaveChange}
                          />
                        </label>
                      </div>

                      <div className="leave-summary-grid">
                        <article>
                          <CalendarDays size={18} />
                          <span>Annual Remaining</span>
                          <strong>
                            {Number(leaveForm.annual || 0) -
                              Number(leaveForm.annualUsed || 0)}
                          </strong>
                        </article>

                        <article>
                          <CalendarDays size={18} />
                          <span>Sick Remaining</span>
                          <strong>
                            {Number(leaveForm.sick || 0) -
                              Number(leaveForm.sickUsed || 0)}
                          </strong>
                        </article>

                        <article>
                          <CalendarDays size={18} />
                          <span>Emergency Remaining</span>
                          <strong>
                            {Number(leaveForm.emergency || 0) -
                              Number(leaveForm.emergencyUsed || 0)}
                          </strong>
                        </article>
                      </div>

                      <div className="users-actions-row">
                        <button
                          type="button"
                          onClick={() => loadLeaveBalance(selectedUser.employeeId)}
                          className="users-soft-btn"
                          disabled={leaveLoading || leaveSaving}
                        >
                          <RotateCcw size={16} />
                          Reload Balance
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveLeaveBalance}
                          className="users-primary-btn"
                          disabled={leaveSaving}
                        >
                          <Save size={16} />
                          {leaveSaving ? "Saving..." : "Save Leave Balance"}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === "security" && (
                <div className="users-form-grid">
                  <label>
                    <span>{isCreateMode ? "Password" : "New Password"}</span>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder={
                        isCreateMode
                          ? "Enter password"
                          : "اتركه فارغ إذا ما تبي تغيّر كلمة المرور"
                      }
                    />
                  </label>
                </div>
              )}

              <div className="users-preview-box">
                <div className="preview-title">
                  <KeyRound size={17} />
                  Profile Preview
                </div>

                <div className="preview-grid">
                  <div><span>Name</span><strong>{formData.name || "-"}</strong></div>
                  <div><span>Username</span><strong>{formData.username || "-"}</strong></div>
                  <div><span>Employee ID</span><strong>{formData.employeeId || "-"}</strong></div>
                  <div><span>GAS ID</span><strong>{formData.gasId || "-"}</strong></div>
                  <div><span>Role</span><strong>{roleLabelFromCode(formData.roleCode)}</strong></div>
                  <div><span>Project</span><strong>{formData.projectName || "-"}</strong></div>
                  <div><span>Package</span><strong>{formData.packageName || "-"}</strong></div>
                  <div><span>Permissions</span><strong>{formData.permissions.length}</strong></div>
                </div>
              </div>

              <div className="users-actions-row sticky-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (isCreateMode) {
                      setFormData(emptyForm);
                      setLeaveForm({
                        annual: 30,
                        annualUsed: 0,
                        sick: 15,
                        sickUsed: 0,
                        emergency: 5,
                        emergencyUsed: 0,
                      });
                    } else if (selectedUser) {
                      setFormData(mapUserToForm(selectedUser));
                      loadLeaveBalance(selectedUser.employeeId);
                    }

                    setMessage("");
                    setError("");
                  }}
                  className="users-soft-btn"
                >
                  <RotateCcw size={16} />
                  Cancel
                </button>

                {!isCreateMode ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="users-danger-btn"
                  >
                    <Trash2 size={16} />
                    {deleting ? "Archiving..." : "Archive User"}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="users-primary-btn"
                >
                  <Save size={16} />
                  {saving ? "Saving..." : isCreateMode ? "Create User" : "Save Changes"}
                </button>
              </div>
            </>
          )}
        </main>
      </section>
    </div>
  );
}

const usersPageStyles = `
  .users-pro-page {
    display: grid;
    gap: 20px;
    width: 100%;
  }

  .users-pro-page * {
    box-sizing: border-box;
  }

  .users-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(320px, .9fr);
    gap: 18px;
  }

  .users-hero-main,
  .users-hero-side,
  .users-list-panel,
  .users-editor-panel {
    border-radius: 30px;
    background: rgba(255,255,255,.96);
    border: 1px solid rgba(226,232,240,.95);
    box-shadow: 0 16px 42px rgba(15,23,42,.07);
    backdrop-filter: blur(12px);
    min-width: 0;
  }

  .users-hero-main {
    position: relative;
    overflow: hidden;
    padding: 30px;
    color: #fff;
    border: none;
    background:
      radial-gradient(circle at top right, rgba(56,189,248,.35), transparent 34%),
      radial-gradient(circle at bottom left, rgba(37,99,235,.28), transparent 36%),
      linear-gradient(135deg, #020617 0%, #0f172a 48%, #1e3a8a 100%);
  }

  .users-hero-main::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px);
    background-size: 48px 48px;
    opacity: .6;
    pointer-events: none;
  }

  .users-hero-main > * {
    position: relative;
    z-index: 2;
  }

  .users-hero-badge {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,.13);
    border: 1px solid rgba(255,255,255,.14);
    color: #dbeafe;
    font-size: .82rem;
    font-weight: 950;
    margin-bottom: 14px;
  }

  .users-hero-main h1 {
    margin: 0;
    color: #fff;
    font-size: 2.55rem;
    font-weight: 950;
    letter-spacing: -.05em;
  }

  .users-hero-main p {
    margin: 12px 0 0;
    max-width: 760px;
    color: rgba(255,255,255,.82);
    line-height: 1.75;
    font-size: 1rem;
  }

  .users-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 22px;
  }

  .users-kpi-card {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 0;
    border-radius: 22px;
    padding: 16px;
    background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.14);
  }

  .users-kpi-icon {
    width: 42px;
    height: 42px;
    flex: 0 0 auto;
    border-radius: 15px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
  }

  .users-kpi-card span {
    display: block;
    color: rgba(255,255,255,.75);
    font-size: .78rem;
    font-weight: 850;
    margin-bottom: 5px;
  }

  .users-kpi-card strong {
    display: block;
    color: #fff;
    font-size: 1.35rem;
    font-weight: 950;
    line-height: 1;
  }

  .users-hero-side {
    padding: 24px;
    display: grid;
    gap: 16px;
    align-content: start;
  }

  .users-side-title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #0f172a;
    font-size: 1.05rem;
    font-weight: 950;
  }

  .users-side-list {
    display: grid;
    gap: 11px;
  }

  .users-side-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 14px 15px;
    border-radius: 17px;
    background: #f8fafc;
    border: 1px solid #edf2f7;
  }

  .users-side-row span {
    color: #64748b;
    font-size: .86rem;
    font-weight: 850;
  }

  .users-side-row strong {
    color: #0f172a;
    font-size: .98rem;
    font-weight: 950;
    text-align: right;
    word-break: break-word;
  }

  .users-alert {
    border-radius: 18px;
    padding: 14px 16px;
    font-weight: 900;
  }

  .users-alert.success {
    background: #ecfdf3;
    color: #047857;
    border: 1px solid #a7f3d0;
  }

  .users-alert.error {
    background: #fff1f2;
    color: #be123c;
    border: 1px solid #fecdd3;
  }

  .users-main-grid {
    display: grid;
    grid-template-columns: 390px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .users-list-panel,
  .users-editor-panel {
    padding: 22px;
  }

  .users-list-panel {
    position: sticky;
    top: 18px;
  }

  .users-panel-head,
  .users-editor-head,
  .users-permission-top,
  .leave-head {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .users-panel-head h2,
  .users-editor-head h2 {
    margin: 0 0 6px;
    color: #0f172a;
    font-size: 1.28rem;
    font-weight: 950;
  }

  .users-panel-head p,
  .users-editor-head p,
  .users-info-box p {
    margin: 0;
    color: #64748b;
    font-size: .9rem;
    font-weight: 750;
    line-height: 1.55;
  }

  .users-search-box {
    margin-top: 18px;
    position: relative;
  }

  .users-search-box svg {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #64748b;
  }

  .users-search-box input,
  .users-form-grid input,
  .users-form-grid select,
  .users-role-field select {
    width: 100%;
    min-height: 50px;
    border: 1px solid #dbe2ea;
    border-radius: 16px;
    padding: 0 14px;
    background: #fff;
    color: #0f172a;
    font-size: .95rem;
  }

  .users-search-box input {
    padding-left: 42px;
  }

  .users-search-box input:focus,
  .users-form-grid input:focus,
  .users-form-grid select:focus,
  .users-role-field select:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 4px rgba(37,99,235,.08);
  }

  .users-list {
    display: grid;
    gap: 10px;
    margin-top: 16px;
    max-height: 640px;
    overflow: auto;
    padding-right: 4px;
  }

  .users-list-item {
    width: 100%;
    text-align: left;
    border: 1px solid #eaecf0;
    background: #fff;
    border-radius: 20px;
    padding: 14px;
    display: flex;
    gap: 12px;
    cursor: pointer;
    transition: .18s ease;
  }

  .users-list-item:hover {
    transform: translateY(-1px);
    border-color: #bfdbfe;
  }

  .users-list-item.active {
    border-color: #2563eb;
    background: #eff6ff;
    box-shadow: 0 10px 24px rgba(37,99,235,.12);
  }

  .users-avatar {
    width: 44px;
    height: 44px;
    flex: 0 0 auto;
    border-radius: 16px;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 950;
  }

  .users-item-content {
    min-width: 0;
  }

  .users-name {
    color: #0f172a;
    font-weight: 950;
    word-break: break-word;
  }

  .users-username {
    margin-top: 4px;
    color: #64748b;
    font-size: .84rem;
    font-weight: 750;
    word-break: break-word;
  }

  .users-badges {
    margin-top: 10px;
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
  }

  .users-badges span {
    min-height: 27px;
    padding: 0 9px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #334155;
    font-size: .72rem;
    font-weight: 900;
    display: inline-flex;
    align-items: center;
  }

  .users-badges .active-status {
    background: #ecfdf3;
    color: #047857;
  }

  .users-badges .inactive-status {
    background: #fff1f2;
    color: #be123c;
  }

  .users-empty-state,
  .users-empty-editor {
    border-radius: 22px;
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    color: #64748b;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 8px;
    text-align: center;
    padding: 32px 18px;
    margin-top: 16px;
    min-height: 160px;
    font-weight: 850;
  }

  .users-empty-editor {
    min-height: 440px;
  }

  .users-empty-editor strong {
    color: #0f172a;
    font-size: 1.05rem;
    font-weight: 950;
  }

  .users-empty-editor span {
    color: #64748b;
    font-size: .9rem;
    font-weight: 750;
  }

  .users-loading-pill {
    min-height: 32px;
    padding: 0 10px;
    border-radius: 999px;
    background: #eff6ff;
    color: #1d4ed8;
    display: inline-flex;
    align-items: center;
    font-size: .78rem;
    font-weight: 950;
  }

  .users-tabs {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
    margin: 22px 0;
  }

  .users-tabs button {
    min-height: 40px;
    border-radius: 14px;
    border: 1px solid #dbe2ea;
    background: #fff;
    color: #334155;
    padding: 0 14px;
    font-weight: 900;
    cursor: pointer;
  }

  .users-tabs button.active {
    border-color: #bfdbfe;
    background: #eff6ff;
    color: #1d4ed8;
  }

  .users-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 16px;
  }

  .users-form-grid label,
  .users-role-field {
    display: grid;
    gap: 8px;
  }

  .users-form-grid label span,
  .users-role-field span {
    color: #334155;
    font-size: .86rem;
    font-weight: 900;
  }

  .users-info-box,
  .users-preview-box {
    margin-top: 18px;
    padding: 18px;
    border-radius: 22px;
    background: #f8fafc;
    border: 1px solid #e8edf4;
  }

  .users-info-box strong,
  .users-preview-box strong {
    color: #0f172a;
    font-weight: 950;
  }

  .danger-text {
    color: #be123c !important;
  }

  .users-permissions-shell {
    display: grid;
    gap: 18px;
  }

  .users-permission-top strong {
    display: block;
    margin-bottom: 4px;
  }

  .users-mini-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .users-mini-actions button {
    min-height: 34px;
    border-radius: 12px;
    border: 1px solid #dbe2ea;
    background: #fff;
    color: #334155;
    padding: 0 10px;
    font-size: .76rem;
    font-weight: 900;
    cursor: pointer;
  }

  .users-permissions-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 12px;
    margin-top: 16px;
  }

  .permission-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 13px;
    border-radius: 17px;
    background: #fff;
    border: 1px solid #e8edf4;
    cursor: pointer;
  }

  .permission-card.checked {
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  .permission-card input {
    margin-top: 4px;
  }

  .permission-card strong {
    display: block;
    color: #0f172a;
    font-size: .88rem;
    font-weight: 950;
  }

  .permission-card small {
    display: block;
    margin-top: 4px;
    color: #64748b;
    font-size: .74rem;
    font-weight: 750;
    word-break: break-word;
  }

  .leave-summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 12px;
    margin-top: 18px;
  }

  .leave-summary-grid article {
    border-radius: 20px;
    padding: 16px;
    background: #f8fafc;
    border: 1px solid #e8edf4;
    display: grid;
    gap: 8px;
  }

  .leave-summary-grid svg {
    color: #1d4ed8;
  }

  .leave-summary-grid span {
    color: #64748b;
    font-size: .8rem;
    font-weight: 850;
  }

  .leave-summary-grid strong {
    color: #0f172a;
    font-size: 1.35rem;
    font-weight: 950;
  }

  .preview-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #0f172a;
    font-weight: 950;
    margin-bottom: 14px;
  }

  .preview-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 12px;
  }

  .preview-grid div {
    border-radius: 16px;
    padding: 12px;
    background: #fff;
    border: 1px solid #e8edf4;
    min-width: 0;
  }

  .preview-grid span {
    display: block;
    color: #64748b;
    font-size: .76rem;
    font-weight: 850;
    margin-bottom: 5px;
  }

  .preview-grid strong {
    display: block;
    word-break: break-word;
    font-size: .9rem;
  }

  .users-actions-row {
    margin-top: 22px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .users-primary-btn,
  .users-soft-btn,
  .users-danger-btn {
    min-height: 46px;
    border: none;
    border-radius: 16px;
    padding: 0 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: .9rem;
    font-weight: 950;
    cursor: pointer;
    transition: transform .18s ease, opacity .18s ease;
  }

  .users-primary-btn:hover,
  .users-soft-btn:hover,
  .users-danger-btn:hover {
    transform: translateY(-1px);
  }

  .users-primary-btn {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: #fff;
    box-shadow: 0 13px 28px rgba(37,99,235,.22);
  }

  .users-soft-btn {
    background: #eef4ff;
    color: #1d4ed8;
  }

  .users-danger-btn {
    background: #d92d20;
    color: #fff;
  }

  button:disabled {
    opacity: .65;
    cursor: not-allowed;
  }

  html.dark .users-hero-side,
  html.dark .users-list-panel,
  html.dark .users-editor-panel {
    background: #111a2d;
    border-color: #24324d;
  }

  html.dark .users-side-title,
  html.dark .users-panel-head h2,
  html.dark .users-editor-head h2,
  html.dark .users-name,
  html.dark .users-form-grid label span,
  html.dark .users-role-field span,
  html.dark .users-info-box strong,
  html.dark .users-preview-box strong,
  html.dark .preview-title,
  html.dark .permission-card strong,
  html.dark .leave-summary-grid strong,
  html.dark .preview-grid strong,
  html.dark .users-empty-editor strong,
  html.dark .users-side-row strong {
    color: #e5eefc;
  }

  html.dark .users-panel-head p,
  html.dark .users-editor-head p,
  html.dark .users-username,
  html.dark .users-info-box p,
  html.dark .permission-card small,
  html.dark .preview-grid span,
  html.dark .leave-summary-grid span,
  html.dark .users-side-row span {
    color: #9fb0cf;
  }

  html.dark .users-side-row,
  html.dark .users-list-item,
  html.dark .users-search-box input,
  html.dark .users-form-grid input,
  html.dark .users-form-grid select,
  html.dark .users-role-field select,
  html.dark .users-info-box,
  html.dark .users-preview-box,
  html.dark .permission-card,
  html.dark .preview-grid div,
  html.dark .leave-summary-grid article,
  html.dark .users-empty-state,
  html.dark .users-empty-editor {
    background: #0f1728;
    border-color: #24324d;
    color: #e5eefc;
  }

  html.dark .users-list-item.active,
  html.dark .permission-card.checked {
    background: #102447;
    border-color: #2563eb;
  }

  @media (max-width: 1200px) {
    .users-hero,
    .users-main-grid {
      grid-template-columns: 1fr;
    }

    .users-list-panel {
      position: relative;
      top: auto;
    }

    .users-kpi-grid,
    .preview-grid {
      grid-template-columns: repeat(2, minmax(0,1fr));
    }
  }

  @media (max-width: 768px) {
    .users-pro-page {
      gap: 14px;
    }

    .users-hero-main,
    .users-hero-side,
    .users-list-panel,
    .users-editor-panel {
      border-radius: 22px;
      padding: 16px;
    }

    .users-hero-main h1 {
      font-size: 2rem;
    }

    .users-hero-main p {
      font-size: .9rem;
    }

    .users-kpi-grid,
    .users-form-grid,
    .users-permissions-grid,
    .leave-summary-grid,
    .preview-grid {
      grid-template-columns: 1fr;
    }

    .users-list {
      max-height: 420px;
    }

    .users-actions-row {
      justify-content: stretch;
    }

    .users-actions-row button,
    .users-primary-btn,
    .users-soft-btn,
    .users-danger-btn {
      width: 100%;
    }

    .users-tabs {
      overflow-x: auto;
      flex-wrap: nowrap;
      padding-bottom: 4px;
    }

    .users-tabs button {
      white-space: nowrap;
    }
  }
`;
