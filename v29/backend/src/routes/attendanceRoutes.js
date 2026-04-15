router.get('/monthly', async (req, res) => {
  try {
    const username = req.query.username || req.user?.username || 'owner';
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    const userResult = await query(
      `
      SELECT id, username
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    const currentUser = userResult.rows[0];

    if (!currentUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const employeeResult = await query(
      `
      SELECT id, gas_id, full_name
      FROM employees
      WHERE gas_id = $1 OR user_id = $2
      LIMIT 1
      `,
      [username, currentUser.id]
    );

    const employee = employeeResult.rows[0];

    if (!employee) {
      return res.json({
        month,
        year,
        records: []
      });
    }

    const recordsResult = await query(
      `
      SELECT
        id,
        work_date,
        status,
        COALESCE(hours, 0) AS hours
      FROM attendance_records
      WHERE employee_code = $1
        AND EXTRACT(MONTH FROM work_date) = $2
        AND EXTRACT(YEAR FROM work_date) = $3
      ORDER BY work_date ASC
      `,
      [employee.gas_id, month, year]
    );

    return res.json({
      month,
      year,
      records: recordsResult.rows || []
    });
  } catch (error) {
    console.error('Monthly attendance error:', error);
    return res.status(500).json({ message: 'Failed to load monthly attendance' });
  }
});
export default router;
