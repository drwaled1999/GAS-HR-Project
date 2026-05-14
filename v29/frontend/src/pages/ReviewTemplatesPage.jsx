import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  Award,
  CheckCircle2,
  Copy,
  Edit3,
  FileSignature,
  ListChecks,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { apiFetch } from "../services/api";

const REVIEW_TYPES = [
  { value: "annual", label: "Annual" },
  { value: "semi_annual", label: "Semi-Annual" },
  { value: "quarterly", label: "Quarterly" },
  { value: "probation", label: "Probation" },
  { value: "custom", label: "Custom" },
];

const SCORE_TYPES = [
  { value: "scale_1_5", label: "Scale 1 - 5" },
  { value: "scale_1_10", label: "Scale 1 - 10" },
  { value: "percentage", label: "Percentage" },
  { value: "yes_no", label: "Yes / No" },
  { value: "text", label: "Text Only" },
];

function emptyTemplateForm() {
  return {
    name: "",
    reviewType: "annual",
    description: "",
    allowSelfReview: true,
  };
}

function emptyItemForm() {
  return {
    title: "",
    description: "",
    weight: 0,
    scoreType: "scale_1_10",
    isRequired: true,
    includeInScore: true,
    visibleToEmployee: true,
    autoScoreKey: "",
    sortOrder: 0,
  };
}

function normalizeItems(template) {
  return Array.isArray(template?.items) ? template.items : [];
}

function StatusBadge({ status }) {
  return <span className={`rt-status ${status}`}>{status || "draft"}</span>;
}

export default function ReviewTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm());
  const [itemForm, setItemForm] = useState(emptyItemForm());
  const [editingItemId, setEditingItemId] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadTemplates() {
    try {
      setLoading(true);
      setError("");
      const res = await apiFetch("/performance/templates");
      const data = res.templates || [];
      setTemplates(data);

      if (selectedTemplate?.id) {
        const fresh = data.find((t) => t.id === selectedTemplate.id);
        setSelectedTemplate(fresh || null);
      } else if (!selectedTemplate && data[0]) {
        setSelectedTemplate(data[0]);
      }
    } catch (err) {
      setError(err.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return templates;

    return templates.filter((template) =>
      [
        template.name,
        template.review_type,
        template.description,
        template.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [templates, keyword]);

  const totalWeight = useMemo(() => {
    return normalizeItems(selectedTemplate)
      .filter((item) => item.includeInScore ?? item.include_in_score)
      .filter((item) => item.scoreType !== "text" && item.score_type !== "text")
      .reduce((sum, item) => sum + Number(item.weight || 0), 0);
  }, [selectedTemplate]);

  function showNotice(message) {
    setNotice(message);
    setTimeout(() => setNotice(""), 3500);
  }

  function selectTemplate(template) {
    setSelectedTemplate(template);
    setEditingItemId(null);
    setItemForm(emptyItemForm());
  }

  async function createTemplate(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      const res = await apiFetch("/performance/templates", {
        method: "POST",
        body: JSON.stringify(templateForm),
      });

      showNotice("Template created successfully");
      setTemplateForm(emptyTemplateForm());
      await loadTemplates();
      setSelectedTemplate(res.template);
    } catch (err) {
      setError(err.message || "Failed to create template");
    } finally {
      setSaving(false);
    }
  }

  async function updateTemplate() {
    if (!selectedTemplate?.id) return;

    try {
      setSaving(true);
      setError("");

      const res = await apiFetch(`/performance/templates/${selectedTemplate.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: selectedTemplate.name,
          reviewType: selectedTemplate.review_type,
          description: selectedTemplate.description,
          allowSelfReview: selectedTemplate.allow_self_review,
        }),
      });

      showNotice("Template updated successfully");
      await loadTemplates();
      setSelectedTemplate(res.template);
    } catch (err) {
      setError(err.message || "Failed to update template");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateTemplate(templateId) {
    try {
      setSaving(true);
      setError("");

      const res = await apiFetch(`/performance/templates/${templateId}/duplicate`, {
        method: "POST",
      });

      showNotice("Template duplicated successfully");
      await loadTemplates();
      setSelectedTemplate(res.template);
    } catch (err) {
      setError(err.message || "Failed to duplicate template");
    } finally {
      setSaving(false);
    }
  }

  async function updateTemplateStatus(templateId, status) {
    try {
      setSaving(true);
      setError("");

      await apiFetch(`/performance/templates/${templateId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      showNotice(`Template ${status} successfully`);
      await loadTemplates();
    } catch (err) {
      setError(err.message || "Failed to update template status");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(templateId) {
    const ok = window.confirm("Are you sure you want to delete/archive this template?");
    if (!ok) return;

    try {
      setSaving(true);
      setError("");

      await apiFetch(`/performance/templates/${templateId}`, {
        method: "DELETE",
      });

      showNotice("Template deleted or archived successfully");
      setSelectedTemplate(null);
      await loadTemplates();
    } catch (err) {
      setError(err.message || "Failed to delete template");
    } finally {
      setSaving(false);
    }
  }

  async function saveItem(e) {
    e.preventDefault();

    if (!selectedTemplate?.id) {
      setError("Select a template first");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...itemForm,
        weight: Number(itemForm.weight || 0),
        autoScoreKey: itemForm.autoScoreKey || null,
      };

      if (editingItemId) {
        await apiFetch(`/performance/template-items/${editingItemId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        showNotice("Item updated successfully");
      } else {
        await apiFetch(`/performance/templates/${selectedTemplate.id}/items`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        showNotice("Item added successfully");
      }

      setEditingItemId(null);
      setItemForm(emptyItemForm());
      await loadTemplates();
    } catch (err) {
      setError(err.message || "Failed to save item");
    } finally {
      setSaving(false);
    }
  }

  function editItem(item) {
    setEditingItemId(item.id);
    setItemForm({
      title: item.title || "",
      description: item.description || "",
      weight: item.weight || 0,
      scoreType: item.scoreType || item.score_type || "scale_1_10",
      isRequired: item.isRequired ?? item.is_required ?? true,
      includeInScore: item.includeInScore ?? item.include_in_score ?? true,
      visibleToEmployee:
        item.visibleToEmployee ?? item.visible_to_employee ?? true,
      autoScoreKey: item.autoScoreKey || item.auto_score_key || "",
      sortOrder: item.sortOrder ?? item.sort_order ?? 0,
    });
  }

  async function deleteItem(itemId) {
    const ok = window.confirm("Delete this item?");
    if (!ok) return;

    try {
      setSaving(true);
      setError("");

      await apiFetch(`/performance/template-items/${itemId}`, {
        method: "DELETE",
      });

      showNotice("Item deleted successfully");
      await loadTemplates();
    } catch (err) {
      setError(err.message || "Failed to delete item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="review-templates-page">
      <style>{`
        .review-templates-page {
          color: #0f172a;
        }

        .rt-hero {
          border-radius: 30px;
          padding: 26px;
          background:
            radial-gradient(circle at 90% 20%, rgba(34,197,94,.22), transparent 26%),
            linear-gradient(135deg, #0f172a, #1e3a8a);
          color: white;
          box-shadow: 0 24px 60px rgba(15,23,42,.22);
          margin-bottom: 18px;
          overflow: hidden;
          position: relative;
        }

        .rt-hero-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          position: relative;
          z-index: 1;
        }

        .rt-kicker {
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

        .rt-hero h1 {
          margin: 14px 0 8px;
          font-size: clamp(28px, 4vw, 42px);
          line-height: 1.05;
          font-weight: 950;
        }

        .rt-hero p {
          margin: 0;
          max-width: 760px;
          color: rgba(255,255,255,.78);
          line-height: 1.7;
        }

        .rt-btn {
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

        .rt-btn:hover {
          transform: translateY(-1px);
        }

        .rt-btn.primary {
          background: #2563eb;
          color: white;
        }

        .rt-btn.dark {
          background: #0f172a;
          color: white;
        }

        .rt-btn.white {
          background: white;
          color: #0f172a;
        }

        .rt-btn.soft {
          background: #f1f5f9;
          color: #0f172a;
        }

        .rt-btn.success {
          background: #16a34a;
          color: white;
        }

        .rt-btn.danger {
          background: #dc2626;
          color: white;
        }

        .rt-btn.warning {
          background: #f59e0b;
          color: #111827;
        }

        .rt-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
          transform: none;
        }

        .rt-layout {
          display: grid;
          grid-template-columns: 380px minmax(0, 1fr);
          gap: 18px;
        }

        .rt-panel {
          background: rgba(255,255,255,.95);
          border: 1px solid rgba(148,163,184,.22);
          border-radius: 28px;
          box-shadow: 0 18px 45px rgba(15,23,42,.08);
          overflow: hidden;
        }

        .rt-panel-header {
          padding: 18px 20px;
          border-bottom: 1px solid rgba(148,163,184,.18);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .rt-panel-header h2 {
          margin: 0;
          font-size: 18px;
          color: #0f172a;
        }

        .rt-panel-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .rt-form {
          padding: 16px;
          display: grid;
          gap: 12px;
        }

        .rt-field {
          display: grid;
          gap: 7px;
        }

        .rt-field label {
          font-size: 12px;
          color: #475569;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .04em;
        }

        .rt-input,
        .rt-select,
        .rt-textarea {
          width: 100%;
          border: 1px solid rgba(148,163,184,.35);
          background: white;
          border-radius: 15px;
          padding: 11px 12px;
          outline: none;
          color: #0f172a;
        }

        .rt-textarea {
          min-height: 86px;
          resize: vertical;
        }

        .rt-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .rt-check-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
        }

        .rt-check {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          border-radius: 14px;
          background: #f8fafc;
          border: 1px solid rgba(148,163,184,.18);
          font-size: 12px;
          color: #334155;
          font-weight: 800;
        }

        .rt-search-wrap {
          padding: 14px;
          border-bottom: 1px solid rgba(148,163,184,.15);
          position: relative;
        }

        .rt-search-wrap svg {
          position: absolute;
          left: 28px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }

        .rt-search {
          width: 100%;
          height: 42px;
          border-radius: 15px;
          border: 1px solid rgba(148,163,184,.35);
          padding: 0 12px 0 40px;
          outline: none;
        }

        .rt-list {
          padding: 12px;
          display: grid;
          gap: 10px;
          max-height: 650px;
          overflow: auto;
        }

        .rt-template-card {
          border: 1px solid rgba(148,163,184,.18);
          background: #f8fafc;
          border-radius: 20px;
          padding: 14px;
          cursor: pointer;
          transition: .2s ease;
        }

        .rt-template-card:hover,
        .rt-template-card.active {
          border-color: rgba(37,99,235,.45);
          background: #eff6ff;
        }

        .rt-template-top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
        }

        .rt-template-card strong {
          display: block;
          color: #0f172a;
          font-size: 14px;
        }

        .rt-template-card p {
          margin: 7px 0 0;
          color: #64748b;
          line-height: 1.5;
          font-size: 12px;
        }

        .rt-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }

        .rt-pill,
        .rt-status {
          display: inline-flex;
          align-items: center;
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          background: #e2e8f0;
          color: #334155;
          white-space: nowrap;
        }

        .rt-status.active {
          background: #dcfce7;
          color: #15803d;
        }

        .rt-status.draft {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .rt-status.archived {
          background: #f1f5f9;
          color: #64748b;
        }

        .rt-status.locked {
          background: #fef3c7;
          color: #b45309;
        }

        .rt-builder {
          display: grid;
          gap: 18px;
        }

        .rt-template-editor {
          padding: 18px;
          display: grid;
          gap: 12px;
        }

        .rt-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .rt-weight-card {
          margin: 0 18px 18px;
          padding: 14px;
          border-radius: 20px;
          border: 1px solid rgba(148,163,184,.18);
          background: #f8fafc;
        }

        .rt-weight-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .rt-weight-bar {
          height: 13px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
        }

        .rt-weight-bar div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #2563eb, #22c55e);
        }

        .rt-weight-warning {
          color: #b45309;
          margin-top: 8px;
          font-size: 12px;
          font-weight: 800;
        }

        .rt-items {
          padding: 0 18px 18px;
          display: grid;
          gap: 10px;
        }

        .rt-item-card {
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 20px;
          background: white;
          padding: 14px;
          display: grid;
          gap: 10px;
        }

        .rt-item-top {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }

        .rt-item-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rt-item-icon {
          width: 40px;
          height: 40px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          background: #eff6ff;
          color: #2563eb;
          flex: 0 0 auto;
        }

        .rt-item-title strong {
          display: block;
          color: #0f172a;
        }

        .rt-item-title span {
          display: block;
          color: #64748b;
          font-size: 12px;
          margin-top: 3px;
        }

        .rt-item-actions {
          display: flex;
          gap: 8px;
        }

        .rt-icon-btn {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          border: 0;
          display: grid;
          place-items: center;
          cursor: pointer;
          background: #f1f5f9;
          color: #0f172a;
        }

        .rt-icon-btn.danger {
          color: #dc2626;
          background: #fef2f2;
        }

        .rt-empty,
        .rt-loading,
        .rt-error,
        .rt-notice {
          padding: 20px;
          text-align: center;
          color: #64748b;
        }

        .rt-error {
          margin-bottom: 14px;
          border-radius: 18px;
          background: #fef2f2;
          color: #b91c1c;
          font-weight: 800;
        }

        .rt-notice {
          margin-bottom: 14px;
          border-radius: 18px;
          background: #ecfdf5;
          color: #047857;
          font-weight: 800;
        }

        @media (max-width: 1180px) {
          .rt-layout {
            grid-template-columns: 1fr;
          }

          .rt-list {
            max-height: none;
          }
        }

        @media (max-width: 720px) {
          .rt-hero {
            border-radius: 22px;
            padding: 20px;
          }

          .rt-hero-content {
            flex-direction: column;
            align-items: flex-start;
          }

          .rt-row,
          .rt-check-grid {
            grid-template-columns: 1fr;
          }

          .rt-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .rt-btn {
            width: 100%;
          }

          .rt-item-top {
            flex-direction: column;
          }

          .rt-item-actions {
            width: 100%;
          }

          .rt-icon-btn {
            flex: 1;
          }
        }
      `}</style>

      <section className="rt-hero">
        <div className="rt-hero-content">
          <div>
            <div className="rt-kicker">
              <FileSignature size={16} />
              HR Manager Builder
            </div>
            <h1>Review Templates</h1>
            <p>
              Create annual, quarterly, semi-annual, probation, and custom
              performance review templates with fully dynamic criteria, weights,
              score types, visibility, and auto-score rules.
            </p>
          </div>

          <button className="rt-btn white" onClick={loadTemplates}>
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>
      </section>

      {error ? <div className="rt-error">{error}</div> : null}
      {notice ? <div className="rt-notice">{notice}</div> : null}

      <section className="rt-layout">
        <aside className="rt-panel">
          <div className="rt-panel-header">
            <div>
              <h2>Templates</h2>
              <p>Select a template to edit its criteria.</p>
            </div>
            <Award size={22} />
          </div>

          <div className="rt-search-wrap">
            <Search size={16} />
            <input
              className="rt-search"
              placeholder="Search templates..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="rt-loading">Loading templates...</div>
          ) : (
            <div className="rt-list">
              {filteredTemplates.length === 0 ? (
                <div className="rt-empty">No templates found.</div>
              ) : (
                filteredTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    className={`rt-template-card ${
                      selectedTemplate?.id === template.id ? "active" : ""
                    }`}
                    onClick={() => selectTemplate(template)}
                  >
                    <div className="rt-template-top">
                      <div>
                        <strong>{template.name}</strong>
                        <p>{template.description || "No description"}</p>
                      </div>
                      <StatusBadge status={template.status} />
                    </div>

                    <div className="rt-meta">
                      <span className="rt-pill">
                        {String(template.review_type || "").replaceAll("_", " ")}
                      </span>
                      <span className="rt-pill">v{template.version || 1}</span>
                      <span className="rt-pill">
                        {normalizeItems(template).length} items
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </aside>

        <main className="rt-builder">
          <div className="rt-panel">
            <div className="rt-panel-header">
              <div>
                <h2>Create New Template</h2>
                <p>Build a new review template for HR Manager approval.</p>
              </div>
              <Plus size={22} />
            </div>

            <form className="rt-form" onSubmit={createTemplate}>
              <div className="rt-row">
                <div className="rt-field">
                  <label>Template Name</label>
                  <input
                    className="rt-input"
                    value={templateForm.name}
                    onChange={(e) =>
                      setTemplateForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Annual Review 2026"
                  />
                </div>

                <div className="rt-field">
                  <label>Review Type</label>
                  <select
                    className="rt-select"
                    value={templateForm.reviewType}
                    onChange={(e) =>
                      setTemplateForm((p) => ({
                        ...p,
                        reviewType: e.target.value,
                      }))
                    }
                  >
                    {REVIEW_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rt-field">
                <label>Description</label>
                <textarea
                  className="rt-textarea"
                  value={templateForm.description}
                  onChange={(e) =>
                    setTemplateForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe when and how this template should be used..."
                />
              </div>

              <label className="rt-check">
                <input
                  type="checkbox"
                  checked={templateForm.allowSelfReview}
                  onChange={(e) =>
                    setTemplateForm((p) => ({
                      ...p,
                      allowSelfReview: e.target.checked,
                    }))
                  }
                />
                Allow Employee Self Review
              </label>

              <button className="rt-btn primary" disabled={saving}>
                <Plus size={17} />
                Create Template
              </button>
            </form>
          </div>

          {selectedTemplate ? (
            <>
              <div className="rt-panel">
                <div className="rt-panel-header">
                  <div>
                    <h2>Template Settings</h2>
                    <p>Edit template details, activate, duplicate, or archive.</p>
                  </div>
                  <Settings2 size={22} />
                </div>

                <div className="rt-template-editor">
                  <div className="rt-row">
                    <div className="rt-field">
                      <label>Template Name</label>
                      <input
                        className="rt-input"
                        value={selectedTemplate.name || ""}
                        onChange={(e) =>
                          setSelectedTemplate((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="rt-field">
                      <label>Review Type</label>
                      <select
                        className="rt-select"
                        value={selectedTemplate.review_type || "annual"}
                        onChange={(e) =>
                          setSelectedTemplate((p) => ({
                            ...p,
                            review_type: e.target.value,
                          }))
                        }
                      >
                        {REVIEW_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rt-field">
                    <label>Description</label>
                    <textarea
                      className="rt-textarea"
                      value={selectedTemplate.description || ""}
                      onChange={(e) =>
                        setSelectedTemplate((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <label className="rt-check">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedTemplate.allow_self_review)}
                      onChange={(e) =>
                        setSelectedTemplate((p) => ({
                          ...p,
                          allow_self_review: e.target.checked,
                        }))
                      }
                    />
                    Allow Employee Self Review
                  </label>

                  <div className="rt-actions">
                    <button
                      className="rt-btn primary"
                      type="button"
                      disabled={saving}
                      onClick={updateTemplate}
                    >
                      <Save size={17} />
                      Save
                    </button>

                    <button
                      className="rt-btn success"
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        updateTemplateStatus(selectedTemplate.id, "active")
                      }
                    >
                      <CheckCircle2 size={17} />
                      Activate
                    </button>

                    <button
                      className="rt-btn warning"
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        updateTemplateStatus(selectedTemplate.id, "locked")
                      }
                    >
                      <Activity size={17} />
                      Lock
                    </button>

                    <button
                      className="rt-btn soft"
                      type="button"
                      disabled={saving}
                      onClick={() => duplicateTemplate(selectedTemplate.id)}
                    >
                      <Copy size={17} />
                      Duplicate
                    </button>

                    <button
                      className="rt-btn soft"
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        updateTemplateStatus(selectedTemplate.id, "archived")
                      }
                    >
                      <Archive size={17} />
                      Archive
                    </button>

                    <button
                      className="rt-btn danger"
                      type="button"
                      disabled={saving}
                      onClick={() => deleteTemplate(selectedTemplate.id)}
                    >
                      <Trash2 size={17} />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="rt-weight-card">
                  <div className="rt-weight-header">
                    <strong>Total Weight</strong>
                    <span className="rt-pill">{totalWeight}% / 100%</span>
                  </div>

                  <div className="rt-weight-bar">
                    <div style={{ width: `${Math.min(totalWeight, 100)}%` }} />
                  </div>

                  {Math.round(totalWeight) !== 100 ? (
                    <div className="rt-weight-warning">
                      Template cannot be activated until included scoring items
                      equal exactly 100%.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rt-panel">
                <div className="rt-panel-header">
                  <div>
                    <h2>{editingItemId ? "Edit Criterion" : "Add Criterion"}</h2>
                    <p>
                      HR Manager can add discipline, attendance, quality, safety,
                      or any custom item.
                    </p>
                  </div>
                  <ListChecks size={22} />
                </div>

                <form className="rt-form" onSubmit={saveItem}>
                  <div className="rt-row">
                    <div className="rt-field">
                      <label>Criterion Title</label>
                      <input
                        className="rt-input"
                        value={itemForm.title}
                        onChange={(e) =>
                          setItemForm((p) => ({
                            ...p,
                            title: e.target.value,
                          }))
                        }
                        placeholder="Discipline"
                      />
                    </div>

                    <div className="rt-field">
                      <label>Score Type</label>
                      <select
                        className="rt-select"
                        value={itemForm.scoreType}
                        onChange={(e) =>
                          setItemForm((p) => ({
                            ...p,
                            scoreType: e.target.value,
                          }))
                        }
                      >
                        {SCORE_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rt-row">
                    <div className="rt-field">
                      <label>Weight %</label>
                      <input
                        type="number"
                        className="rt-input"
                        value={itemForm.weight}
                        onChange={(e) =>
                          setItemForm((p) => ({
                            ...p,
                            weight: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="rt-field">
                      <label>Auto Score Key</label>
                      <select
                        className="rt-select"
                        value={itemForm.autoScoreKey}
                        onChange={(e) =>
                          setItemForm((p) => ({
                            ...p,
                            autoScoreKey: e.target.value,
                          }))
                        }
                      >
                        <option value="">Manual</option>
                        <option value="attendance">Attendance</option>
                        <option value="warnings">Warnings</option>
                      </select>
                    </div>
                  </div>

                  <div className="rt-field">
                    <label>Description</label>
                    <textarea
                      className="rt-textarea"
                      value={itemForm.description}
                      onChange={(e) =>
                        setItemForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Explain how this criterion should be evaluated..."
                    />
                  </div>

                  <div className="rt-check-grid">
                    <label className="rt-check">
                      <input
                        type="checkbox"
                        checked={itemForm.isRequired}
                        onChange={(e) =>
                          setItemForm((p) => ({
                            ...p,
                            isRequired: e.target.checked,
                          }))
                        }
                      />
                      Required
                    </label>

                    <label className="rt-check">
                      <input
                        type="checkbox"
                        checked={itemForm.includeInScore}
                        onChange={(e) =>
                          setItemForm((p) => ({
                            ...p,
                            includeInScore: e.target.checked,
                          }))
                        }
                      />
                      Include in Score
                    </label>

                    <label className="rt-check">
                      <input
                        type="checkbox"
                        checked={itemForm.visibleToEmployee}
                        onChange={(e) =>
                          setItemForm((p) => ({
                            ...p,
                            visibleToEmployee: e.target.checked,
                          }))
                        }
                      />
                      Visible to Employee
                    </label>
                  </div>

                  <div className="rt-actions">
                    <button className="rt-btn primary" disabled={saving}>
                      <Save size={17} />
                      {editingItemId ? "Update Item" : "Add Item"}
                    </button>

                    {editingItemId ? (
                      <button
                        type="button"
                        className="rt-btn soft"
                        onClick={() => {
                          setEditingItemId(null);
                          setItemForm(emptyItemForm());
                        }}
                      >
                        <X size={17} />
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="rt-items">
                  {normalizeItems(selectedTemplate).length === 0 ? (
                    <div className="rt-empty">No criteria added yet.</div>
                  ) : (
                    normalizeItems(selectedTemplate).map((item) => (
                      <div className="rt-item-card" key={item.id}>
                        <div className="rt-item-top">
                          <div className="rt-item-title">
                            <div className="rt-item-icon">
                              <ListChecks size={18} />
                            </div>
                            <div>
                              <strong>{item.title}</strong>
                              <span>
                                {item.description || "No description"}
                              </span>
                            </div>
                          </div>

                          <div className="rt-item-actions">
                            <button
                              className="rt-icon-btn"
                              type="button"
                              onClick={() => editItem(item)}
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              className="rt-icon-btn danger"
                              type="button"
                              onClick={() => deleteItem(item.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="rt-meta">
                          <span className="rt-pill">Weight: {item.weight}%</span>
                          <span className="rt-pill">
                            {String(item.scoreType || item.score_type || "").replaceAll(
                              "_",
                              " "
                            )}
                          </span>
                          {(item.autoScoreKey || item.auto_score_key) ? (
                            <span className="rt-pill">
                              Auto: {item.autoScoreKey || item.auto_score_key}
                            </span>
                          ) : (
                            <span className="rt-pill">Manual</span>
                          )}
                          <span className="rt-pill">
                            {(item.includeInScore ?? item.include_in_score)
                              ? "Included"
                              : "Not included"}
                          </span>
                          <span className="rt-pill">
                            {(item.visibleToEmployee ?? item.visible_to_employee)
                              ? "Visible"
                              : "Hidden"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="rt-panel">
              <div className="rt-empty">
                Select or create a template to start building criteria.
              </div>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
