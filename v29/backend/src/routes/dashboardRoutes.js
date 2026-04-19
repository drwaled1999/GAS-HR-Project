import { Router } from "express";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = Router();

router.use(requireAuth);

function normalizeRoleName(roleCode) {
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

  return map[String(roleCode || "").trim().toLowerCase()] || "Employee";
}

function normalizeDivision(nationality) {
  const value = String(nationality || "").trim().toUpperCase();
  return value === "SAUDI" ? "Saudi Division" : "General";
}

function canViewAll(roleCode) {
  const role = String(roleCode || "").trim().toLowerCase();
  return ["owner", "hr_manager", "hr_admin", "hr"].includes(role);
}

function scopedEmployeesWhere(currentUser) {
  const roleCode = String(currentUser?.role_code || "").trim().toLowerCase();
  const projectName = String(currentUser?.project_name || "").trim();
  const packageName = String(currentUser?.package_name || "").trim();
  const employeeId = currentUser?.employee_id || null;
  const gasId = String(currentUser?.gas_id || "").trim();

  if (canViewAll(roleCode)) {
    return {
      clause: "1=1",
      params: [],
    };
  }

  if (["project_manager", "cm"].includes(roleCode)) {
    if (projectName) {
      return {
        clause: `COALESCE(e.project_name, '') = $1`,
        params: [projectName],
      };
    }

    return {
      clause: "1=0",
      params: [],
    };
  }

  if (["engineer", "supervisor"].includes(roleCode)) {
    if (projectName && packageName) {
      return {
        clause: `COALESCE(e.project_name, '') = $1 AND COALESCE(e.package_name, '') = $2`,
        params: [projectName, packageName],
      };
    }

    if (projectName) {
      return {
        clause: `COALESCE(e.project_name, '') = $1`,
        params: [projectName],
      };
    }

    return {
      clause: "1=0",
      params: [],
    };
  }

  if (roleCode === "employee") {
    if (employeeId) {
      return {
        clause: `e.id = $1`,
        params: [employeeId],
      };
    }

    if (gasId) {
      return {
        clause: `COALESCE(e.gas_id, '') = $1`,
        params: [gasId],
      };
    }

    return {
      clause: "1=0",
      params: [],
    };
  }

  if (employeeId) {
    return {
      clause: `e.id = $1`,
      params: [employeeId],
    };
  }

  if (gasId) {
    return {
      clause: `COALESCE(e.gas_id, '') = $1`,
      params: [gasId],
    };
  }

  return {
    clause: "1=0",
    params: [],
  };
}

router.get("/summary", async (req, res) => {
  try {
    const username = String(req.user?.username || "").trim();

    if (!username) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userResult = await query(
      `
      SELECT
        u.id,
        u.username,
        COALESCE(u.name, u.full_name, u.username) AS full_name,
        u.is_active,
        e.id AS employee_id,
        e.gas_id,
        e.nationality,
        e.project_name,
        e.package_name,
        e.job_title,
        r.code AS role_code,
        r.name AS role_name
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.username = $1
      LIMIT 1
      `,
      [username]
    );

    const currentUser = userResult.rows[0];

    if (!currentUser) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    const scope = scopedEmployeesWhere(currentUser);

    const employeesCountResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM employees e
      WHERE ${scope.clause}
      `,
      scope.params
    );

    const usersCountResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE ${scope.clause}
      `,
      scope.params
    );

    const projectsCountResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT DISTINCT COALESCE(e.project_name, 'Unknown Project') AS project_name
        FROM employees e
        WHERE ${scope.clause}
          AND e.project_name IS NOT NULL
          AND e.project_name <> ''
      ) x
      `,
      scope.params
    );

    const packagesCountResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT DISTINCT COALESCE(e.package_name, 'Unknown Package') AS package_name
        FROM employees e
        WHERE ${scope.clause}
          AND e.package_name IS NOT NULL
          AND e.package_name <> ''
      ) x
      `,
      scope.params
    );

    const todayResult = await query(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE
            (
              a.override_type = 'present'
              OR (
                a.override_type IS NULL
                AND COALESCE(a.regular_hours, 0) > 0
                AND NOT (
                  COALESCE(a.exception_text, '') ILIKE '%absence%'
                  OR COALESCE(a.exception_text, '') ILIKE '%missing punch%'
                )
              )
            )
        )::int AS present,

        COUNT(*) FILTER (
          WHERE
            a.override_type = 'absent'
            OR COALESCE(a.exception_text, '') ILIKE '%absence%'
        )::int AS absent,

        COUNT(*) FILTER (
          WHERE
            COALESCE(a.exception_text, '') ILIKE '%missing punch%'
            OR (
              COALESCE(a.check_in, '') <> ''
              AND COALESCE(a.check_in, '') <> '-'
              AND (COALESCE(a.check_out, '') = '' OR COALESCE(a.check_out, '') = '-')
            )
            OR (
              COALESCE(a.check_out, '') <> ''
              AND COALESCE(a.check_out, '') <> '-'
              AND (COALESCE(a.check_in, '') = '' OR COALESCE(a.check_in, '') = '-')
            )
        )::int AS single_punch
      FROM attendance_records a
      LEFT JOIN employees e
        ON e.gas_id = a.employee_code
        OR e.id::text = a.employee_code
      WHERE a.work_date = CURRENT_DATE
        AND ${scope.clause}
      `,
      scope.params
    );

    const projectsResult = await query(
      `
      SELECT
        ROW_NUMBER() OVER (ORDER BY e.project_name) AS id,
        e.project_name AS name,
        COUNT(*)::int AS employees
      FROM employees e
      WHERE ${scope.clause}
        AND e.project_name IS NOT NULL
        AND e.project_name <> ''
      GROUP BY e.project_name
      ORDER BY e.project_name
      LIMIT 10
      `,
      scope.params
    );

    const packagesResult = await query(
      `
      SELECT
        ROW_NUMBER() OVER (ORDER BY e.package_name) AS id,
        e.package_name AS name,
        COUNT(*)::int AS employees
      FROM employees e
      WHERE ${scope.clause}
        AND e.package_name IS NOT NULL
        AND e.package_name <> ''
      GROUP BY e.package_name
      ORDER BY e.package_name
      LIMIT 10
      `,
      scope.params
    );

    const recentUsersResult = await query(
      `
      SELECT
        u.id,
        COALESCE(u.name, u.full_name, u.username) AS full_name,
        u.username,
        u.created_at
      FROM users u
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE ${scope.clause}
      ORDER BY u.created_at DESC NULLS LAST, u.id DESC
      LIMIT 5
      `,
      scope.params
    );

    const recentAttendanceResult = await query(
      `
      SELECT
        a.id,
        a.work_date,
        a.override_type,
        a.exception_text,
        a.updated_at,
        a.created_at,
        COALESCE(e.full_name, a.employee_name, a.employee_code, 'Employee') AS employee_display_name
      FROM attendance_records a
      LEFT JOIN employees e
        ON e.gas_id = a.employee_code
        OR e.id::text = a.employee_code
      WHERE ${scope.clause}
      ORDER BY COALESCE(a.updated_at, a.created_at) DESC NULLS LAST
      LIMIT 5
      `,
      scope.params
    );

    const recentRequestsResult = await query(
      `
      SELECT
        lr.id,
        COALESCE(lr.employee_name, e.full_name, lr.employee_gas_id, 'Employee') AS employee_display_name,
        lr.type,
        lr.status,
        lr.created_at
      FROM leave_requests lr
      LEFT JOIN employees e ON e.id = lr.employee_id
      WHERE ${scope.clause}
      ORDER BY lr.created_at DESC NULLS LAST, lr.id DESC
      LIMIT 5
      `,
      scope.params
    );

    const today = todayResult.rows[0] || {
      present: 0,
      absent: 0,
      single_punch: 0,
    };

    const recentActivity = [
      ...recentUsersResult.rows.map((item) => ({
        id: `user-${item.id}`,
        title: `New user: ${item.full_name || item.username}`,
        subtitle: item.username || "-",
        status: "created",
        createdAt: item.created_at || new Date().toISOString(),
      })),

      ...recentAttendanceResult.rows.map((item) => {
        const attendanceLabel =
          item.override_type ||
          item.exception_text ||
          "Attendance updated";

        return {
          id: `attendance-${item.id}`,
          title: `${item.employee_display_name} • ${item.work_date}`,
          subtitle: attendanceLabel,
          status: "attendance",
          createdAt: item.updated_at || item.created_at || new Date().toISOString(),
        };
      }),

      ...recentRequestsResult.rows.map((item) => ({
        id: `request-${item.id}`,
        title: `${item.employee_display_name} • ${item.type || "request"}`,
        subtitle: item.status || "pending",
        status: item.status || "pending",
        createdAt: item.created_at || new Date().toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8);

    const cards = [
      {
        label: "Users",
        value: usersCountResult.rows[0]?.count || 0,
        hint: "المستخدمون ضمن نطاقك",
      },
      {
        label: "Employees",
        value: employeesCountResult.rows[0]?.count || 0,
        hint: "الموظفون ضمن نطاقك",
      },
      {
        label: "Projects",
        value: projectsCountResult.rows[0]?.count || 0,
        hint: "المشاريع ضمن نطاقك",
      },
      {
        label: "Packages",
        value: packagesCountResult.rows[0]?.count || 0,
        hint: "البكجات ضمن نطاقك",
      },
      {
        label: "Today Present",
        value: today.present || 0,
        hint: "حضور اليوم ضمن نطاقك",
      },
      {
        label: "Today Absent",
        value: today.absent || 0,
        hint: "غياب اليوم ضمن نطاقك",
      },
      {
        label: "Single Punch",
        value: today.single_punch || 0,
        hint: "السجلات الناقصة اليوم",
      },
      {
        label: "Recent Activity",
        value: recentActivity.length,
        hint: "أحدث الحركات ضمن نطاقك",
      },
    ];

    return res.json({
      user: {
        role: currentUser.role_name || normalizeRoleName(currentUser.role_code),
        division: normalizeDivision(currentUser.nationality),
        projectId: currentUser.project_name || null,
        packageId: currentUser.package_name || null,
        maintenanceMode: false,
      },
      cards,
      today: {
        date: new Date().toISOString().slice(0, 10),
        present: today.present || 0,
        absent: today.absent || 0,
        singlePunch: today.single_punch || 0,
      },
      projects: projectsResult.rows || [],
      packages: packagesResult.rows || [],
      recentActivity,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return res.status(500).json({
      message: error?.message || "Failed to load dashboard summary",
    });
  }
});

export default router;