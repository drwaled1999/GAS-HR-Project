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

// ================= CLOUDINARY =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET,
});

const upload = multer({ storage: multer.memoryStorage() });

// ================= HELPERS =================
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

// ================= GET EMPLOYEES =================
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

// ================= EXPORT EXCEL =================
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
    res.setHeader("Content-Disposition", "attachment; filename=employee-master-data.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("EXPORT EMPLOYEES ERROR:", err);
    res.status(500).json({ message: "Failed to export employees" });
  }
});

// ================= UPDATE EMPLOYEE =================
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

// ================= UPLOAD DOCUMENT =================
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

// ================= GET DOCUMENTS =================
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

// ================= VIEW DOCUMENT =================
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
      message:
        "This document was stored locally and is not available after deployment. Please re-upload it.",
    });
  } catch (err) {
    console.error("VIEW EMPLOYEE DOCUMENT ERROR:", err);
    res.status(500).json({ message: "Failed to load document" });
  }
});

// ================= DELETE DOCUMENT =================
router.delete("/documents/:docId", requireEmployeeAdmin, async (req, res) => {
  try {
    const { docId } = req.params;

    const deleted = await query(
      `
      DELETE FROM employee_documents
      WHERE id = $1
      RETURNING id
      `,
      [docId]
    );

    if (!deleted.rows.length) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE EMPLOYEE DOCUMENT ERROR:", err);
    res.status(500).json({ message: "Failed to delete document" });
  }
});

// ================= UPDATE DOCUMENT TYPE =================
router.put("/documents/:docId", requireEmployeeAdmin, async (req, res) => {
  try {
    const { docId } = req.params;
    const { document_type, expiry_date, verified } = req.body;

    const result = await query(
      `
      UPDATE employee_documents
      SET
        document_type = COALESCE($1, document_type),
        expiry_date = COALESCE($2, expiry_date),
        verified = COALESCE($3, verified)
      WHERE id = $4
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
        document_type || null,
        expiry_date || null,
        typeof verified === "boolean" ? verified : null,
        docId,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("UPDATE EMPLOYEE DOCUMENT ERROR:", err);
    res.status(500).json({ message: "Failed to update document" });
  }
});

// ================= NORMAL NOTIFICATION ONLY =================
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

// ================= SMART DATA UPDATE REQUEST =================
router.post("/:id/data-update-request", requireEmployeeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { requested_fields, message } = req.body;

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
    const fieldsArray = Array.isArray(requested_fields) ? requested_fields : [];

    const created = await query(
      `
      INSERT INTO employee_data_update_requests
        (employee_id, requested_by, requested_fields, status, created_at)
      VALUES
        ($1, $2, $3::jsonb, 'pending_employee', NOW())
      RETURNING *
      `,
      [
        row.id,
        req.user?.username || req.user?.name || req.user?.id || "HR",
        JSON.stringify(fieldsArray),
      ]
    );

    await createNotificationRepo(
      targetUserId,
      message || "Please complete your missing employee profile information.",
      "employee_data_update_request",
      "/data-update",
      {
        requestId: created.rows[0].id,
        employeeId: row.id,
        gasId: row.gas_id,
        requestedFields: fieldsArray,
      }
    );

    res.json({
      success: true,
      item: created.rows[0],
    });
  } catch (err) {
    console.error("CREATE DATA UPDATE REQUEST ERROR:", err);
    res.status(500).json({ message: "Failed to create update request" });
  }
});

// ================= LIST DATA UPDATE REQUESTS ADMIN =================
router.get("/data-update-requests/list", requireEmployeeAdmin, async (_req, res) => {
  try {
    const result = await query(
      `
      SELECT
        r.*,
        e.full_name,
        e.gas_id,
        e.project_name,
        e.job_title
      FROM employee_data_update_requests r
      JOIN employees e ON e.id = r.employee_id
      ORDER BY r.created_at DESC
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error("LIST DATA UPDATE REQUESTS ERROR:", err);
    res.status(500).json({ message: "Failed to load update requests" });
  }
});

// ================= APPROVE SUBMITTED DATA =================
router.post("/data-update-requests/:requestId/approve", requireEmployeeAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { hr_note } = req.body;

    const requestResult = await query(
      `
      SELECT *
      FROM employee_data_update_requests
      WHERE id = $1
      LIMIT 1
      `,
      [requestId]
    );

    const item = requestResult.rows[0];

    if (!item) {
      return res.status(404).json({ message: "Update request not found" });
    }

    if (item.status !== "submitted") {
      return res.status(400).json({ message: "Request is not submitted yet" });
    }

    const data = item.submitted_data || {};

    await query(
      `
      UPDATE employees
      SET
        phone = COALESCE($1, phone),
        email = COALESCE($2, email),
        id_number = COALESCE($3, id_number),
        address = COALESCE($4, address),
        sabul_short_address = COALESCE($5, sabul_short_address),
        education = COALESCE($6, education),
        emergency_contact = COALESCE($7, emergency_contact),
        updated_at = NOW()
      WHERE id = $8
      `,
      [
        data.phone || null,
        data.email || null,
        data.id_number || null,
        data.address || null,
        data.sabul_short_address || null,
        data.education || null,
        data.emergency_contact || null,
        item.employee_id,
      ]
    );

    const updated = await query(
      `
      UPDATE employee_data_update_requests
      SET
        status = 'approved',
        hr_note = $1,
        reviewed_by = $2,
        reviewed_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [
        hr_note || null,
        req.user?.username || req.user?.name || req.user?.id || "HR",
        requestId,
      ]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    console.error("APPROVE DATA UPDATE REQUEST ERROR:", err);
    res.status(500).json({ message: "Failed to approve update request" });
  }
});

// ================= REJECT / NEEDS CORRECTION =================
router.post("/data-update-requests/:requestId/review", requireEmployeeAdmin, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, hr_note } = req.body;

    const allowed = ["rejected", "needs_correction"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updated = await query(
      `
      UPDATE employee_data_update_requests
      SET
        status = $1,
        hr_note = $2,
        reviewed_by = $3,
        reviewed_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [
        status,
        hr_note || null,
        req.user?.username || req.user?.name || req.user?.id || "HR",
        requestId,
      ]
    );

    if (!updated.rows.length) {
      return res.status(404).json({ message: "Update request not found" });
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error("REVIEW DATA UPDATE REQUEST ERROR:", err);
    res.status(500).json({ message: "Failed to review update request" });
  }
});

export default router;
