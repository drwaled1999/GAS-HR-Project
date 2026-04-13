import { Router } from 'express';
import { authenticateToken, enforceMaintenance } from '../middleware_auth.js';
import { query } from '../data/index.js';

const router = Router();

router.use(requireAuth);

function normalizeRoleName(roleCode) {
  const map = {
    owner: 'System Owner',
    hr_manager: 'HR Manager',
    hr: 'HR',
    engineer: 'Engineer',
    supervisor: 'Supervisor',
    employee: 'Employee',
    cm: 'CM',
    project_manager: 'Project Manager'
  };

  return map[roleCode] || 'Employee';
}

router.get('/summary', async (req, res) => {
  try {
    const username = req.query.username || req.user?.username;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const userResult = await query(
      `
      SELECT
        u.id,
        u.username,
        u.full_name,
        u.is_active,
        u.status,
        e.id AS employee_id,
        e.gas_id,
        e.nationality,
        e.project_id,
        e.package_id,
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
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const usersCountResult = await query(`SELECT COUNT(*)::int AS count FROM users`);
    const employeesCountResult = await query(`SELECT COUNT(*)::int AS count FROM employees`);
    const activeProjectsCountResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT DISTINCT COALESCE(project_name, 'Unknown Project') AS project_name
        FROM employees
      ) x
      `
    );

    const todayResult = await query(
      `
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(hours, 0) > 0)::int AS present,
        COUNT(*) FILTER (WHERE status = 'A')::int AS absent,
        COUNT(*) FILTER (WHERE status = 'SP' OR status ILIKE '%single%')::int AS single_punch
      FROM attendance_records
      WHERE work_date = CURRENT_DATE
      `
    );

    const recentUsersResult = await query(
      `
      SELECT
        u.id,
        u.full_name,
        u.username,
        u.created_at
      FROM users u
      ORDER BY u.created_at DESC NULLS LAST, u.id DESC
      LIMIT 5
      `
    );

    const recentAttendanceResult = await query(
      `
      SELECT
        a.id,
        a.work_date,
        a.status,
        a.updated_at,
        a.created_at,
        e.full_name
      FROM attendance_records a
      LEFT JOIN employees e ON e.id = a.employee_id
      ORDER BY COALESCE(a.updated_at, a.created_at) DESC NULLS LAST
      LIMIT 5
      `
    );

    const projectsResult = await query(
      `
      SELECT
        ROW_NUMBER() OVER (ORDER BY project_name) AS id,
        project_name AS name,
        COUNT(*)::int AS employees
      FROM employees
      WHERE project_name IS NOT NULL AND project_name <> ''
      GROUP BY project_name
      ORDER BY project_name
      LIMIT 10
      `
    );

    const packagesResult = await query(
      `
      SELECT
        ROW_NUMBER() OVER (ORDER BY package_name) AS id,
        package_name AS name,
        COUNT(*)::int AS employees
      FROM employees
      WHERE package_name IS NOT NULL AND package_name <> ''
      GROUP BY package_name
      ORDER BY package_name
      LIMIT 10
      `
    );

    const recentActivity = [
      ...recentUsersResult.rows.map((item) => ({
        id: `user-${item.id}`,
        title: `New user: ${item.full_name || item.username}`,
        subtitle: item.username,
        status: 'created',
        createdAt: item.created_at || new Date().toISOString()
      })),
      ...recentAttendanceResult.rows.map((item) => ({
        id: `attendance-${item.id}`,
        title: `${item.full_name || 'Employee'} • ${item.work_date}`,
        subtitle: item.status || 'Attendance updated',
        status: 'attendance',
        createdAt: item.updated_at || item.created_at || new Date().toISOString()
      }))
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);

    const today = todayResult.rows[0] || {
      present: 0,
      absent: 0,
      single_punch: 0
    };

    const cards = [
      {
        label: 'Users',
        value: usersCountResult.rows[0]?.count || 0,
        hint: 'إجمالي المستخدمين'
      },
      {
        label: 'Employees',
        value: employeesCountResult.rows[0]?.count || 0,
        hint: 'إجمالي الموظفين'
      },
      {
        label: 'Active Projects',
        value: activeProjectsCountResult.rows[0]?.count || 0,
        hint: 'المشاريع الموجودة بالنظام'
      },
      {
        label: 'Today Present',
        value: today.present || 0,
        hint: `حضور اليوم ${new Date().toISOString().slice(0, 10)}`
      },
      {
        label: 'Today Absent',
        value: today.absent || 0,
        hint: 'غياب اليوم'
      },
      {
        label: 'Single Punch',
        value: today.single_punch || 0,
        hint: 'السجلات الناقصة اليوم'
      }
    ];

    return res.json({
      user: {
        role: currentUser.role_name || normalizeRoleName(currentUser.role_code),
        division: currentUser.nationality === 'SAUDI' ? 'Saudi Division' : 'General',
        projectId: currentUser.project_id || null,
        packageId: currentUser.package_id || null,
        maintenanceMode: false
      },
      cards,
      today: {
        date: new Date().toISOString().slice(0, 10),
        present: today.present || 0,
        absent: today.absent || 0,
        singlePunch: today.single_punch || 0
      },
      projects: projectsResult.rows || [],
      packages: packagesResult.rows || [],
      recentActivity
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return res.status(500).json({ message: 'Failed to load dashboard summary' });
  }
});

export default router;
