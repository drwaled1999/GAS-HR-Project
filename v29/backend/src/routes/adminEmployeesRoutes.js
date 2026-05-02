import express from "express";
import ExcelJS from "exceljs";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.use(requireAuth);

function normalizeRole(user) {
  return String(user?.roleName || user?.role || "")
    .trim()
    .toLowerCase();
}

function canManageEmployees(user) {
  const role = normalizeRole(user);
  return ["system owner", "hr manager", "hr admin", "admin"].includes(role);
}

function requireEmployeeAdmin(req, res, next) {
  if (!canManageEmployees(req.user)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
}

router.get("/", requireEmployeeAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id,
        full_name,
        gas_id,
        nationality,
        job_title,
        project_name,
        package_name,
        phone,
        email,
        id_number,
        join_date,
        address,
        sabul_short_address,
        education,
        emergency_contact,
        status,
        updated_at
      FROM employees
      ORDER BY full_name ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("GET ADMIN EMPLOYEES ERROR:", err);
    res.status(500).json({ message: "Failed to load employees" });
  }
});

router.get("/export", requireEmployeeAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        full_name,
        gas_id,
        nationality,
        job_title,
        project_name,
        package_name,
        phone,
        email,
        id_number,
        join_date,
        address,
        sabul_short_address,
        education,
        emergency_contact,
        status,
        updated_at
      FROM employees
      ORDER BY full_name ASC
    `);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "HR Portal";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Employee Master Data");

    sheet.columns = [
      { header: "Employee Name", key: "full_name", width: 30 },
      { header: "GAS ID", key: "gas_id", width: 14 },
      { header: "Nationality", key: "nationality", width: 18 },
      { header: "Job Title", key: "job_title", width: 24 },
      { header: "Project", key: "project_name", width: 20 },
      { header: "Package", key: "package_name", width: 18 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Email", key: "email", width: 30 },
      { header: "ID / Iqama", key: "id_number", width: 20 },
      { header: "Join Date", key: "join_date", width: 16 },
      { header: "Address", key: "address", width: 35 },
      { header: "Sabul Short Address", key: "sabul_short_address", width: 24 },
      { header: "Education", key: "education", width: 24 },
      { header: "Emergency Contact", key: "emergency_contact", width: 22 },
      { header: "Status", key: "status", width: 14 },
      { header: "Last Updated", key: "updated_at", width: 22 },
    ];

    result.rows.forEach((emp) => {
      sheet.addRow({
        full_name: emp.full_name || "",
        gas_id: emp.gas_id || "",
        nationality: emp.nationality || "",
        job_title: emp.job_title || "",
        project_name: emp.project_name || "",
        package_name: emp.package_name || "",
        phone: emp.phone || "",
        email: emp.email || "",
        id_number: emp.id_number || "",
        join_date: emp.join_date
          ? new Date(emp.join_date).toISOString().slice(0, 10)
          : "",
        address: emp.address || "",
        sabul_short_address: emp.sabul_short_address || "",
        education: emp.education || "",
        emergency_contact: emp.emergency_contact || "",
        status: emp.status || "",
        updated_at: emp.updated_at
          ? new Date(emp.updated_at).toISOString().slice(0, 19).replace("T", " ")
          : "",
      });
    });

    const headerRow = sheet.getRow(1);
    headerRow.height = 24;
    headerRow.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    headerRow.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    sheet.views = [{ state: "frozen", ySplit: 1 }];

    sheet.autoFilter = {
      from: "A1",
      to: "P1",
    };

    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };

        cell.alignment = {
          vertical: "middle",
          horizontal: rowNumber === 1 ? "center" : "left",
          wrapText: true,
        };
      });
    });

    sheet.getColumn("B").alignment = { horizontal: "center" };
    sheet.getColumn("J").alignment = { horizontal: "center" };
    sheet.getColumn("O").alignment = { horizontal: "center" };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=employee-master-data.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("EXPORT EMPLOYEES ERROR:", err);
    res.status(500).json({ message: "Failed to export employees" });
  }
});

router.put("/:id", requireEmployeeAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      phone,
      email,
      id_number,
      join_date,
      address,
      sabul_short_address,
      education,
      emergency_contact,
      status,
    } = req.body;

    const result = await query(
      `
      UPDATE employees
      SET
        phone = $1,
        email = $2,
        id_number = $3,
        join_date = $4,
        address = $5,
        sabul_short_address = $6,
        education = $7,
        emergency_contact = $8,
        status = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
      `,
      [
        phone || null,
        email || null,
        id_number || null,
        join_date || null,
        address || null,
        sabul_short_address || null,
        education || null,
        emergency_contact || null,
        status || "Active",
        id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE EMPLOYEE ERROR:", err);
    res.status(500).json({ message: "Failed to update employee" });
  }
});

export default router;
