import express from "express";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.use(requireAuth);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET,
});

function isRemoteUrl(value = "") {
  const text = String(value || "").trim().toLowerCase();
  return text.startsWith("http://") || text.startsWith("https://");
}

function safeFileName(filename = "document.pdf") {
  const base = path.basename(String(filename || "document.pdf"));
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

function getCloudinaryResourceTypeFromUrl(url = "") {
  const text = String(url || "");
  if (text.includes("/raw/upload/")) return "raw";
  if (text.includes("/image/upload/")) return "image";
  if (text.includes("/video/upload/")) return "video";
  return "raw";
}

function extractPublicIdFromCloudinaryUrl(url = "") {
  try {
    const text = String(url || "");
    const resourceType = getCloudinaryResourceTypeFromUrl(text);
    const marker = `/${resourceType}/upload/`;
    const index = text.indexOf(marker);

    if (index === -1) return null;

    let rest = text.slice(index + marker.length);
    rest = rest.replace(/^v\d+\//, "");
    rest = rest.replace(/\.[^/.]+$/, "");

    return rest;
  } catch {
    return null;
  }
}

function buildSignedCloudinaryUrl(filePath, download = false, fileName = "document.pdf") {
  if (!isRemoteUrl(filePath)) return null;

  const publicId = extractPublicIdFromCloudinaryUrl(filePath);

  if (!publicId) return filePath;

  return cloudinary.url(publicId, {
    resource_type: "raw",
    type: "upload",
    secure: true,
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 10,
    flags: download ? `attachment:${safeFileName(fileName)}` : undefined,
  });
}

async function getMyEmployee(user) {
  const result = await query(
    `
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
    WHERE
      id = $1
      OR gas_id = $2
    LIMIT 1
    `,
    [user.employeeId || user.id, user.gasId || null]
  );

  return result.rows[0] || null;
}

// ================= GET MY PROFILE =================
router.get("/me", async (req, res) => {
  try {
    const employee = await getMyEmployee(req.user);

    if (!employee) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    res.json(employee);
  } catch (err) {
    console.error("GET EMPLOYEE PROFILE ERROR:", err);
    res.status(500).json({ message: "Failed to load employee profile" });
  }
});

// ================= GET MY DOCUMENTS =================
router.get("/documents", async (req, res) => {
  try {
    const employee = await getMyEmployee(req.user);

    if (!employee) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const result = await query(
      `
      SELECT
        id,
        employee_id,
        document_type,
        file_name,
        expiry_date,
        verified,
        uploaded_by,
        uploaded_at
      FROM employee_documents
      WHERE employee_id = $1
      ORDER BY uploaded_at DESC
      `,
      [employee.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET MY DOCUMENTS ERROR:", err);
    res.status(500).json({ message: "Failed to load documents" });
  }
});

// ================= VIEW / DOWNLOAD MY DOCUMENT =================
router.get("/documents/:docId/view", async (req, res) => {
  try {
    const employee = await getMyEmployee(req.user);

    if (!employee) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const result = await query(
      `
      SELECT
        id,
        employee_id,
        file_name,
        file_path
      FROM employee_documents
      WHERE id = $1
        AND employee_id = $2
      LIMIT 1
      `,
      [req.params.docId, employee.id]
    );

    const doc = result.rows[0];

    if (!doc) {
      return res.status(404).json({ message: "File not found" });
    }

    if (!isRemoteUrl(doc.file_path)) {
      return res.status(404).json({
        message:
          "This document was stored locally and is not available after deployment. Please re-upload it.",
      });
    }

    const signedUrl = buildSignedCloudinaryUrl(
      doc.file_path,
      req.query.download === "1",
      doc.file_name
    );

    if (!signedUrl) {
      return res.status(404).json({ message: "Invalid file URL" });
    }

    return res.redirect(signedUrl);
  } catch (err) {
    console.error("VIEW MY DOCUMENT ERROR:", err);
    res.status(500).json({ message: "Failed to load document" });
  }
});

export default router;
