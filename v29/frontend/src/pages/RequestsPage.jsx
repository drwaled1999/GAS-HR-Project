import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || "https://gas-hr-project.onrender.com").trim();
}

function getAuthToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function buildFileUrl(requestId, kind = "request") {
  const base = getApiBaseUrl();
  const finalUrl = base ? `${base}/files/request/${requestId}` : `/files/request/${requestId}`;
  return kind === "review" ? `${finalUrl}?kind=review` : finalUrl;
}

function extractFilenameFromDisposition(disposition = "") {
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const asciiMatch = disposition.match(/filename="([^"]+)"/i);
  if (asciiMatch?.[1]) return asciiMatch[1];

  return "";
}

function pickSingleFile(accept = "") {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;

    input.onchange = () => {
      resolve(input.files?.[0] || null);
    };

    input.oncancel = () => resolve(null);
    input.click();
  });
}

function formatDateRange(item) {
  const start = item?.startDate || item?.start_date || "";
  const end = item?.endDate || item?.end_date || "";

  if (start && end && start !== end) return `${start} → ${end}`;
  return start || end || "-";
}

function normalizeRequest(item) {
  return {
    ...item,
    employeeName: item?.employeeName || item?.employee_name || "-",
    type: item?.type || "-",
    startDate: item?.startDate || item?.start_date || "",
    endDate: item?.endDate || item?.end_date || "",
    status: item?.status || "pending",
    attachmentName: item?.attachmentName || item?.attachment_name || "",
    attachmentPath: item?.attachmentPath || item?.attachment_path || "",
    reviewAttachmentName:
      item?.reviewAttachmentName || item?.review_attachment_name || "",
    reviewAttachmentPath:
      item?.reviewAttachmentPath || item?.review_attachment_path || "",
    reviewerName: item?.reviewerName || item?.reviewer_name || "",
    note: item?.note || "",
    currentBank: item?.currentBank || item?.current_bank || "",
    newBank: item?.newBank || item?.new_bank || "",
    newIban: item?.newIban || item?.new_iban || "",
  };
}

function typeLabel(type) {
  const map = {
    annual_leave: "إجازة سنوية",
    sick_leave: "إجازة مرضية",
    emergency_leave: "إجازة اضطرارية",
    salary_transfer: "تحويل راتب",
    payslip_request: "طلب مسير راتب",
  };
  return map[type] || type || "-";
}

function statusClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "approved") return "success";
  if (value === "rejected") return "danger";
  return "warning";
}

export default function RequestsPage() {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [fileBusyId, setFileBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function loadPage() {
    try {
      setLoading(true);
      setError("");

      const username =
        JSON.parse(localStorage.getItem("hr_portal_user") || "null")?.username || "";

      const response = await apiFetch(`/requests-center/list`, {
        method: "GET",
        params: username ? { username } : {},
      });

      const requests = Array.isArray(response?.leaveRequests)
        ? response.leaveRequests.map(normalizeRequest)
        : [];

      setLeaveRequests(requests);
      setEmployees(Array.isArray(response?.employees) ? response.employees : []);
    } catch (err) {
      console.error("Load requests error:", err);
      setError(err?.message || "Failed to load requests");
      setLeaveRequests([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  async function fetchAttachmentResponse(requestId, kind = "request") {
    const token = getAuthToken();
    const url = buildFileUrl(requestId, kind);

    const response = await fetch(url, {
      method: "GET",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || "Failed to load attachment");
    }

    return response;
  }

  async function handleDownload(requestId, attachmentName, kind = "request") {
    try {
      setFileBusyId(`download-${kind}-${requestId}`);
      setError("");

      const response = await fetchAttachmentResponse(requestId, kind);
      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("Empty attachment");
      }

      const disposition = response.headers.get("content-disposition") || "";
      const headerFilename = extractFilenameFromDisposition(disposition);
      const finalName = attachmentName || headerFilename || `${kind}-attachment-${requestId}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = finalName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Download error:", err);
      setError("تعذر تحميل المرفق. الملف قد يكون غير صالح أو غير مسموح.");
    } finally {
      setFileBusyId("");
    }
  }

  async function handlePreview(requestId, attachmentName, kind = "request") {
    try {
      setFileBusyId(`preview-${kind}-${requestId}`);
      setError("");

      const response = await fetchAttachmentResponse(requestId, kind);
      const blob = await response.blob();
      const contentType = response.headers.get("content-type") || blob.type || "";

      if (!blob || blob.size === 0) {
        throw new Error("Empty attachment");
      }

      const allowedPreviewTypes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "text/plain",
      ];

      const canPreview = allowedPreviewTypes.some((t) => contentType.includes(t));

      if (!canPreview) {
        await handleDownload(requestId, attachmentName, kind);
        setMessage("هذا النوع لا يدعم المعاينة المباشرة، تم تنزيل الملف بدلًا من ذلك");
        return;
      }

      const previewBlob = new Blob([blob], {
        type: contentType || "application/octet-stream",
      });

      const url = window.URL.createObjectURL(previewBlob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("Preview error:", err);
      setError("تعذر فتح المرفق كمعاينة أو تنزيل");
    } finally {
      setFileBusyId("");
    }
  }

  async function reviewLeave(item, decision) {
    try {
      setReviewingId(String(item.id));
      setError("");
      setMessage("");

      let rejectionReason = "";
      let reviewAttachment = null;

      if (decision === "rejected") {
        rejectionReason =
          window.prompt("اكتب سبب الرفض", "Rejected by reviewer") || "";

        if (!rejectionReason.trim()) {
          throw new Error("سبب الرفض مطلوب");
        }
      }

      if (
        decision === "approved" &&
        String(item.type || "").trim().toLowerCase() === "payslip_request"
      ) {
        reviewAttachment = await pickSingleFile(
          ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
        );

        if (!reviewAttachment) {
          throw new Error("مرفق الباي سليب مطلوب للموافقة على هذا الطلب");
        }
      }

      const body = new FormData();
      body.append("decision", decision);

      if (rejectionReason) {
        body.append("rejectionReason", rejectionReason);
      }

      if (reviewAttachment) {
        body.append("reviewAttachment", reviewAttachment);
      }

      await apiFetch(`/requests-center/leave/${item.id}/review`, {
        method: "POST",
        body,
      });

      setMessage(
        decision === "approved"
          ? "تمت الموافقة على الطلب"
          : "تم رفض الطلب"
      );

      await loadPage();
    } catch (err) {
      console.error("Review leave error:", err);
      setError(err?.message || "Failed to review request");
    } finally {
      setReviewingId("");
    }
  }

  const filteredRequests = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return leaveRequests;

    return leaveRequests.filter((item) =>
      [
        item.employeeName,
        item.type,
        item.status,
        item.note,
        item.currentBank,
        item.newBank,
        item.newIban,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [leaveRequests, search]);

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>Leave / Task Requests</h1>
          <p style={{ marginTop: 8, color: "#667085" }}>
            Track submitted requests, statuses, and attachments.
          </p>
        </div>
      </div>

      {message ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            background: "#ecfdf3",
            color: "#067647",
            border: "1px solid #abefc6",
          }}
        >
          {message}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            background: "#fef3f2",
            color: "#b42318",
            border: "1px solid #fecdca",
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          marginBottom: 18,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search requests..."
          style={{
            minWidth: 280,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #d0d5dd",
            outline: "none",
          }}
        />
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #eaecf0",
          borderRadius: 18,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 1.4fr 1fr",
            gap: 12,
            padding: "16px 18px",
            borderBottom: "1px solid #eaecf0",
            fontWeight: 700,
            color: "#475467",
          }}
        >
          <div>Employee</div>
          <div>Type</div>
          <div>Dates</div>
          <div>Status</div>
          <div>Attachment</div>
          <div>Action</div>
        </div>

        {loading ? (
          <div style={{ padding: 20, color: "#667085" }}>Loading...</div>
        ) : filteredRequests.length === 0 ? (
          <div style={{ padding: 20, color: "#667085" }}>No requests found.</div>
        ) : (
          filteredRequests.map((item) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 1.4fr 1fr",
                gap: 12,
                padding: "18px",
                borderBottom: "1px solid #f2f4f7",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 700 }}>{item.employeeName}</div>

              <div>{typeLabel(item.type)}</div>

              <div style={{ fontWeight: 700 }}>
                {formatDateRange(item)}
              </div>

              <div>
                <span
                  style={{
                    display: "inline-flex",
                    padding: "8px 12px",
                    borderRadius: 999,
                    fontWeight: 700,
                    background:
                      statusClass(item.status) === "success"
                        ? "#ecfdf3"
                        : statusClass(item.status) === "danger"
                        ? "#fef3f2"
                        : "#fffaeb",
                    color:
                      statusClass(item.status) === "success"
                        ? "#067647"
                        : statusClass(item.status) === "danger"
                        ? "#b42318"
                        : "#b54708",
                  }}
                >
                  {item.status}
                </span>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {item.attachmentPath ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() =>
                        handlePreview(
                          item.id,
                          item.attachmentName || item.attachment_name,
                          "request"
                        )
                      }
                      disabled={fileBusyId === `preview-request-${item.id}`}
                      style={smallBtn("#e0f2fe", "#0369a1")}
                    >
                      {fileBusyId === `preview-request-${item.id}` ? "..." : "Preview"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(
                          item.id,
                          item.attachmentName || item.attachment_name,
                          "request"
                        )
                      }
                      disabled={fileBusyId === `download-request-${item.id}`}
                      style={smallBtn("#e0e7ff", "#4338ca")}
                    >
                      {fileBusyId === `download-request-${item.id}` ? "..." : "Download"}
                    </button>
                  </div>
                ) : (
                  <span style={{ color: "#667085" }}>No request attachment</span>
                )}

                {item.reviewAttachmentPath ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() =>
                        handlePreview(
                          item.id,
                          item.reviewAttachmentName || "review-attachment",
                          "review"
                        )
                      }
                      disabled={fileBusyId === `preview-review-${item.id}`}
                      style={smallBtn("#dcfce7", "#166534")}
                    >
                      {fileBusyId === `preview-review-${item.id}` ? "..." : "Preview Reply"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDownload(
                          item.id,
                          item.reviewAttachmentName || "review-attachment",
                          "review"
                        )
                      }
                      disabled={fileBusyId === `download-review-${item.id}`}
                      style={smallBtn("#ede9fe", "#6d28d9")}
                    >
                      {fileBusyId === `download-review-${item.id}` ? "..." : "Download Reply"}
                    </button>
                  </div>
                ) : null}
              </div>

              <div>
                {String(item.status).toLowerCase() === "pending" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => reviewLeave(item, "approved")}
                      disabled={reviewingId === String(item.id)}
                      style={smallBtn("#ecfdf3", "#067647")}
                    >
                      {reviewingId === String(item.id) ? "..." : "Approve"}
                    </button>

                    <button
                      type="button"
                      onClick={() => reviewLeave(item, "rejected")}
                      disabled={reviewingId === String(item.id)}
                      style={smallBtn("#fef3f2", "#b42318")}
                    >
                      {reviewingId === String(item.id) ? "..." : "Reject"}
                    </button>
                  </div>
                ) : (
                  <span style={{ color: "#667085" }}>
                    {item.reviewerName ? `Reviewed by ${item.reviewerName}` : "-"}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function smallBtn(bg, color) {
  return {
    background: bg,
    color,
    border: "none",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
  };
}
