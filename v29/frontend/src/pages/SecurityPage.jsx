import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function pick(item, camel, snake, fallback = "-") {
  return item?.[camel] ?? item?.[snake] ?? fallback;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export default function SecurityPage() {
  const { user } = useAuth();

  const [data, setData] = useState({
    summary: {
      lockedUsers: 0,
      failedLogins: 0,
      securityEvents: 0,
      auditLogs: 0,
    },
    lockedUsers: [],
    recentLoginAttempts: [],
    recentSecurityEvents: [],
    recentAuditLogs: [],
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState("");

  const isSystemOwner = useMemo(() => {
    const role = normalizeRole(user?.role || user?.roleName || user?.roleCode);
    return ["system owner", "system_owner", "systemowner", "owner"].includes(role);
  }, [user]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [summaryRes, lockedUsersRes, loginAttemptsRes, eventsRes, auditLogsRes] =
        await Promise.all([
          apiFetch("/security/summary"),
          apiFetch("/security/locked-users"),
          apiFetch("/security/login-attempts"),
          apiFetch("/security/events"),
          apiFetch("/security/audit-logs"),
        ]);

      const lockedUsers = Array.isArray(lockedUsersRes?.users)
        ? lockedUsersRes.users
        : [];

      setData({
        summary: {
          lockedUsers: lockedUsers.length,
          failedLogins: Number(
            summaryRes?.failedLogins ?? summaryRes?.failed_logins ?? 0
          ),
          securityEvents: Number(
            summaryRes?.securityEvents ?? summaryRes?.security_events ?? 0
          ),
          auditLogs: Number(summaryRes?.auditLogs ?? summaryRes?.audit_logs ?? 0),
        },
        lockedUsers,
        recentLoginAttempts: Array.isArray(loginAttemptsRes?.items)
          ? loginAttemptsRes.items
          : [],
        recentSecurityEvents: Array.isArray(eventsRes?.items)
          ? eventsRes.items
          : [],
        recentAuditLogs: Array.isArray(auditLogsRes?.items)
          ? auditLogsRes.items
          : [],
      });
    } catch (err) {
      console.error("Security page load error:", err);
      setError(err?.message || "Failed to load security dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function unlockUser(userId) {
    try {
      setUnlockingId(userId);
      setError("");
      await apiFetch(`/security/unlock/${userId}`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err?.message || "Failed to unlock user");
    } finally {
      setUnlockingId("");
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <div>
            <h3 style={styles.loadingTitle}>Loading security dashboard...</h3>
            <p style={styles.loadingText}>Please wait while audit data is loaded.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isSystemOwner) {
    return (
      <div style={styles.page}>
        <div style={styles.hero}>
          <div>
            <div style={styles.badge}>Restricted Area</div>
            <h1 style={styles.title}>Security & Audit</h1>
            <p style={styles.subtitle}>
              Monitoring locked accounts, login attempts, security events, and audit logs.
            </p>
          </div>
        </div>

        <div style={styles.deniedCard}>
          <div style={styles.deniedIcon}>🔒</div>
          <h2 style={styles.deniedTitle}>Access Restricted</h2>
          <p style={styles.deniedText}>هذه الصفحة متاحة لـ System Owner فقط.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.badge}>Security Control Center</div>
          <h1 style={styles.title}>Security & Audit</h1>
          <p style={styles.subtitle}>
            مراقبة الحسابات المقفلة، محاولات الدخول، الأحداث الأمنية، وسجلات التدقيق.
          </p>
        </div>

        <button style={styles.refreshButton} onClick={load}>
          Refresh Data
        </button>
      </div>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <div style={styles.statsGrid}>
        <StatCard title="Locked Users" value={data.summary.lockedUsers} tone="danger" />
        <StatCard title="Failed Logins" value={data.summary.failedLogins} tone="warning" />
        <StatCard title="Security Events" value={data.summary.securityEvents} tone="info" />
        <StatCard title="Audit Logs" value={data.summary.auditLogs} tone="dark" />
      </div>

      <div style={styles.layout}>
        <section style={styles.mainColumn}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Locked Accounts</h2>
                <p style={styles.cardDesc}>
                  Users currently locked due to failed attempts or account status.
                </p>
              </div>
              <span style={styles.countPill}>{data.lockedUsers.length} accounts</span>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Username</th>
                    <th style={styles.th}>GAS ID</th>
                    <th style={styles.th}>Division</th>
                    <th style={styles.th}>Attempts</th>
                    <th style={styles.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lockedUsers.length ? (
                    data.lockedUsers.map((item) => {
                      const failedAttempts =
                        pick(item, "failedAttempts", "failed_attempts", 0) || 0;

                      return (
                        <tr key={item.id}>
                          <td style={styles.td}>{item.name || item.fullName || item.full_name || "-"}</td>
                          <td style={styles.td}>{item.username || "-"}</td>
                          <td style={styles.td}>{pick(item, "gasId", "gas_id")}</td>
                          <td style={styles.td}>{item.division || "-"}</td>
                          <td style={styles.td}>
                            <span style={styles.attemptBadge}>{failedAttempts}</span>
                          </td>
                          <td style={styles.td}>
                            <button
                              style={{
                                ...styles.unlockButton,
                                ...(unlockingId === item.id ? styles.disabledButton : {}),
                              }}
                              disabled={unlockingId === item.id}
                              onClick={() => unlockUser(item.id)}
                            >
                              {unlockingId === item.id ? "Unlocking..." : "Unlock"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td style={styles.emptyTd} colSpan="6">
                        لا توجد حسابات مقفلة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <ActivityCard
            title="Recent Audit Logs"
            description="Latest system actions and administrative changes."
            emptyText="No audit logs found."
            items={data.recentAuditLogs}
            renderItem={(item) => (
              <>
                <strong>{item.action || "-"}</strong>
                <span> — {pick(item, "actorName", "actor_name", "Unknown")}</span>
                <small>{formatDate(pick(item, "createdAt", "created_at", ""))}</small>
              </>
            )}
          />
        </section>

        <aside style={styles.sideColumn}>
          <ActivityCard
            title="Recent Login Attempts"
            description="Latest authentication attempts."
            emptyText="No login attempts found."
            items={data.recentLoginAttempts}
            renderItem={(item) => (
              <>
                <strong>{item.username || "-"}</strong>
                <span> — {item.status || "-"}</span>
                <small>{formatDate(pick(item, "createdAt", "created_at", ""))}</small>
              </>
            )}
          />

          <ActivityCard
            title="Recent Security Events"
            description="Important security events captured by the system."
            emptyText="No security events found."
            items={data.recentSecurityEvents}
            renderItem={(item) => (
              <>
                <strong>{pick(item, "eventType", "event_type", "-")}</strong>
                <span> — user #{pick(item, "userId", "user_id", "-")}</span>
                <small>{formatDate(pick(item, "createdAt", "created_at", ""))}</small>
              </>
            )}
          />
        </aside>
      </div>
    </div>
  );
}

function StatCard({ title, value, tone }) {
  const toneStyle =
    tone === "danger"
      ? styles.statDanger
      : tone === "warning"
      ? styles.statWarning
      : tone === "info"
      ? styles.statInfo
      : styles.statDark;

  return (
    <div style={{ ...styles.statCard, ...toneStyle }}>
      <span style={styles.statLabel}>{title}</span>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  );
}

function ActivityCard({ title, description, items, emptyText, renderItem }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeaderCompact}>
        <div>
          <h2 style={styles.cardTitle}>{title}</h2>
          <p style={styles.cardDesc}>{description}</p>
        </div>
      </div>

      <div style={styles.activityList}>
        {items.length ? (
          items.map((item, index) => (
            <div key={item.id || index} style={styles.activityItem}>
              <div style={styles.activityDot} />
              <div style={styles.activityContent}>{renderItem(item)}</div>
            </div>
          ))
        ) : (
          <div style={styles.emptyBox}>{emptyText}</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px",
    background:
      "radial-gradient(circle at top left, rgba(37, 99, 235, 0.14), transparent 32%), linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)",
    color: "#0f172a",
  },

  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "flex-start",
    marginBottom: "22px",
    padding: "28px",
    borderRadius: "28px",
    background:
      "linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(127, 29, 29, 0.9))",
    color: "#fff",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
    flexWrap: "wrap",
  },

  badge: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.2)",
    fontSize: "12px",
    fontWeight: 800,
    marginBottom: "12px",
  },

  title: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  subtitle: {
    margin: "10px 0 0",
    maxWidth: "720px",
    color: "rgba(255,255,255,0.78)",
    fontSize: "15px",
    lineHeight: 1.8,
  },

  refreshButton: {
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    borderRadius: "16px",
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },

  errorBox: {
    marginBottom: "16px",
    padding: "14px 16px",
    borderRadius: "18px",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 800,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "16px",
    marginBottom: "22px",
  },

  statCard: {
    padding: "22px",
    borderRadius: "24px",
    border: "1px solid rgba(148,163,184,0.22)",
    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.08)",
    display: "grid",
    gap: "10px",
    minHeight: "118px",
  },

  statDanger: {
    background: "linear-gradient(135deg, #fff, #fee2e2)",
  },

  statWarning: {
    background: "linear-gradient(135deg, #fff, #fef3c7)",
  },

  statInfo: {
    background: "linear-gradient(135deg, #fff, #dbeafe)",
  },

  statDark: {
    background: "linear-gradient(135deg, #fff, #e2e8f0)",
  },

  statLabel: {
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 900,
  },

  statValue: {
    fontSize: "38px",
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.06em",
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(340px, 0.85fr)",
    gap: "22px",
    alignItems: "start",
  },

  mainColumn: {
    display: "grid",
    gap: "18px",
  },

  sideColumn: {
    display: "grid",
    gap: "18px",
  },

  card: {
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    borderRadius: "26px",
    padding: "22px",
    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.08)",
    backdropFilter: "blur(14px)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
    marginBottom: "16px",
    flexWrap: "wrap",
  },

  cardHeaderCompact: {
    marginBottom: "16px",
  },

  cardTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },

  cardDesc: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  countPill: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#334155",
    fontWeight: 900,
    fontSize: "12px",
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    minWidth: "760px",
    borderCollapse: "separate",
    borderSpacing: "0 10px",
  },

  th: {
    textAlign: "left",
    padding: "10px 12px",
    color: "#64748b",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  td: {
    padding: "14px 12px",
    background: "#f8fafc",
    borderTop: "1px solid rgba(148,163,184,0.16)",
    borderBottom: "1px solid rgba(148,163,184,0.16)",
    color: "#334155",
    fontSize: "14px",
  },

  emptyTd: {
    padding: "24px",
    textAlign: "center",
    background: "#f8fafc",
    color: "#64748b",
    borderRadius: "16px",
  },

  attemptBadge: {
    display: "inline-flex",
    justifyContent: "center",
    minWidth: "34px",
    padding: "6px 9px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 950,
  },

  unlockButton: {
    border: 0,
    borderRadius: "14px",
    padding: "10px 14px",
    background: "linear-gradient(135deg, #0f172a, #1d4ed8)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },

  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  activityList: {
    display: "grid",
    gap: "12px",
  },

  activityItem: {
    display: "flex",
    gap: "12px",
    padding: "14px",
    borderRadius: "18px",
    background: "#f8fafc",
    border: "1px solid rgba(148,163,184,0.16)",
  },

  activityDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: "#1d4ed8",
    marginTop: "6px",
    boxShadow: "0 0 0 4px rgba(29,78,216,0.12)",
    flexShrink: 0,
  },

  activityContent: {
    display: "grid",
    gap: "4px",
    color: "#334155",
    fontSize: "14px",
    lineHeight: 1.5,
  },

  emptyBox: {
    padding: "18px",
    textAlign: "center",
    borderRadius: "18px",
    background: "#f8fafc",
    color: "#64748b",
    border: "1px dashed rgba(148,163,184,0.4)",
  },

  deniedCard: {
    maxWidth: "560px",
    margin: "0 auto",
    textAlign: "center",
    padding: "34px",
    borderRadius: "28px",
    background: "#fff",
    border: "1px solid rgba(148,163,184,0.22)",
    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.08)",
  },

  deniedIcon: {
    fontSize: "42px",
    marginBottom: "10px",
  },

  deniedTitle: {
    margin: 0,
    color: "#0f172a",
  },

  deniedText: {
    color: "#64748b",
    marginBottom: 0,
  },

  loadingCard: {
    maxWidth: "520px",
    margin: "80px auto",
    display: "flex",
    gap: "16px",
    alignItems: "center",
    background: "#fff",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.08)",
  },

  spinner: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    border: "4px solid #fee2e2",
    borderTopColor: "#dc2626",
  },

  loadingTitle: {
    margin: 0,
    color: "#0f172a",
  },

  loadingText: {
    margin: "5px 0 0",
    color: "#64748b",
  },
};
