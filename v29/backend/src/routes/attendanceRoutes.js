router.get("/sheet", async (req, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const batchId = Number(req.query.batchId || 0);

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required." });
    }

    const daysInMonth = new Date(year, month, 0).getDate();

    let rowsRes;

    if (batchId) {
      rowsRes = await query(
        `
        SELECT
          ir.id,
          ir.employee_id,
          ir.employee_name,
          ir.gas_id,
          ir.work_date,
          ir.regular_value,
          ir.regular_hours,
          ir.derived_status,
          e.nationality,
          e.job_title,
          e.gas_id AS employee_gas_id
        FROM attendance_import_rows ir
        LEFT JOIN employees e ON e.id = ir.employee_id
        WHERE ir.batch_id = $1
        `,
        [batchId]
      );
    } else {
      rowsRes = await query(
        `
        SELECT
          a.id,
          a.employee_id,
          e.full_name AS employee_name,
          e.gas_id,
          a.work_date,
          a.status AS regular_value,
          a.hours AS regular_hours,
          a.status AS derived_status,
          e.nationality,
          e.job_title,
          e.gas_id AS employee_gas_id
        FROM attendance_records a
        LEFT JOIN employees e ON e.id = a.employee_id
        WHERE EXTRACT(MONTH FROM a.work_date) = $1
          AND EXTRACT(YEAR FROM a.work_date) = $2
        `,
        [month, year]
      );
    }

    const grouped = new Map();

    for (const row of rowsRes.rows) {
      const employeeKey = `${row.employee_id || row.gas_id || row.employee_name}`;

      if (!grouped.has(employeeKey)) {
        grouped.set(employeeKey, {
          sno: grouped.size + 1,
          name: row.employee_name || "",
          tradeCategory: row.job_title || "",
          id: row.employee_id || "",
          gasId: row.gas_id || row.employee_gas_id || "",
          nationality: row.nationality || "",
          totalRegularHours: 0,
          days: {},
        });
      }

      const item = grouped.get(employeeKey);
      const dateObj = new Date(row.work_date);
      const dayNumber = dateObj.getDate();
      const hours = Number(row.regular_hours || 0);

      item.totalRegularHours += hours;

      item.days[dayNumber] = {
        value:
          row.derived_status === "SP"
            ? "SP"
            : row.derived_status === "P"
            ? "P"
            : "A",
        regularHours: hours,
        color:
          row.derived_status === "SP"
            ? "orange"
            : row.derived_status === "P"
            ? "green"
            : "red",
      };
    }

    const employees = Array.from(grouped.values()).map((employee) => {
      const filledDays = {};

      for (let d = 1; d <= daysInMonth; d += 1) {
        filledDays[d] = employee.days[d] || {
          value: "A",
          regularHours: 0,
          color: "red",
        };
      }

      return {
        ...employee,
        totalRegularHours: Number(employee.totalRegularHours.toFixed(2)),
        days: filledDays,
      };
    });

    return res.json({
      month,
      year,
      daysInMonth,
      employees,
    });
  } catch (error) {
    console.error("Attendance sheet error:", error);
    return res.status(500).json({ message: "Failed to load attendance sheet." });
  }
});