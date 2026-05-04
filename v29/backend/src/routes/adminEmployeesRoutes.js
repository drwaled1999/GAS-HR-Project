import express from "express";
import ExcelJS from "exceljs";
import path from "path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";
import { createNotificationRepo } from "../data/leaveNotificationRepository.js";

const router = express.Router();

router.use(requireAuth);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage() });

function normalizeRole(user) {
  return String(user?.roleName || user?.role || user?.roleCode || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function canManageEmployees(user) {
  const role = normalizeRole(user);
  return ["system_owner", "owner", "hr_manager", "hr_admin", "hr", "admin"].includes(role);
}

function requireEmployeeAdmin(req, res, next) {
  if (!canManageEmployees(req.user)) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
}

function isRemoteUrl(value = "") {
  const text = String(value || "").trim().toLowerCase();
  return text.startsWith("http://") || text.startsWith("https://");
}

function getMimeType(filename = "") {
  const ext = path.extname(String(filename)).toLowerCase();

  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".csv") return "text/csv; charset=utf-8";
  if (ext === ".xls") return "application/vnd.ms-excel";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return "application/octet-stream";
}

async function uploadToCloudinary(file) {
  return await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "hr-employee-docs",
          resource_type: "auto",
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      )
      .end(file.buffer);
  });
}

router.get("/", requireEmployeeAdmin, async (_req, res) => {
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

router.get("/export", requireEmployeeAdmin, async (_req, res) => {
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
        join_date: emp.join_date ? new Date(emp.join_date).toISOString().slice(0, 10) : "",
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
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "P1" };

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
      RETURNING
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

router.post(
  "/:id/documents",
  requireEmployeeAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { document_type, expiry_date, verified } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "File is required" });
      }

      const employee = await query(`SELECT id FROM employees WHERE id = $1 LIMIT 1`, [id]);

      if (!employee.rows.length) {
        return res.status(404).json({ message: "Employee not found" });
      }

      const uploadResult = await uploadToCloudinary(req.file);

      const result = await query(
        `
        INSERT INTO employee_documents
          (employee_id, document_type, file_name, file_path, expiry_date, verified, uploaded_by, uploaded_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING
          id,
          employee_id,
          document_type,
          file_name,
          file_path,
          expiry_date,
          verified,
          uploaded_by,
          uploaded_at
        `,
        [
          id,
          document_type || "other",
          req.file.originalname,
          uploadResult.secure_url,
          expiry_date || null,
          String(verified || "").toLowerCase() === "true",
          req.user?.username || req.user?.name || req.user?.id || "system",
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error("UPLOAD EMPLOYEE DOCUMENT ERROR:", err);
      res.status(500).json({ message: "Failed to upload document" });
    }
  }
);

router.get("/:id/documents", requireEmployeeAdmin, async (req, res) => {
  try {
    const result = await query(
      `
      SELECT
        id,
        employee_id,
        document_type,
        file_name,
        file_path,
        expiry_date,
        verified,
        uploaded_by,
        uploaded_at
      FROM employee_documents
      WHERE employee_id = $1
      ORDER BY uploaded_at DESC
      `,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET EMPLOYEE DOCUMENTS ERROR:", err);
    res.status(500).json({ message: "Failed to load documents" });
  }
});

router.get("/documents/:docId/view", requireEmployeeAdmin, async (req, res) => {
  try {
    const result = await query(
      `
      SELECT
        id,
        file_name,
        file_path
      FROM employee_documents
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.docId]
    );

    const doc = result.rows[0];

    if (!doc) {
      return res.status(404).json({ message: "File not found" });
    }

    if (isRemoteUrl(doc.file_path)) {
      return res.redirect(doc.file_path);
    }

    return res.status(404).json({
      message: "This document was stored locally and is not available after deployment. Please re-upload it.",
    });
  } catch (err) {
    console.error("VIEW EMPLOYEE DOCUMENT ERROR:", err);
    res.status(500).json({ message: "Failed to load document" });
  }
});

router.post("/:id/request-update", requireEmployeeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const emp = await query(
      `
      SELECT
        e.id,
        e.full_name,
        e.gas_id,
        u.id AS user_id
      FROM employees e
      LEFT JOIN users u
        ON u.employee_id = e.id
        OR u.gas_id = e.gas_id
      WHERE e.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!emp.rows.length) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const row = emp.rows[0];
    const targetUserId = row.user_id || row.id;

    await createNotificationRepo(
      targetUserId,
      message || "Please update your employee profile information.",
      "employee_profile_update_request",
      "/profile",
      {
        employeeId: row.id,
        gasId: row.gas_id,
        requestedBy: req.user?.username || req.user?.name || req.user?.id || "HR",
      }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("REQUEST EMPLOYEE UPDATE ERROR:", err);
    res.status(500).json({ message: "Failed to send update request" });
  }
});

export default router;
