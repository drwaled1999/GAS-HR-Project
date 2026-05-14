import { useEffect, useMemo, useState } from "react";
import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Star,
  ThumbsUp,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../services/api";

function numberValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function scoreMax(scoreType) {
  if (scoreType === "scale_1_5") return 5;
  if (scoreType === "percentage") return 100;
  if (scoreType === "yes_no") return 1;
  return 10;
}

function scoreLabel(scoreType) {
  if (scoreType === "scale_1_5") return "Score 1 - 5";
  if (scoreType === "percentage") return "Percentage";
  if (scoreType === "yes_no") return "Yes / No";
  if (scoreType === "text") return "Comment Only";
  return "Score 1 - 10";
}

function StatusBadge({ status }) {
  return <span className={`pr-status ${status}`}>{String(status || "draft").replaceAll("_", " ")}</span>;
}

export default function PerformanceReviewPage() {
  const { id } = useParams();

  const [review, setReview] = useState(null);
  const [scores, setScores] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [comments, setComments] = useState([]);
  const [signatures, setSignatures] = useState([]);

  const [mode, setMode] = useState("supervisor");
  const [comment, setComment] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadReview() {
    try {
      setLoading(true);
      setError("");

      const res = await apiFetch(`/performance/reviews/${id}`);

      setReview(res.review || null);
      setScores(res.scores || []);
      setRecommendation(
        res.recommendation || {
          recommend_promotion: false,
          recommend_salary_increase: false,
          training_required: false,
          warning_required: false,
          no_action: false,
          training_topics: [],
          custom_training: "",
          recommendation_notes: "",
        }
      );
      setComments(res.comments || []);
      setSignatures(res.signatures || []);
    } catch (err) {
      setError(err.message || "Failed to load review");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReview();
  }, [id]);

  function showNotice(message) {
    setNotice(message);
    setTimeout(() => setNotice(""), 3500);
  }

  const totalWeight = useMemo(() => {
    return scores
      .filter((item) => item.include_in_score && item.score_type !== "text")
      .reduce((sum, item) => sum + numberValue(item.weight), 0);
  }, [scores]);

  const calculatedScore = useMemo(() => {
    return scores
      .filter((item) => item.include_in_score && item.score_type !== "text")
      .reduce((sum, item) => {
        const max = scoreMax(item.score_type);
        const raw =
          item.final_score ??
          item.hr_score ??
          item.supervisor_score ??
          item.employee_score ??
          0;

        return sum + (numberValue(raw) / max) * numberValue(item.weight);
      }, 0);
  }, [scores]);

  function updateScoreRow(scoreId, patch) {
    setScores((prev) =>
      prev.map((item) => (item.id === scoreId ? { ...item, ...patch } : item))
    );
  }

  function buildScorePayload(actor) {
    return scores.map((item) => {
      let score = null;
      let text = "";

      if (actor === "employee") {
        score = item.employee_score;
        text = item.employee_comment;
      }

      if (actor === "supervisor") {
        score = item.supervisor_score;
        text = item.supervisor_comment;
      }

      if (actor === "hr") {
        score = item.hr_score;
        text = item.hr_comment;
      }

      return {
        id: item.id,
        score,
        comment: text,
      };
    });
  }

  async function submitScores(actor) {
    try {
      setSaving(true);
      setError("");

      const endpointMap = {
        employee: "self-review",
        supervisor: "supervisor-review",
        hr: "hr-review",
      };

      const res = await apiFetch(`/performance/reviews/${id}/${endpointMap[actor]}`, {
        method: "PUT",
        body: JSON.stringify({
          scores: buildScorePayload(actor),
        }),
      });

      showNotice(res.message || "Review saved successfully");
      await loadReview();
    } catch (err) {
      setError(err.message || "Failed to save review");
    } finally {
      setSaving(false);
    }
  }

  async function saveRecommendation() {
    try {
      setSaving(true);
      setError("");

      await apiFetch(`/performance/reviews/${id}/recommendation`, {
        method: "PUT",
        body: JSON.stringify({
          recommendPromotion: Boolean(recommendation?.recommend_promotion),
          recommendSalaryIncrease: Boolean(recommendation?.recommend_salary_increase),
          trainingRequired: Boolean(recommendation?.training_required),
          warningRequired: Boolean(recommendation?.warning_required),
          noAction: Boolean(recommendation?.no_action),
          trainingTopics: Array.isArray(recommendation?.training_topics)
            ? recommendation.training_topics
            : [],
          customTraining: recommendation?.custom_training || "",
          recommendationNotes: recommendation?.recommendation_notes || "",
        }),
      });

      showNotice("Recommendation saved successfully");
      await loadReview();
    } catch (err) {
      setError(err.message || "Failed to save recommendation");
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!comment.trim()) return;

    try {
      setSaving(true);
      setError("");

      await apiFetch(`/performance/reviews/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ comment }),
      });

      setComment("");
      showNotice("Comment added");
      await loadReview();
    } catch (err) {
      setError(err.message || "Failed to add comment");
    } finally {
      setSaving(false);
    }
  }

  async function signReview() {
    try {
      setSaving(true);
      setError("");

      await apiFetch(`/performance/reviews/${id}/sign`, {
        method: "POST",
        body: JSON.stringify({
          signerRole: mode === "hr" ? "hr" : mode,
          signatureText: signatureText || "Signed electronically",
        }),
      });

      setSignatureText("");
      showNotice("Review signed successfully");
      await loadReview();
    } catch (err) {
      setError(err.message || "Failed to sign review");
    } finally {
      setSaving(false);
    }
  }

  async function approveReview() {
    try {
      setSaving(true);
      setError("");

      await apiFetch(`/performance/reviews/${id}/final-approve`, {
        method: "PUT",
      });

      showNotice("Review approved successfully");
      await loadReview();
    } catch (err) {
      setError(err.message || "Failed to approve review");
    } finally {
      setSaving(false);
    }
  }

  async function rejectReview() {
    try {
      setSaving(true);
      setError("");

      await apiFetch(`/performance/reviews/${id}/reject`, {
        method: "PUT",
        body: JSON.stringify({
          reason: rejectReason || "Rejected by reviewer",
        }),
      });

      setRejectReason("");
      showNotice("Review rejected");
      await loadReview();
    } catch (err) {
      setError(err.message || "Failed to reject review");
    } finally {
      setSaving(false);
    }
  }

  async function lockReview() {
    try {
      setSaving(true);
      setError("");

      await apiFetch(`/performance/reviews/${id}/lock`, {
        method: "PUT",
      });

      showNotice("Review locked successfully");
      await loadReview();
    } catch (err) {
      setError(err.message || "Failed to lock review");
    } finally {
      setSaving(false);
    }
  }

  function updateRecommendationField(key, value) {
    setRecommendation((prev) => ({ ...(prev || {}), [key]: value }));
  }

  if (loading) {
    return (
      <div className="performance-review-page">
        <div style={{ padding: 24 }}>Loading review...</div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="performance-review-page">
        <div style={{ padding: 24 }}>Review not found.</div>
      </div>
    );
  }

  return (
    <div className="performance-review-page">
      <style>{`
        .performance-review-page {
          color: #0f172a;
        }

        .pr-hero {
          border-radius: 30px;
          padding: 26px;
          background:
            radial-gradient(circle at 90% 20%, rgba(34,197,94,.22), transparent 30%),
            linear-gradient(135deg, #111827, #1e40af);
          color: white;
          box-shadow: 0 24px 60px rgba(15,23,42,.22);
          margin-bottom: 18px;
        }

        .pr-hero-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
        }

        .pr-kicker {
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

        .pr-hero h1 {
          margin: 14px 0 8px;
          font-size: clamp(26px, 4vw, 42px);
          font-weight: 950;
          line-height: 1.08;
        }

        .pr-hero p {
          margin: 0;
          color: rgba(255,255,255,.78);
          line-height: 1.7;
        }

        .pr-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: flex-end;
        }

        .pr-btn {
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
        }

        .pr-btn:hover {
          transform: translateY(-1px);
        }

        .pr-btn.white {
          background: white;
          color: #0f172a;
        }

        .pr-btn.primary {
          background: #2563eb;
          color: white;
        }

        .pr-btn.success {
          background: #16a34a;
          color: white;
        }

        .pr-btn.danger {
          background: #dc2626;
          color: white;
        }

        .pr-btn.soft {
          background: #f1f5f9;
          color: #0f172a;
        }

        .pr-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }

        .pr-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .pr-card {
          background: rgba(255,255,255,.95);
          border: 1px solid rgba(148,163,184,.22);
          border-radius: 24px;
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
          padding: 18px;
        }

        .pr-card p {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .pr-card strong {
          display: block;
          margin-top: 7px;
          font-size: 24px;
          color: #0f172a;
        }

        .pr-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) 390px;
          gap: 18px;
        }

        .pr-panel {
          background: rgba(255,255,255,.95);
          border: 1px solid rgba(148,163,184,.22);
          border-radius: 28px;
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
          overflow: hidden;
        }

        .pr-panel-header {
          padding: 18px 20px;
          border-bottom: 1px solid rgba(148,163,184,.18);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .pr-panel-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .pr-panel-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .pr-mode-tabs {
          padding: 14px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          border-bottom: 1px solid rgba(148,163,184,.15);
        }

        .pr-tab {
          border: 1px solid rgba(148,163,184,.25);
          background: #f8fafc;
          color: #0f172a;
          border-radius: 999px;
          padding: 9px 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .pr-tab.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .pr-score-list {
          padding: 16px;
          display: grid;
          gap: 14px;
        }

        .pr-score-item {
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 22px;
          background: #fff;
          padding: 16px;
          display: grid;
          gap: 12px;
        }

        .pr-score-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .pr-score-title {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .pr-icon {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          color: #2563eb;
          flex: 0 0 auto;
        }

        .pr-score-title strong {
          display: block;
          font-size: 15px;
        }

        .pr-score-title span {
          display: block;
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        .pr-pill,
        .pr-status {
          display: inline-flex;
          align-items: center;
          padding: 6px 9px;
          border-radius: 999px;
          background: #e2e8f0;
          color: #334155;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
          width: fit-content;
        }

        .pr-status.approved,
        .pr-status.locked {
          background: #dcfce7;
          color: #15803d;
        }

        .pr-status.rejected {
          background: #fef2f2;
          color: #dc2626;
        }

        .pr-status.assigned {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .pr-fields {
          display: grid;
          grid-template-columns: 170px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
        }

        .pr-field {
          display: grid;
          gap: 7px;
        }

        .pr-field label {
          font-size: 12px;
          color: #475569;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .pr-input,
        .pr-textarea,
        .pr-select {
          width: 100%;
          border: 1px solid rgba(148,163,184,.35);
          border-radius: 15px;
          background: white;
          color: #0f172a;
          padding: 11px 12px;
          outline: none;
        }

        .pr-textarea {
          min-height: 88px;
          resize: vertical;
        }

        .pr-side-stack {
          display: grid;
          gap: 18px;
        }

        .pr-side-body {
          padding: 16px;
          display: grid;
          gap: 12px;
        }

        .pr-check {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 11px;
          border-radius: 16px;
          background: #f8fafc;
          border: 1px solid rgba(148,163,184,.18);
          font-size: 13px;
          font-weight: 800;
          color: #334155;
        }

        .pr-comment {
          padding: 13px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid rgba(148,163,184,.16);
        }

        .pr-comment strong {
          display: block;
          font-size: 13px;
        }

        .pr-comment p {
          margin: 6px 0 0;
          color: #475569;
          font-size: 13px;
          line-height: 1.6;
        }

        .pr-signature {
          padding: 12px;
          border-radius: 16px;
          background: #ecfdf5;
          border: 1px solid rgba(22,163,74,.18);
          color: #047857;
          font-weight: 800;
          font-size: 13px;
        }

        .pr-error,
        .pr-notice {
          padding: 16px;
          border-radius: 18px;
          margin-bottom: 14px;
          text-align: center;
          font-weight: 800;
        }

        .pr-error {
          background: #fef2f2;
          color: #b91c1c;
        }

        .pr-notice {
          background: #ecfdf5;
          color: #047857;
        }

        @media (max-width: 1180px) {
          .pr-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .pr-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .pr-hero {
            border-radius: 22px;
            padding: 20px;
          }

          .pr-hero-content {
            flex-direction: column;
          }

          .pr-actions,
          .pr-btn {
            width: 100%;
          }

          .pr-summary-grid,
          .pr-fields {
            grid-template-columns: 1fr;
          }

          .pr-score-top {
            flex-direction: column;
          }
        }
      `}</style>

      <section className="pr-hero">
        <div className="pr-hero-content">
          <div>
            <div className="pr-kicker">
              <FileSignature size={16} />
              Performance Review
            </div>
            <h1>{review.employee_name || "Employee Review"}</h1>
            <p>
              GAS ID: {review.gas_id || "-"} · {review.project_name || "-"} ·{" "}
              {review.package_name || "No Package"} ·{" "}
              {String(review.review_type || "").replaceAll("_", " ")}
            </p>
          </div>

          <div className="pr-actions">
            <button className="pr-btn white" onClick={loadReview}>
              <RefreshCw size={17} />
              Refresh
            </button>
            <button className="pr-btn success" onClick={approveReview} disabled={saving}>
              <CheckCircle2 size={17} />
              Final Approve
            </button>
            <button className="pr-btn soft" onClick={lockReview} disabled={saving}>
              <ShieldCheck size={17} />
              Lock
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="pr-error">{error}</div> : null}
      {notice ? <div className="pr-notice">{notice}</div> : null}

      <section className="pr-summary-grid">
        <div className="pr-card">
          <p>Status</p>
          <strong>
            <StatusBadge status={review.status} />
          </strong>
        </div>
        <div className="pr-card">
          <p>Total Score</p>
          <strong>{numberValue(review.total_score || calculatedScore).toFixed(1)}%</strong>
        </div>
        <div className="pr-card">
          <p>Rating</p>
          <strong>{review.final_rating || "-"}</strong>
        </div>
        <div className="pr-card">
          <p>Total Weight</p>
          <strong>{totalWeight}%</strong>
        </div>
      </section>

      <section className="pr-layout">
        <main className="pr-panel">
          <div className="pr-panel-header">
            <div>
              <h2>Evaluation Criteria</h2>
              <p>Fill scores and comments based on your review stage.</p>
            </div>
            <ClipboardCheck size={22} />
          </div>

          <div className="pr-mode-tabs">
            <button
              className={`pr-tab ${mode === "employee" ? "active" : ""}`}
              onClick={() => setMode("employee")}
            >
              Employee Self Review
            </button>
            <button
              className={`pr-tab ${mode === "supervisor" ? "active" : ""}`}
              onClick={() => setMode("supervisor")}
            >
              Supervisor Review
            </button>
            <button
              className={`pr-tab ${mode === "hr" ? "active" : ""}`}
              onClick={() => setMode("hr")}
            >
              HR Review
            </button>
          </div>

          <div className="pr-score-list">
            {scores.map((item) => {
              const max = scoreMax(item.score_type);
              const scoreKey =
                mode === "employee"
                  ? "employee_score"
                  : mode === "supervisor"
                  ? "supervisor_score"
                  : "hr_score";

              const commentKey =
                mode === "employee"
                  ? "employee_comment"
                  : mode === "supervisor"
                  ? "supervisor_comment"
                  : "hr_comment";

              return (
                <div className="pr-score-item" key={item.id}>
                  <div className="pr-score-top">
                    <div className="pr-score-title">
                      <div className="pr-icon">
                        <Star size={18} />
                      </div>
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          Weight: {item.weight}% · {scoreLabel(item.score_type)}
                          {item.auto_score_key ? ` · Auto: ${item.auto_score_key}` : ""}
                        </span>
                      </div>
                    </div>

                    <span className="pr-pill">
                      {item.include_in_score ? "Included" : "Not Included"}
                    </span>
                  </div>

                  <div className="pr-fields">
                    {item.score_type === "text" ? (
                      <div className="pr-field">
                        <label>Score</label>
                        <input className="pr-input" value="Text only" disabled />
                      </div>
                    ) : item.score_type === "yes_no" ? (
                      <div className="pr-field">
                        <label>Score</label>
                        <select
                          className="pr-select"
                          value={item[scoreKey] ?? ""}
                          onChange={(e) =>
                            updateScoreRow(item.id, {
                              [scoreKey]: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        >
                          <option value="">Select</option>
                          <option value={1}>Yes</option>
                          <option value={0}>No</option>
                        </select>
                      </div>
                    ) : (
                      <div className="pr-field">
                        <label>Score / {max}</label>
                        <input
                          className="pr-input"
                          type="number"
                          min="0"
                          max={max}
                          value={item[scoreKey] ?? ""}
                          onChange={(e) =>
                            updateScoreRow(item.id, {
                              [scoreKey]: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    )}

                    <div className="pr-field">
                      <label>Comment</label>
                      <textarea
                        className="pr-textarea"
                        value={item[commentKey] || ""}
                        onChange={(e) =>
                          updateScoreRow(item.id, {
                            [commentKey]: e.target.value,
                          })
                        }
                        placeholder="Write review comment..."
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              className="pr-btn primary"
              disabled={saving}
              onClick={() => submitScores(mode)}
            >
              <Save size={17} />
              Save {mode === "employee" ? "Self" : mode === "hr" ? "HR" : "Supervisor"} Review
            </button>
          </div>
        </main>

        <aside className="pr-side-stack">
          <div className="pr-panel">
            <div className="pr-panel-header">
              <div>
                <h2>Recommendations</h2>
                <p>Promotion, salary increase, training, or warning.</p>
              </div>
              <ThumbsUp size={22} />
            </div>

            <div className="pr-side-body">
              <label className="pr-check">
                <input
                  type="checkbox"
                  checked={Boolean(recommendation?.recommend_promotion)}
                  onChange={(e) =>
                    updateRecommendationField("recommend_promotion", e.target.checked)
                  }
                />
                Recommend Promotion
              </label>

              <label className="pr-check">
                <input
                  type="checkbox"
                  checked={Boolean(recommendation?.recommend_salary_increase)}
                  onChange={(e) =>
                    updateRecommendationField(
                      "recommend_salary_increase",
                      e.target.checked
                    )
                  }
                />
                Recommend Salary Increase
              </label>

              <label className="pr-check">
                <input
                  type="checkbox"
                  checked={Boolean(recommendation?.training_required)}
                  onChange={(e) =>
                    updateRecommendationField("training_required", e.target.checked)
                  }
                />
                Training Required
              </label>

              <label className="pr-check">
                <input
                  type="checkbox"
                  checked={Boolean(recommendation?.warning_required)}
                  onChange={(e) =>
                    updateRecommendationField("warning_required", e.target.checked)
                  }
                />
                Warning Required
              </label>

              <label className="pr-check">
                <input
                  type="checkbox"
                  checked={Boolean(recommendation?.no_action)}
                  onChange={(e) =>
                    updateRecommendationField("no_action", e.target.checked)
                  }
                />
                No Action
              </label>

              <div className="pr-field">
                <label>Custom Training</label>
                <input
                  className="pr-input"
                  value={recommendation?.custom_training || ""}
                  onChange={(e) =>
                    updateRecommendationField("custom_training", e.target.value)
                  }
                  placeholder="Leadership, Safety, Excel..."
                />
              </div>

              <div className="pr-field">
                <label>Recommendation Notes</label>
                <textarea
                  className="pr-textarea"
                  value={recommendation?.recommendation_notes || ""}
                  onChange={(e) =>
                    updateRecommendationField(
                      "recommendation_notes",
                      e.target.value
                    )
                  }
                  placeholder="Write recommendation notes..."
                />
              </div>

              <button className="pr-btn primary" disabled={saving} onClick={saveRecommendation}>
                <Save size={17} />
                Save Recommendation
              </button>
            </div>
          </div>

          <div className="pr-panel">
            <div className="pr-panel-header">
              <div>
                <h2>Approval Control</h2>
                <p>Final approve or reject the evaluation.</p>
              </div>
              <Award size={22} />
            </div>

            <div className="pr-side-body">
              <div className="pr-field">
                <label>Reject Reason</label>
                <textarea
                  className="pr-textarea"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason if rejected..."
                />
              </div>

              <button className="pr-btn success" disabled={saving} onClick={approveReview}>
                <CheckCircle2 size={17} />
                Final Approve
              </button>

              <button className="pr-btn danger" disabled={saving} onClick={rejectReview}>
                <XCircle size={17} />
                Reject
              </button>
            </div>
          </div>

          <div className="pr-panel">
            <div className="pr-panel-header">
              <div>
                <h2>Comments</h2>
                <p>Review discussion and notes.</p>
              </div>
              <MessageSquare size={22} />
            </div>

            <div className="pr-side-body">
              {comments.length === 0 ? (
                <div className="pr-comment">No comments yet.</div>
              ) : (
                comments.map((item) => (
                  <div className="pr-comment" key={item.id}>
                    <strong>
                      {item.user_name || "User"} · {item.role_name || "-"}
                    </strong>
                    <p>{item.comment}</p>
                  </div>
                ))
              )}

              <div className="pr-field">
                <label>Add Comment</label>
                <textarea
                  className="pr-textarea"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write comment..."
                />
              </div>

              <button className="pr-btn primary" disabled={saving} onClick={addComment}>
                <Send size={17} />
                Add Comment
              </button>
            </div>
          </div>

          <div className="pr-panel">
            <div className="pr-panel-header">
              <div>
                <h2>Signatures</h2>
                <p>Electronic signatures for PDF and audit.</p>
              </div>
              <UserCheck size={22} />
            </div>

            <div className="pr-side-body">
              {signatures.length === 0 ? (
                <div className="pr-signature">No signatures yet.</div>
              ) : (
                signatures.map((item) => (
                  <div className="pr-signature" key={item.id}>
                    {item.signer_name || "Signer"} signed as {item.signer_role}
                  </div>
                ))
              )}

              <div className="pr-field">
                <label>Signature Text</label>
                <input
                  className="pr-input"
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  placeholder="Signed electronically"
                />
              </div>

              <button className="pr-btn primary" disabled={saving} onClick={signReview}>
                <FileSignature size={17} />
                Sign Review
              </button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
