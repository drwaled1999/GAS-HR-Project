import { useEffect, useMemo, useState } from "react";
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
  supervisor: [
    "dashboard.view",
    "attendance.view",
    "requests.view",
  ],
  engineer: [
    "dashboard.view",
    "attendance.view",
    "requests.view",
  ],
  employee: [
    "dashboard.view",
    "requests.create",
    "requests.view",
  ],
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
  if (["engineer"].includes(value)) return "engineer";
  if (["supervisor"].includes(value)) return "supervisor";
  if (["employee"].includes(value)) return "employee";
  if (["cm"].includes(value)) return "cm";
  if (["project manager", "project_manager"].includes(value)) return "project_manager";

  return "employee";
}

function roleLabelFromCode(code) {
  const map = {
    owner: "System Owner",
    hr_manager: "HR Manager",
    hr_admin: "HR Admin",
    hr: "HR",
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
        await loadUsers(createdUser.id);
        setMode("edit");
      } else {
        if (!selectedUser?.id) {
          setError("Select a user first");
          setSaving(false);
          return;
        }

        const response = await updateUser(selectedUser.id, payload);
        const updatedUser = normalizeUserPreview(response?.user || { ...selectedUser, ...payload });

        await saveUserPermissions(updatedUser.id || selectedUser.id, formData.permissions);

        setMessage(response?.message || "User updated successfully");

        setUsers((prev) =>
          prev.map((user) => (user.id === selectedUser.id ? updatedUser : user))
        );

        setSelectedUser(updatedUser);
        setFormData(mapUserToForm(updatedUser));

        await loadUsers(selectedUser.id);
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
      `هل أنت متأكد من حذف المستخدم: ${selectedUser.name || selectedUser.username} ؟`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      setError("");
      setMessage("");

      const response = await deleteUser(selectedUser.id);

      setMessage(response?.message || "User deleted successfully");
      setUsers((prev) => prev.filter((user) => user.id !== selectedUser.id));
      setSelectedUser(null);
      setFormData(emptyForm);
      setMode("create");
    } catch (err) {
      console.error("Delete user error:", err);
      setError(err.message || "Failed to delete user");
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

  return (
    <div className="page users-page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Users</h1>
          <p style={{ marginTop: 8, color: "#667085" }}>
            Create users, edit profiles, assign roles, and manage permissions.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={handleCreateNew} style={primaryBtn}>
            + Add User
          </button>
        </div>
      </div>

      {message ? <div style={successBox}>{message}</div> : null}
      {error ? <div style={errorBox}>{error}</div> : null}

      <div style={layoutStyle}>
        <section style={leftPanelStyle}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ margin: "0 0 10px 0" }}>Users</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, GAS ID..."
              style={inputStyle}
            />
          </div>

          {loading ? (
            <p style={{ color: "#667085" }}>Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <p style={{ color: "#667085" }}>No users found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredUsers.map((user) => {
                const active = selectedUser?.id === user.id && !isCreateMode;
                const roleCode = normalizeRoleCodeFromUser(user);

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    style={{
                      textAlign: "left",
                      padding: 14,
                      borderRadius: 14,
                      border: active ? "1px solid #155eef" : "1px solid #eaecf0",
                      background: active ? "#eff4ff" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#101828" }}>
                      {user.name || "-"}
                    </div>
                    <div style={{ marginTop: 4, color: "#475467", fontSize: 14 }}>
                      @{user.username || "-"}
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={badgeStyle}>{roleLabelFromCode(roleCode)}</span>
                      <span style={badgeStyle}>GAS: {user.gasId || "-"}</span>
                      <span
                        style={{
                          ...badgeStyle,
                          background: user.status === "active" ? "#ecfdf3" : "#fef3f2",
                          color: user.status === "active" ? "#067647" : "#b42318",
                        }}
                      >
                        {user.status || "active"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section style={rightPanelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>
              {isCreateMode ? "Create User" : "Edit User"}
            </h2>

            {detailLoading ? (
              <span style={{ color: "#667085", fontSize: 14 }}>Loading details...</span>
            ) : null}
          </div>

          {!isCreateMode && !selectedUser ? (
            <p style={{ color: "#667085", marginTop: 16 }}>Select a user to edit</p>
          ) : (
            <>
              <div style={tabsRow}>
                <button type="button" onClick={() => setActiveTab("basic")} style={tabButton(activeTab === "basic")}>
                  Basic Info
                </button>
                <button type="button" onClick={() => setActiveTab("organization")} style={tabButton(activeTab === "organization")}>
                  Organization
                </button>
                <button type="button" onClick={() => setActiveTab("permissions")} style={tabButton(activeTab === "permissions")}>
                  Permissions
                </button>
                <button type="button" onClick={() => setActiveTab("leave")} style={tabButton(activeTab === "leave")}>
                  Leave Balance
                </button>
                <button type="button" onClick={() => setActiveTab("security")} style={tabButton(activeTab === "security")}>
                  Security
                </button>
              </div>

              {activeTab === "basic" && (
                <div style={gridStyle}>
                  <label style={labelStyle}>
                    Full Name
                    <input name="name" value={formData.name} onChange={handleChange} style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    Username
                    <input name="username" value={formData.username} onChange={handleChange} style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    Email
                    <input name="email" value={formData.email} onChange={handleChange} style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    GAS ID
                    <input name="gasId" value={formData.gasId} onChange={handleChange} style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    Job Title
                    <input name="jobTitle" value={formData.jobTitle} onChange={handleChange} style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    Nationality
                    <input name="nationality" value={formData.nationality} onChange={handleChange} style={inputStyle} />
                  </label>
                </div>
              )}

              {activeTab === "organization" && (
                <div style={gridStyle}>
                  <label style={labelStyle}>
                    Project Name
                    <input name="projectName" value={formData.projectName} onChange={handleChange} style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    Package Name
                    <input name="packageName" value={formData.packageName} onChange={handleChange} style={inputStyle} />
                  </label>

                  <label style={labelStyle}>
                    Status
                    <select name="status" value={formData.status} onChange={handleChange} style={inputStyle}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              )}

              {activeTab === "permissions" && (
                <div style={{ display: "grid", gap: 18 }}>
                  <label style={labelStyle}>
                    Role
                    <select name="roleCode" value={formData.roleCode} onChange={handleChange} style={inputStyle}>
                      <option value="owner">System Owner</option>
                      <option value="hr_manager">HR Manager</option>
                      <option value="hr_admin">HR Admin</option>
                      <option value="hr">HR</option>
                      <option value="engineer">Engineer</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="employee">Employee</option>
                      <option value="cm">CM</option>
                      <option value="project_manager">Project Manager</option>
                    </select>
                  </label>

                  <div style={infoCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <strong>Permission Matrix</strong>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={secondaryMiniBtn}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              permissions: ROLE_DEFAULT_PERMISSIONS[prev.roleCode] || [],
                            }))
                          }
                        >
                          Use Role Default
                        </button>

                        <button
                          type="button"
                          style={secondaryMiniBtn}
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
                          style={secondaryMiniBtn}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              permissions: [],
                            }))
                          }
                        >
                          Clear All
                        </button>
                      </div>
                    </div>

                    <div style={permissionsGrid}>
                      {PERMISSION_OPTIONS.map((permission) => {
                        const checked = formData.permissions.includes(permission.code);

                        return (
                          <label key={permission.code} style={permissionItem}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handlePermissionToggle(permission.code)}
                            />
                            <div>
                              <div style={{ fontWeight: 600 }}>{permission.label}</div>
                              <div style={{ fontSize: 12, color: "#667085" }}>{permission.code}</div>
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
                    <div style={infoCard}>
                      <strong>Leave Balance</strong>
                      <p style={{ marginTop: 10, color: "#667085" }}>
                        Save the user first, then you can manage their leave balance.
                      </p>
                    </div>
                  ) : !selectedUser?.employeeId ? (
                    <div style={infoCard}>
                      <strong>Leave Balance</strong>
                      <p style={{ marginTop: 10, color: "#b42318" }}>
                        This user does not have a linked employee record.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={infoCard}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <strong>Manage Leave Balance</strong>
                            <div style={{ marginTop: 6, color: "#667085", fontSize: 14 }}>
                              Edit the employee leave balances and used values manually.
                            </div>
                          </div>

                          {leaveLoading ? (
                            <span style={{ color: "#667085", fontSize: 14 }}>Loading balance...</span>
                          ) : null}
                        </div>
                      </div>

                      <div style={gridStyle}>
                        <label style={labelStyle}>
                          Annual Balance
                          <input
                            type="number"
                            min="0"
                            name="annual"
                            value={leaveForm.annual}
                            onChange={handleLeaveChange}
                            style={inputStyle}
                          />
                        </label>

                        <label style={labelStyle}>
                          Annual Used
                          <input
                            type="number"
                            min="0"
                            name="annualUsed"
                            value={leaveForm.annualUsed}
                            onChange={handleLeaveChange}
                            style={inputStyle}
                          />
                        </label>

                        <label style={labelStyle}>
                          Sick Balance
                          <input
                            type="number"
                            min="0"
                            name="sick"
                            value={leaveForm.sick}
                            onChange={handleLeaveChange}
                            style={inputStyle}
                          />
                        </label>

                        <label style={labelStyle}>
                          Sick Used
                          <input
                            type="number"
                            min="0"
                            name="sickUsed"
                            value={leaveForm.sickUsed}
                            onChange={handleLeaveChange}
                            style={inputStyle}
                          />
                        </label>

                        <label style={labelStyle}>
                          Emergency Balance
                          <input
                            type="number"
                            min="0"
                            name="emergency"
                            value={leaveForm.emergency}
                            onChange={handleLeaveChange}
                            style={inputStyle}
                          />
                        </label>

                        <label style={labelStyle}>
                          Emergency Used
                          <input
                            type="number"
                            min="0"
                            name="emergencyUsed"
                            value={leaveForm.emergencyUsed}
                            onChange={handleLeaveChange}
                            style={inputStyle}
                          />
                        </label>
                      </div>

                      <div style={infoCard}>
                        <strong>Balance Summary</strong>
                        <div style={{ marginTop: 10, color: "#475467", lineHeight: 1.9 }}>
                          <div><strong>Annual Remaining:</strong> {Number(leaveForm.annual || 0) - Number(leaveForm.annualUsed || 0)}</div>
                          <div><strong>Sick Remaining:</strong> {Number(leaveForm.sick || 0) - Number(leaveForm.sickUsed || 0)}</div>
                          <div><strong>Emergency Remaining:</strong> {Number(leaveForm.emergency || 0) - Number(leaveForm.emergencyUsed || 0)}</div>
                        </div>
                      </div>

                      <div style={actionsRow}>
                        <button
                          type="button"
                          onClick={() => loadLeaveBalance(selectedUser.employeeId)}
                          style={secondaryBtn}
                          disabled={leaveLoading || leaveSaving}
                        >
                          Reload Balance
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveLeaveBalance}
                          style={primaryBtn}
                          disabled={leaveSaving}
                        >
                          {leaveSaving ? "Saving..." : "Save Leave Balance"}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === "security" && (
                <div style={gridStyle}>
                  <label style={labelStyle}>
                    {isCreateMode ? "Password" : "New Password"}
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      style={inputStyle}
                      placeholder={
                        isCreateMode
                          ? "Enter password"
                          : "اتركه فارغ إذا ما تبي تغيّر كلمة المرور"
                      }
                    />
                  </label>
                </div>
              )}

              <div style={infoCard}>
                <strong>Profile Preview</strong>
                <div style={{ marginTop: 10, color: "#475467", lineHeight: 1.9 }}>
                  <div><strong>Name:</strong> {formData.name || "-"}</div>
                  <div><strong>Username:</strong> {formData.username || "-"}</div>
                  <div><strong>Employee ID:</strong> {formData.employeeId || "-"}</div>
                  <div><strong>GAS ID:</strong> {formData.gasId || "-"}</div>
                  <div><strong>Role:</strong> {roleLabelFromCode(formData.roleCode)}</div>
                  <div><strong>Project:</strong> {formData.projectName || "-"}</div>
                  <div><strong>Package:</strong> {formData.packageName || "-"}</div>
                  <div><strong>Permissions:</strong> {formData.permissions.length}</div>
                </div>
              </div>

              <div style={actionsRow}>
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
                  style={secondaryBtn}
                >
                  Cancel
                </button>

                {!isCreateMode ? (
                  <button type="button" onClick={handleDelete} disabled={deleting} style={dangerBtn}>
                    {deleting ? "Deleting..." : "Delete User"}
                  </button>
                ) : null}

                <button type="button" onClick={handleSave} disabled={saving} style={primaryBtn}>
                  {saving ? "Saving..." : isCreateMode ? "Create User" : "Save Changes"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const layoutStyle = {
  display: "grid",
  gridTemplateColumns: "360px 1fr",
  gap: 20,
  alignItems: "start",
};

const leftPanelStyle = {
  background: "#fff",
  border: "1px solid #eaecf0",
  borderRadius: 16,
  padding: 18,
  minHeight: 640,
};

const rightPanelStyle = {
  background: "#fff",
  border: "1px solid #eaecf0",
  borderRadius: 16,
  padding: 22,
  minHeight: 640,
};

const tabsRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 18,
};

const tabButton = (active) => ({
  padding: "10px 16px",
  borderRadius: 12,
  border: active ? "1px solid #155eef" : "1px solid #d0d5dd",
  background: active ? "#eff4ff" : "#fff",
  color: active ? "#155eef" : "#344054",
  cursor: "pointer",
  fontWeight: 600,
});

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  color: "#344054",
  fontWeight: 500,
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #d0d5dd",
  borderRadius: 10,
  outline: "none",
  fontSize: 14,
  background: "#fff",
  boxSizing: "border-box",
};

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  background: "#f2f4f7",
  color: "#344054",
  fontSize: 12,
  fontWeight: 600,
};

const primaryBtn = {
  background: "#155eef",
  color: "#fff",
  border: "none",
  padding: "12px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryBtn = {
  background: "#fff",
  color: "#344054",
  border: "1px solid #d0d5dd",
  padding: "12px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryMiniBtn = {
  background: "#fff",
  color: "#344054",
  border: "1px solid #d0d5dd",
  padding: "8px 12px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
};

const dangerBtn = {
  background: "#d92d20",
  color: "#fff",
  border: "none",
  padding: "12px 18px",
  borderRadius: 10,
  cursor: "pointer",
  fontWeight: 600,
};

const actionsRow = {
  marginTop: 22,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const infoCard = {
  marginTop: 22,
  padding: 16,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #eaecf0",
};

const successBox = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  background: "#ecfdf3",
  color: "#067647",
  border: "1px solid #abefc6",
};

const errorBox = {
  marginBottom: 16,
  padding: 12,
  borderRadius: 10,
  background: "#fef3f2",
  color: "#b42318",
  border: "1px solid #fecdca",
};

const permissionsGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 16,
};

const permissionItem = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: 12,
  border: "1px solid #eaecf0",
  borderRadius: 12,
  background: "#fff",
};
