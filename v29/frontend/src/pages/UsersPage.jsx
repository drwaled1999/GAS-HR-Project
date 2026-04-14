import { useEffect, useMemo, useState } from "react";
import { getUsers, updateUser, deleteUser } from "../services/api";

const emptyForm = {
  id: "",
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
};

function mapUserToForm(user) {
  return {
    id: user?.id || "",
    name: user?.name || "",
    username: user?.username || "",
    email: user?.email || "",
    password: "",
    gasId: user?.gasId || "",
    jobTitle: user?.jobTitle || "",
    roleCode: user?.roleCode || "employee",
    nationality: user?.nationality || "Saudi",
    projectName: user?.projectName || "",
    packageName: user?.packageName || "",
    status: user?.status || "active",
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("basic");

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");
      const data = await getUsers();
      const resolvedUsers = Array.isArray(data) ? data : data?.users || [];
      setUsers(resolvedUsers);
    } catch (err) {
      setError(err.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleSelectUser(user) {
    setSelectedUser(user);
    setFormData(mapUserToForm(user));
    setMessage("");
    setError("");
    setActiveTab("basic");
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSave() {
    if (!selectedUser?.id) {
      setError("Select a user first");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        name: formData.name,
        username: formData.username,
        email: formData.email,
        password: formData.password,
        gasId: formData.gasId,
        nationality: formData.nationality,
        projectName: formData.projectName,
        packageName: formData.packageName,
        jobTitle: formData.jobTitle,
        roleCode: formData.roleCode,
        status: formData.status,
      };

      const response = await updateUser(selectedUser.id, payload);

      setMessage(response?.message || "User updated successfully");

      const updatedUserPreview = {
        ...selectedUser,
        ...payload,
        role: roleLabelFromCode(payload.roleCode),
      };

      setUsers((prev) =>
        prev.map((user) => (user.id === selectedUser.id ? updatedUserPreview : user))
      );
      setSelectedUser(updatedUserPreview);
      setFormData((prev) => ({ ...prev, password: "" }));
    } catch (err) {
      setError(err.message || "Failed to update user");
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
    } catch (err) {
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
        user.role,
        user.jobTitle,
        user.projectName,
        user.packageName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [users, search]);

  return (
    <div className="page users-page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Users</h1>
          <p style={{ marginTop: 8, color: "#667085" }}>
            Edit users, roles, GAS ID, project, package, and account status.
          </p>
        </div>
      </div>

      {message ? (
        <div style={successBox}>{message}</div>
      ) : null}

      {error ? (
        <div style={errorBox}>{error}</div>
      ) : null}

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
                const active = selectedUser?.id === user.id;
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
                      <span style={badgeStyle}>{user.role || "Employee"}</span>
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
          <h2 style={{ marginTop: 0 }}>Edit User</h2>

          {!selectedUser ? (
            <p style={{ color: "#667085" }}>Select a user to edit</p>
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
                <div style={gridStyle}>
                  <label style={labelStyle}>
                    Role
                    <select name="roleCode" value={formData.roleCode} onChange={handleChange} style={inputStyle}>
                      <option value="owner">System Owner</option>
                      <option value="hr_manager">HR Manager</option>
                      <option value="hr">HR</option>
                      <option value="engineer">Engineer</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="employee">Employee</option>
                      <option value="cm">CM</option>
                      <option value="project_manager">Project Manager</option>
                    </select>
                  </label>
                </div>
              )}

              {activeTab === "security" && (
                <div style={gridStyle}>
                  <label style={labelStyle}>
                    New Password
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      style={inputStyle}
                      placeholder="اتركه فارغ إذا ما تبي تغيّر كلمة المرور"
                    />
                  </label>
                </div>
              )}

              <div style={infoCard}>
                <strong>Profile Preview</strong>
                <div style={{ marginTop: 10, color: "#475467", lineHeight: 1.9 }}>
                  <div><strong>Name:</strong> {formData.name || "-"}</div>
                  <div><strong>Username:</strong> {formData.username || "-"}</div>
                  <div><strong>GAS ID:</strong> {formData.gasId || "-"}</div>
                  <div><strong>Role:</strong> {roleLabelFromCode(formData.roleCode)}</div>
                  <div><strong>Project:</strong> {formData.projectName || "-"}</div>
                  <div><strong>Package:</strong> {formData.packageName || "-"}</div>
                </div>
              </div>

              <div style={actionsRow}>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(mapUserToForm(selectedUser));
                    setMessage("");
                    setError("");
                  }}
                  style={secondaryBtn}
                >
                  Cancel
                </button>

                <button type="button" onClick={handleDelete} disabled={deleting} style={dangerBtn}>
                  {deleting ? "Deleting..." : "Delete User"}
                </button>

                <button type="button" onClick={handleSave} disabled={saving} style={primaryBtn}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function roleLabelFromCode(code) {
  const map = {
    owner: "System Owner",
    hr_manager: "HR Manager",
    hr: "HR",
    engineer: "Engineer",
    supervisor: "Supervisor",
    employee: "Employee",
    cm: "CM",
    project_manager: "Project Manager",
  };

  return map[code] || "Employee";
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