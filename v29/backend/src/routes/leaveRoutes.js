import express from "express";
import multer from "multer";
import path from "path";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";
import cloudinary from "../utils/cloudinary.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

/* =========================
   Helpers
========================= */

function sanitizePublicIdPart(name) {
  return String(name || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100) || "file";
}

function resolveCloudinaryResourceType(file) {
  const mime = String(file?.mimetype || "").toLowerCase();
  const ext = path.extname(String(file?.originalname || "")).toLowerCase();

  const rawExtensions = new Set([
    ".pdf", ".txt", ".csv", ".xls", ".xlsx",
    ".doc", ".docx", ".ppt", ".pptx",
    ".zip", ".rar"
  ]);

  const imageExtensions = new Set([
    ".jpg", ".jpeg", ".png", ".webp",
    ".gif", ".bmp", ".svg"
  ]);

  if (mime.startsWith("image/") || imageExtensions.has(ext)) {
    return "image";
  }

  return "raw"; // 🔥 كل الباقي (PDF وغيره)
}

async function uploadToCloudinary(file, folder) {
  if (!file?.buffer) return null;

  const originalName = file.originalname || "file";
  const publicId = `${Date.now()}-${sanitizePublicIdPart(originalName)}`;
  const resourceType = resolveCloudinaryResourceType(file);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType, // 🔥 أهم سطر
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

/* =========================
   Approve Request
========================= */

router.post(
  "/:id/review",
  upload.single("reviewAttachment"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { note } = req.body;

      let uploadedFile = null;

      if (req.file) {
        uploadedFile = await uploadToCloudinary(
          req.file,
          "hr-requests/review-attachments"
        );
      }

      const result = await query(
        `
        UPDATE leave_requests
        SET
          status = 'approved',
          reviewer_note = $1,
          review_attachment_name = $2,
          review_attachment_path = $3,
          reviewed_by = $4,
          reviewed_at = NOW()
        WHERE id = $5
        RETURNING *
        `,
        [
          note || null,
          req.file?.originalname || null,
          uploadedFile?.secure_url || null,
          req.user.username,
          id,
        ]
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Review leave error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
