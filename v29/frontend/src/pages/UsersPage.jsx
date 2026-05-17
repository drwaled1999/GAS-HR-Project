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
  Building2,
  BriefcaseBusiness,
  LockKeyhole,
  Sparkles,
  Layers3,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  ShieldAlert,
  Fingerprint,
  UserRoundCheck,
  Settings2,
  Bell,
  FileText,
  WalletCards,
  ClipboardCheck,
  Video,
  Gauge,
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
  { code: "attendance.issues", label: "Attendance Issues" },
  { code: "attendance.project", label: "Project Attendance" },
  { code: "attendance.my_project", label: "My Project Attendance" },
  { code: "attendance.timesheet_report", label: "Timesheet Report Generator" },

  { code: "requests.view", label: "Requests View" },
  { code: "requests.create", label: "Create Requests" },
  { code: "requests.review", label: "Review Requests" },
  { code: "leave.manage", label: "Manage Leave" },

  { code: "employee_services.view", label: "Employee Services View" },
  { code: "employee_services.review", label: "Review Employee Data Updates" },

  { code: "meetings.view", label: "Meeting Room View" },
  { code: "meetings.manage", label: "Manage Meetings" },
  { code: "meetings.employee", label: "Employee Meetings" },

  { code: "warnings.view", label: "Warnings View" },
  { code: "warnings.create", label: "Create Warnings" },
  { code: "warnings.print", label: "Print Warnings" },

  { code: "performance.view", label: "Performance View" },
  { code: "performance.manage", label: "Manage Performance" },

  { code: "payroll.view", label: "Payroll View" },
  { code: "reports.view", label: "Reports View" },
  { code: "projects.view", label: "Projects View" },
  { code: "projects.manage", label: "Manage Projects" },

  { code: "notifications.view", label: "Notifications View" },
  { code: "settings.view", label: "Settings View" },
  { code: "settings.manage", label: "Manage Settings" },
  { code: "security.view", label: "Security View" },
];

const ROLE_DEFAULT_PERMISSIONS = {
  owner: PERMISSION_OPTIONS.map((item) => item.code),

  hr_manager: PERMISSION_OPTIONS.map((item) => item.code).filter(
    (code) => code !== "requests.create"
  ),

  hr_admin: [
    "dashboard.view",
    "users.view",
    "users.create",
    "users.edit",
    "attendance.view",
    "attendance.upload",
    "attendance.edit",
    "attendance.issues",
    "attendance.timesheet_report",
    "requests.view",
    "requests.review",
    "leave.manage",
    "employee_services.view",
    "employee_services.review",
    "meetings.view",
    "meetings.manage",
    "warnings.view",
    "warnings.create",
    "warnings.print",
    "performance.view",
    "performance.manage",
    "reports.view",
    "projects.view",
    "notifications.view",
  ],

  hr: [
    "dashboard.view",
    "users.view",
    "attendance.view",
    "attendance.upload",
    "attendance.issues",
    "requests.view",
    "requests.review",
    "leave.manage",
    "employee_services.view",
    "employee_services.review",
    "meetings.view",
    "warnings.view",
    "performance.view",
    "reports.view",
    "projects.view",
    "notifications.view",
  ],

  admin: [
    "dashboard.view",
    "users.view",
    "users.create",
    "users.edit",
    "attendance.view",
    "attendance.upload",
    "attendance.edit",
    "attendance.issues",
    "attendance.project",
    "attendance.timesheet_report",
    "requests.view",
    "requests.review",
    "employee_services.view",
    "meetings.view",
    "meetings.manage",
    "warnings.view",
    "warnings.create",
    "warnings.print",
    "reports.view",
    "projects.view",
    "notifications.view",
  ],

  admin_assistant: [
    "dashboard.view",
    "users.view",
    "attendance.view",
    "attendance.project",
    "attendance.timesheet_report",
    "requests.view",
    "requests.create",
    "employee_services.view",
    "meetings.view",
    "warnings.view",
    "reports.view",
    "projects.view",
    "notifications.view",
  ],

  site_admin: [
    "dashboard.view",
    "attendance.view",
    "attendance.upload",
    "attendance.edit",
    "attendance.issues",
    "attendance.project",
    "requests.view",
    "requests.review",
    "meetings.view",
    "warnings.view",
    "reports.view",
    "projects.view",
    "notifications.view",
  ],

  project_manager: [
    "dashboard.view",
    "attendance.view",
    "attendance.project",
    "requests.view",
    "requests.review",
    "meetings.view",
    "warnings.view",
    "performance.view",
    "reports.view",
    "projects.view",
    "notifications.view",
  ],

  cm: [
    "dashboard.view",
    "attendance.view",
    "attendance.project",
    "requests.view",
    "requests.review",
    "meetings.view",
    "warnings.view",
    "reports.view",
    "projects.view",
    "notifications.view",
  ],

  supervisor: [
    "dashboard.view",
    "attendance.view",
    "attendance.project",
    "requests.view",
    "requests.review",
    "meetings.view",
    "warnings.view",
    "notifications.view",
  ],

  engineer: [
    "dashboard.view",
    "attendance.view",
    "attendance.project",
    "requests.view",
    "meetings.view",
    "notifications.view",
  ],

  employee: [
    "dashboard.view",
    "requests.create",
    "requests.view",
    "attendance.my_project",
    "meetings.employee",
    "notifications.view",
  ],
};

const PERMISSION_GROUPS = [
  {
    key: "core",
    title: "Core Workspace",
    icon: Gauge,
    description: "Dashboard and global workspace visibility.",
    codes: ["dashboard.view", "notifications.view"],
  },
  {
    key: "users",
    title: "Users & Access",
    icon: UserCog,
    description: "Create, edit, archive users and manage access rights.",
    codes: [
      "users.view",
      "users.create",
      "users.edit",
      "users.delete",
      "users.permissions",
    ],
  },
  {
    key: "attendance",
    title: "Attendance Operations",
    icon: Fingerprint,
    description: "Attendance sheets, uploads, approvals, issues and project views.",
    codes: [
      "attendance.view",
      "attendance.upload",
      "attendance.edit",
      "attendance.approve",
      "attendance.issues",
      "attendance.project",
      "attendance.my_project",
      "attendance.timesheet_report",
    ],
  },
  {
    key: "requests",
    title: "Requests & Leave",
    icon: FileText,
    description: "Employee requests, approval workflow and leave management.",
    codes: [
      "requests.view",
      "requests.create",
      "requests.review",
      "leave.manage",
      "employee_services.view",
      "employee_services.review",
    ],
  },
  {
    key: "meetings",
    title: "Meetings & Warnings",
    icon: Video,
    description: "Meetings, investigations and warning letters.",
    codes: [
      "meetings.view",
      "meetings.manage",
      "meetings.employee",
      "warnings.view",
      "warnings.create",
      "warnings.print",
    ],
  },
  {
    key: "performance",
    title: "Performance Management",
    icon: ClipboardCheck,
    description: "Performance dashboard, review templates and assignments.",
    codes: ["performance.view", "performance.manage"],
  },
  {
    key: "business",
    title: "Projects, Payroll & Reports",
    icon: BriefcaseBusiness,
    description: "Projects, payroll, reports and business visibility.",
    codes: [
      "projects.view",
      "projects.manage",
      "payroll.view",
      "reports.view",
    ],
  },
  {
    key: "system",
    title: "System Administration",
    icon: Settings2,
    description: "Security center, settings and system controls.",
    codes: ["settings.view", "settings.manage", "security.view"],
  },
];

const ROLE_TEMPLATES = [
  {
    code: "owner",
    label: "System Owner",
    icon: ShieldAlert,
    hint: "Full platform access",
  },
  {
    code: "hr_manager",
    label: "HR Manager",
    icon: ShieldCheck,
    hint: "Approval and control center",
  },
  {
    code: "hr_admin",
    label: "HR Admin",
    icon: UserRoundCheck,
    hint: "Operational HR access",
  },
  {
    code: "admin",
    label: "Admin",
    icon: Building2,
    hint: "Project administration",
  },
  {
    code: "admin_assistant",
    label: "Admin Assistant",
    icon: BriefcaseBusiness,
    hint: "Daily admin tasks",
  },
  {
    code: "site_admin",
    label: "Site Admin",
    icon: Layers3,
    hint: "Site and attendance tasks",
  },
  {
    code: "project_manager",
    label: "Project Manager",
    icon: BadgeCheck,
    hint: "Project level visibility",
  },
  {
    code: "cm",
    label: "CM",
    icon: ClipboardCheck,
    hint: "Package supervision",
  },
  {
    code: "supervisor",
    label: "Supervisor",
    icon: Users,
    hint: "Team follow-up",
  },
  {
    code: "engineer",
    label: "Engineer",
    icon: Sparkles,
    hint: "Engineering visibility",
  },
  {
    code: "employee",
    label: "Employee",
    icon: UserCog,
    hint: "Employee self-service",
  },
];

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

function getPermissionMeta(code) {
  return (
    PERMISSION_OPTIONS.find((permission) => permission.code === code) || {
      code,
      label: code,
    }
  );
}

function StatCard({ icon: Icon, label, value, tone = "blue" }) {
  return (
    <article className={`users-kpi-card tone-${tone}`}>
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

function Field({ label, children }) {
  return (
    <label className="users-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ProfileMetric({ label, value, icon: Icon }) {
  return (
    <article className="profile-metric">
      <div className="profile-metric-icon">
        <Icon size={17} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value || "-"}</strong>
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
  const [permissionSearch, setPermissionSearch] = useState("");
  const [activeTab, setActiveTab] = useState("basic");
  const [openGroups, setOpenGroups] = useState(() =>
    PERMISSION_GROUPS.reduce((acc, group) => ({ ...acc, [group.key]: true }), {})
  );

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

  function handleRoleTemplateSelect(roleCode) {
    setFormData((prev) => ({
      ...prev,
      roleCode,
      permissions: ROLE_DEFAULT_PERMISSIONS[roleCode] || [],
    }));
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

  function handlePermissionGroupToggle(groupCodes, checked) {
    setFormData((prev) => {
      const current = new Set(prev.permissions || []);

      if (checked) {
        groupCodes.forEach((code) => current.add(code));
      } else {
        groupCodes.forEach((code) => current.delete(code));
      }

      return {
        ...prev,
        permissions: [...current],
      };
    });
  }

  function handleCloneSelectedPermissions() {
    if (!selectedUser?.permissions?.length) {
      setError("Select a user with permissions first");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      permissions: selectedUser.permissions,
    }));

    setMessage("Selected user permissions copied to the editor");
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

  const filteredPermissionGroups = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();

    return PERMISSION_GROUPS.map((group) => {
      const permissions = group.codes
        .map(getPermissionMeta)
        .filter((permission) => {
          if (!q) return true;
          return [permission.code, permission.label, group.title]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q));
        });

      return {
        ...group,
        permissions,
      };
    }).filter((group) => group.permissions.length > 0);
  }, [permissionSearch]);

  const isCreateMode = mode === "create";

  const activeUsers = users.filter(
    (user) => String(user.status || "active").toLowerCase() === "active"
  ).length;

  const inactiveUsers = users.length - activeUsers;

  const selectedRoleTemplate =
    ROLE_TEMPLATES.find((role) => role.code === formData.roleCode) ||
    ROLE_TEMPLATES.find((role) => role.code === "employee");

  const completionScore = useMemo(() => {
    const fields = [
      formData.name,
      formData.username,
      formData.email,
      formData.gasId,
      formData.jobTitle,
      formData.roleCode,
      formData.projectName,
      formData.packageName,
    ];

    const completed = fields.filter(Boolean).length;
    return Math.round((completed / fields.length) * 100);
  }, [formData]);

  const annualRemaining =
    Number(leaveForm.annual || 0) - Number(leaveForm.annualUsed || 0);
  const sickRemaining = Number(leaveForm.sick || 0) - Number(leaveForm.sickUsed || 0);
  const emergencyRemaining =
    Number(leaveForm.emergency || 0) - Number(leaveForm.emergencyUsed || 0);

  return (
    <div className="users-ultra-page">
      <style>{usersPageStyles}</style>

      <section className="users-oracle-hero">
        <div className="hero-glow one" />
        <div className="hero-glow two" />

        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={16} />
            Enterprise Access Control
          </div>

          <h1>Users Command Center</h1>
          <p>
            Manage identities, roles, permissions, projects, leave balances and
            security settings from a premium HR administration workspace.
          </p>

          <div className="users-kpi-grid">
            <StatCard icon={Users} label="Total Users" value={users.length} />
            <StatCard icon={BadgeCheck} label="Active Users" value={activeUsers} tone="green" />
            <StatCard icon={XCircle} label="Inactive" value={inactiveUsers} tone="red" />
            <StatCard
              icon={ShieldCheck}
              label="Selected Permissions"
              value={formData.permissions.length}
              tone="purple"
            />
          </div>
        </div>

        <aside className="hero-profile-card">
          <div className="profile-avatar-xl">
            {(formData.name || formData.username || "U").slice(0, 1).toUpperCase()}
          </div>

          <div>
            <span className="eyebrow">Current Profile</span>
            <h2>{formData.name || "No user selected"}</h2>
            <p>{roleLabelFromCode(formData.roleCode)}</p>
          </div>

          <div className="hero-status-row">
            <span className={`status-dot ${formData.status === "active" ? "active" : "inactive"}`} />
            <strong>{formData.status || "active"}</strong>
          </div>

          <div className="profile-progress">
            <div className="profile-progress-head">
              <span>Profile Completion</span>
              <strong>{completionScore}%</strong>
            </div>
            <div className="progress-track">
              <div style={{ width: `${completionScore}%` }} />
            </div>
          </div>
        </aside>
      </section>

      {message ? (
        <div className="users-alert success">
          <CheckCircle2 size={18} />
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="users-alert error">
          <XCircle size={18} />
          {error}
        </div>
      ) : null}

      <section className="users-workbench">
        <aside className="users-directory-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Directory</span>
              <h2>Users Directory</h2>
              <p>Search by name, username, GAS ID, role, project or package.</p>
            </div>

            <button type="button" onClick={handleCreateNew} className="users-primary-btn compact">
              <UserPlus size={17} />
              Add
            </button>
          </div>

          <div className="users-search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users..."
            />
          </div>

          <div className="directory-toolbar">
            <span>{filteredUsers.length} result(s)</span>
            <button type="button" onClick={() => loadUsers(selectedUser?.id)}>
              <RotateCcw size={14} />
              Refresh
            </button>
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
                      <div className="users-name-row">
                        <strong>{user.name || "-"}</strong>
                        <span className={`mini-status ${
                          String(user.status || "active").toLowerCase() === "active"
                            ? "active"
                            : "inactive"
                        }`}>
                          {user.status || "active"}
                        </span>
                      </div>

                      <div className="users-username">@{user.username || "-"}</div>

                      <div className="users-badges">
                        <span>{roleLabelFromCode(roleCode)}</span>
                        <span>GAS: {user.gasId || "-"}</span>
                        <span>{user.projectName || "No Project"}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <main className="users-editor-panel">
          <div className="editor-top-card">
            <div className="editor-user-main">
              <div className="profile-avatar-lg">
                {(formData.name || formData.username || "U").slice(0, 1).toUpperCase()}
              </div>

              <div>
                <span className="eyebrow">{isCreateMode ? "Create Mode" : "Edit Mode"}</span>
                <h2>{isCreateMode ? "Create User" : formData.name || "Edit User"}</h2>
                <p>
                  {isCreateMode
                    ? "Create a new identity and assign the correct access template."
                    : "Update user profile, organization, permissions and leave balance."}
                </p>
              </div>
            </div>

            <div className="editor-top-actions">
              {detailLoading ? (
                <span className="users-loading-pill">Loading details...</span>
              ) : null}

              <button type="button" onClick={handleCloneSelectedPermissions} className="users-soft-btn mini">
                <Copy size={15} />
                Clone Permissions
              </button>
            </div>
          </div>

          {!isCreateMode && !selectedUser ? (
            <div className="users-empty-editor">
              <UserCog size={40} />
              <strong>Select a user to edit</strong>
              <span>Choose an employee from the directory to view and update profile details.</span>
            </div>
          ) : (
            <>
              <div className="profile-metrics-grid">
                <ProfileMetric icon={KeyRound} label="Username" value={formData.username} />
                <ProfileMetric icon={BadgeCheck} label="GAS ID" value={formData.gasId} />
                <ProfileMetric icon={Building2} label="Project" value={formData.projectName} />
                <ProfileMetric icon={Layers3} label="Package" value={formData.packageName} />
              </div>

              <div className="users-tabs">
                {[
                  ["basic", "Basic Info", UserCog],
                  ["organization", "Organization", Building2],
                  ["permissions", "Permissions", ShieldCheck],
                  ["leave", "Leave Balance", CalendarDays],
                  ["security", "Security", LockKeyhole],
                ].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={activeTab === key ? "active" : ""}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "basic" && (
                <section className="tab-card">
                  <div className="tab-card-head">
                    <div>
                      <h3>Basic Information</h3>
                      <p>Identity details used for login, communication and employee mapping.</p>
                    </div>
                    <span className="tab-count">01</span>
                  </div>

                  <div className="users-form-grid">
                    <Field label="Full Name">
                      <input name="name" value={formData.name} onChange={handleChange} />
                    </Field>

                    <Field label="Username">
                      <input name="username" value={formData.username} onChange={handleChange} />
                    </Field>

                    <Field label="Email">
                      <input name="email" value={formData.email} onChange={handleChange} />
                    </Field>

                    <Field label="Employee ID">
                      <input name="employeeId" value={formData.employeeId} onChange={handleChange} />
                    </Field>

                    <Field label="GAS ID">
                      <input name="gasId" value={formData.gasId} onChange={handleChange} />
                    </Field>

                    <Field label="Job Title">
                      <input name="jobTitle" value={formData.jobTitle} onChange={handleChange} />
                    </Field>

                    <Field label="Nationality">
                      <input name="nationality" value={formData.nationality} onChange={handleChange} />
                    </Field>
                  </div>
                </section>
              )}

              {activeTab === "organization" && (
                <section className="tab-card">
                  <div className="tab-card-head">
                    <div>
                      <h3>Organization Assignment</h3>
                      <p>Map this user to project, package and current account status.</p>
                    </div>
                    <span className="tab-count">02</span>
                  </div>

                  <div className="assignment-banner">
                    <div>
                      <Building2 size={24} />
                    </div>
                    <section>
                      <span>Current Assignment</span>
                      <strong>
                        {formData.projectName || "No Project"} / {formData.packageName || "No Package"}
                      </strong>
                      <p>Use this section to keep project visibility and reporting scope clean.</p>
                    </section>
                  </div>

                  <div className="users-form-grid">
                    <Field label="Project Name">
                      <input name="projectName" value={formData.projectName} onChange={handleChange} />
                    </Field>

                    <Field label="Package Name">
                      <input name="packageName" value={formData.packageName} onChange={handleChange} />
                    </Field>

                    <Field label="Status">
                      <select name="status" value={formData.status} onChange={handleChange}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>
                  </div>
                </section>
              )}

              {activeTab === "permissions" && (
                <section className="tab-card">
                  <div className="tab-card-head">
                    <div>
                      <h3>Permission Matrix</h3>
                      <p>Choose a role template, then fine-tune access by grouped modules.</p>
                    </div>
                    <span className="tab-count">{formData.permissions.length}</span>
                  </div>

                  <div className="role-template-shell">
                    {ROLE_TEMPLATES.map((role) => {
                      const Icon = role.icon;
                      const active = formData.roleCode === role.code;

                      return (
                        <button
                          key={role.code}
                          type="button"
                          onClick={() => handleRoleTemplateSelect(role.code)}
                          className={`role-template-card ${active ? "active" : ""}`}
                        >
                          <div>
                            <Icon size={18} />
                          </div>
                          <strong>{role.label}</strong>
                          <span>{role.hint}</span>
                        </button>
                      );
                    })}
                  </div>

                  <Field label="Role">
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
                  </Field>

                  <div className="permission-toolbar">
                    <div className="permission-search">
                      <Search size={17} />
                      <input
                        value={permissionSearch}
                        onChange={(event) => setPermissionSearch(event.target.value)}
                        placeholder="Search permissions..."
                      />
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

                  <div className="permission-groups">
                    {filteredPermissionGroups.map((group) => {
                      const Icon = group.icon;
                      const codes = group.permissions.map((permission) => permission.code);
                      const selectedCount = codes.filter((code) =>
                        formData.permissions.includes(code)
                      ).length;
                      const allSelected =
                        codes.length > 0 && selectedCount === codes.length;
                      const isOpen = openGroups[group.key];

                      return (
                        <section key={group.key} className="permission-group-card">
                          <button
                            type="button"
                            className="permission-group-head"
                            onClick={() =>
                              setOpenGroups((prev) => ({
                                ...prev,
                                [group.key]: !prev[group.key],
                              }))
                            }
                          >
                            <div className="group-title">
                              <div className="group-icon">
                                <Icon size={18} />
                              </div>
                              <div>
                                <strong>{group.title}</strong>
                                <span>{group.description}</span>
                              </div>
                            </div>

                            <div className="group-actions">
                              <span>{selectedCount}/{codes.length}</span>
                              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>
                          </button>

                          {isOpen ? (
                            <div className="permission-group-body">
                              <label className="group-select-all">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  onChange={(event) =>
                                    handlePermissionGroupToggle(codes, event.target.checked)
                                  }
                                />
                                <span>Select all in {group.title}</span>
                              </label>

                              <div className="permissions-grid-ultra">
                                {group.permissions.map((permission) => {
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
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                </section>
              )}

              {activeTab === "leave" && (
                <section className="tab-card">
                  <div className="tab-card-head">
                    <div>
                      <h3>Leave Balance Center</h3>
                      <p>Manage annual, sick and emergency leave balances for the linked employee record.</p>
                    </div>
                    {leaveLoading ? <span className="users-loading-pill">Loading balance...</span> : null}
                  </div>

                  {isCreateMode ? (
                    <div className="users-info-box">
                      <strong>Leave Balance</strong>
                      <p>Save the user first, then you can manage their leave balance.</p>
                    </div>
                  ) : !selectedUser?.employeeId ? (
                    <div className="users-info-box danger">
                      <strong>Leave Balance</strong>
                      <p>This user does not have a linked employee record.</p>
                    </div>
                  ) : (
                    <>
                      <div className="leave-summary-grid">
                        <article>
                          <CalendarDays size={18} />
                          <span>Annual Remaining</span>
                          <strong>{annualRemaining}</strong>
                        </article>

                        <article>
                          <CalendarDays size={18} />
                          <span>Sick Remaining</span>
                          <strong>{sickRemaining}</strong>
                        </article>

                        <article>
                          <CalendarDays size={18} />
                          <span>Emergency Remaining</span>
                          <strong>{emergencyRemaining}</strong>
                        </article>
                      </div>

                      <div className="users-form-grid">
                        <Field label="Annual Balance">
                          <input
                            type="number"
                            min="0"
                            name="annual"
                            value={leaveForm.annual}
                            onChange={handleLeaveChange}
                          />
                        </Field>

                        <Field label="Annual Used">
                          <input
                            type="number"
                            min="0"
                            name="annualUsed"
                            value={leaveForm.annualUsed}
                            onChange={handleLeaveChange}
                          />
                        </Field>

                        <Field label="Sick Balance">
                          <input
                            type="number"
                            min="0"
                            name="sick"
                            value={leaveForm.sick}
                            onChange={handleLeaveChange}
                          />
                        </Field>

                        <Field label="Sick Used">
                          <input
                            type="number"
                            min="0"
                            name="sickUsed"
                            value={leaveForm.sickUsed}
                            onChange={handleLeaveChange}
                          />
                        </Field>

                        <Field label="Emergency Balance">
                          <input
                            type="number"
                            min="0"
                            name="emergency"
                            value={leaveForm.emergency}
                            onChange={handleLeaveChange}
                          />
                        </Field>

                        <Field label="Emergency Used">
                          <input
                            type="number"
                            min="0"
                            name="emergencyUsed"
                            value={leaveForm.emergencyUsed}
                            onChange={handleLeaveChange}
                          />
                        </Field>
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
                </section>
              )}

              {activeTab === "security" && (
                <section className="tab-card">
                  <div className="tab-card-head">
                    <div>
                      <h3>Security Center</h3>
                      <p>Password control and account protection summary.</p>
                    </div>
                    <span className="security-shield">
                      <LockKeyhole size={16} />
                      Protected
                    </span>
                  </div>

                  <div className="security-grid">
                    <article>
                      <KeyRound size={20} />
                      <strong>Password Policy</strong>
                      <p>Use a strong password. Leave blank when editing if you do not want to change it.</p>
                    </article>

                    <article>
                      <ShieldCheck size={20} />
                      <strong>Permission Guard</strong>
                      <p>Access is controlled by the permission matrix and protected routes.</p>
                    </article>

                    <article>
                      <Bell size={20} />
                      <strong>Status Tracking</strong>
                      <p>Inactive accounts are visually flagged in the user directory.</p>
                    </article>
                  </div>

                  <div className="users-form-grid single">
                    <Field label={isCreateMode ? "Password" : "New Password"}>
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
                    </Field>
                  </div>
                </section>
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

        <aside className="users-insights-panel">
          <div className="insight-card main">
            <span className="eyebrow">Role Template</span>
            <div className="insight-role">
              {selectedRoleTemplate ? <selectedRoleTemplate.icon size={22} /> : <ShieldCheck size={22} />}
              <strong>{roleLabelFromCode(formData.roleCode)}</strong>
            </div>
            <p>{selectedRoleTemplate?.hint || "Custom access template"}</p>
          </div>

          <div className="insight-card">
            <span className="eyebrow">Access Summary</span>
            <div className="ring-score">
              <strong>{formData.permissions.length}</strong>
              <span>Permissions</span>
            </div>
          </div>

          <div className="insight-card">
            <span className="eyebrow">Leave Snapshot</span>
            <div className="mini-leave-list">
              <div><span>Annual</span><strong>{annualRemaining}</strong></div>
              <div><span>Sick</span><strong>{sickRemaining}</strong></div>
              <div><span>Emergency</span><strong>{emergencyRemaining}</strong></div>
            </div>
          </div>

          <div className="insight-card">
            <span className="eyebrow">Recommended Checks</span>
            <ul className="check-list">
              <li><CheckCircle2 size={15} /> Confirm GAS ID mapping</li>
              <li><CheckCircle2 size={15} /> Review project/package visibility</li>
              <li><CheckCircle2 size={15} /> Save permissions after role changes</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}

const usersPageStyles = `
  .users-ultra-page {
    display: grid;
    gap: 20px;
    width: 100%;
    color: #0f172a;
  }

  .users-ultra-page * {
    box-sizing: border-box;
  }

  .users-oracle-hero {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(310px, .72fr);
    gap: 18px;
    border-radius: 34px;
    padding: 28px;
    color: #fff;
    background:
      linear-gradient(135deg, rgba(2,6,23,.97) 0%, rgba(15,23,42,.96) 44%, rgba(30,58,138,.93) 100%);
    box-shadow: 0 26px 70px rgba(2,6,23,.24);
  }

  .users-oracle-hero::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px);
    background-size: 52px 52px;
    opacity: .56;
    pointer-events: none;
  }

  .hero-glow {
    position: absolute;
    width: 360px;
    height: 360px;
    border-radius: 50%;
    filter: blur(20px);
    opacity: .35;
    pointer-events: none;
  }

  .hero-glow.one {
    right: 10%;
    top: -150px;
    background: #38bdf8;
  }

  .hero-glow.two {
    left: -120px;
    bottom: -160px;
    background: #6366f1;
  }

  .hero-content,
  .hero-profile-card {
    position: relative;
    z-index: 2;
  }

  .hero-badge,
  .eyebrow {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: .76rem;
    letter-spacing: .04em;
    text-transform: uppercase;
    font-weight: 950;
  }

  .hero-badge {
    padding: 9px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.15);
    color: #dbeafe;
    margin-bottom: 15px;
  }

  .eyebrow {
    color: #64748b;
  }

  .users-oracle-hero h1 {
    margin: 0;
    color: #fff;
    font-size: clamp(2.15rem, 5vw, 4.2rem);
    font-weight: 1000;
    letter-spacing: -.065em;
    line-height: .98;
  }

  .hero-content p {
    margin: 15px 0 0;
    max-width: 820px;
    color: rgba(255,255,255,.78);
    line-height: 1.75;
    font-size: 1rem;
  }

  .hero-profile-card {
    align-self: stretch;
    display: grid;
    gap: 15px;
    align-content: start;
    border-radius: 28px;
    padding: 22px;
    background: rgba(255,255,255,.11);
    border: 1px solid rgba(255,255,255,.14);
    backdrop-filter: blur(14px);
  }

  .profile-avatar-xl,
  .profile-avatar-lg,
  .users-avatar {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    color: #fff;
    font-weight: 1000;
    background:
      radial-gradient(circle at 25% 15%, rgba(255,255,255,.35), transparent 30%),
      linear-gradient(135deg, #2563eb, #0ea5e9);
  }

  .profile-avatar-xl {
    width: 78px;
    height: 78px;
    border-radius: 25px;
    font-size: 2rem;
  }

  .profile-avatar-lg {
    width: 58px;
    height: 58px;
    border-radius: 21px;
    font-size: 1.45rem;
  }

  .hero-profile-card h2 {
    margin: 7px 0 4px;
    color: #fff;
    font-size: 1.28rem;
    font-weight: 950;
    word-break: break-word;
  }

  .hero-profile-card p {
    margin: 0;
    color: rgba(255,255,255,.74);
    font-weight: 800;
  }

  .hero-status-row {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    width: fit-content;
    min-height: 36px;
    padding: 0 12px;
    border-radius: 999px;
    background: rgba(255,255,255,.13);
    border: 1px solid rgba(255,255,255,.14);
    color: #fff;
    font-weight: 950;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #fb7185;
    box-shadow: 0 0 0 4px rgba(251,113,133,.18);
  }

  .status-dot.active {
    background: #22c55e;
    box-shadow: 0 0 0 4px rgba(34,197,94,.18);
  }

  .profile-progress {
    display: grid;
    gap: 9px;
  }

  .profile-progress-head {
    display: flex;
    justify-content: space-between;
    color: rgba(255,255,255,.82);
    font-size: .82rem;
    font-weight: 900;
  }

  .progress-track {
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255,255,255,.14);
  }

  .progress-track div {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #38bdf8, #22c55e);
  }

  .users-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 13px;
    margin-top: 24px;
  }

  .users-kpi-card {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 13px;
    border-radius: 22px;
    padding: 15px;
    background: rgba(255,255,255,.11);
    border: 1px solid rgba(255,255,255,.13);
  }

  .users-kpi-icon {
    width: 42px;
    height: 42px;
    border-radius: 15px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    flex: 0 0 auto;
  }

  .tone-green .users-kpi-icon { background: linear-gradient(135deg, #16a34a, #22c55e); }
  .tone-red .users-kpi-icon { background: linear-gradient(135deg, #e11d48, #fb7185); }
  .tone-purple .users-kpi-icon { background: linear-gradient(135deg, #7c3aed, #a855f7); }

  .users-kpi-card span {
    display: block;
    color: rgba(255,255,255,.72);
    font-size: .76rem;
    font-weight: 850;
    margin-bottom: 5px;
  }

  .users-kpi-card strong {
    display: block;
    color: #fff;
    font-size: 1.34rem;
    font-weight: 1000;
    line-height: 1;
  }

  .users-alert {
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 18px;
    padding: 14px 16px;
    font-weight: 950;
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

  .users-workbench {
    display: grid;
    grid-template-columns: minmax(300px, 360px) minmax(0, 1fr) minmax(250px, 300px);
    gap: 18px;
    align-items: start;
  }

  .users-directory-panel,
  .users-editor-panel,
  .users-insights-panel,
  .tab-card,
  .users-preview-box,
  .insight-card {
    min-width: 0;
    border-radius: 28px;
    background: rgba(255,255,255,.97);
    border: 1px solid rgba(226,232,240,.95);
    box-shadow: 0 16px 44px rgba(15,23,42,.07);
    backdrop-filter: blur(12px);
  }

  .users-directory-panel,
  .users-editor-panel,
  .users-insights-panel {
    padding: 20px;
  }

  .users-directory-panel,
  .users-insights-panel {
    position: sticky;
    top: 18px;
  }

  .section-head,
  .editor-top-card,
  .tab-card-head,
  .permission-toolbar,
  .users-actions-row,
  .directory-toolbar {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .section-head h2,
  .editor-top-card h2,
  .tab-card-head h3 {
    margin: 4px 0 6px;
    color: #0f172a;
    font-weight: 1000;
    letter-spacing: -.03em;
  }

  .section-head h2 { font-size: 1.2rem; }
  .editor-top-card h2 { font-size: 1.5rem; }
  .tab-card-head h3 { font-size: 1.18rem; }

  .section-head p,
  .editor-top-card p,
  .tab-card-head p,
  .users-info-box p,
  .insight-card p {
    margin: 0;
    color: #64748b;
    font-size: .88rem;
    font-weight: 750;
    line-height: 1.55;
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
    transition: transform .18s ease, opacity .18s ease, box-shadow .18s ease;
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

  .users-primary-btn.compact {
    min-height: 40px;
    border-radius: 14px;
    padding: 0 13px;
  }

  .users-soft-btn {
    background: #eef4ff;
    color: #1d4ed8;
  }

  .users-soft-btn.mini {
    min-height: 38px;
    border-radius: 14px;
    padding: 0 12px;
    font-size: .82rem;
  }

  .users-danger-btn {
    background: #d92d20;
    color: #fff;
  }

  button:disabled {
    opacity: .65;
    cursor: not-allowed;
  }

  .users-search-box,
  .permission-search {
    position: relative;
    width: 100%;
  }

  .users-search-box {
    margin-top: 16px;
  }

  .users-search-box svg,
  .permission-search svg {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #64748b;
  }

  .users-search-box input,
  .permission-search input,
  .users-field input,
  .users-field select {
    width: 100%;
    min-height: 50px;
    border: 1px solid #dbe2ea;
    border-radius: 16px;
    padding: 0 14px;
    background: #fff;
    color: #0f172a;
    font-size: .94rem;
    font-weight: 750;
  }

  .users-search-box input,
  .permission-search input {
    padding-left: 42px;
  }

  .users-search-box input:focus,
  .permission-search input:focus,
  .users-field input:focus,
  .users-field select:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 4px rgba(37,99,235,.08);
  }

  .directory-toolbar {
    margin-top: 12px;
    align-items: center;
  }

  .directory-toolbar span {
    color: #64748b;
    font-size: .78rem;
    font-weight: 900;
  }

  .directory-toolbar button {
    border: 1px solid #dbe2ea;
    background: #fff;
    color: #334155;
    border-radius: 12px;
    min-height: 32px;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 900;
    cursor: pointer;
  }

  .users-list {
    display: grid;
    gap: 10px;
    margin-top: 14px;
    max-height: 680px;
    overflow: auto;
    padding-right: 4px;
  }

  .users-list-item {
    width: 100%;
    text-align: left;
    border: 1px solid #eaecf0;
    background: linear-gradient(180deg, #ffffff, #f8fafc);
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
    box-shadow: 0 10px 26px rgba(15,23,42,.06);
  }

  .users-list-item.active {
    border-color: #2563eb;
    background: #eff6ff;
    box-shadow: 0 12px 28px rgba(37,99,235,.13);
  }

  .users-avatar {
    width: 44px;
    height: 44px;
    border-radius: 16px;
  }

  .users-item-content {
    min-width: 0;
    width: 100%;
  }

  .users-name-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: flex-start;
  }

  .users-name-row strong {
    color: #0f172a;
    font-weight: 1000;
    word-break: break-word;
  }

  .mini-status {
    min-height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: .68rem;
    font-weight: 1000;
    display: inline-flex;
    align-items: center;
    text-transform: capitalize;
    background: #fff1f2;
    color: #be123c;
    flex: 0 0 auto;
  }

  .mini-status.active {
    background: #ecfdf3;
    color: #047857;
  }

  .users-username {
    margin-top: 4px;
    color: #64748b;
    font-size: .83rem;
    font-weight: 800;
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
    font-size: .7rem;
    font-weight: 950;
    display: inline-flex;
    align-items: center;
  }

  .editor-top-card {
    align-items: center;
    padding: 18px;
    border-radius: 26px;
    background:
      radial-gradient(circle at top right, rgba(37,99,235,.10), transparent 34%),
      #fff;
    border: 1px solid #e8edf4;
    box-shadow: 0 12px 34px rgba(15,23,42,.06);
  }

  .editor-user-main {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .editor-top-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .profile-metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 12px;
    margin-top: 14px;
  }

  .profile-metric {
    min-width: 0;
    display: flex;
    gap: 11px;
    align-items: center;
    border-radius: 20px;
    padding: 14px;
    background: #f8fafc;
    border: 1px solid #e8edf4;
  }

  .profile-metric-icon {
    width: 38px;
    height: 38px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    color: #1d4ed8;
    background: #eff6ff;
    flex: 0 0 auto;
  }

  .profile-metric span {
    display: block;
    color: #64748b;
    font-size: .72rem;
    font-weight: 900;
    margin-bottom: 4px;
  }

  .profile-metric strong {
    display: block;
    color: #0f172a;
    font-size: .88rem;
    font-weight: 1000;
    word-break: break-word;
  }

  .users-tabs {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
    margin: 20px 0;
  }

  .users-tabs button {
    min-height: 42px;
    border-radius: 15px;
    border: 1px solid #dbe2ea;
    background: #fff;
    color: #334155;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 950;
    cursor: pointer;
    transition: .18s ease;
  }

  .users-tabs button.active {
    border-color: #bfdbfe;
    background: #eff6ff;
    color: #1d4ed8;
    box-shadow: 0 8px 18px rgba(37,99,235,.09);
  }

  .tab-card {
    padding: 20px;
  }

  .tab-card-head {
    align-items: center;
    margin-bottom: 18px;
  }

  .tab-count {
    min-width: 46px;
    min-height: 38px;
    padding: 0 12px;
    border-radius: 14px;
    background: #eff6ff;
    color: #1d4ed8;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 1000;
  }

  .users-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 15px;
  }

  .users-form-grid.single {
    grid-template-columns: 1fr;
    margin-top: 16px;
  }

  .users-field {
    display: grid;
    gap: 8px;
  }

  .users-field > span {
    color: #334155;
    font-size: .84rem;
    font-weight: 950;
  }

  .assignment-banner {
    display: flex;
    gap: 14px;
    align-items: center;
    border-radius: 24px;
    padding: 17px;
    background: linear-gradient(135deg, #eff6ff, #f8fafc);
    border: 1px solid #dbeafe;
    margin-bottom: 16px;
  }

  .assignment-banner > div {
    width: 52px;
    height: 52px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
    flex: 0 0 auto;
  }

  .assignment-banner span {
    display: block;
    color: #64748b;
    font-size: .76rem;
    font-weight: 900;
    margin-bottom: 4px;
  }

  .assignment-banner strong {
    color: #0f172a;
    font-weight: 1000;
  }

  .assignment-banner p {
    margin: 5px 0 0;
    color: #64748b;
    font-size: .85rem;
    font-weight: 750;
  }

  .role-template-shell {
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 11px;
    margin-bottom: 16px;
  }

  .role-template-card {
    text-align: left;
    display: grid;
    gap: 8px;
    padding: 14px;
    border-radius: 18px;
    border: 1px solid #e8edf4;
    background: #fff;
    cursor: pointer;
    transition: .18s ease;
  }

  .role-template-card:hover {
    transform: translateY(-1px);
    border-color: #bfdbfe;
  }

  .role-template-card.active {
    background: #eff6ff;
    border-color: #2563eb;
    box-shadow: 0 10px 22px rgba(37,99,235,.12);
  }

  .role-template-card div {
    width: 36px;
    height: 36px;
    border-radius: 13px;
    display: grid;
    place-items: center;
    color: #1d4ed8;
    background: #eff6ff;
  }

  .role-template-card.active div {
    color: #fff;
    background: linear-gradient(135deg, #2563eb, #0ea5e9);
  }

  .role-template-card strong {
    color: #0f172a;
    font-size: .88rem;
    font-weight: 1000;
  }

  .role-template-card span {
    color: #64748b;
    font-size: .72rem;
    font-weight: 800;
    line-height: 1.35;
  }

  .permission-toolbar {
    align-items: center;
    margin: 18px 0;
  }

  .permission-search {
    max-width: 360px;
  }

  .users-mini-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .users-mini-actions button {
    min-height: 36px;
    border-radius: 13px;
    border: 1px solid #dbe2ea;
    background: #fff;
    color: #334155;
    padding: 0 11px;
    font-size: .78rem;
    font-weight: 950;
    cursor: pointer;
  }

  .permission-groups {
    display: grid;
    gap: 12px;
  }

  .permission-group-card {
    border-radius: 21px;
    border: 1px solid #e8edf4;
    background: #f8fafc;
    overflow: hidden;
  }

  .permission-group-head {
    width: 100%;
    border: none;
    background: transparent;
    padding: 15px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    cursor: pointer;
    text-align: left;
  }

  .group-title {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .group-icon {
    width: 42px;
    height: 42px;
    flex: 0 0 auto;
    border-radius: 15px;
    display: grid;
    place-items: center;
    color: #1d4ed8;
    background: #eff6ff;
  }

  .group-title strong {
    display: block;
    color: #0f172a;
    font-weight: 1000;
  }

  .group-title span {
    display: block;
    margin-top: 3px;
    color: #64748b;
    font-size: .8rem;
    font-weight: 750;
    line-height: 1.35;
  }

  .group-actions {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: #334155;
    font-weight: 1000;
  }

  .group-actions span {
    min-height: 28px;
    padding: 0 9px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    background: #fff;
    border: 1px solid #e8edf4;
    font-size: .78rem;
  }

  .permission-group-body {
    border-top: 1px solid #e8edf4;
    padding: 14px;
    background: #fff;
  }

  .group-select-all {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    margin-bottom: 12px;
    color: #334155;
    font-size: .84rem;
    font-weight: 950;
  }

  .permissions-grid-ultra {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 11px;
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
    transition: .18s ease;
  }

  .permission-card:hover {
    border-color: #bfdbfe;
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
    font-size: .86rem;
    font-weight: 1000;
  }

  .permission-card small {
    display: block;
    margin-top: 4px;
    color: #64748b;
    font-size: .73rem;
    font-weight: 800;
    word-break: break-word;
  }

  .users-info-box {
    padding: 18px;
    border-radius: 22px;
    background: #f8fafc;
    border: 1px solid #e8edf4;
  }

  .users-info-box strong {
    color: #0f172a;
    font-weight: 1000;
  }

  .users-info-box.danger {
    background: #fff1f2;
    border-color: #fecdd3;
  }

  .users-info-box.danger p {
    color: #be123c;
  }

  .leave-summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .leave-summary-grid article {
    border-radius: 21px;
    padding: 16px;
    background: linear-gradient(180deg, #f8fafc, #fff);
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
    font-weight: 900;
  }

  .leave-summary-grid strong {
    color: #0f172a;
    font-size: 1.4rem;
    font-weight: 1000;
  }

  .security-shield {
    min-height: 36px;
    padding: 0 11px;
    border-radius: 999px;
    background: #ecfdf3;
    color: #047857;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: .8rem;
    font-weight: 1000;
  }

  .security-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .security-grid article {
    display: grid;
    gap: 8px;
    border-radius: 20px;
    padding: 15px;
    background: #f8fafc;
    border: 1px solid #e8edf4;
  }

  .security-grid svg {
    color: #1d4ed8;
  }

  .security-grid strong {
    color: #0f172a;
    font-weight: 1000;
  }

  .security-grid p {
    margin: 0;
    color: #64748b;
    font-size: .82rem;
    font-weight: 750;
    line-height: 1.5;
  }

  .users-preview-box {
    margin-top: 18px;
    padding: 18px;
  }

  .preview-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #0f172a;
    font-weight: 1000;
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
    background: #f8fafc;
    border: 1px solid #e8edf4;
    min-width: 0;
  }

  .preview-grid span {
    display: block;
    color: #64748b;
    font-size: .75rem;
    font-weight: 900;
    margin-bottom: 5px;
  }

  .preview-grid strong {
    display: block;
    word-break: break-word;
    font-size: .9rem;
    color: #0f172a;
    font-weight: 1000;
  }

  .users-actions-row {
    margin-top: 20px;
    justify-content: flex-end;
  }

  .sticky-actions {
    position: sticky;
    bottom: 14px;
    z-index: 5;
    padding: 12px;
    border-radius: 22px;
    background: rgba(255,255,255,.82);
    border: 1px solid rgba(226,232,240,.95);
    backdrop-filter: blur(14px);
    box-shadow: 0 18px 38px rgba(15,23,42,.10);
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
    font-weight: 900;
  }

  .users-empty-editor {
    min-height: 440px;
  }

  .users-empty-editor strong {
    color: #0f172a;
    font-size: 1.05rem;
    font-weight: 1000;
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
    font-weight: 1000;
  }

  .users-insights-panel {
    display: grid;
    gap: 14px;
  }

  .insight-card {
    padding: 17px;
    box-shadow: 0 12px 30px rgba(15,23,42,.055);
  }

  .insight-card.main {
    background:
      radial-gradient(circle at top right, rgba(37,99,235,.10), transparent 35%),
      #fff;
  }

  .insight-role {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 9px 0 7px;
    color: #1d4ed8;
  }

  .insight-role strong {
    color: #0f172a;
    font-weight: 1000;
  }

  .ring-score {
    width: 132px;
    height: 132px;
    margin: 14px auto 2px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    text-align: center;
    background:
      radial-gradient(circle at center, #fff 56%, transparent 57%),
      conic-gradient(#2563eb 0 78%, #e2e8f0 78% 100%);
  }

  .ring-score strong {
    display: block;
    color: #0f172a;
    font-size: 1.9rem;
    font-weight: 1000;
    line-height: 1;
  }

  .ring-score span {
    display: block;
    color: #64748b;
    font-size: .72rem;
    font-weight: 900;
    margin-top: 4px;
  }

  .mini-leave-list {
    display: grid;
    gap: 10px;
    margin-top: 12px;
  }

  .mini-leave-list div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 12px;
    border-radius: 15px;
    background: #f8fafc;
    border: 1px solid #e8edf4;
  }

  .mini-leave-list span {
    color: #64748b;
    font-size: .82rem;
    font-weight: 900;
  }

  .mini-leave-list strong {
    color: #0f172a;
    font-weight: 1000;
  }

  .check-list {
    list-style: none;
    padding: 0;
    margin: 12px 0 0;
    display: grid;
    gap: 9px;
  }

  .check-list li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: #334155;
    font-size: .83rem;
    font-weight: 850;
    line-height: 1.4;
  }

  .check-list svg {
    color: #16a34a;
    margin-top: 1px;
    flex: 0 0 auto;
  }

  html.dark .users-directory-panel,
  html.dark .users-editor-panel,
  html.dark .users-insights-panel,
  html.dark .tab-card,
  html.dark .users-preview-box,
  html.dark .insight-card,
  html.dark .editor-top-card {
    background: #111a2d;
    border-color: #24324d;
  }

  html.dark .section-head h2,
  html.dark .editor-top-card h2,
  html.dark .tab-card-head h3,
  html.dark .users-name-row strong,
  html.dark .profile-metric strong,
  html.dark .users-field > span,
  html.dark .assignment-banner strong,
  html.dark .role-template-card strong,
  html.dark .group-title strong,
  html.dark .permission-card strong,
  html.dark .users-info-box strong,
  html.dark .leave-summary-grid strong,
  html.dark .security-grid strong,
  html.dark .preview-title,
  html.dark .preview-grid strong,
  html.dark .insight-role strong,
  html.dark .ring-score strong,
  html.dark .mini-leave-list strong,
  html.dark .users-empty-editor strong {
    color: #e5eefc;
  }

  html.dark .section-head p,
  html.dark .editor-top-card p,
  html.dark .tab-card-head p,
  html.dark .users-username,
  html.dark .profile-metric span,
  html.dark .assignment-banner span,
  html.dark .assignment-banner p,
  html.dark .role-template-card span,
  html.dark .group-title span,
  html.dark .permission-card small,
  html.dark .users-info-box p,
  html.dark .security-grid p,
  html.dark .preview-grid span,
  html.dark .insight-card p,
  html.dark .ring-score span,
  html.dark .mini-leave-list span,
  html.dark .check-list li,
  html.dark .eyebrow {
    color: #9fb0cf;
  }

  html.dark .users-list-item,
  html.dark .users-search-box input,
  html.dark .permission-search input,
  html.dark .users-field input,
  html.dark .users-field select,
  html.dark .directory-toolbar button,
  html.dark .profile-metric,
  html.dark .assignment-banner,
  html.dark .role-template-card,
  html.dark .permission-group-card,
  html.dark .permission-group-body,
  html.dark .permission-card,
  html.dark .users-info-box,
  html.dark .leave-summary-grid article,
  html.dark .security-grid article,
  html.dark .preview-grid div,
  html.dark .mini-leave-list div,
  html.dark .users-empty-state,
  html.dark .users-empty-editor,
  html.dark .sticky-actions {
    background: #0f1728;
    border-color: #24324d;
    color: #e5eefc;
  }

  html.dark .users-list-item.active,
  html.dark .role-template-card.active,
  html.dark .permission-card.checked {
    background: #102447;
    border-color: #2563eb;
  }

  html.dark .permission-group-head,
  html.dark .group-actions {
    color: #e5eefc;
  }

  html.dark .group-actions span {
    background: #111a2d;
    border-color: #24324d;
  }

  html.dark .ring-score {
    background:
      radial-gradient(circle at center, #111a2d 56%, transparent 57%),
      conic-gradient(#2563eb 0 78%, #24324d 78% 100%);
  }

  @media (max-width: 1440px) {
    .users-workbench {
      grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
    }

    .users-insights-panel {
      grid-column: 1 / -1;
      position: relative;
      top: auto;
      grid-template-columns: repeat(4, minmax(0,1fr));
    }
  }

  @media (max-width: 1200px) {
    .users-oracle-hero,
    .users-workbench {
      grid-template-columns: 1fr;
    }

    .users-directory-panel {
      position: relative;
      top: auto;
    }

    .users-insights-panel {
      grid-template-columns: repeat(2, minmax(0,1fr));
    }

    .users-kpi-grid,
    .profile-metrics-grid,
    .preview-grid {
      grid-template-columns: repeat(2, minmax(0,1fr));
    }

    .role-template-shell {
      grid-template-columns: repeat(3, minmax(0,1fr));
    }
  }

  @media (max-width: 768px) {
    .users-ultra-page {
      gap: 14px;
    }

    .users-oracle-hero {
      border-radius: 24px;
      padding: 18px;
    }

    .users-directory-panel,
    .users-editor-panel,
    .users-insights-panel,
    .tab-card,
    .users-preview-box,
    .insight-card {
      border-radius: 22px;
      padding: 16px;
    }

    .users-kpi-grid,
    .profile-metrics-grid,
    .users-form-grid,
    .leave-summary-grid,
    .security-grid,
    .preview-grid,
    .permissions-grid-ultra,
    .users-insights-panel,
    .role-template-shell {
      grid-template-columns: 1fr;
    }

    .users-list {
      max-height: 430px;
    }

    .users-tabs {
      overflow-x: auto;
      flex-wrap: nowrap;
      padding-bottom: 4px;
    }

    .users-tabs button {
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .editor-user-main {
      align-items: flex-start;
    }

    .users-actions-row,
    .editor-top-actions,
    .permission-toolbar {
      justify-content: stretch;
    }

    .users-actions-row button,
    .editor-top-actions button,
    .permission-toolbar button,
    .users-primary-btn,
    .users-soft-btn,
    .users-danger-btn,
    .permission-search {
      width: 100%;
    }

    .permission-group-head {
      align-items: flex-start;
    }

    .group-actions {
      flex-direction: column;
      gap: 6px;
    }

    .assignment-banner {
      align-items: flex-start;
    }
  }
`;
