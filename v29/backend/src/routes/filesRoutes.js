import { Router } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../uploads/requests");

router.use(requireAuth);

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function canSeeAllRequests(user) {
  const role = normalizeRole(user?.roleName || user?.role || user?.roleCode);
  return [
    "system owner",
    "owner",
    "system_owner",
    "hr manager",
    "hr_manager",
    "hr",
    "cm",
    "project manager",
    "project_manager",
  ].includes(role);
}

router.get("/request/:id", async (req, res) => {
  try {
    const result = await query(
      `
      SELECT
        lr.id,
        lr.employee_id,
        lr.requested_by,
        lr.attachment_name,
        lr.attachment_path
      FROM leave_requests lr
      WHERE lr.id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    const item = result.rows[0];

    if (!item || !item.attachment_path) {
      return res.status(404).json({ message: "المرفق غير موجود" });
    }

    const username = String(req.user?.username || "");
    const userEmployeeId = String(req.user?.employeeId || req.user?.id || "");

    const isOwner =
      String(item.requested_by || "") === username ||
      String(item.employee_id || "") === userEmployeeId;

    if (!isOwner && !canSeeAllRequests(req.user)) {
      return res.status(403).json({ message: "ليس لديك صلاحية فتح هذا المرفق" });
    }

    const filename = path.basename(item.attachment_path);
    const abs = path.resolve(uploadsDir, filename);

    return res.sendFile(abs);
  } catch (error) {
    console.error("Request attachment error:", error);
    return res.status(500).json({ message: "Failed to load attachment" });
  }
});

export default router;
