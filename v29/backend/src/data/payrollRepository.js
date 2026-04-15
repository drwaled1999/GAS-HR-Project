import { addAuditLog } from "./store.js";
import { pool, query } from "./index.js";
import { getScopedEmployeesForUserRepo } from "./userEmployeeRepository.js";
import { listAttendanceRecordsRepo } from "./attendanceRepository.js";
import { daysInMonth } from "../utils/date.js";

function mapPolicyRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    label: row.label,
    division: row.division,
    nationality: row.nationality,
    projectId: row.project_id ?? null,
    packageId: row.package_id ?? null,
    expectedHours: Number(row.expected_hours || 0),
    active: Boolean(row.active),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by || null,
  };
}

function mapCompensationRow(row) {
  if (!row) return null;

  return {
    employeeId: row.employee_id,
    baseSalary: Number(row.base_salary || 0),
    hourlyRate: Number(row.hourly_rate || 0),
    overtimeMultiplier: Number(row.overtime_multiplier || 1.5),
    housingAllowance: Number(row.housing_allowance || 0),
    transportAllowance: Number(row.transport_allowance || 0),
    otherAllowances: Number(row.other_allowances || 0),
    updatedBy: row.updated_by || null,
    updatedAt: row.updated_at,
  };
}

function mapAdjustmentRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    employeeId: row.employee_id,
    month: Number(row.month),
    year: Number(row.year),
    type: row.type,
    label: row.label,
    amount: Number(row.amount || 0),
    note: row.note || "",
    createdBy: row.created_by || null,
    createdAt: row.created_at,
  };
}

function mapPayrollRunRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    month: Number(row.month),
    year: Number(row.year),
    division: row.division || null,
    projectId: row.project_id ?? null,
    packageId: row.package_id ?? null,
    status: row.status,
    summary: row.summary || {},
    createdById: row.created_by_id ?? null,
    createdByName: row.created_by_name || null,
    createdAt: row.created_at,
    closedAt: row.closed_at || null,
  };
}

function mapPayrollItemRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    payrollRunId: row.payroll_run_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    gasId: row.gas_id,
    nationality: row.nationality,
    projectId: row.project_id ?? null,
    packageId: row.package_id ?? null,
    expectedDailyHours: Number(row.expected_daily_hours || 0),
    presentDays: Number(row.present_days || 0),
    absentDays: Number(row.absent_days || 0),
    leaveDays: Number(row.leave_days || 0),
    issueDays: Number(row.issue_days || 0),
    regularHours: Number(row.regular_hours || 0),
    overtimeHours: Number(row.overtime_hours || 0),
    totalWorkedHours: Number(row.total_worked_hours || 0),
    payableBaseHours: Number(row.payable_base_hours || 0),
    grossAmount: Number(row.gross_amount || 0),
    deductionsAmount: Number(row.deductions_amount || 0),
    netAmount: Number(row.net_amount || 0),
    details: row.details || {},
    createdAt: row.created_at,
  };
}

function monthDateRange(month, year) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-${String(
    daysInMonth(year, month)
  ).padStart(2, "0")}`;
  return { from, to };
}

const LEAVE_STATUSES = new Set([
  "Annual Leave",
  "Emergency Leave",
  "Sick Leave",
  "Hajj",
  "Umrah",
  "Business Trip",
  "Training",
  "Official Holiday",
  "Weekend",
]);

export async function listWorkHourPoliciesRepo() {
  const { rows } = await query(
    `SELECT *
     FROM work_hour_policies
     ORDER BY id`
  );

  return rows.map(mapPolicyRow);
}

export async function upsertWorkHourPolicyRepo(payload, actorName = "System Owner") {
  if (payload.id) {
    const { rows } = await query(
      `UPDATE work_hour_policies
       SET
         label = $1,
         division = $2,
         nationality = $3,
         project_id = $4,
         package_id = $5,
         expected_hours = $6,
         active = $7,
         updated_by = $8,
         updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        payload.label,
        payload.division || null,
        payload.nationality || null,
        payload.projectId || null,
        payload.packageId || null,
        Number(payload.expectedHours || 0),
        payload.active !== false,
        actorName,
        payload.id,
      ]
    );

    const item = mapPolicyRow(rows[0]);
    addAuditLog("PAYROLL_POLICY_UPDATED", actorName, { policy: item });
    return item;
  }

  const { rows } = await query(
    `INSERT INTO work_hour_policies (
       label,
       division,
       nationality,
       project_id,
       package_id,
       expected_hours,
       active,
       updated_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      payload.label,
      payload.division || null,
      payload.nationality || null,
      payload.projectId || null,
      payload.packageId || null,
      Number(payload.expectedHours || 0),
      payload.active !== false,
      actorName,
    ]
  );

  const item = mapPolicyRow(rows[0]);
  addAuditLog("PAYROLL_POLICY_CREATED", actorName, { policy: item });
  return item;
}

export async function deleteWorkHourPolicyRepo(id, actorName = "System Owner") {
  const { rows } = await query(
    `DELETE FROM work_hour_policies
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  if (!rows[0]) return null;

  const item = mapPolicyRow(rows[0]);
  addAuditLog("PAYROLL_POLICY_DELETED", actorName, { policy: item });
  return item;
}

export async function getExpectedWorkHoursForEmployeeRepo(employee) {
  const policies = await listWorkHourPoliciesRepo();
  const active = policies.filter((x) => x.active !== false);

  const exactPackage = active.find(
    (policy) =>
      String(policy.projectId) === String(employee.projectId) &&
      String(policy.packageId) === String(employee.packageId)
  );
  if (exactPackage) return Number(exactPackage.expectedHours || 0);

  const exactProject = active.find(
    (policy) =>
      String(policy.projectId) === String(employee.projectId) &&
      !policy.packageId
  );
  if (exactProject) return Number(exactProject.expectedHours || 0);

  const division =
    employee.nationality === "SAUDI"
      ? "Saudi Division"
      : "Non-Saudi Division";

  const divisionDefault = active.find(
    (policy) =>
      policy.division === division && !policy.projectId && !policy.packageId
  );
  if (divisionDefault) return Number(divisionDefault.expectedHours || 0);

  return employee.nationality === "SAUDI" ? 8 : 10;
}

export async function listEmployeeCompensationRepo(scope = {}) {
  const params = [];
  let where = "";

  if (scope.employeeId) {
    params.push(scope.employeeId);
    where = "WHERE employee_id = $1";
  }

  const { rows } = await query(
    `SELECT *
     FROM employee_compensation
     ${where}
     ORDER BY employee_id`,
    params
  );

  return rows.map(mapCompensationRow);
}

export async function upsertEmployeeCompensationRepo(payload, actorName = "System Owner") {
  const { rows } = await query(
    `INSERT INTO employee_compensation (
       employee_id,
       base_salary,
       hourly_rate,
       overtime_multiplier,
       housing_allowance,
       transport_allowance,
       other_allowances,
       updated_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (employee_id)
     DO UPDATE SET
       base_salary = EXCLUDED.base_salary,
       hourly_rate = EXCLUDED.hourly_rate,
       overtime_multiplier = EXCLUDED.overtime_multiplier,
       housing_allowance = EXCLUDED.housing_allowance,
       transport_allowance = EXCLUDED.transport_allowance,
       other_allowances = EXCLUDED.other_allowances,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [
      payload.employeeId,
      Number(payload.baseSalary || 0),
      Number(payload.hourlyRate || 0),
      Number(payload.overtimeMultiplier || 1.5),
      Number(payload.housingAllowance || 0),
      Number(payload.transportAllowance || 0),
      Number(payload.otherAllowances || 0),
      actorName,
    ]
  );

  const item = mapCompensationRow(rows[0]);
  addAuditLog("EMPLOYEE_COMPENSATION_SAVED", actorName, { compensation: item });
  return item;
}

export async function listPayrollAdjustmentsRepo({ month, year, employeeId } = {}) {
  const params = [];
  const filters = [];

  if (month) {
    params.push(Number(month));
    filters.push(`month = $${params.length}`);
  }
  if (year) {
    params.push(Number(year));
    filters.push(`year = $${params.length}`);
  }
  if (employeeId) {
    params.push(employeeId);
    filters.push(`employee_id = $${params.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT *
     FROM payroll_adjustments
     ${where}
     ORDER BY created_at DESC, id DESC`,
    params
  );

  return rows.map(mapAdjustmentRow);
}

export async function upsertPayrollAdjustmentRepo(payload, actorName = "System Owner") {
  if (payload.id) {
    const { rows } = await query(
      `UPDATE payroll_adjustments
       SET
         type = $1,
         label = $2,
         amount = $3,
         note = $4,
         month = $5,
         year = $6
       WHERE id = $7
       RETURNING *`,
      [
        payload.type,
        payload.label,
        Number(payload.amount || 0),
        payload.note || "",
        Number(payload.month),
        Number(payload.year),
        payload.id,
      ]
    );

    const item = mapAdjustmentRow(rows[0]);
    addAuditLog("PAYROLL_ADJUSTMENT_UPDATED", actorName, { adjustment: item });
    return item;
  }

  const { rows } = await query(
    `INSERT INTO payroll_adjustments (
       employee_id,
       month,
       year,
       type,
       label,
       amount,
       note,
       created_by
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      payload.employeeId,
      Number(payload.month),
      Number(payload.year),
      payload.type,
      payload.label,
      Number(payload.amount || 0),
      payload.note || "",
      actorName,
    ]
  );

  const item = mapAdjustmentRow(rows[0]);
  addAuditLog("PAYROLL_ADJUSTMENT_CREATED", actorName, { adjustment: item });
  return item;
}

export async function deletePayrollAdjustmentRepo(id, actorName = "System Owner") {
  const { rows } = await query(
    `DELETE FROM payroll_adjustments
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  if (!rows[0]) return null;

  const item = mapAdjustmentRow(rows[0]);
  addAuditLog("PAYROLL_ADJUSTMENT_DELETED", actorName, { adjustment: item });
  return item;
}

async function getCompensationMap(employeeIds) {
  const items = await listEmployeeCompensationRepo();
  const map = new Map(
    items
      .filter((x) => employeeIds.has(String(x.employeeId)))
      .map((x) => [String(x.employeeId), x])
  );
  return map;
}

async function getAdjustmentsMap(month, year, employeeIds) {
  const items = await listPayrollAdjustmentsRepo({ month, year });
  const map = new Map();

  for (const item of items) {
    if (!employeeIds.has(String(item.employeeId))) continue;

    if (!map.has(String(item.employeeId))) {
      map.set(String(item.employeeId), []);
    }

    map.get(String(item.employeeId)).push(item);
  }

  return map;
}

export async function buildPayrollSummaryRepo({ user, month, year }) {
  const scopedEmployees = await getScopedEmployeesForUserRepo(user);
  const employeeIds = new Set(scopedEmployees.map((e) => String(e.id)));

  const records = await listAttendanceRecordsRepo();
  const { from, to } = monthDateRange(month, year);

  const monthRecords = records.filter(
    (item) =>
      employeeIds.has(String(item.employeeId)) &&
      item.date >= from &&
      item.date <= to
  );

  const compMap = await getCompensationMap(employeeIds);
  const adjMap = await getAdjustmentsMap(month, year, employeeIds);

  const rows = [];

  for (const employee of scopedEmployees) {
    const expectedDailyHours = await getExpectedWorkHoursForEmployeeRepo(employee);
    const employeeRecords = monthRecords.filter(
      (item) => String(item.employeeId) === String(employee.id)
    );

    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let issueDays = 0;
    let totalWorkedHours = 0;
    let regularHours = 0;
    let overtimeHours = 0;

    for (const record of employeeRecords) {
      const hrs = Number(record.hours || 0);

      if (record.status === "Present") {
        presentDays += 1;
        totalWorkedHours += hrs;
        regularHours += Math.min(hrs, expectedDailyHours);
        overtimeHours += Math.max(0, hrs - expectedDailyHours);
      } else if (record.status === "Absent") {
        absentDays += 1;
      } else if (record.status === "Single Punch") {
        issueDays += 1;
      } else if (LEAVE_STATUSES.has(record.status)) {
        leaveDays += 1;
      } else {
        issueDays += 1;
      }
    }

    const payableBaseHours = regularHours + leaveDays * expectedDailyHours;

    const compensation = compMap.get(String(employee.id)) || {
      baseSalary: 0,
      hourlyRate: 0,
      overtimeMultiplier: 1.5,
      housingAllowance: 0,
      transportAllowance: 0,
      otherAllowances: 0,
    };

    const derivedHourlyRate =
      Number(compensation.hourlyRate || 0) > 0
        ? Number(compensation.hourlyRate)
        : Number(
            (
              Number(compensation.baseSalary || 0) /
              Math.max(expectedDailyHours * 30, 1)
            ).toFixed(4)
          );

    const overtimeRate = Number(
      (derivedHourlyRate * Number(compensation.overtimeMultiplier || 1.5)).toFixed(4)
    );

    const basePay = Number((payableBaseHours * derivedHourlyRate).toFixed(2));
    const overtimePay = Number((overtimeHours * overtimeRate).toFixed(2));
    const fixedAllowances = Number(
      (
        Number(compensation.housingAllowance || 0) +
        Number(compensation.transportAllowance || 0) +
        Number(compensation.otherAllowances || 0)
      ).toFixed(2)
    );

    const adjustments = adjMap.get(String(employee.id)) || [];
    const allowanceAdjustments = adjustments
      .filter((x) => x.type === "allowance")
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

    const deductionAdjustments = adjustments
      .filter((x) => x.type === "deduction")
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

    const advanceAdjustments = adjustments
      .filter((x) => x.type === "advance")
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);

    const absenceDeduction = Number(
      (absentDays * expectedDailyHours * derivedHourlyRate).toFixed(2)
    );

    const grossAmount = Number(
      (basePay + overtimePay + fixedAllowances + allowanceAdjustments).toFixed(2)
    );

    const deductionsAmount = Number(
      (absenceDeduction + deductionAdjustments + advanceAdjustments).toFixed(2)
    );

    const netAmount = Number((grossAmount - deductionsAmount).toFixed(2));

    rows.push({
      employeeId: employee.id,
      employeeName: employee.name,
      gasId: employee.gasId,
      nationality: employee.nationality,
      projectId: employee.projectId,
      packageId: employee.packageId,
      expectedDailyHours,
      presentDays,
      absentDays,
      leaveDays,
      issueDays,
      totalWorkedHours: Number(totalWorkedHours.toFixed(2)),
      regularHours: Number(regularHours.toFixed(2)),
      overtimeHours: Number(overtimeHours.toFixed(2)),
      payableBaseHours: Number(payableBaseHours.toFixed(2)),
      baseSalary: Number(compensation.baseSalary || 0),
      hourlyRate: Number(derivedHourlyRate.toFixed(4)),
      overtimeRate: Number(overtimeRate.toFixed(4)),
      housingAllowance: Number(compensation.housingAllowance || 0),
      transportAllowance: Number(compensation.transportAllowance || 0),
      otherAllowances: Number(compensation.otherAllowances || 0),
      allowanceAdjustments: Number(allowanceAdjustments.toFixed(2)),
      deductionAdjustments: Number(deductionAdjustments.toFixed(2)),
      advanceAdjustments: Number(advanceAdjustments.toFixed(2)),
      absenceDeduction,
      basePay,
      overtimePay,
      grossAmount,
      deductionsAmount,
      netAmount,
      adjustments,
    });
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.employees += 1;
      acc.presentDays += row.presentDays;
      acc.absentDays += row.absentDays;
      acc.leaveDays += row.leaveDays;
      acc.issueDays += row.issueDays;
      acc.totalWorkedHours += row.totalWorkedHours;
      acc.regularHours += row.regularHours;
      acc.overtimeHours += row.overtimeHours;
      acc.payableBaseHours += row.payableBaseHours;
      acc.basePay += row.basePay;
      acc.overtimePay += row.overtimePay;
      acc.grossAmount += row.grossAmount;
      acc.deductionsAmount += row.deductionsAmount;
      acc.netAmount += row.netAmount;
      return acc;
    },
    {
      employees: 0,
      presentDays: 0,
      absentDays: 0,
      leaveDays: 0,
      issueDays: 0,
      totalWorkedHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      payableBaseHours: 0,
      basePay: 0,
      overtimePay: 0,
      grossAmount: 0,
      deductionsAmount: 0,
      netAmount: 0,
    }
  );

  Object.keys(totals).forEach((key) => {
    totals[key] = Number(Number(totals[key]).toFixed(2));
  });

  return {
    month: Number(month),
    year: Number(year),
    rows,
    totals,
  };
}

export async function createPayrollRunRepo({ user, month, year, summary }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const runResult = await client.query(
      `INSERT INTO payroll_runs (
         month,
         year,
         division,
         project_id,
         package_id,
         status,
         summary,
         created_by_id,
         created_by_name
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
       RETURNING *`,
      [
        Number(month),
        Number(year),
        user?.division || null,
        user?.projectId || null,
        user?.packageId || null,
        "draft",
        JSON.stringify(summary.totals || {}),
        user?.id || null,
        user?.name || null,
      ]
    );

    const run = mapPayrollRunRow(runResult.rows[0]);

    for (const row of summary.rows || []) {
      await client.query(
        `INSERT INTO payroll_items (
           payroll_run_id,
           employee_id,
           employee_name,
           gas_id,
           nationality,
           project_id,
           package_id,
           expected_daily_hours,
           present_days,
           absent_days,
           leave_days,
           issue_days,
           regular_hours,
           overtime_hours,
           total_worked_hours,
           payable_base_hours,
           gross_amount,
           deductions_amount,
           net_amount,
           details
         )
         VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb
         )`,
        [
          run.id,
          row.employeeId,
          row.employeeName,
          row.gasId,
          row.nationality,
          row.projectId || null,
          row.packageId || null,
          row.expectedDailyHours,
          row.presentDays,
          row.absentDays,
          row.leaveDays,
          row.issueDays,
          row.regularHours,
          row.overtimeHours,
          row.totalWorkedHours,
          row.payableBaseHours,
          row.grossAmount,
          row.deductionsAmount,
          row.netAmount,
          JSON.stringify(row),
        ]
      );
    }

    await client.query("COMMIT");

    addAuditLog("PAYROLL_RUN_CREATED", user?.name || "System Owner", {
      payrollRunId: run.id,
      month,
      year,
      employees: summary.rows?.length || 0,
    });

    return run;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPayrollRunsRepo() {
  const { rows } = await query(
    `SELECT *
     FROM payroll_runs
     ORDER BY created_at DESC, id DESC`
  );

  return rows.map(mapPayrollRunRow);
}

export async function getPayrollRunDetailsRepo(runId) {
  const [runRes, itemsRes] = await Promise.all([
    query(
      `SELECT *
       FROM payroll_runs
       WHERE id = $1
       LIMIT 1`,
      [runId]
    ),
    query(
      `SELECT *
       FROM payroll_items
       WHERE payroll_run_id = $1
       ORDER BY employee_name`,
      [runId]
    ),
  ]);

  if (!runRes.rows[0]) return null;

  return {
    run: mapPayrollRunRow(runRes.rows[0]),
    items: itemsRes.rows.map(mapPayrollItemRow),
  };
}

export async function getPayrollSlipRepo(runId, employeeId) {
  const details = await getPayrollRunDetailsRepo(runId);
  if (!details) return null;

  const item = details.items.find(
    (x) => String(x.employeeId) === String(employeeId)
  );

  if (!item) return null;

  return { run: details.run, item };
}

export async function listSalaryTransferRequestsRepo(user) {
  let sql = `
    SELECT *
    FROM leave_requests
    WHERE category = 'salary_transfer'
  `;
  const params = [];

  const roleName = String(user?.roleName || "").toLowerCase();
  const isSystemOwner =
    roleName === "system owner" || String(user?.roleId) === "1";

  if (!isSystemOwner) {
    const scopedEmployees = await getScopedEmployeesForUserRepo(user);
    const employeeIds = scopedEmployees.map((e) => e.id);

    if (!employeeIds.length) {
      return [];
    }

    params.push(employeeIds);
    sql += ` AND employee_id = ANY($1::uuid[])`;
  }

  sql += ` ORDER BY created_at DESC`;

  const { rows } = await query(sql, params);
  return rows.map(mapLeaveRequestLikeSalaryTransfer);
}

function mapLeaveRequestLikeSalaryTransfer(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeGasId: row.employee_gas_id,
    projectId: row.project_id ?? null,
    packageId: row.package_id ?? null,
    type: row.type,
    startDate: row.start_date ? String(row.start_date).slice(0, 10) : null,
    endDate: row.end_date ? String(row.end_date).slice(0, 10) : null,
    note: row.note || "",
    category: row.category || "salary_transfer",
    currentBank: row.current_bank || "",
    newBank: row.new_bank || "",
    newIban: row.new_iban || "",
    attachmentName: row.attachment_name || null,
    attachmentPath: row.attachment_path || null,
    requestedById: row.requested_by_id,
    requestedByName: row.requested_by_name || "",
    approverUserId: row.approver_user_id ?? null,
    status: row.status || "pending",
    reviewerId: row.reviewer_id ?? null,
    reviewerName: row.reviewer_name || null,
    rejectionReason: row.rejection_reason || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}