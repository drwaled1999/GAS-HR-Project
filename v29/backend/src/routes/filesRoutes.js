import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Readable } from "stream";
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

function getMimeType(filename = "") {
  const ext = path.extname(String(filename)).toLowerCase();

  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".csv") return "text/csv; charset=utf-8";
  if (ext === ".xls") return "application/vnd.ms-excel";
  if (ext === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  return "application/octet-stream";
}

function canAccessRequestAttachment(user, item) {
  const currentUserId = String(user?.id || "").trim();
  const currentEmployeeId = String(
    user?.employeeId || user?.employee_id || ""
  ).trim();
  const currentGasId = String(
    user?.gasId || user?.gas_id || ""
  ).trim();

  const requestEmployeeId = String(item?.employee_id || "").trim();
  const requestUserId = String(item?.requested_by_id || "").trim();
  const requestGasId = String(item?.employee_gas_id || "").trim();

  const isOwner =
    (requestUserId && requestUserId === currentUserId) ||
    (requestEmployeeId && requestEmployeeId === currentEmployeeId) ||
    (requestGasId && currentGasId && requestGasId === currentGasId);

  return isOwner || canSeeAllRequests(user);
}

function isRemoteUrl(value = "") {
  const text = String(value || "").trim().toLowerCase();
  return text.startsWith("http://") || text.startsWith("https://");
}

function buildDownloadHeaders(res, downloadName, mimeType, contentLength, forceDownload) {
  const dispositionType = forceDownload ? "attachment" : "inline";

  res.setHeader("Content-Type", mimeType || "application/octet-stream");

  if (contentLength) {
    res.setHeader("Content-Length", contentLength);
  }

  res.setHeader(
    "Content-Disposition",
    `${dispositionType}; filename="${encodeURIComponent(
      downloadName
    )}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
  );

  res.setHeader("Cache-Control", "private, max-age=60");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

async function sendRemoteFile(res, filePathValue, fileNameValue, downloadQueryValue) {
  const forceDownload = String(downloadQueryValue || "").trim() === "1";

  let upstream;
  try {
    upstream = await fetch(filePathValue);
  } catch (error) {
    console.error("Remote attachment fetch error:", error);
    return res.status(502).json({ message: "تعذر الوصول إلى الملف الخارجي" });
  }

  if (!upstream.ok || !upstream.body) {
    return res.status(404).json({ message: "الملف غير موجود على الخادم" });
  }

  let derivedName = "file";
  try {
    const pathname = new URL(filePathValue).pathname;
    const basename = path.basename(pathname);
    if (basename) derivedName = basename;
  } catch {
    // ignore
  }

  const downloadName = fileNameValue || derivedName;
  const mimeType =
    upstream.headers.get("content-type") || getMimeType(downloadName);
  const contentLength = upstream.headers.get("content-length");

  buildDownloadHeaders(
    res,
    downloadName,
    mimeType,
    contentLength,
    forceDownload
  );

  const stream = Readable.fromWeb(upstream.body);

  stream.on("error", (err) => {
    console.error("Remote attachment stream error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to stream remote attachment" });
    } else {
      res.end();
    }
  });

  return stream.pipe(res);
}

async function sendLocalFile(res, filePathValue, fileNameValue, downloadQueryValue) {
  const storedFilename = path.basename(String(filePathValue || ""));
  const absPath = path.resolve(uploadsDir, storedFilename);

  if (!absPath.startsWith(uploadsDir)) {
    return res.status(400).json({ message: "مسار الملف غير صالح" });
  }

  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ message: "الملف غير موجود على الخادم" });
  }

  const downloadName = fileNameValue || storedFilename;
  const mimeType = getMimeType(downloadName);
  const stat = fs.statSync(absPath);
  const forceDownload = String(downloadQueryValue || "").trim() === "1";

  buildDownloadHeaders(
    res,
    downloadName,
    mimeType,
    stat.size,
    forceDownload
  );

  const stream = fs.createReadStream(absPath);

  stream.on("error", (err) => {
    console.error("Attachment stream error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to stream attachment" });
    } else {
      res.end();
    }
  });

  return stream.pipe(res);
}

async function sendStoredFile(res, filePathValue, fileNameValue, downloadQueryValue) {
  if (isRemoteUrl(filePathValue)) {
    return sendRemoteFile(res, filePathValue, fileNameValue, downloadQueryValue);
  }

  return sendLocalFile(res, filePathValue, fileNameValue, downloadQueryValue);
}

router.get("/request/:id", async (req, res) => {
  try {
    const result = await query(
      `
      SELECT
        lr.id,
        lr.employee_id,
        lr.employee_gas_id,
        lr.requested_by_id,
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

    if (!canAccessRequestAttachment(req.user, item)) {
      return res.status(403).json({
        message: "ليس لديك صلاحية فتح هذا المرفق",
      });
    }

    return await sendStoredFile(
      res,
      item.attachment_path,
      item.attachment_name,
      req.query.download
    );
  } catch (error) {
    console.error("Request attachment error:", error);
    return res.status(500).json({ message: "Failed to load attachment" });
  }
});

router.get("/request/:id/review", async (req, res) => {
  try {
    const result = await query(
      `
      SELECT
        lr.id,
        lr.employee_id,
        lr.employee_gas_id,
        lr.requested_by_id,
        lr.review_attachment_name,
        lr.review_attachment_path
      FROM leave_requests lr
      WHERE lr.id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    const item = result.rows[0];

    if (!item || !item.review_attachment_path) {
      return res.status(404).json({ message: "مرفق المراجع غير موجود" });
    }

    if (!canAccessRequestAttachment(req.user, item)) {
      return res.status(403).json({
        message: "ليس لديك صلاحية فتح هذا المرفق",
      });
    }

    return await sendStoredFile(
      res,
      item.review_attachment_path,
      item.review_attachment_name,
      req.query.download
    );
  } catch (error) {
    console.error("Review attachment error:", error);
    return res.status(500).json({ message: "Failed to load review attachment" });
  }
});

export default router;
