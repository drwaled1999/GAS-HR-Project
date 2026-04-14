import { useEffect, useState } from "react";
import { getUsers, updateUser } from "../services/api";

const emptyForm = {
  fullName: "",
  username: "",
  password: "",
  gasId: "",
  jobTitle: "",
  systemRole: "",
  nationalityType: "Saudi",
  status: "Active",
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleSelectUser(user) {
    setSelectedUser(user);
    setMessage("");
    setError("");
    setFormData({
      fullName: user.fullName || "",
      username: user.username || "",
      password: "",
      gasId: user.gasId || "",
      jobTitle: user.jobTitle || "",
      systemRole: user.systemRole || "",
      nationalityType: user.nationalityType || "Saudi",
      status: user.status || "Active",
    });
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSaveChanges() {
    try {
      if (!selectedUser) {
        setError("Please select a user first");
        return;
      }

      setSaving(true);
      setMessage("");
      setError("");

      const userId = selectedUser._id || selectedUser.id || selectedUser.uuid;

      if (!userId) {
        setError("User ID not found");
        return;
      }

      const payload = {
        fullName: formData.fullName,
        username: formData.username,
        gasId: formData.gasId,
        jobTitle: formData.jobTitle,
        systemRole: formData.systemRole,
        nationalityType: formData.nationalityType,
        status: formData.status,
      };

      if (formData.password && formData.password.trim()) {
        payload.password = formData.password;
      }

      const updatedUser = await updateUser(userId, payload);

      setMessage("User updated successfully");

      setUsers((prev) =>
        prev.map((user) => {
          const currentId = user._id || user.id || user.uuid;
          return currentId === userId ? updatedUser : user;
        })
      );

      setSelectedUser(updatedUser);
      setFormData({
        fullName: updatedUser.fullName || "",
        username: updatedUser.username || "",
        password: "",
        gasId: updatedUser.gasId || "",
        jobTitle: updatedUser.jobTitle || "",
        systemRole: updatedUser.systemRole || "",
        nationalityType: updatedUser.nationalityType || "Saudi",
        status: updatedUser.status || "Active",
      });
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: "20px", padding: "20px" }}>
      <div style={{ width: "35%" }}>
        <h2>Users</h2>

        {loading && <p>Loading users...</p>}
        {error && !selectedUser && (
          <p style={{ color: "red", background: "#ffeaea", padding: "10px", borderRadius: "8px" }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {users.map((user) => {
            const userId = user._id || user.id || user.uuid;
            return (
              <button
                key={userId}
                onClick={() => handleSelectUser(user)}
                style={{
                  textAlign: "left",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  background:
                    (selectedUser?._id || selectedUser?.id || selectedUser?.uuid) === userId
                      ? "#e8f0ff"
                      : "#fff",
                  cursor: "pointer",
                }}
              >
                <div><strong>{user.fullName || "-"}</strong></div>
                <div>{user.username || "-"}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ width: "65%" }}>
        <h2>Edit User</h2>

        {!selectedUser ? (
          <p>Select a user to edit</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              background: "#fff",
              padding: "20px",
              borderRadius: "14px",
              border: "1px solid #eee",
            }}
          >
            <div>
              <label>Full Name</label>
              <input
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>

            <div>
              <label>Username</label>
              <input
                name="username"
                value={formData.username}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>

            <div>
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Leave blank to keep current password"
                style={inputStyle}
              />
            </div>

            <div>
              <label>GAS ID</label>
              <input
                name="gasId"
                value={formData.gasId}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>

            <div>
              <label>Job Title</label>
              <input
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>

            <div>
              <label>System Role</label>
              <select
                name="systemRole"
                value={formData.systemRole}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">Select role</option>
                <option value="Admin">Admin</option>
                <option value="HR">HR</option>
                <option value="Employee">Employee</option>
              </select>
            </div>

            <div>
              <label>Nationality Type</label>
              <select
                name="nationalityType"
                value={formData.nationalityType}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="Saudi">Saudi</option>
                <option value="Non-Saudi">Non-Saudi</option>
              </select>
            </div>

            <div>
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              {error && (
                <div
                  style={{
                    color: "#b42318",
                    background: "#fef3f2",
                    border: "1px solid #fecdca",
                    padding: "12px",
                    borderRadius: "10px",
                    marginBottom: "12px",
                  }}
                >
                  {error}
                </div>
              )}

              {message && (
                <div
                  style={{
                    color: "#067647",
                    background: "#ecfdf3",
                    border: "1px solid #abefc6",
                    padding: "12px",
                    borderRadius: "10px",
                    marginBottom: "12px",
                  }}
                >
                  {message}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => handleSelectUser(selectedUser)}
                  style={secondaryBtn}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={saving}
                  style={primaryBtn}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #d0d5dd",
  marginTop: "6px",
};

const primaryBtn = {
  background: "#155eef",
  color: "#fff",
  border: "none",
  padding: "12px 18px",
  borderRadius: "10px",
  cursor: "pointer",
};

const secondaryBtn = {
  background: "#fff",
  color: "#344054",
  border: "1px solid #d0d5dd",
  padding: "12px 18px",
  borderRadius: "10px",
  cursor: "pointer",
};