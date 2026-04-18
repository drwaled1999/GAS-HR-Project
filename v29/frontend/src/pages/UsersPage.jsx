import { useEffect, useMemo, useState } from "react";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  saveUserPermissions,
  deleteUser,
} from "../services/api";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(Array.isArray(data) ? data : data?.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;

    return users.filter((u) =>
      [u.name, u.username, u.gasId]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [users, search]);

  return (
    <div className="users-pro-page">
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1>Users Management</h1>
          <p>Manage users, roles and permissions in one place</p>
        </div>

        <button className="btn-primary">+ Add User</button>
      </div>

      {/* MAIN GRID */}
      <div className="layout-grid">
        {/* LEFT SIDE */}
        <div className="glass-card list-card">
          <h3>Users</h3>

          <input
            placeholder="Search by name, username, GAS ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />

          {loading ? (
            <p className="muted">Loading...</p>
          ) : (
            <div className="users-list">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`user-item ${
                    selectedUser?.id === user.id ? "active" : ""
                  }`}
                >
                  <div className="user-name">{user.name}</div>
                  <div className="user-sub">@{user.username}</div>

                  <div className="user-badges">
                    <span className="badge">{user.role || "Employee"}</span>
                    <span className="badge">GAS: {user.gasId}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT SIDE */}
        <div className="glass-card editor-card">
          {!selectedUser ? (
            <div className="empty-state">
              <h2>Select User</h2>
              <p>Choose a user from the left to edit details</p>
            </div>
          ) : (
            <div className="editor-content">
              <h2>Edit User</h2>

              <div className="form-grid">
                <input value={selectedUser.name} readOnly />
                <input value={selectedUser.username} readOnly />
                <input value={selectedUser.email || ""} readOnly />
                <input value={selectedUser.gasId || ""} readOnly />
              </div>

              <div className="actions">
                <button className="btn-secondary">Cancel</button>
                <button className="btn-danger">Delete</button>
                <button className="btn-primary">Save</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS */}
      <style>{`
        .users-pro-page {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .page-header h1 {
          margin: 0;
        }

        .layout-grid {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 20px;
          align-items: stretch;
        }

        .layout-grid > * {
          min-width: 0;
        }

        .glass-card {
          background: #fff;
          border-radius: 16px;
          padding: 20px;
          border: 1px solid #e5e7eb;
        }

        .list-card {
          min-height: 700px;
        }

        .editor-card {
          min-height: 700px;
          width: 100%;
        }

        .search-input {
          width: 100%;
          padding: 10px;
          margin: 10px 0;
          border-radius: 10px;
          border: 1px solid #ddd;
        }

        .users-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .user-item {
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #eee;
          cursor: pointer;
        }

        .user-item.active {
          border-color: #155eef;
          background: #eff4ff;
        }

        .user-name {
          font-weight: bold;
        }

        .user-sub {
          color: #666;
          font-size: 13px;
        }

        .user-badges {
          display: flex;
          gap: 6px;
          margin-top: 6px;
        }

        .badge {
          background: #f3f4f6;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
        }

        .empty-state {
          text-align: center;
          margin-top: 120px;
          color: #777;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 20px;
        }

        .actions {
          margin-top: 20px;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }

        .btn-primary {
          background: #155eef;
          color: #fff;
          padding: 10px 16px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
        }

        .btn-secondary {
          background: #fff;
          border: 1px solid #ccc;
          padding: 10px 16px;
          border-radius: 10px;
          cursor: pointer;
        }

        .btn-danger {
          background: #dc2626;
          color: #fff;
          padding: 10px 16px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}