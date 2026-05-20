import express from "express";
import path from "path";
import https from "https";
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

// ================= HELPERS =================
function safeFileName(filename = "document.pdf") {
  const base = path.basename(String(filename || "document.pdf"));
  const cleaned = base.replace(/[^\w.\-() ]+/g, "_");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}

function isRemoteUrl(value = "") {
  const text = String(value || "").trim().toLowerCase();
  return text.startsWith("http://") || text.startsWith("https://");
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

function httpsGetBuffer(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      reject(new Error("Too many redirects"));
      return;
    }

    https
      .get(url, (response) => {
        const status = response.statusCode || 0;

        if ([301, 302, 303, 307, 308].includes(status)) {
          const redirectUrl = response.headers.location;

          if (!redirectUrl) {
            reject(new Error("Redirect URL missing"));
            return;
          }

          httpsGetBuffer(redirectUrl, maxRedirects - 1)
            .then(resolve)
            .catch(reject);

          return;
        }

        if (status !== 200) {
          console.error("EMPLOYEE PROFILE HTTPS GET ERROR:", status, url);
          reject(new Error(`Remote returned ${status}`));
          return;
        }

        const chunks = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
        });

        response.on("end", () => {
          resolve(Buffer.concat(chunks));
        });
      })
      .on("error", (err) => {
        console.error("EMPLOYEE PROFILE HTTPS ERROR:", err);
        reject(err);
      });
  });
}

async function fetchCloudinaryPdf(publicId, fileName = "document.pdf") {
  const finalPublicId = decodeURIComponent(String(publicId || ""));
  const safeName = safeFileName(fileName || "document.pdf");

  const signedUrl = cloudinary.utils.private_download_url(finalPublicId, "", {
    resource_type: "raw",
    type: "upload",
    expires_at: Math.floor(Date.now() / 1000) + 600,
    attachment: false,
  });

  const buffer = await httpsGetBuffer(signedUrl);

  return {
    buffer,
    fileName: safeName,
  };
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
    [user.employeeId || user.id, user.gasId || user.username || null]
  );

  return result.rows[0] || null;
}

function normalizeDataUpdateAttachment(att, requestRow, index) {
  return {
    id: `du-${requestRow.id}-${index}`,
    source: "data_update_attachment",
    request_id: requestRow.id,
    employee_id: requestRow.employee_id,
    document_type: "data_update_attachment",
    file_name: safeFileName(att.file_name || att.filename || "document.pdf"),
    filename: safeFileName(att.file_name || att.filename || "document.pdf"),
    file_path: att.file_url || att.url || null,
    file_url: att.file_url || att.url || null,
    url: att.file_url || att.url || null,
    public_id: att.public_id || null,
    resource_type: att.resource_type || "raw",
    verified: requestRow.status === "approved",
    uploaded_by: "Employee",
    uploaded_at: att.uploaded_at || requestRow.submitted_at || requestRow.created_at,
    status: requestRow.status,
  };
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

// ================= GET MY DOCUMENTS + DATA UPDATE ATTACHMENTS =================
router.get("/documents", async (req, res) => {
  try {
    const employee = await getMyEmployee(req.user);

    if (!employee) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const docsResult = await query(
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
      [employee.id]
    );

    const requestResult = await query(
      `
      SELECT
        id,
        employee_id,
        requested_fields,
        submitted_data,
        status,
        created_at,
        submitted_at,
        reviewed_at
      FROM employee_data_update_requests
      WHERE employee_id = $1
        AND submitted_data IS NOT NULL
      ORDER BY COALESCE(submitted_at, created_at) DESC
      `,
      [employee.id]
    );

    const normalDocs = docsResult.rows.map((doc) => ({
      ...doc,
      source: "employee_document",
    }));

    const dataUpdateAttachments = [];

    requestResult.rows.forEach((row) => {
      const submittedData = parseJson(row.submitted_data, {});
      const attachments = Array.isArray(submittedData.__attachments)
        ? submittedData.__attachments
        : Array.isArray(submittedData.attachments)
        ? submittedData.attachments
        : [];

      attachments.forEach((att, index) => {
        dataUpdateAttachments.push(normalizeDataUpdateAttachment(att, row, index));
      });
    });

    res.json([...normalDocs, ...dataUpdateAttachments]);
  } catch (err) {
    console.error("GET MY DOCUMENTS ERROR:", err);
    res.status(500).json({ message: "Failed to load documents" });
  }
});

// ================= VIEW EMPLOYEE DOCUMENT =================
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

// ================= VIEW DATA UPDATE ATTACHMENT FOR EMPLOYEE =================
router.get("/data-update-attachments/view", async (req, res) => {
  try {
    const employee = await getMyEmployee(req.user);

    if (!employee) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const { request_id, public_id, filename, download } = req.query;

    if (!request_id || !public_id) {
      return res.status(400).json({ message: "Missing attachment information" });
    }

    const requestResult = await query(
      `
      SELECT
        id,
        employee_id,
        submitted_data
      FROM employee_data_update_requests
      WHERE id = $1
        AND employee_id = $2
      LIMIT 1
      `,
      [request_id, employee.id]
    );

    const requestRow = requestResult.rows[0];

    if (!requestRow) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const submittedData = parseJson(requestRow.submitted_data, {});
    const attachments = Array.isArray(submittedData.__attachments)
      ? submittedData.__attachments
      : Array.isArray(submittedData.attachments)
      ? submittedData.attachments
      : [];

    const found = attachments.some(
      (att) => String(att.public_id || "") === String(public_id || "")
    );

    if (!found) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const { buffer, fileName } = await fetchCloudinaryPdf(
      public_id,
      filename || "document.pdf"
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);

    if (download === "1") {
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    } else {
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    }

    return res.send(buffer);
  } catch (err) {
    console.error("VIEW MY DATA UPDATE ATTACHMENT ERROR:", err);
    res.status(500).json({ message: "Failed to load attachment" });
  }
});

export default router;
