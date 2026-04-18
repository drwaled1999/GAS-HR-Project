import { useEffect, useMemo, useState } from "react";
import { getUsers } from "../services/api";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getUsers();
        setUsers(Array.isArray(data) ? data : data?.users || []);
      } finally {
        setLoading(false);
      }
    }
    load();
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
    <div className="page-stack">
      {/* 🔥 HERO */}
      <div className="glass-card section-hero">
        <div>
          <div className="eyebrow dark">Users Control Center</div>
          <h2>Users Management</h2>
          <p>Manage users, roles, and permissions in a professional HR system.</p>
        </div>

        <div className="hero-mini-grid">
          <div className="mini-stat">
            <div className="mini-stat-label">Total Users</div>
            <div className="mini-stat-value">{users.length}</div>
          </div>

          <div className="mini-stat">
            <div className="mini-stat-label">Active</div>
            <div className="mini-stat-value">
              {users.filter((u) => u.status === "active").length}
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 GRID */}
      <div className="users-grid">
        {/* LEFT */}
        <div className="glass-card">
          <div className="section-title">
            <h3>Users</h3>
          </div>

          <input
            className="input"
            placeholder="Search by name, username, GAS ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {loading ? (
            <div className="empty-box">Loading users...</div>
          ) : (
            <div className="users-list">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`user-card ${
                    selectedUser?.id === user.id ? "active" : ""
                  }`}
                >
                  <div className="user-name">{user.name}</div>
                  <div className="user-sub">@{user.username}</div>

                  <div className="badges">
                    <span className="badge">{user.role || "Employee"}</span>
                    <span className="badge">GAS: {user.gasId}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="glass-card">
          {!selectedUser ? (
            <div className="empty-box">
              Select user from left to edit
            </div>
          ) : (
            <>
              <div className="section-title">
                <h3>Edit User</h3>
              </div>

              <div className="form-grid">
                <input value={selectedUser.name || ""} readOnly />
                <input value={selectedUser.username || ""} readOnly />
                <input value={selectedUser.email || ""} readOnly />
                <input value={selectedUser.gasId || ""} readOnly />
              </div>

              <div className="inline-actions" style={{ marginTop: 20 }}>
                <button className="btn secondary">Cancel</button>
                <button className="btn danger">Delete</button>
                <button className="btn primary">Save</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 🔥 CSS */}
      <style>{`
        .users-grid {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 20px;
        }

        .users-grid > * {
          min-width: 0;
        }

        .users-list {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .user-card {
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          cursor: pointer;
          transition: 0.2s;
        }

        .user-card:hover {
          background: #f9fafb;
        }

        .user-card.active {
          border-color: #155eef;
          background: #eff4ff;
        }

        .user-name {
          font-weight: 700;
          color: #101828;
        }

        .user-sub {
          font-size: 13px;
          color: #667085;
        }

        .badges {
          display: flex;
          gap: 6px;
          margin-top: 6px;
        }

        .badge {
          background: #f2f4f7;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
      `}</style>
    </div>
  );
}