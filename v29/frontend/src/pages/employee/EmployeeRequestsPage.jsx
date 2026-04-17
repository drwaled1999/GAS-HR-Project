import { useEffect, useMemo, useState } from "react";
import { apiFetch, getProtectedFileUrl } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

function normalizeRequest(item) {
  return {
    ...item,
    employeeName: item?.employeeName || item?.employee_name || "-",
    type: item?.type || "-",
    startDate: item?.startDate || item?.start_date || "",
    endDate: item?.endDate || item?.end_date || "",
    status: item?.status || "pending",
    attachmentPath: item?.attachmentPath || item?.attachment_path || "",
    attachmentName: item?.attachmentName || item?.attachment_name || "",
    reviewAttachmentPath:
      item?.reviewAttachmentPath || item?.review_attachment_path || "",
    reviewAttachmentName:
      item?.reviewAttachmentName || item?.review_attachment_name || "",
    reviewerName: item?.reviewerName || item?.reviewer_name || "",
    note: item?.note || "",
    rejectionReason: item?.rejectionReason || item?.rejection_reason || "",
    currentBank: item?.currentBank || item?.current_bank || "",
    newBank: item?.newBank || item?.new_bank || "",
    newIban: item?.newIban || item?.new_iban || "",
  };
}

function typeLabel(type) {
  const map = {
    annual_leave: "Annual Leave",
    sick_leave: "Sick Leave",
    emergency_leave: "Emergency Leave",
    salary_transfer: "Salary Transfer",
    payslip_request: "Payslip Request",
  };
  return map[type] || type || "-";
}

function formatDateRange(request) {
  const start = request?.startDate || "";
  const end = request?.endDate || "";

  if (start && end && start !== end) return `${start} → ${end}`;
  return start || end || "-";
}

function statusStyles(status) {
  const value = String(status || "").toLowerCase();

  if (value === "approved") {
    return {
      background: "#ecfdf3",
      color: "#067647",
      border: "1px solid #abefc6",
    };
  }

  if (value === "rejected") {
    return {
      background: "#fef3f2",
      color: "#b42318",
      border: "1px solid #fecdca",
    };
  }

  return {
    background: "#fffaeb",
    color: "#b54708",
    border: "1px solid #fedf89",
  };
}

export default function EmployeeRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function loadRequests() {
    try {
      setLoading(true);
      setError("");

      const response = await apiFetch("/requests-center/list", {
        method: "GET",
        params: {
          username: user?.username || "",
        },
      });

      const items = Array.isArray(response?.leaveRequests)
        ? response.leaveRequests.map(normalizeRequest)
        : [];

      setRequests(items);
    } catch (err) {
      console.error("Employee requests load error:", err);
      setError(err?.message || "Failed to load requests");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.username) {
      loadRequests();
    }
  }, [user?.username]);

  const filteredRequests = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return requests;

    return requests.filter((request) =>
      [
        request.type,
        request.status,
        request.note,
        request.employeeName,
        request.currentBank,
        request.newBank,
        request.newIban,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [requests, search]);

  return (
    <div className="page mobile-page">
      <section className="card mobile-list-card">
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0 }}>My Requests</h1>
          <p style={{ marginTop: 8, color: "#667085" }}>
            Track your submitted requests and download available attachments.
          </p>
        </div>

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

        <div style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests..."
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #d0d5dd",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {loading ? (
          <div style={{ color: "#667085" }}>Loading...</div>
        ) : filteredRequests.length === 0 ? (
          <div style={{ color: "#667085" }}>No requests found.</div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {filteredRequests.map((request) => (
              <div
                key={request.id}
                style={{
                  border: "1px solid #eaecf0",
                  borderRadius: 18,
                  padding: 16,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      {typeLabel(request.type)}
                    </div>
                    <div style={{ color: "#667085", marginTop: 6 }}>
                      {formatDateRange(request)}
                    </div>
                  </div>

                  <span
                    style={{
                      display: "inline-flex",
                      padding: "8px 12px",
                      borderRadius: 999,
                      fontWeight: 700,
                      ...statusStyles(request.status),
                    }}
                  >
                    {request.status}
                  </span>
                </div>

                {request.note ? (
                  <div style={{ marginBottom: 10, color: "#344054" }}>
                    <strong>Note:</strong> {request.note}
                  </div>
                ) : null}

                {request.type === "salary_transfer" ? (
                  <div style={{ marginBottom: 10, color: "#344054", lineHeight: 1.8 }}>
                    <div><strong>Current Bank:</strong> {request.currentBank || "-"}</div>
                    <div><strong>New Bank:</strong> {request.newBank || "-"}</div>
                    <div><strong>New IBAN:</strong> {request.newIban || "-"}</div>
                  </div>
                ) : null}

                {request.status === "rejected" && request.rejectionReason ? (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: 10,
                      borderRadius: 12,
                      background: "#fef3f2",
                      color: "#b42318",
                    }}
                  >
                    <strong>Rejection Reason:</strong> {request.rejectionReason}
                  </div>
                ) : null}

                <div
                  className="request-card-actions"
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginTop: 12,
                  }}
                >
                  {request.attachmentPath ? (
                    <a
                      className="ghost-link"
                      href={getProtectedFileUrl(`/files/request/${request.id}`)}
                      target="_blank"
                      rel="noreferrer"
                      style={linkBtnStyle}
                    >
                      View Attachment
                    </a>
                  ) : (
                    <span style={{ color: "#667085", fontSize: 13 }}>
                      No attachment
                    </span>
                  )}

                  {request.reviewAttachmentPath ? (
                    <a
                      className="ghost-link"
                      href={getProtectedFileUrl(`/files/request/${request.id}?kind=review`)}
                      target="_blank"
                      rel="noreferrer"
                      style={replyBtnStyle}
                    >
                      Download Reply Attachment
                    </a>
                  ) : null}

                  {request.reviewerName ? (
                    <span style={{ color: "#667085", fontSize: 13 }}>
                      Reviewed by: {request.reviewerName}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const linkBtnStyle = {
  textDecoration: "none",
  padding: "10px 14px",
  borderRadius: 12,
  background: "#eef4ff",
  color: "#155eef",
  fontWeight: 700,
};

const replyBtnStyle = {
  textDecoration: "none",
  padding: "10px 14px",
  borderRadius: 12,
  background: "#ecfdf3",
  color: "#067647",
  fontWeight: 700,
};
