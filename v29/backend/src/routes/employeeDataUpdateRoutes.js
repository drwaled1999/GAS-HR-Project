import express from "express";
import path from "path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.use(requireAuth);

// ================= CLOUDINARY =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET,
});

// ================= CONFIG =================
const ALLOWED_FIELDS = [
  "phone",
  "email",
  "id_number",
  "address",
  "sabul_short_address",
  "education",
  "emergency_contact",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      String(file.originalname || "").toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return cb(new Error("Only PDF files are allowed"));
    }

    cb(null, true);
  },
});

// ================= HELPERS =================
function safeFileName(filename = "document.pdf") {
  const base = path.basename(String(filename || "document.pdf"));
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeRequestedFields(value) {
  const parsed = parseJson(value, []);

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => String(item || "").trim())
    .filter((item) => ALLOWED_FIELDS.includes(item));
}

function filterSubmittedData(submittedData, requestedFields) {
  const clean = {};
  const data = parseJson(submittedData, {});

  requestedFields.forEach((field) => {
    if (!ALLOWED_FIELDS.includes(field)) return;

    const value = data?.[field];

    if (value !== undefined && value !== null) {
      clean[field] = String(value).trim();
    }
  });

  return clean;
}

async function uploadToCloudinary(file, requestId) {
  return await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: `hr-employee-data-update/${requestId}`,
          resource_type: "auto",
          type: "upload",
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) {
            console.error("EMPLOYEE DATA UPDATE CLOUDINARY ERROR:", error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      )
      .end(file.buffer);
  });
}

async function getMyRequest(requestId, user) {
  const result = await query(
    `
    SELECT
      r.*,
      e.full_name,
      e.gas_id
    FROM employee_data_update_requests r
    JOIN employees e ON e.id = r.employee_id
    WHERE r.id = $1
      AND (
        e.id = $2
        OR e.gas_id = $3
      )
    LIMIT 1
    `,
    [requestId, user.employeeId || user.id, user.gasId || null]
  );

  return result.rows[0] || null;
}

// ================= GET MY REQUESTS =================
router.get("/", async (req, res) => {
  try {
    const user = req.user;

    const result = await query(
      `
      SELECT
        r.*,
        e.full_name,
        e.gas_id
      FROM employee_data_update_requests r
      JOIN employees e ON e.id = r.employee_id
      WHERE
        e.id = $1
        OR e.gas_id = $2
      ORDER BY r.created_at DESC
      `,
      [user.employeeId || user.id, user.gasId || null]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET EMPLOYEE REQUESTS ERROR:", err);
    res.status(500).json({ message: "Failed to load requests" });
  }
});

// ================= SUBMIT DATA + CLOUDINARY ATTACHMENTS =================
router.post("/:id/submit", upload.array("attachments", 10), async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const item = await getMyRequest(id, req.user);

    if (!item) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (item.status !== "pending_employee" && item.status !== "needs_correction") {
      return res.status(400).json({
        message: "This request cannot be submitted again",
      });
    }

    const requestedFields = normalizeRequestedFields(item.requested_fields);

    if (!requestedFields.length) {
      return res.status(400).json({
        message: "No requested fields found for this request",
      });
    }

    const rawSubmittedData =
      req.body.submitted_data ||
      req.body.data ||
      req.body;

    const cleanSubmittedData = filterSubmittedData(
      rawSubmittedData,
      requestedFields
    );

    const uploadedAttachments = [];

    if (Array.isArray(req.files) && req.files.length) {
      for (const file of req.files) {
        const uploadResult = await uploadToCloudinary(file, id);

        uploadedAttachments.push({
          label: "Employee Attachment",
          file_name: safeFileName(file.originalname),
          filename: safeFileName(file.originalname),
          file_url: uploadResult.secure_url,
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          resource_type: uploadResult.resource_type || "auto",
          uploaded_at: new Date().toISOString(),
        });
      }
    }

    const finalSubmittedData = {
      ...cleanSubmittedData,
      __attachments: uploadedAttachments,
    };

    const updated = await query(
      `
      UPDATE employee_data_update_requests
      SET
        submitted_data = $1::jsonb,
        employee_note = $2,
        status = 'submitted',
        submitted_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [JSON.stringify(finalSubmittedData), note || null, id]
    );

    res.json(updated.rows[0]);
  } catch (err) {
    console.error("SUBMIT DATA UPDATE ERROR:", err);
    res.status(500).json({
      message: err?.message || "Failed to submit data",
    });
  }
});

// ================= MULTER ERROR HANDLER =================
router.use((err, _req, res, next) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  if (err.message === "Only PDF files are allowed") {
    return res.status(400).json({ message: "Only PDF files are allowed" });
  }

  return next(err);
});

export default router;
