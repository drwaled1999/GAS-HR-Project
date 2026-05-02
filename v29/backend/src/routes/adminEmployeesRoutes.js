import express from "express";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import multer from "multer";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";
import { createNotificationRepo } from "../data/leaveNotificationRepository.js";

const router = express.Router();
router.use(requireAuth);

// ================== CONFIG ==================
const uploadDir = path.resolve("uploads/employee-docs");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname;
    cb(null, unique);
  },
});

const upload = multer({ storage });

// ================== AUTH ==================
function normalizeRole(user) {
  return String(user?.roleName || user?.role || "").trim().toLowerCase();
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

// ================== GET EMPLOYEES ==================
router.get("/", requireEmployeeAdmin, async (req, res) => {
  const result = await query(`SELECT * FROM employees ORDER BY full_name`);
  res.json(result.rows);
});

// ================== EXPORT EXCEL ==================
router.get("/export", requireEmployeeAdmin, async (req, res) => {
  const result = await query(`SELECT * FROM employees ORDER BY full_name`);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Employees");

  sheet.columns = [
    { header: "Name", key: "full_name", width: 25 },
    { header: "GAS ID", key: "gas_id", width: 12 },
    { header: "Project", key: "project_name", width: 18 },
    { header: "Job", key: "job_title", width: 20 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Email", key: "email", width: 25 },
    { header: "Status", key: "status", width: 12 },
  ];

  result.rows.forEach((r) => sheet.addRow(r));

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=employees.xlsx"
  );

  await workbook.xlsx.write(res);
  res.end();
});

// ================== UPDATE ==================
router.put("/:id", requireEmployeeAdmin, async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const result = await query(
    `UPDATE employees SET phone=$1,email=$2,address=$3 WHERE id=$4 RETURNING *`,
    [data.phone, data.email, data.address, id]
  );

  res.json(result.rows[0]);
});

// ================== 📎 UPLOAD DOCUMENT ==================
router.post(
  "/:id/documents",
  requireEmployeeAdmin,
  upload.single("file"),
  async (req, res) => {
    const { id } = req.params;
    const { document_type } = req.body;

    const file = req.file;

    const result = await query(
      `
      INSERT INTO employee_documents
      (employee_id, document_type, file_name, file_path)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [id, document_type, file.originalname, file.filename]
    );

    res.json(result.rows[0]);
  }
);

// ================== 📂 GET DOCUMENTS ==================
router.get("/:id/documents", requireEmployeeAdmin, async (req, res) => {
  const result = await query(
    `SELECT * FROM employee_documents WHERE employee_id=$1`,
    [req.params.id]
  );

  res.json(result.rows);
});

// ================== 👁️ VIEW FILE ==================
router.get("/documents/:docId/view", requireEmployeeAdmin, async (req, res) => {
  const result = await query(
    `SELECT * FROM employee_documents WHERE id=$1`,
    [req.params.docId]
  );

  const doc = result.rows[0];

  if (!doc) return res.status(404).send("File not found");

  const filePath = path.join(uploadDir, doc.file_path);

  res.sendFile(filePath);
});

// ================== 🔔 REQUEST UPDATE ==================
router.post("/:id/request-update", requireEmployeeAdmin, async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  const emp = await query(`SELECT * FROM employees WHERE id=$1`, [id]);

  if (!emp.rows.length) return res.status(404).send("Employee not found");

  await createNotificationRepo(
    emp.rows[0].id,
    message || "Please update your information",
    "update_request",
    "/profile",
    {}
  );

  res.json({ success: true });
});

export default router;
