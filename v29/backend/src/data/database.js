import pg from 'pg';
import { db } from './index.js';

const { Pool } = pg;

let pool = null;
let autosaveTimer = null;
let initialized = false;

export function shouldUsePostgres() {
  return String(process.env.DB_DRIVER || '').toLowerCase() === 'postgres' || !!process.env.DATABASE_URL;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false)
    });
  }
  return pool;
}

export async function initDatabase() {
  if (initialized) return { driver: shouldUsePostgres() ? 'postgres' : 'memory' };

  if (!shouldUsePostgres()) {
    initialized = true;
    console.log('[db] Running with in-memory store');
    return { driver: 'memory' };
  }

  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        state JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        gas_id TEXT UNIQUE NOT NULL,
        nationality_type TEXT,
        division TEXT NOT NULL,
        job_title TEXT NOT NULL,
        role_id INTEGER NOT NULL,
        project_id INTEGER NULL,
        package_id INTEGER NULL,
        supervisor_id INTEGER NULL,
        access_scope TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        allow_during_maintenance BOOLEAN NOT NULL DEFAULT FALSE,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
        locked_until TIMESTAMPTZ NULL,
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        last_login_at TIMESTAMPTZ NULL,
        last_login_ip TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY,
        gas_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        nationality TEXT NOT NULL,
        project_id INTEGER NULL,
        package_id INTEGER NULL,
        user_id INTEGER NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS attendance_uploads (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL,
        uploaded_by TEXT,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        columns JSONB NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE TABLE IF NOT EXISTS attendance_records (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        date DATE NOT NULL,
        hours NUMERIC(10,2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        upload_id INTEGER NULL,
        is_modified BOOLEAN NOT NULL DEFAULT FALSE,
        note TEXT NOT NULL DEFAULT '',
        request_id INTEGER NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (employee_id, date)
      );
      CREATE TABLE IF NOT EXISTS attendance_adjustments (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        employee_name TEXT NULL,
        date DATE NOT NULL,
        current_status TEXT NULL,
        new_status TEXT NOT NULL,
        hours NUMERIC(10,2) NOT NULL DEFAULT 0,
        reason TEXT NOT NULL DEFAULT '',
        approver_user_id INTEGER NULL,
        requested_by_id INTEGER NULL,
        requested_by_name TEXT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT NULL,
        reviewed_by_name TEXT NULL,
        reviewed_at TIMESTAMPTZ NULL,
        rejection_reason TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_division_project_package ON users (division, project_id, package_id);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS login_attempts (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        ip_address TEXT NOT NULL DEFAULT '-',
        user_agent TEXT NOT NULL DEFAULT '-',
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS security_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NULL,
        event_type TEXT NOT NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address TEXT NOT NULL DEFAULT '-',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens (user_id, expires_at DESC);

      CREATE INDEX IF NOT EXISTS idx_employees_division_project_package ON employees (project_id, package_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_date ON attendance_records (employee_id, date);
      CREATE INDEX IF NOT EXISTS idx_attendance_adjustments_employee_date ON attendance_adjustments (employee_id, date);

      CREATE TABLE IF NOT EXISTS leave_policies (
        code TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        default_days INTEGER NOT NULL DEFAULT 0,
        requires_attachment BOOLEAN NOT NULL DEFAULT FALSE,
        deduct_from_balance BOOLEAN NOT NULL DEFAULT TRUE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS leave_balances (
        employee_id INTEGER PRIMARY KEY,
        annual_leave_total INTEGER NOT NULL DEFAULT 30,
        annual_leave_used INTEGER NOT NULL DEFAULT 0,
        emergency_leave_total INTEGER NOT NULL DEFAULT 5,
        emergency_leave_used INTEGER NOT NULL DEFAULT 0,
        sick_leave_total INTEGER NOT NULL DEFAULT 15,
        sick_leave_used INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS closed_attendance_months (
        key TEXT PRIMARY KEY,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        closed BOOLEAN NOT NULL DEFAULT TRUE,
        closed_at TIMESTAMPTZ NULL,
        closed_by_id INTEGER NULL,
        closed_by_name TEXT NULL,
        reopened_at TIMESTAMPTZ NULL,
        reopened_by_id INTEGER NULL,
        reopened_by_name TEXT NULL,
        note TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        employee_gas_id TEXT NOT NULL,
        project_id INTEGER NULL,
        package_id INTEGER NULL,
        type TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'leave',
        current_bank TEXT NOT NULL DEFAULT '',
        new_bank TEXT NOT NULL DEFAULT '',
        new_iban TEXT NOT NULL DEFAULT '',
        attachment_name TEXT NULL,
        attachment_path TEXT NULL,
        requested_by_id INTEGER NOT NULL,
        requested_by_name TEXT NOT NULL,
        approver_user_id INTEGER NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewer_id INTEGER NULL,
        reviewer_name TEXT NULL,
        rejection_reason TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'general',
        path TEXT NOT NULL DEFAULT '/',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        read_at TIMESTAMPTZ NULL
      );
      CREATE TABLE IF NOT EXISTS work_hour_policies (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL,
        division TEXT NULL,
        nationality TEXT NULL,
        project_id INTEGER NULL,
        package_id INTEGER NULL,
        expected_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by TEXT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS payroll_runs (
        id SERIAL PRIMARY KEY,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        division TEXT NULL,
        project_id INTEGER NULL,
        package_id INTEGER NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        summary JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by_id INTEGER NULL,
        created_by_name TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMPTZ NULL
      );
      CREATE TABLE IF NOT EXISTS payroll_items (
        id SERIAL PRIMARY KEY,
        payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
        employee_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        gas_id TEXT NOT NULL,
        nationality TEXT NOT NULL,
        project_id INTEGER NULL,
        package_id INTEGER NULL,
        expected_daily_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
        present_days INTEGER NOT NULL DEFAULT 0,
        absent_days INTEGER NOT NULL DEFAULT 0,
        leave_days INTEGER NOT NULL DEFAULT 0,
        issue_days INTEGER NOT NULL DEFAULT 0,
        regular_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
        overtime_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
        total_worked_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
        payable_base_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
        gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        deductions_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS salary_transfer_requests (
        id INTEGER PRIMARY KEY,
        leave_request_id INTEGER NULL,
        employee_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        employee_gas_id TEXT NOT NULL,
        division TEXT NOT NULL,
        project_id INTEGER NULL,
        package_id INTEGER NULL,
        current_bank TEXT NOT NULL DEFAULT '',
        new_bank TEXT NOT NULL DEFAULT '',
        new_iban TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        attachment_name TEXT NULL,
        attachment_path TEXT NULL,
        requested_by_id INTEGER NOT NULL,
        requested_by_name TEXT NOT NULL,
        approver_user_id INTEGER NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewer_id INTEGER NULL,
        reviewer_name TEXT NULL,
        rejection_reason TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_work_hour_policies_scope ON work_hour_policies (division, nationality, project_id, package_id, active);
      CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON payroll_runs (year, month, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_items (payroll_run_id, employee_id);
      CREATE INDEX IF NOT EXISTS idx_salary_transfer_status ON salary_transfer_requests (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_created ON leave_requests (employee_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_approver_status ON leave_requests (approver_user_id, status);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS employee_compensation (
        employee_id INTEGER PRIMARY KEY,
        base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
        hourly_rate NUMERIC(12,4) NOT NULL DEFAULT 0,
        overtime_multiplier NUMERIC(6,2) NOT NULL DEFAULT 1.50,
        housing_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
        transport_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
        other_allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
        updated_by TEXT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS payroll_adjustments (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        created_by TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_employee_compensation_employee ON employee_compensation (employee_id);
      CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_period ON payroll_adjustments (year, month, employee_id, type);
    `);

    const usersCount = await client.query('SELECT COUNT(*)::int AS count FROM users');
    if (usersCount.rows[0].count === 0) {
      for (const user of db.users) {
        await client.query(`INSERT INTO users (id, username, password_hash, name, gas_id, nationality_type, division, job_title, role_id, project_id, package_id, supervisor_id, access_scope, status, permissions, allow_during_maintenance, failed_attempts, is_locked, locked_until, must_change_password, last_login_at, last_login_ip, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19,$20,$21,$22,COALESCE($23::timestamptz,NOW()),COALESCE($24::timestamptz,NOW())) ON CONFLICT (id) DO NOTHING`, [user.id, user.username, user.passwordHash, user.name, String(user.gasId), user.nationalityType || null, user.division, user.jobTitle, user.roleId, user.projectId || null, user.packageId || null, user.supervisorId || null, user.accessScope, user.status || 'active', JSON.stringify(user.permissions || []), Boolean(user.allowDuringMaintenance), Number(user.failedAttempts || 0), Boolean(user.isLocked), user.lockedUntil || null, Boolean(user.mustChangePassword), user.lastLoginAt || null, user.lastLoginIp || null, user.createdAt || null, user.updatedAt || null]);
      }
    }
    const employeesCount = await client.query('SELECT COUNT(*)::int AS count FROM employees');
    if (employeesCount.rows[0].count === 0) {
      for (const employee of db.employees) {
        await client.query(`INSERT INTO employees (id, gas_id, name, nationality, project_id, package_id, user_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,NOW()),COALESCE($9::timestamptz,NOW())) ON CONFLICT (id) DO NOTHING`, [employee.id, String(employee.gasId), employee.name, employee.nationality, employee.projectId || null, employee.packageId || null, employee.userId || null, employee.createdAt || null, employee.updatedAt || null]);
      }
    }
    const attendanceUploadsCount = await client.query('SELECT COUNT(*)::int AS count FROM attendance_uploads');
    if (attendanceUploadsCount.rows[0].count === 0 && db.attendanceUploads.length) {
      for (const upload of db.attendanceUploads) {
        await client.query(`INSERT INTO attendance_uploads (id, file_name, uploaded_by, imported_at, columns) VALUES ($1,$2,$3,COALESCE($4::timestamptz,NOW()),$5::jsonb) ON CONFLICT (id) DO NOTHING`, [upload.id, upload.fileName, upload.uploadedBy || 'system', upload.importedAt || null, JSON.stringify(upload.columns || {})]);
      }
    }
    const attendanceRecordsCount = await client.query('SELECT COUNT(*)::int AS count FROM attendance_records');
    if (attendanceRecordsCount.rows[0].count === 0 && db.attendanceRecords.length) {
      for (const record of db.attendanceRecords) {
        await client.query(`INSERT INTO attendance_records (id, employee_id, date, hours, status, source, upload_id, is_modified, note, request_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::timestamptz,NOW()),COALESCE($12::timestamptz,NOW())) ON CONFLICT (id) DO NOTHING`, [record.id, record.employeeId, record.date, Number(record.hours || 0), record.status, record.source || 'manual', record.uploadId || null, Boolean(record.isModified), record.note || '', record.requestId || null, record.createdAt || null, record.updatedAt || null]);
      }
    }
    const attendanceAdjustmentsCount = await client.query('SELECT COUNT(*)::int AS count FROM attendance_adjustments');
    if (attendanceAdjustmentsCount.rows[0].count === 0 && db.attendanceAdjustments.length) {
      for (const item of db.attendanceAdjustments) {
        await client.query(`INSERT INTO attendance_adjustments (id, employee_id, employee_name, date, current_status, new_status, hours, reason, approver_user_id, requested_by_id, requested_by_name, status, reviewed_by, reviewed_by_name, reviewed_at, rejection_reason, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,COALESCE($17::timestamptz,NOW())) ON CONFLICT (id) DO NOTHING`, [item.id, item.employeeId, item.employeeName || null, item.date, item.currentStatus || null, item.newStatus, Number(item.hours || 0), item.reason || '', item.approverUserId || null, item.requestedById || null, item.requestedByName || null, item.status || 'pending', item.reviewedBy || null, item.reviewedByName || null, item.reviewedAt || null, item.rejectionReason || '', item.createdAt || null]);
      }
    }


    const workHourPoliciesCount = await client.query('SELECT COUNT(*)::int AS count FROM work_hour_policies');
    if (workHourPoliciesCount.rows[0].count === 0 && db.settings.workHourPolicies.length) {
      for (const item of db.settings.workHourPolicies) {
        await client.query(`INSERT INTO work_hour_policies (id,label,division,nationality,project_id,package_id,expected_hours,active,updated_by,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::timestamptz,NOW())) ON CONFLICT (id) DO NOTHING`, [item.id, item.label, item.division || null, item.nationality || null, item.projectId || null, item.packageId || null, Number(item.expectedHours || 0), item.active !== false, item.updatedBy || null, item.updatedAt || null]);
      }
    }
    const leavePoliciesCount = await client.query('SELECT COUNT(*)::int AS count FROM leave_policies');
    if (leavePoliciesCount.rows[0].count === 0 && db.leavePolicies.length) {
      for (const item of db.leavePolicies) {
        await client.query(`INSERT INTO leave_policies (code,label,default_days,requires_attachment,deduct_from_balance,active,updated_at) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,NOW())) ON CONFLICT (code) DO NOTHING`, [item.code,item.label,Number(item.defaultDays||0),Boolean(item.requiresAttachment),Boolean(item.deductFromBalance), item.active !== false, item.updatedAt || null]);
      }
    }
    const leaveBalancesCount = await client.query('SELECT COUNT(*)::int AS count FROM leave_balances');
    if (leaveBalancesCount.rows[0].count === 0 && db.leaveBalances.length) {
      for (const item of db.leaveBalances) {
        await client.query(`INSERT INTO leave_balances (employee_id,annual_leave_total,annual_leave_used,emergency_leave_total,emergency_leave_used,sick_leave_total,sick_leave_used,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,NOW())) ON CONFLICT (employee_id) DO NOTHING`, [Number(item.employeeId),Number(item.annualLeaveTotal||30),Number(item.annualLeaveUsed||0),Number(item.emergencyLeaveTotal||5),Number(item.emergencyLeaveUsed||0),Number(item.sickLeaveTotal||15),Number(item.sickLeaveUsed||0), item.updatedAt || null]);
      }
    }
    const closedMonthsCount = await client.query('SELECT COUNT(*)::int AS count FROM closed_attendance_months');
    if (closedMonthsCount.rows[0].count === 0 && db.closedAttendanceMonths.length) {
      for (const item of db.closedAttendanceMonths) {
        await client.query(`INSERT INTO closed_attendance_months (key,month,year,closed,closed_at,closed_by_id,closed_by_name,reopened_at,reopened_by_id,reopened_by_name,note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (key) DO NOTHING`, [item.key,Number(item.month),Number(item.year),Boolean(item.closed),item.closedAt||null,item.closedById||null,item.closedByName||null,item.reopenedAt||null,item.reopenedById||null,item.reopenedByName||null,item.note||'']);
      }
    }
    const leaveRequestsCount = await client.query('SELECT COUNT(*)::int AS count FROM leave_requests');
    if (leaveRequestsCount.rows[0].count === 0 && db.leaveRequests.length) {
      for (const item of db.leaveRequests) {
        await client.query(`INSERT INTO leave_requests (id,employee_id,employee_name,employee_gas_id,project_id,package_id,type,start_date,end_date,note,category,current_bank,new_bank,new_iban,attachment_name,attachment_path,requested_by_id,requested_by_name,approver_user_id,status,reviewer_id,reviewer_name,rejection_reason,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,COALESCE($24::timestamptz,NOW()),COALESCE($25::timestamptz,NOW())) ON CONFLICT (id) DO NOTHING`, [item.id,Number(item.employeeId),item.employeeName,item.employeeGasId,item.projectId||null,item.packageId||null,item.type,item.startDate,item.endDate,item.note||'',item.category||'leave',item.currentBank||'',item.newBank||'',item.newIban||'',item.attachmentName||null,item.attachmentPath||null,Number(item.requestedById),item.requestedByName||'',item.approverUserId||null,item.status||'pending',item.reviewerId||null,item.reviewerName||null,item.rejectionReason||'',item.createdAt||null,item.updatedAt||null]);
      }
    }
    const salaryTransferCount = await client.query('SELECT COUNT(*)::int AS count FROM salary_transfer_requests');
    if (salaryTransferCount.rows[0].count === 0) {
      const transferItems = db.leaveRequests.filter((item) => item.category === 'salary_transfer');
      for (const item of transferItems) {
        await client.query(`INSERT INTO salary_transfer_requests (id,leave_request_id,employee_id,employee_name,employee_gas_id,division,project_id,package_id,current_bank,new_bank,new_iban,note,attachment_name,attachment_path,requested_by_id,requested_by_name,approver_user_id,status,reviewer_id,reviewer_name,rejection_reason,created_at,updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,COALESCE($22::timestamptz,NOW()),COALESCE($23::timestamptz,NOW())) ON CONFLICT (id) DO NOTHING`, [item.id,item.id,Number(item.employeeId),item.employeeName,item.employeeGasId,item.employeeGasId && String(item.employeeGasId).startsWith('2') ? 'Saudi Division' : (item.projectId === 1 ? 'Non-Saudi Division' : 'Saudi Division'),item.projectId||null,item.packageId||null,item.currentBank||'',item.newBank||'',item.newIban||'',item.note||'',item.attachmentName||null,item.attachmentPath||null,Number(item.requestedById),item.requestedByName||'',item.approverUserId||null,item.status||'pending',item.reviewerId||null,item.reviewerName||null,item.rejectionReason||'',item.createdAt||null,item.updatedAt||null]);
      }
    }
    const notificationsCount = await client.query('SELECT COUNT(*)::int AS count FROM notifications');
    if (notificationsCount.rows[0].count === 0 && db.notifications.length) {
      for (const item of db.notifications) {
        await client.query(`INSERT INTO notifications (id,user_id,message,type,path,metadata,is_read,created_at,read_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,COALESCE($8::timestamptz,NOW()),$9) ON CONFLICT (id) DO NOTHING`, [item.id,Number(item.userId),item.message,item.type||'general',item.path||'/',JSON.stringify(item.meta||{}),Boolean(item.isRead),item.createdAt||null,item.readAt||null]);
      }
    }

    const compensationCount = await client.query('SELECT COUNT(*)::int AS count FROM employee_compensation');
    if (compensationCount.rows[0].count === 0) {
      for (const employee of db.employees) {
        const monthlyBase = employee.nationality === 'SAUDI' ? 6000 : 3500;
        const dailyHours = employee.nationality === 'SAUDI' ? 8 : 10;
        const hourlyRate = Number((monthlyBase / (dailyHours * 30)).toFixed(4));
        await client.query(`INSERT INTO employee_compensation (employee_id, base_salary, hourly_rate, overtime_multiplier, housing_allowance, transport_allowance, other_allowances, updated_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (employee_id) DO NOTHING`, [employee.id, monthlyBase, hourlyRate, 1.5, 0, 0, 0, 'seed']);
      }
    }

    
    const auditLogsCount = await client.query('SELECT COUNT(*)::int AS count FROM audit_logs');
    if (auditLogsCount.rows[0].count === 0 && db.auditLogs.length) {
      for (const item of db.auditLogs) {
        await client.query(`INSERT INTO audit_logs (id,action,actor_name,details,created_at) VALUES ($1,$2,$3,$4::jsonb,COALESCE($5::timestamptz,NOW())) ON CONFLICT (id) DO NOTHING`, [item.id, item.action, item.actorName || 'System', JSON.stringify(item.details || {}), item.createdAt || null]);
      }
    }
    const loginAttemptsCount = await client.query('SELECT COUNT(*)::int AS count FROM login_attempts');
    if (loginAttemptsCount.rows[0].count === 0 && db.loginAttempts.length) {
      for (const item of db.loginAttempts) {
        await client.query(`INSERT INTO login_attempts (id,username,ip_address,user_agent,status,created_at) VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz,NOW())) ON CONFLICT (id) DO NOTHING`, [item.id, item.username, item.ipAddress || '-', item.userAgent || '-', item.status, item.createdAt || null]);
      }
    }
    const securityEventsCount = await client.query('SELECT COUNT(*)::int AS count FROM security_events');
    if (securityEventsCount.rows[0].count === 0 && db.securityEvents.length) {
      for (const item of db.securityEvents) {
        await client.query(`INSERT INTO security_events (id,user_id,event_type,details,ip_address,created_at) VALUES ($1,$2,$3,$4::jsonb,$5,COALESCE($6::timestamptz,NOW())) ON CONFLICT (id) DO NOTHING`, [item.id, item.userId || null, item.eventType, JSON.stringify(item.details || {}), item.ipAddress || '-', item.createdAt || null]);
      }
    }
    const refreshTokensCount = await client.query('SELECT COUNT(*)::int AS count FROM refresh_tokens');
    if (refreshTokensCount.rows[0].count === 0 && db.refreshTokens.length) {
      for (const item of db.refreshTokens) {
        await client.query(`INSERT INTO refresh_tokens (id,user_id,token_hash,expires_at,revoked_at,created_at) VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz,COALESCE($6::timestamptz,NOW())) ON CONFLICT (id) DO NOTHING`, [item.id, Number(item.userId), item.tokenHash, item.expiresAt, item.revokedAt || null, item.createdAt || null]);
      }
    }

const result = await client.query('SELECT state FROM app_state WHERE key = $1 LIMIT 1', ['main']);
    if (result.rows.length > 0) {
      const saved = result.rows[0].state;
      hydrateStore(saved);
      console.log('[db] Loaded application state from PostgreSQL');
    } else {
      await saveDatabaseSnapshot();
      console.log('[db] Seeded initial application state into PostgreSQL');
    }

    autosaveTimer = setInterval(() => {
      saveDatabaseSnapshot().catch((err) => {
        console.error('[db] autosave failed', err);
      });
    }, Number(process.env.DB_AUTOSAVE_MS || 10000));
    if (autosaveTimer.unref) autosaveTimer.unref();

    initialized = true;
    return { driver: 'postgres' };
  } finally {
    client.release();
  }
}

function hydrateStore(saved) {
  if (!saved || typeof saved !== 'object') return;
  for (const key of Object.keys(db)) {
    if (!(key in saved)) continue;
    const current = db[key];
    const incoming = saved[key];
    if (Array.isArray(current)) {
      current.splice(0, current.length, ...incoming);
    } else if (current && typeof current === 'object') {
      Object.keys(current).forEach((k) => delete current[k]);
      Object.assign(current, incoming);
    } else {
      db[key] = incoming;
    }
  }
}

function serializeDb() {
  return JSON.parse(JSON.stringify(db));
}

export async function saveDatabaseSnapshot() {
  if (!shouldUsePostgres()) return;
  const state = serializeDb();
  await getPool().query(
    `INSERT INTO app_state (key, state, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key)
     DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
    ['main', JSON.stringify(state)]
  );
}

export async function shutdownDatabase() {
  try {
    if (autosaveTimer) clearInterval(autosaveTimer);
    await saveDatabaseSnapshot();
  } catch (err) {
    console.error('[db] shutdown save failed', err);
  }

  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function getDatabaseHealth() {
  if (!shouldUsePostgres()) return { driver: 'memory', ok: true };
  const result = await getPool().query('SELECT NOW() as now');
  return { driver: 'postgres', ok: true, now: result.rows[0].now };
}
