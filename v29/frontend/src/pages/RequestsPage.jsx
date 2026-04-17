import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";
import { useAuth } from "../context/AuthContext";

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
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
  const url = base ? `${base}/files/request/${requestId}` : `/files/request/${requestId}`;
  return kind === "review" ? `${url}?kind=review` : url;
}

function extractFilenameFromDisposition(disposition) {
  if (!disposition) return "";

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = disposition.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return "";
}

function pickSingleFile(accept = "") {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (accept) input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRequest(item) {
  return {
    ...item,
    id: item?.id,
    employeeId: item?.employeeId || item?.employee_id || "",
    employeeName: item?.employeeName || item?.employee_name || "-",
    employeeGasId: item?.employeeGasId || item?.employee_gas_id || "",
    type: item?.type || "",
    note: item?.note || "",
    currentBank: item?.currentBank || item?.current_bank || "",
    newBank: item?.newBank || item?.new_bank || "",
    newIban: item?.newIban || item?.new_iban || "",
    startDate: item?.startDate || item?.start_date || "",
    endDate: item?.endDate || item?.end_date || "",
    status: item?.status || "pending",
    rejectionReason: item?.rejectionReason || item?.rejection_reason || "",
    requestedById: item?.requestedById || item?.requested_by_id || "",
    requestedBy: item?.requestedBy || "",
    requestedByName: item?.requestedByName || "",
    reviewerName: item?.reviewerName || item?.reviewer_name || "",
    reviewedAt: item?.reviewedAt || item?.reviewed_at || "",
    attachmentName: item?.attachmentName || item?.attachment_name || "",
    attachmentPath: item?.attachmentPath || item?.attachment_path || "",
    reviewAttachmentName:
      item?.reviewAttachmentName || item?.review_attachment_name || "",
    reviewAttachmentPath:
      item?.reviewAttachmentPath || item?.review_attachment_path || "",
    createdAt: item?.createdAt || item?.created_at || "",
  };
}

function badgeClass(status) {
  const value = String(status || "").toLowerCase();
  if (value === "approved") return "success";
  if (value === "rejected") return "danger";
  return "warning";
}

export default function RequestsPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [attendanceAdjustments, setAttendanceAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [fileBusyId, setFileBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const canReview = useMemo(() => {
    const role = String(
      user?.roleName || user?.role || user?.roleCode || ""
    ).toLowerCase();

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
  }, [user?.roleName, user?.role, user?.roleCode]);

  async function loadPage() {
    try {
      setLoading(true);
      setError("");

      const username = user?.username ? encodeURIComponent(user.username) : "";
      const response = await apiFetch(`/requests-center/list?username=${username}`);

      setEmployees(safeArray(response?.employees));
      setLeaveRequests(safeArray(response?.leaveRequests).map(normalizeRequest));
      setAttendanceAdjustments(safeArray(response?.attendanceAdjustments));
    } catch (err) {
      console.error("Load requests error:", err);
      setError(err?.message || "Failed to load requests");
      setEmployees([]);
      setLeaveRequests([]);
      setAttendanceAdjustments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, [user?.username]);

  const filteredLeaveRequests = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return leaveRequests;

    return leaveRequests.filter((item) => {
      return [
        item.employeeName,
        item.employeeGasId,
        item.type,
        item.status,
        item.requestedBy,
        item.requestedByName,
        item.reviewerName,
        item.note,
        item.currentBank,
        item.newBank,
        item.newIban,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [leaveRequests, search]);

  async function reviewLeave(item, decision) {
    try {
      setReviewingId(String(item.id));
      setError("");
      setMessage("");

      const rejectionReason =
        decision === "rejected"
          ? window.prompt("اكتب سبب الرفض", "Rejected by reviewer") || ""
          : "";

      if (decision === "rejected" && !rejectionReason.trim()) {
        throw new Error("سبب الرفض مطلوب");
      }

      let reviewAttachment = null;

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
      if (rejectionReason) body.append("rejectionReason", rejectionReason);
      if (reviewAttachment) body.append("reviewAttachment", reviewAttachment);

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

      if (!allowedPreviewTypes.some((t) => contentType.includes(t))) {
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
      const finalName =
        attachmentName || headerFilename || `${kind}-attachment-${requestId}`;

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

  return (
    <div className="page">
      <style>{`
        .requests-board {
          display: grid;
          gap: 20px;
        }

        .requests-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .requests-search {
          width: min(420px, 100%);
          border: 1px solid #d0d5dd;
          border-radius: 16px;
          padding: 14px 16px;
          font-size: 15px;
          outline: none;
          background: #ffffff;
          box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
        }

        .requests-table {
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
        }

        .requests-head,
        .requests-row {
          display: grid;
          grid-template-columns: 1.2fr 1fr 1fr 0.8fr 1fr 1fr 1fr;
          gap: 16px;
          align-items: center;
          padding: 18px 20px;
        }

        .requests-head {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          font-weight: 800;
          color: #334155;
        }

        .requests-row {
          border-bottom: 1px solid #eef2f7;
        }

        .requests-row:last-child {
          border-bottom: none;
        }

        .cell-main {
          font-weight: 700;
          color: #0f172a;
        }

        .cell-sub {
          font-size: 0.88rem;
          color: #64748b;
          margin-top: 4px;
        }

        .cell-muted {
          color: #64748b;
          font-size: 0.92rem;
        }

        .soft-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 800;
          text-transform: lowercase;
        }

        .soft-badge.success {
          background: #dcfce7;
          color: #166534;
        }

        .soft-badge.warning {
          background: #fef3c7;
          color: #92400e;
        }

        .soft-badge.danger {
          background: #fee2e2;
          color: #991b1b;
        }

        .inline-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .inline-actions button,
        .file-btn {
          border: none;
          border-radius: 14px;
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .inline-actions button:hover,
        .file-btn:hover {
          transform: translateY(-1px);
        }

        .inline-actions button:disabled,
        .file-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .inline-actions button {
          background: #dcfce7;
          color: #166534;
        }

        .inline-actions button.ghost {
          background: #fee2e2;
          color: #991b1b;
        }

        .file-actions-stack {
          display: grid;
          gap: 8px;
        }

        .file-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .file-btn.preview {
          background: #e0f2fe;
          color: #075985;
        }

        .file-btn.download {
          background: #e0e7ff;
          color: #3730a3;
        }

        .message-box {
          border-radius: 18px;
          padding: 14px 16px;
          font-weight: 700;
        }

        .message-box.success {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #bbf7d0;
        }

        .message-box.error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        @media (max-width: 1200px) {
          .requests-head,
          .requests-row {
            grid-template-columns: 1.2fr 1fr 1fr 0.8fr 1fr 1fr;
          }

          .requests-head > :nth-child(6),
          .requests-row > :nth-child(6) {
            display: none;
          }
        }

        @media (max-width: 900px) {
          .requests-head {
            display: none;
          }

          .requests-row {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .requests-row > div {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
        }
      `}</style>

      <div className="requests-board">
        <div className="page-header">
          <div>
            <h1>Leave / Task Requests</h1>
            <p>Track submitted requests, statuses, and attachments.</p>
          </div>
        </div>

        {message ? <div className="message-box success">{message}</div> : null}
        {error ? <div className="message-box error">{error}</div> : null}

        <div className="requests-toolbar">
          <input
            className="requests-search"
            type="search"
            placeholder="Search requests..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="requests-table">
          <div className="requests-head">
            <div>Employee</div>
            <div>Type</div>
            <div>Dates</div>
            <div>Status</div>
            <div>Attachment</div>
            <div>Requested By</div>
            <div>Action</div>
          </div>

          {loading ? (
            <div className="requests-row">
              <div className="cell-muted">Loading requests...</div>
            </div>
          ) : filteredLeaveRequests.length === 0 ? (
            <div className="requests-row">
              <div className="cell-muted">No requests found.</div>
            </div>
          ) : (
            filteredLeaveRequests.map((item) => (
              <div className="requests-row" key={item.id}>
                <div>
                  <div className="cell-main">{item.employeeName || "-"}</div>
                  <div className="cell-sub">{item.employeeGasId || "-"}</div>
                </div>

                <div>
                  <div className="cell-main">{item.type || "-"}</div>
                </div>

                <div>
                  <div className="cell-main">
                    {formatDateRangeShort(item.startDate, item.endDate)}
                  </div>
                </div>

                <div>
                  <span className={`soft-badge ${badgeClass(item.status)}`}>
                    {item.status || "-"}
                  </span>
                </div>

                <div>
                  <div className="file-actions-stack">
                    {item.attachmentPath ? (
                      <div className="file-actions">
                        <button
                          type="button"
                          className="file-btn preview"
                          onClick={() =>
                            handlePreview(
                              item.id,
                              item.attachmentName || item.attachment_name,
                              "request"
                            )
                          }
                          disabled={fileBusyId === `preview-request-${item.id}`}
                        >
                          {fileBusyId === `preview-request-${item.id}` ? "..." : "Preview"}
                        </button>

                        <button
                          type="button"
                          className="file-btn download"
                          onClick={() =>
                            handleDownload(
                              item.id,
                              item.attachmentName || item.attachment_name,
                              "request"
                            )
                          }
                          disabled={fileBusyId === `download-request-${item.id}`}
                        >
                          {fileBusyId === `download-request-${item.id}` ? "..." : "Download"}
                        </button>
                      </div>
                    ) : (
                      <span className="cell-muted">No attachment</span>
                    )}

                    {item.reviewAttachmentPath ? (
                      <div className="file-actions">
                        <button
                          type="button"
                          className="file-btn preview"
                          onClick={() =>
                            handlePreview(
                              item.id,
                              item.reviewAttachmentName || "reply-attachment",
                              "review"
                            )
                          }
                          disabled={fileBusyId === `preview-review-${item.id}`}
                        >
                          {fileBusyId === `preview-review-${item.id}` ? "..." : "Preview Reply"}
                        </button>
                        <button
                          type="button"
                          className="file-btn download"
                          onClick={() =>
                            handleDownload(
                              item.id,
                              item.reviewAttachmentName || "reply-attachment",
                              "review"
                            )
                          }
                          disabled={fileBusyId === `download-review-${item.id}`}
                        >
                          {fileBusyId === `download-review-${item.id}` ? "..." : "Download Reply"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="cell-main">{item.requestedByName || item.requestedBy || "-"}</div>
                </div>

                <div>
                  {canReview && item.status === "pending" ? (
                    <div className="inline-actions">
                      <button
                        type="button"
                        onClick={() => reviewLeave(item, "approved")}
                        disabled={reviewingId === String(item.id)}
                      >
                        {reviewingId === String(item.id) ? "..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => reviewLeave(item, "rejected")}
                        disabled={reviewingId === String(item.id)}
                      >
                        {reviewingId === String(item.id) ? "..." : "Reject"}
                      </button>
                    </div>
                  ) : item.status === "rejected" && item.rejectionReason ? (
                    <span className="cell-muted">{item.rejectionReason}</span>
                  ) : (
                    <span className="cell-muted">No action</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
