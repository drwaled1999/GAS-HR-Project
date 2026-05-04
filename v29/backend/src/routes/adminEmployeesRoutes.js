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

// ================= UPLOAD DOCUMENT =================
router.post(
  "/:id/documents",
  requireEmployeeAdmin,
  upload.single("file"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "File is required" });
      }

      const uploadResult = await uploadToCloudinary(req.file);

      res.json({
        success: true,
        url: uploadResult.secure_url,
      });
    } catch (err) {
      console.error("UPLOAD EMPLOYEE DOCUMENT ERROR:", err);
      res.status(500).json({ message: "Failed to upload document" });
    }
  }
);

export default router;
