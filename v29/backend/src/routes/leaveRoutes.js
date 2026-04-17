import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();
router.use(requireAuth);

// ===== paths =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads/requests");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ===== multer =====
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, Date.now() + "-" + safe);
  },
});

const upload = multer({ storage });

// ===== helpers =====
function calcDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

// ===== ensure table =====
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID,
      employee_name TEXT,
      type TEXT,
      note TEXT,
      start_date DATE,
      end_date DATE,
      status TEXT DEFAULT 'pending',
      rejection_reason TEXT,
      reviewer_name TEXT,
      reviewed_at TIMESTAMP,
      attachment_name TEXT,
      attachment_path TEXT,
      requested_by_id UUID,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// ===== list =====
router.get("/list", async (req, res) => {
  try {
    await ensureTable();

    const result = await query(`
      SELECT *
      FROM leave_requests
      ORDER BY created_at DESC
    `);

    res.json({
      leaveRequests: result.rows,
      employees: [],
      attendanceAdjustments: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "error loading requests" });
  }
});

// ===== create =====
router.post("/leave", upload.single("attachment"), async (req, res) => {
  try {
    await ensureTable();

    const { employeeId, employeeName, type, note, startDate, endDate } =
      req.body;

    const file = req.file;

    const result = await query(
      `
      INSERT INTO leave_requests (
        employee_id,
        employee_name,
        type,
        note,
        start_date,
        end_date,
        attachment_name,
        attachment_path,
        requested_by_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `,
      [
        employeeId,
        employeeName,
        type,
        note,
        startDate || null,
        endDate || null,
        file?.originalname || null,
        file?.filename || null,
        req.user?.id,
      ]
    );

    res.json({
      message: "تم إرسال الطلب",
      request: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "error create request" });
  }
});

// ===== review (IMPORTANT FIX) =====
router.post(
  "/leave/:id/review",
  upload.single("reviewAttachment"),
  async (req, res) => {
    try {
      await ensureTable();

      const { decision, rejectionReason } = req.body;
      const file = req.file;

      const existing = await query(
        `SELECT * FROM leave_requests WHERE id = $1`,
        [req.params.id]
      );

      const request = existing.rows[0];

      if (!request) {
        return res.status(404).json({ message: "not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ message: "already reviewed" });
      }

      const isPayslip = request.type === "payslip_request";

      // 🔥 أهم شرط
      if (decision === "approved" && isPayslip && !file && !request.attachment_path) {
        return res.status(400).json({
          message: "لازم ترفع مرفق الباي سليب قبل الموافقة",
        });
      }

      let attachmentName = request.attachment_name;
      let attachmentPath = request.attachment_path;

      if (file) {
        // حذف القديم
        if (attachmentPath) {
          const old = path.resolve(uploadsDir, attachmentPath);
          if (fs.existsSync(old)) fs.unlinkSync(old);
        }

        attachmentName = file.originalname;
        attachmentPath = file.filename;
      }

      const updated = await query(
        `
        UPDATE leave_requests
        SET
          status = $2,
          rejection_reason = $3,
          reviewer_name = $4,
          reviewed_at = NOW(),
          attachment_name = $5,
          attachment_path = $6
        WHERE id = $1
        RETURNING *
      `,
        [
          req.params.id,
          decision,
          decision === "rejected" ? rejectionReason : null,
          req.user?.username,
          attachmentName,
          attachmentPath,
        ]
      );

      res.json({
        message:
          decision === "approved"
            ? "تمت الموافقة"
            : "تم الرفض",
        request: updated.rows[0],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "error review" });
    }
  }
);

export default router;
