import { useEffect, useMemo, useState } from "react";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileSignature,
  RefreshCw,
  Search,
  Star,
} from "lucide-react";
import { apiFetch } from "../../services/api";

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function StatusBadge({ status }) {
  return (
    <span className={`ep-status ${status}`}>
      {String(status || "draft").replaceAll("_", " ")}
    </span>
  );
}

export default function EmployeePerformancePage() {
  const [reviews, setReviews] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReviews() {
    try {
      setLoading(true);
      setError("");

      const res = await apiFetch("/performance/reviews");
      setReviews(res.reviews || []);
    } catch (err) {
      setError(err.message || "Failed to load performance reviews");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, []);

  const filteredReviews = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    if (!q) return reviews;

    return reviews.filter((review) =>
      [
        review.review_type,
        review.status,
        review.final_rating,
        review.project_name,
        review.package_name,
        review.period_start,
        review.period_end,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [reviews, keyword]);

  const stats = useMemo(() => {
    return {
      total: reviews.length,
      approved: reviews.filter((r) => r.status === "approved").length,
      pending: reviews.filter((r) =>
        ["assigned", "self_review_completed", "supervisor_completed", "hr_reviewed"].includes(
          r.status
        )
      ).length,
      avg:
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + safeNumber(r.total_score), 0) /
            reviews.length
          : 0,
    };
  }, [reviews]);

  return (
    <div className="employee-performance-page">
      <style>{`
        .employee-performance-page {
          color: #0f172a;
          padding-bottom: 80px;
        }

        .ep-hero {
          border-radius: 30px;
          padding: 26px;
          background:
            radial-gradient(circle at 86% 18%, rgba(34,197,94,.22), transparent 28%),
            linear-gradient(135deg, #0f172a, #1d4ed8);
          color: white;
          box-shadow: 0 24px 60px rgba(15,23,42,.22);
          margin-bottom: 18px;
        }

        .ep-hero-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
        }

        .ep-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,.13);
          border: 1px solid rgba(255,255,255,.18);
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .ep-hero h1 {
          margin: 14px 0 8px;
          font-size: clamp(28px, 4vw, 42px);
          line-height: 1.05;
          font-weight: 950;
        }

        .ep-hero p {
          margin: 0;
          max-width: 740px;
          color: rgba(255,255,255,.78);
          line-height: 1.7;
        }

        .ep-btn {
          border: 0;
          border-radius: 16px;
          padding: 11px 15px;
          font-weight: 900;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: .2s ease;
          white-space: nowrap;
          text-decoration: none;
        }

        .ep-btn:hover {
          transform: translateY(-1px);
        }

        .ep-btn.white {
          background: white;
          color: #0f172a;
        }

        .ep-btn.primary {
          background: #2563eb;
          color: white;
        }

        .ep-btn.soft {
          background: #f1f5f9;
          color: #0f172a;
        }

        .ep-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .ep-stat {
          background: rgba(255,255,255,.95);
          border: 1px solid rgba(148,163,184,.22);
          border-radius: 24px;
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
          padding: 18px;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .ep-stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          color: #2563eb;
          flex: 0 0 auto;
        }

        .ep-stat p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .ep-stat strong {
          display: block;
          margin-top: 5px;
          font-size: 24px;
          color: #0f172a;
        }

        .ep-panel {
          background: rgba(255,255,255,.95);
          border: 1px solid rgba(148,163,184,.22);
          border-radius: 28px;
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
          overflow: hidden;
        }

        .ep-panel-header {
          padding: 18px 20px;
          border-bottom: 1px solid rgba(148,163,184,.18);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .ep-panel-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .ep-panel-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .ep-search-wrap {
          position: relative;
          min-width: 280px;
        }

        .ep-search-wrap svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .ep-search {
          width: 100%;
          height: 42px;
          border-radius: 15px;
          border: 1px solid rgba(148,163,184,.35);
          padding: 0 12px 0 40px;
          outline: none;
        }

        .ep-list {
          padding: 16px;
          display: grid;
          gap: 14px;
        }

        .ep-review-card {
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 22px;
          background: #fff;
          padding: 16px;
          display: grid;
          gap: 14px;
        }

        .ep-review-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
        }

        .ep-review-title {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .ep-icon {
          width: 44px;
          height: 44px;
          border-radius: 17px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          color: #2563eb;
          flex: 0 0 auto;
        }

        .ep-review-title strong {
          display: block;
          font-size: 16px;
          color: #0f172a;
        }

        .ep-review-title span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-top: 4px;
        }

        .ep-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ep-pill,
        .ep-status {
          display: inline-flex;
          align-items: center;
          padding: 7px 10px;
          border-radius: 999px;
          background: #e2e8f0;
          color: #334155;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          width: fit-content;
        }

        .ep-status.approved,
        .ep-status.locked {
          background: #dcfce7;
          color: #15803d;
        }

        .ep-status.rejected {
          background: #fef2f2;
          color: #dc2626;
        }

        .ep-status.assigned {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .ep-score {
          min-width: 82px;
          justify-content: center;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .ep-card-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .ep-empty,
        .ep-loading,
        .ep-error {
          padding: 26px;
          text-align: center;
          color: #64748b;
        }

        .ep-error {
          color: #b91c1c;
          background: #fef2f2;
          border-radius: 18px;
          margin-bottom: 14px;
          font-weight: 800;
        }

        @media (max-width: 980px) {
          .ep-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .ep-hero {
            border-radius: 22px;
            padding: 20px;
          }

          .ep-hero-content,
          .ep-panel-header,
          .ep-review-top {
            flex-direction: column;
          }

          .ep-grid {
            grid-template-columns: 1fr;
          }

          .ep-search-wrap {
            width: 100%;
            min-width: 0;
          }

          .ep-btn,
          .ep-card-actions {
            width: 100%;
          }

          .ep-card-actions .ep-btn {
            flex: 1;
          }
        }
      `}</style>

      <section className="ep-hero">
        <div className="ep-hero-content">
          <div>
            <div className="ep-kicker">
              <Award size={16} />
              My Performance
            </div>
            <h1>My Performance Reviews</h1>
            <p>
              View your assigned performance reviews, complete your self review,
              check approval status, final rating, and electronic signatures.
            </p>
          </div>

          <button className="ep-btn white" onClick={loadReviews}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </section>

      {error ? <div className="ep-error">{error}</div> : null}

      <section className="ep-grid">
        <div className="ep-stat">
          <div className="ep-stat-icon">
            <FileSignature size={20} />
          </div>
          <div>
            <p>Total Reviews</p>
            <strong>{stats.total}</strong>
          </div>
        </div>

        <div className="ep-stat">
          <div className="ep-stat-icon">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p>Approved</p>
            <strong>{stats.approved}</strong>
          </div>
        </div>

        <div className="ep-stat">
          <div className="ep-stat-icon">
            <Clock size={20} />
          </div>
          <div>
            <p>Pending</p>
            <strong>{stats.pending}</strong>
          </div>
        </div>

        <div className="ep-stat">
          <div className="ep-stat-icon">
            <Star size={20} />
          </div>
          <div>
            <p>Average Score</p>
            <strong>{stats.avg.toFixed(1)}%</strong>
          </div>
        </div>
      </section>

      <section className="ep-panel">
        <div className="ep-panel-header">
          <div>
            <h2>Review History</h2>
            <p>Your annual, quarterly, semi-annual, and custom evaluations.</p>
          </div>

          <div className="ep-search-wrap">
            <Search size={16} />
            <input
              className="ep-search"
              placeholder="Search reviews..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="ep-loading">Loading reviews...</div>
        ) : filteredReviews.length === 0 ? (
          <div className="ep-empty">No performance reviews found.</div>
        ) : (
          <div className="ep-list">
            {filteredReviews.map((review) => (
              <div className="ep-review-card" key={review.id}>
                <div className="ep-review-top">
                  <div className="ep-review-title">
                    <div className="ep-icon">
                      <CalendarDays size={19} />
                    </div>
                    <div>
                      <strong>
                        {String(review.review_type || "Review").replaceAll("_", " ")}
                      </strong>
                      <span>
                        {review.period_start || "-"} to {review.period_end || "-"}
                      </span>
                    </div>
                  </div>

                  <StatusBadge status={review.status} />
                </div>

                <div className="ep-meta">
                  <span className="ep-pill">{review.project_name || "-"}</span>
                  <span className="ep-pill">{review.package_name || "No package"}</span>
                  <span className="ep-pill ep-score">
                    {safeNumber(review.total_score).toFixed(1)}%
                  </span>
                  <span className="ep-pill">
                    {review.final_rating || "No rating yet"}
                  </span>
                </div>

                <div className="ep-card-actions">
                  <a
                    className="ep-btn primary"
                    href={`/performance/reviews/${review.id}`}
                  >
                    <Eye size={17} />
                    Open Review
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
