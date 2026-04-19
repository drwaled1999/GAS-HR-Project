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
    <div className="page-stack users-pro-page">
      <style>{`
        .users-pro-page {
          display: grid;
          gap: 20px;
          width: 100%;
          max-width: 100%;
        }

        .users-pro-page .hero-shell {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
          gap: 18px;
          width: 100%;
        }

        .users-pro-page .hero-main,
        .users-pro-page .hero-side,
        .users-pro-page .list-card,
        .users-pro-page .editor-card {
          border-radius: 28px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(10px);
          min-width: 0;
        }

        .users-pro-page .hero-main {
          padding: 28px;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          color: #fff;
          border: none;
        }

        .users-pro-page .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 0.82rem;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          margin-bottom: 14px;
        }

        .users-pro-page .hero-main h1 {
          margin: 0 0 10px 0;
          font-size: 2.4rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #fff;
        }

        .users-pro-page .hero-main p {
          margin: 0;
          max-width: 720px;
          color: rgba(255, 255, 255, 0.84);
          line-height: 1.7;
          font-size: 0.98rem;
        }

        .users-pro-page .hero-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .users-pro-page .hero-kpi {
          border-radius: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.14);
          min-width: 0;
        }

        .users-pro-page .hero-kpi .label {
          display: block;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.82rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .users-pro-page .hero-kpi .value {
          font-size: 1.6rem;
          font-weight: 900;
          color: #fff;
          line-height: 1;
        }

        .users-pro-page .hero-side {
          padding: 24px;
          display: grid;
          gap: 14px;
          align-content: start;
        }

        .users-pro-page .side-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1rem;
          font-weight: 900;
          color: #0f172a;
        }

        .users-pro-page .side-stat-list {
          display: grid;
          gap: 12px;
        }

        .users-pro-page .side-stat {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 16px;
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
          min-width: 0;
        }

        .users-pro-page .side-stat span {
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .users-pro-page .side-stat strong {
          color: #0f172a;
          font-size: 1.02rem;
          font-weight: 900;
          text-align: right;
          word-break: break-word;
        }

        .users-pro-page .layout-grid {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 20px;
          align-items: stretch;
        }

        .users-pro-page .layout-grid > * {
          min-width: 0;
        }

        .users-pro-page .list-card {
          padding: 20px;
          min-height: 720px;
        }

        .users-pro-page .editor-card {
          padding: 24px;
          min-height: 720px;
          width: 100%;
          display: block;
        }

        .users-pro-page .card-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .users-pro-page .card-head h2 {
          margin: 0 0 6px 0;
          font-size: 1.2rem;
          font-weight: 900;
          color: #0f172a;
        }

        .users-pro-page .card-head p {
          margin: 0;
          color: #64748b;
          font-size: 0.92rem;
        }

        .users-pro-page .alert-pro {
          border-radius: 18px;
          padding: 14px 16px;
          font-weight: 800;
          font-size: 0.94rem;
        }

        .users-pro-page .alert-pro.success {
          background: #ecfdf3;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .users-pro-page .alert-pro.error {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        .users-pro-page .btn-primary-strong,
        .users-pro-page .btn-soft,
        .users-pro-page .btn-danger {
          min-height: 46px;
          border: none;
          border-radius: 16px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.18s ease, opacity 0.2s ease;
        }

        .users-pro-page .btn-primary-strong:hover,
        .users-pro-page .btn-soft:hover,
        .users-pro-page .btn-danger:hover {
          transform: translateY(-1px);
        }

        .users-pro-page .btn-primary-strong {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
        }

        .users-pro-page .btn-soft {
          background: #eef4ff;
          color: #1d4ed8;
        }

        .users-pro-page .btn-danger {
          background: #d92d20;
          color: #fff;
        }

        .users-pro-page .users-search {
          position: relative;
          margin-top: 10px;
        }

        .users-pro-page .users-search input,
        .users-pro-page .field-pro input,
        .users-pro-page .field-pro select {
          min-height: 50px;
          width: 100%;
          border-radius: 16px;
          border: 1px solid #dbe2ea;
          padding: 0 14px;
          background: #fff;
          color: #0f172a;
          font-size: 0.95rem;
          box-sizing: border-box;
        }

        .users-pro-page .users-search input {
          padding-left: 40px;
        }

        .users-pro-page .users-search input:focus,
        .users-pro-page .field-pro input:focus,
        .users-pro-page .field-pro select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }

        .users-pro-page .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .users-pro-page .users-list {
          display: grid;
          gap: 10px;
          margin-top: 16px;
          max-height: 560px;
          overflow: auto;
          padding-right: 4px;
        }

        .users-pro-page .user-item {
          text-align: left;
          padding: 14px;
          border-radius: 16px;
          border: 1px solid #eaecf0;
          background: #fff;
          cursor: pointer;
          transition: border-color 0.2s ease, transform 0.18s ease, background 0.2s ease;
        }

        .users-pro-page .user-item:hover {
          transform: translateY(-1px);
        }

        .users-pro-page .user-item.active {
          border-color: #155eef;
          background: #eff4ff;
        }

        .users-pro-page .user-name {
          font-weight: 800;
          color: #101828;
          word-break: break-word;
        }

        .users-pro-page .user-username {
          margin-top: 4px;
          color: #475467;
          font-size: 14px;
          word-break: break-word;
        }

        .users-pro-page .user-badges {
          margin-top: 8px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .users-pro-page .soft-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 0.76rem;
          font-weight: 900;
          background: #f2f4f7;
          color: #344054;
        }

        .users-pro-page .soft-badge.active-status {
          background: #ecfdf3;
          color: #067647;
        }

        .users-pro-page .soft-badge.inactive-status {
          background: #fef3f2;
          color: #b42318;
        }

        .users-pro-page .editor-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .users-pro-page .editor-top h2 {
          margin: 0;
          color: #0f172a;
          font-size: 1.4rem;
          font-weight: 900;
        }

        .users-pro-page .editor-status {
          color: #667085;
          font-size: 14px;
          font-weight: 700;
        }

        .users-pro-page .tabs-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin: 20px 0 18px 0;
        }

        .users-pro-page .tab-btn {
          padding: 10px 16px;
          border-radius: 12px;
          border: 1px solid #d0d5dd;
          background: #fff;
          color: #344054;
          cursor: pointer;
          font-weight: 700;
        }

        .users-pro-page .tab-btn.active {
          border-color: #155eef;
          background: #eff4ff;
          color: #155eef;
        }

        .users-pro-page .grid-pro {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .users-pro-page .field-pro {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #344054;
          font-weight: 700;
          min-width: 0;
        }

        .users-pro-page .info-card {
          margin-top: 22px;
          padding: 16px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid #eaecf0;
        }

        .users-pro-page .info-card strong {
          color: #101828;
        }

        .users-pro-page .info-card p,
        .users-pro-page .info-card div {
          color: #475467;
          line-height: 1.8;
          word-break: break-word;
        }

        .users-pro-page .permission-header {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .users-pro-page .mini-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .users-pro-page .mini-btn {
          background: #fff;
          color: #344054;
          border: 1px solid #d0d5dd;
          padding: 8px 12px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 700;
          font-size: 12px;
        }

        .users-pro-page .permissions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 16px;
        }

        .users-pro-page .permission-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 12px;
          border: 1px solid #eaecf0;
          border-radius: 14px;
          background: #fff;
        }

        .users-pro-page .permission-item input {
          margin-top: 3px;
        }

        .users-pro-page .permission-label {
          font-weight: 700;
          color: #101828;
        }

        .users-pro-page .permission-code {
          font-size: 12px;
          color: #667085;
          margin-top: 4px;
          word-break: break-word;
        }

        .users-pro-page .actions-row {
          margin-top: 22px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .users-pro-page .empty-editor {
          min-height: 420px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #667085;
          font-weight: 700;
          font-size: 1rem;
          border: 1px dashed #d0d5dd;
          border-radius: 18px;
          background: #fafcff;
        }

        @media (max-width: 1200px) {
          .users-pro-page .hero-shell,
          .users-pro-page .layout-grid {
            grid-template-columns: 1fr;
          }

          .users-pro-page .hero-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .users-pro-page .hero-main h1 {
            font-size: 2rem;
          }

          .users-pro-page .hero-kpis,
          .users-pro-page .grid-pro,
          .users-pro-page .permissions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="hero-shell">
        <div className="hero-main">
          <div className="hero-badge">Users Control Center</div>

          <h1>Users Management</h1>
          <p>
            Create users, edit profiles, assign roles, manage permissions,
            and control leave balances from one centralized HR dashboard.
          </p>

          <div className="hero-kpis">
            <div className="hero-kpi">
              <span className="label">Total Users</span>
              <strong className="value">{users.length}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Filtered</span>
              <strong className="value">{filteredUsers.length}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Active</span>
              <strong className="value">
                {users.filter((u) => String(u.status || "active").toLowerCase() === "active").length}
              </strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Permissions</span>
              <strong className="value">{formData.permissions.length}</strong>
            </div>
          </div>
        </div>

        <div className="hero-side">
          <div className="side-title">Current Snapshot</div>

          <div className="side-stat-list">
            <div className="side-stat">
              <span>Mode</span>
              <strong>{isCreateMode ? "Create" : "Edit"}</strong>
            </div>
            <div className="side-stat">
              <span>Selected User</span>
              <strong>{selectedUser?.name || "-"}</strong>
            </div>
            <div className="side-stat">
              <span>Role</span>
              <strong>{roleLabelFromCode(formData.roleCode)}</strong>
            </div>
            <div className="side-stat">
              <span>GAS ID</span>
              <strong>{formData.gasId || "-"}</strong>
            </div>
          </div>
        </div>
      </section>

      {message ? <div className="alert-pro success">{message}</div> : null}
      {error ? <div className="alert-pro error">{error}</div> : null}

      <div className="layout-grid">
        <section className="list-card">
          <div className="card-head">
            <div>
              <h2>Users</h2>
              <p>Browse and search users by name, username, role, or GAS ID.</p>
            </div>

            <button type="button" onClick={handleCreateNew} className="btn-primary-strong">
              + Add User
            </button>
          </div>

          <div className="users-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, username, GAS ID..."
            />
          </div>

          {loading ? (
            <p style={{ color: "#667085", marginTop: 16 }}>Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <p style={{ color: "#667085", marginTop: 16 }}>No users found.</p>
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
                    className={`user-item ${active ? "active" : ""}`}
                  >
                    <div className="user-name">{user.name || "-"}</div>
                    <div className="user-username">@{user.username || "-"}</div>

                    <div className="user-badges">
                      <span className="soft-badge">{roleLabelFromCode(roleCode)}</span>
                      <span className="soft-badge">GAS: {user.gasId || "-"}</span>
                      <span
                        className={`soft-badge ${
                          String(user.status || "active").toLowerCase() === "active"
                            ? "active-status"
                            : "inactive-status"
                        }`}
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

        <section className="editor-card">
          <div className="editor-top">
            <h2>{isCreateMode ? "Create User" : "Edit User"}</h2>

            {detailLoading ? (
              <span className="editor-status">Loading details...</span>
            ) : null}
          </div>

          {!isCreateMode && !selectedUser ? (
            <div className="empty-editor">Select a user to edit</div>
          ) : (
            <>
              <div className="tabs-row">
                <button
                  type="button"
                  onClick={() => setActiveTab("basic")}
                  className={`tab-btn ${activeTab === "basic" ? "active" : ""}`}
                >
                  Basic Info
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("organization")}
                  className={`tab-btn ${activeTab === "organization" ? "active" : ""}`}
                >
                  Organization
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("permissions")}
                  className={`tab-btn ${activeTab === "permissions" ? "active" : ""}`}
                >
                  Permissions
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("leave")}
                  className={`tab-btn ${activeTab === "leave" ? "active" : ""}`}
                >
                  Leave Balance
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("security")}
                  className={`tab-btn ${activeTab === "security" ? "active" : ""}`}
                >
                  Security
                </button>
              </div>

              {activeTab === "basic" && (
                <div className="grid-pro">
                  <label className="field-pro">
                    Full Name
                    <input name="name" value={formData.name} onChange={handleChange} />
                  </label>

                  <label className="field-pro">
                    Username
                    <input name="username" value={formData.username} onChange={handleChange} />
                  </label>

                  <label className="field-pro">
                    Email
                    <input name="email" value={formData.email} onChange={handleChange} />
                  </label>

                  <label className="field-pro">
                    GAS ID
                    <input name="gasId" value={formData.gasId} onChange={handleChange} />
                  </label>

                  <label className="field-pro">
                    Job Title
                    <input name="jobTitle" value={formData.jobTitle} onChange={handleChange} />
                  </label>

                  <label className="field-pro">
                    Nationality
                    <input name="nationality" value={formData.nationality} onChange={handleChange} />
                  </label>
                </div>
              )}

              {activeTab === "organization" && (
                <div className="grid-pro">
                  <label className="field-pro">
                    Project Name
                    <input name="projectName" value={formData.projectName} onChange={handleChange} />
                  </label>

                  <label className="field-pro">
                    Package Name
                    <input name="packageName" value={formData.packageName} onChange={handleChange} />
                  </label>

                  <label className="field-pro">
                    Status
                    <select name="status" value={formData.status} onChange={handleChange}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              )}

              {activeTab === "permissions" && (
                <div style={{ display: "grid", gap: 18 }}>
                  <label className="field-pro">
                    Role
                    <select name="roleCode" value={formData.roleCode} onChange={handleChange}>
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

                  <div className="info-card">
                    <div className="permission-header">
                      <strong>Permission Matrix</strong>

                      <div className="mini-actions">
                        <button
                          type="button"
                          className="mini-btn"
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
                          className="mini-btn"
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
                          className="mini-btn"
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

                    <div className="permissions-grid">
                      {PERMISSION_OPTIONS.map((permission) => {
                        const checked = formData.permissions.includes(permission.code);

                        return (
                          <label key={permission.code} className="permission-item">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handlePermissionToggle(permission.code)}
                            />
                            <div>
                              <div className="permission-label">{permission.label}</div>
                              <div className="permission-code">{permission.code}</div>
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
                    <div className="info-card">
                      <strong>Leave Balance</strong>
                      <p style={{ marginTop: 10 }}>
                        Save the user first, then you can manage their leave balance.
                      </p>
                    </div>
                  ) : !selectedUser?.employeeId ? (
                    <div className="info-card">
                      <strong>Leave Balance</strong>
                      <p style={{ marginTop: 10, color: "#b42318" }}>
                        This user does not have a linked employee record.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="info-card">
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

                      <div className="grid-pro">
                        <label className="field-pro">
                          Annual Balance
                          <input
                            type="number"
                            min="0"
                            name="annual"
                            value={leaveForm.annual}
                            onChange={handleLeaveChange}
                          />
                        </label>

                        <label className="field-pro">
                          Annual Used
                          <input
                            type="number"
                            min="0"
                            name="annualUsed"
                            value={leaveForm.annualUsed}
                            onChange={handleLeaveChange}
                          />
                        </label>

                        <label className="field-pro">
                          Sick Balance
                          <input
                            type="number"
                            min="0"
                            name="sick"
                            value={leaveForm.sick}
                            onChange={handleLeaveChange}
                          />
                        </label>

                        <label className="field-pro">
                          Sick Used
                          <input
                            type="number"
                            min="0"
                            name="sickUsed"
                            value={leaveForm.sickUsed}
                            onChange={handleLeaveChange}
                          />
                        </label>

                        <label className="field-pro">
                          Emergency Balance
                          <input
                            type="number"
                            min="0"
                            name="emergency"
                            value={leaveForm.emergency}
                            onChange={handleLeaveChange}
                          />
                        </label>

                        <label className="field-pro">
                          Emergency Used
                          <input
                            type="number"
                            min="0"
                            name="emergencyUsed"
                            value={leaveForm.emergencyUsed}
                            onChange={handleLeaveChange}
                          />
                        </label>
                      </div>

                      <div className="info-card">
                        <strong>Balance Summary</strong>
                        <div style={{ marginTop: 10 }}>
                          <div><strong>Annual Remaining:</strong> {Number(leaveForm.annual || 0) - Number(leaveForm.annualUsed || 0)}</div>
                          <div><strong>Sick Remaining:</strong> {Number(leaveForm.sick || 0) - Number(leaveForm.sickUsed || 0)}</div>
                          <div><strong>Emergency Remaining:</strong> {Number(leaveForm.emergency || 0) - Number(leaveForm.emergencyUsed || 0)}</div>
                        </div>
                      </div>

                      <div className="actions-row">
                        <button
                          type="button"
                          onClick={() => loadLeaveBalance(selectedUser.employeeId)}
                          className="btn-soft"
                          disabled={leaveLoading || leaveSaving}
                        >
                          Reload Balance
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveLeaveBalance}
                          className="btn-primary-strong"
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
                <div className="grid-pro">
                  <label className="field-pro">
                    {isCreateMode ? "Password" : "New Password"}
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

              <div className="info-card">
                <strong>Profile Preview</strong>
                <div style={{ marginTop: 10 }}>
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

              <div className="actions-row">
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
                  className="btn-soft"
                >
                  Cancel
                </button>

                {!isCreateMode ? (
                  <button type="button" onClick={handleDelete} disabled={deleting} className="btn-danger">
                    {deleting ? "Deleting..." : "Delete User"}
                  </button>
                ) : null}

                <button type="button" onClick={handleSave} disabled={saving} className="btn-primary-strong">
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