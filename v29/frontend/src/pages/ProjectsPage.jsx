import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";

const emptyProjectForm = {
  name: "",
  code: "",
  initialPackageName: "",
  initialPackageCode: "",
};

const emptyPackageForm = {
  projectId: "",
  name: "",
  code: "",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [packageForm, setPackageForm] = useState(emptyPackageForm);

  const [editingProjectId, setEditingProjectId] = useState("");
  const [editingProjectForm, setEditingProjectForm] = useState({
    name: "",
    code: "",
    status: "active",
  });

  const [editingPackageId, setEditingPackageId] = useState("");
  const [editingPackageForm, setEditingPackageForm] = useState({
    name: "",
    code: "",
    status: "active",
  });

  const [loading, setLoading] = useState(true);
  const [submittingProject, setSubmittingProject] = useState(false);
  const [submittingPackage, setSubmittingPackage] = useState(false);
  const [savingProjectEdit, setSavingProjectEdit] = useState(false);
  const [savingPackageEdit, setSavingPackageEdit] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");
      setError("");

      const response = await apiFetch("/projects");

      const safeProjects = Array.isArray(response?.projects)
        ? response.projects.map((project) => ({
            ...project,
            id: String(project.id),
            packages: Array.isArray(project.packages)
              ? project.packages.map((pkg) => ({
                  ...pkg,
                  id: String(pkg.id),
                  projectId: String(pkg.projectId),
                }))
              : [],
          }))
        : [];

      setProjects(safeProjects);

      setPackageForm((current) => {
        const exists =
          current.projectId &&
          safeProjects.some((project) => project.id === current.projectId);

        return {
          ...current,
          projectId: exists ? current.projectId : "",
        };
      });
    } catch (err) {
      setProjects([]);
      setError(err.message || "فشل تحميل المشاريع والبكجات");
    } finally {
      setLoading(false);
    }
  }

  const packagesRows = useMemo(() => {
    return projects.flatMap((project) =>
      project.packages.map((pkg) => ({
        ...pkg,
        projectName: project.name,
      }))
    );
  }, [projects]);

  const totalProjects = projects.length;
  const totalPackages = packagesRows.length;
  const activeProjects = projects.filter(
    (project) => String(project.status || "active").toLowerCase() === "active"
  ).length;
  const activePackages = packagesRows.filter(
    (pkg) => String(pkg.status || "active").toLowerCase() === "active"
  ).length;

  async function handleCreateProject(event) {
    event.preventDefault();

    try {
      setSubmittingProject(true);
      setMessage("");
      setError("");

      const name = String(projectForm.name || "").trim();
      const code = String(projectForm.code || "").trim();
      const initialPackageName = String(projectForm.initialPackageName || "").trim();
      const initialPackageCode = String(projectForm.initialPackageCode || "").trim();

      if (!name) {
        setError("اكتب اسم المشروع");
        return;
      }

      if (!initialPackageName) {
        setError("اكتب اسم أول بكج مع المشروع");
        return;
      }

      const response = await apiFetch("/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          code: code || null,
          initialPackageName,
          initialPackageCode: initialPackageCode || null,
        }),
      });

      setProjectForm(emptyProjectForm);
      setMessage(response?.message || "تم إنشاء المشروع وأول بكج");
      await loadData();
    } catch (err) {
      setError(err.message || "فشل إنشاء المشروع");
    } finally {
      setSubmittingProject(false);
    }
  }

  async function handleCreatePackage(event) {
    event.preventDefault();

    try {
      setSubmittingPackage(true);
      setMessage("");
      setError("");

      const projectId = String(packageForm.projectId || "").trim();
      const name = String(packageForm.name || "").trim();
      const code = String(packageForm.code || "").trim();

      if (!projectId) {
        setError("اختر المشروع");
        return;
      }

      if (!name) {
        setError("اكتب اسم البكج");
        return;
      }

      const response = await apiFetch("/projects/packages", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          name,
          code: code || null,
        }),
      });

      setPackageForm({
        projectId,
        name: "",
        code: "",
      });

      setMessage(response?.message || "تم إنشاء البكج");
      await loadData();
    } catch (err) {
      setError(err.message || "فشل إنشاء البكج");
    } finally {
      setSubmittingPackage(false);
    }
  }

  function startEditProject(project) {
    setEditingProjectId(project.id);
    setEditingProjectForm({
      name: project.name || "",
      code: project.code || "",
      status: project.status || "active",
    });
    setMessage("");
    setError("");
  }

  async function saveProjectEdit(event) {
    event.preventDefault();

    try {
      setSavingProjectEdit(true);
      setMessage("");
      setError("");

      const response = await apiFetch(`/projects/${editingProjectId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editingProjectForm.name,
          code: editingProjectForm.code || null,
          status: editingProjectForm.status,
        }),
      });

      setEditingProjectId("");
      setEditingProjectForm({
        name: "",
        code: "",
        status: "active",
      });

      setMessage(response?.message || "تم تعديل المشروع");
      await loadData();
    } catch (err) {
      setError(err.message || "فشل تعديل المشروع");
    } finally {
      setSavingProjectEdit(false);
    }
  }

  async function deleteProject(project) {
    const confirmed = window.confirm(
      `هل تريد حذف المشروع "${project.name}"؟ سيتم حذف البكجات التابعة له أيضًا.`
    );
    if (!confirmed) return;

    try {
      setMessage("");
      setError("");

      const response = await apiFetch(`/projects/${project.id}`, {
        method: "DELETE",
      });

      if (editingProjectId === project.id) {
        setEditingProjectId("");
      }

      setMessage(response?.message || "تم حذف المشروع");
      await loadData();
    } catch (err) {
      setError(err.message || "فشل حذف المشروع");
    }
  }

  function startEditPackage(pkg) {
    setEditingPackageId(pkg.id);
    setEditingPackageForm({
      name: pkg.name || "",
      code: pkg.code || "",
      status: pkg.status || "active",
    });
    setMessage("");
    setError("");
  }

  async function savePackageEdit(event) {
    event.preventDefault();

    try {
      setSavingPackageEdit(true);
      setMessage("");
      setError("");

      const response = await apiFetch(`/projects/packages/${editingPackageId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editingPackageForm.name,
          code: editingPackageForm.code || null,
          status: editingPackageForm.status,
        }),
      });

      setEditingPackageId("");
      setEditingPackageForm({
        name: "",
        code: "",
        status: "active",
      });

      setMessage(response?.message || "تم تعديل البكج");
      await loadData();
    } catch (err) {
      setError(err.message || "فشل تعديل البكج");
    } finally {
      setSavingPackageEdit(false);
    }
  }

  async function deletePackage(pkg) {
    const confirmed = window.confirm(`هل تريد حذف البكج "${pkg.name}"؟`);
    if (!confirmed) return;

    try {
      setMessage("");
      setError("");

      const response = await apiFetch(`/projects/packages/${pkg.id}`, {
        method: "DELETE",
      });

      if (editingPackageId === pkg.id) {
        setEditingPackageId("");
      }

      setMessage(response?.message || "تم حذف البكج");
      await loadData();
    } catch (err) {
      setError(err.message || "فشل حذف البكج");
    }
  }

  if (loading) {
    return (
      <div className="page-stack projects-pro-page">
        <section className="pro-card loading-card">
          <h2>Loading...</h2>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack projects-pro-page">
      <style>{`
        .projects-pro-page {
          display: grid;
          gap: 20px;
        }

        .projects-pro-page .pro-card,
        .projects-pro-page .hero-main,
        .projects-pro-page .hero-side {
          border-radius: 28px;
          border: 1px solid rgba(226, 232, 240, 0.95);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(10px);
        }

        .projects-pro-page .loading-card {
          padding: 34px;
        }

        .projects-pro-page .hero-shell {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.95fr);
          gap: 18px;
        }

        .projects-pro-page .hero-main {
          padding: 28px;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          color: #fff;
          border: none;
        }

        .projects-pro-page .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 0.82rem;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
          margin-bottom: 14px;
        }

        .projects-pro-page .hero-main h1 {
          margin: 0 0 10px 0;
          font-size: 2.35rem;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: #fff;
        }

        .projects-pro-page .hero-main p {
          margin: 0;
          max-width: 760px;
          color: rgba(255, 255, 255, 0.84);
          line-height: 1.7;
          font-size: 0.98rem;
        }

        .projects-pro-page .hero-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .projects-pro-page .hero-kpi {
          border-radius: 20px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.14);
        }

        .projects-pro-page .hero-kpi .label {
          display: block;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.82rem;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .projects-pro-page .hero-kpi .value {
          font-size: 1.6rem;
          font-weight: 900;
          color: #fff;
          line-height: 1;
        }

        .projects-pro-page .hero-side {
          padding: 24px;
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .projects-pro-page .side-title {
          font-size: 1rem;
          font-weight: 900;
          color: #0f172a;
        }

        .projects-pro-page .side-stat {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 16px;
          padding: 14px 16px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
        }

        .projects-pro-page .side-stat span {
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 700;
        }

        .projects-pro-page .side-stat strong {
          color: #0f172a;
          font-size: 1rem;
          font-weight: 900;
        }

        .projects-pro-page .alert-pro {
          border-radius: 18px;
          padding: 14px 16px;
          font-weight: 800;
          font-size: 0.94rem;
        }

        .projects-pro-page .alert-pro.success {
          background: #ecfdf3;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .projects-pro-page .alert-pro.error {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        .projects-pro-page .grid-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .projects-pro-page .section-card {
          padding: 24px;
          min-width: 0;
        }

        .projects-pro-page .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .projects-pro-page .section-head h2 {
          margin: 0 0 6px 0;
          font-size: 1.25rem;
          font-weight: 900;
          color: #0f172a;
        }

        .projects-pro-page .section-head p {
          margin: 0;
          color: #64748b;
          font-size: 0.93rem;
        }

        .projects-pro-page .form-grid-pro {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .projects-pro-page .field-pro {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #344054;
          font-weight: 700;
        }

        .projects-pro-page .field-pro.full {
          grid-column: span 2;
        }

        .projects-pro-page .field-pro input,
        .projects-pro-page .field-pro select {
          min-height: 50px;
          width: 100%;
          border-radius: 16px;
          border: 1px solid #dbe2ea;
          padding: 0 14px;
          background: #fff;
          color: #0f172a;
          font-size: 0.95rem;
          box-sizing: border-box;
        }

        .projects-pro-page .field-pro input:focus,
        .projects-pro-page .field-pro select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
        }

        .projects-pro-page .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
          grid-column: span 2;
        }

        .projects-pro-page .btn-primary-strong,
        .projects-pro-page .btn-soft,
        .projects-pro-page .btn-danger {
          min-height: 46px;
          border: none;
          border-radius: 16px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 900;
          cursor: pointer;
          transition: transform 0.18s ease, opacity 0.2s ease;
        }

        .projects-pro-page .btn-primary-strong:hover,
        .projects-pro-page .btn-soft:hover,
        .projects-pro-page .btn-danger:hover {
          transform: translateY(-1px);
        }

        .projects-pro-page .btn-primary-strong {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 12px 28px rgba(37, 99, 235, 0.22);
        }

        .projects-pro-page .btn-soft {
          background: #eef4ff;
          color: #1d4ed8;
        }

        .projects-pro-page .btn-danger {
          background: #d92d20;
          color: #fff;
        }

        .projects-pro-page .table-card {
          padding: 24px;
          overflow: hidden;
        }

        .projects-pro-page .table-scroll {
          width: 100%;
          overflow-x: auto;
          margin-top: 16px;
        }

        .projects-pro-page table {
          width: 100%;
          min-width: 860px;
          border-collapse: separate;
          border-spacing: 0 10px;
        }

        .projects-pro-page thead th {
          text-align: left;
          font-size: 0.84rem;
          color: #64748b;
          font-weight: 900;
          padding: 0 12px 8px 12px;
        }

        .projects-pro-page tbody tr {
          background: #f8fafc;
        }

        .projects-pro-page tbody td {
          padding: 16px 12px;
          color: #0f172a;
          font-weight: 700;
          border-top: 1px solid #e9eef5;
          border-bottom: 1px solid #e9eef5;
          word-break: break-word;
        }

        .projects-pro-page tbody td:first-child {
          border-left: 1px solid #e9eef5;
          border-top-left-radius: 16px;
          border-bottom-left-radius: 16px;
        }

        .projects-pro-page tbody td:last-child {
          border-right: 1px solid #e9eef5;
          border-top-right-radius: 16px;
          border-bottom-right-radius: 16px;
        }

        .projects-pro-page .row-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .projects-pro-page .mini-btn {
          min-height: 36px;
          padding: 0 12px;
          border-radius: 12px;
          border: none;
          font-size: 0.84rem;
          font-weight: 900;
          cursor: pointer;
        }

        .projects-pro-page .mini-btn.edit {
          background: #eef4ff;
          color: #1d4ed8;
        }

        .projects-pro-page .mini-btn.delete {
          background: #fff1f2;
          color: #be123c;
        }

        .projects-pro-page .edit-box {
          margin-top: 18px;
          padding: 18px;
          border-radius: 20px;
          background: #f8fafc;
          border: 1px solid #eaecf0;
        }

        .projects-pro-page .edit-box h3 {
          margin: 0 0 14px 0;
          font-size: 1.05rem;
          color: #0f172a;
          font-weight: 900;
        }

        .projects-pro-page .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 0.76rem;
          font-weight: 900;
          background: #f2f4f7;
          color: #344054;
        }

        .projects-pro-page .status-badge.active {
          background: #ecfdf3;
          color: #067647;
        }

        .projects-pro-page .status-badge.inactive {
          background: #fef3f2;
          color: #b42318;
        }

        @media (max-width: 1200px) {
          .projects-pro-page .hero-shell,
          .projects-pro-page .grid-two {
            grid-template-columns: 1fr;
          }

          .projects-pro-page .hero-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .projects-pro-page .hero-main h1 {
            font-size: 2rem;
          }

          .projects-pro-page .hero-kpis,
          .projects-pro-page .form-grid-pro {
            grid-template-columns: 1fr;
          }

          .projects-pro-page .field-pro.full,
          .projects-pro-page .form-actions {
            grid-column: span 1;
          }
        }
      `}</style>

      <section className="hero-shell">
        <div className="hero-main">
          <div className="hero-badge">Projects Control Center</div>
          <h1>Projects & Packages</h1>
          <p>
            Create projects, add packages, manage current records,
            and control project/package structure from one place.
          </p>

          <div className="hero-kpis">
            <div className="hero-kpi">
              <span className="label">Projects</span>
              <strong className="value">{totalProjects}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Packages</span>
              <strong className="value">{totalPackages}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Active Projects</span>
              <strong className="value">{activeProjects}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Active Packages</span>
              <strong className="value">{activePackages}</strong>
            </div>
          </div>
        </div>

        <div className="hero-side">
          <div className="side-title">Current Snapshot</div>

          <div className="side-stat">
            <span>Projects</span>
            <strong>{totalProjects}</strong>
          </div>

          <div className="side-stat">
            <span>Packages</span>
            <strong>{totalPackages}</strong>
          </div>

          <div className="side-stat">
            <span>Editing Project</span>
            <strong>{editingProjectId || "-"}</strong>
          </div>

          <div className="side-stat">
            <span>Editing Package</span>
            <strong>{editingPackageId || "-"}</strong>
          </div>
        </div>
      </section>

      {message ? <div className="alert-pro success">{message}</div> : null}
      {error ? <div className="alert-pro error">{error}</div> : null}

      <section className="grid-two">
        <div className="pro-card section-card">
          <div className="section-head">
            <div>
              <h2>إنشاء مشروع جديد</h2>
              <p>لازم تضيف أول بكج مع المشروع في نفس الفورم.</p>
            </div>
          </div>

          <form className="form-grid-pro" onSubmit={handleCreateProject}>
            <label className="field-pro">
              اسم المشروع
              <input
                value={projectForm.name}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, name: e.target.value })
                }
                placeholder="مثال: Zuluf Project"
              />
            </label>

            <label className="field-pro">
              كود المشروع
              <input
                value={projectForm.code}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, code: e.target.value })
                }
                placeholder="اختياري"
              />
            </label>

            <label className="field-pro">
              اسم أول بكج
              <input
                value={projectForm.initialPackageName}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, initialPackageName: e.target.value })
                }
                placeholder="مثال: Package 01"
              />
            </label>

            <label className="field-pro">
              كود أول بكج
              <input
                value={projectForm.initialPackageCode}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, initialPackageCode: e.target.value })
                }
                placeholder="اختياري"
              />
            </label>

            <div className="form-actions">
              <button type="submit" disabled={submittingProject} className="btn-primary-strong">
                {submittingProject ? "جاري الإنشاء..." : "إنشاء المشروع مع أول بكج"}
              </button>
            </div>
          </form>
        </div>

        <div className="pro-card section-card">
          <div className="section-head">
            <div>
              <h2>إضافة بكج لمشروع موجود</h2>
              <p>اختر المشروع ثم أضف البكج الجديد.</p>
            </div>
          </div>

          <form className="form-grid-pro" onSubmit={handleCreatePackage}>
            <label className="field-pro full">
              المشروع
              <select
                value={packageForm.projectId}
                onChange={(e) =>
                  setPackageForm({
                    ...packageForm,
                    projectId: String(e.target.value || ""),
                  })
                }
              >
                <option value="">اختر مشروع</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-pro">
              اسم البكج
              <input
                value={packageForm.name}
                onChange={(e) =>
                  setPackageForm({ ...packageForm, name: e.target.value })
                }
                placeholder="مثال: Package 02"
              />
            </label>

            <label className="field-pro">
              كود البكج
              <input
                value={packageForm.code}
                onChange={(e) =>
                  setPackageForm({ ...packageForm, code: e.target.value })
                }
                placeholder="اختياري"
              />
            </label>

            <div className="form-actions">
              <button type="submit" disabled={submittingPackage} className="btn-primary-strong">
                {submittingPackage ? "جاري الإنشاء..." : "إضافة بكج"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="pro-card table-card">
        <div className="section-head">
          <div>
            <h2>المشاريع</h2>
            <p>عرض وتعديل وحذف المشاريع.</p>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>اسم المشروع</th>
                <th>الكود</th>
                <th>البكجات</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan="5">لا توجد مشاريع</td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id}>
                    <td>{project.name}</td>
                    <td>{project.code || "-"}</td>
                    <td>
                      {project.packages.length > 0
                        ? project.packages.map((pkg) => pkg.name).join("، ")
                        : "-"}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          String(project.status || "active").toLowerCase() === "active"
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {project.status || "active"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="mini-btn edit"
                          onClick={() => startEditProject(project)}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="mini-btn delete"
                          onClick={() => deleteProject(project)}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {editingProjectId ? (
          <div className="edit-box">
            <form className="form-grid-pro" onSubmit={saveProjectEdit}>
              <h3>تعديل المشروع</h3>

              <label className="field-pro">
                اسم المشروع
                <input
                  value={editingProjectForm.name}
                  onChange={(e) =>
                    setEditingProjectForm({ ...editingProjectForm, name: e.target.value })
                  }
                />
              </label>

              <label className="field-pro">
                كود المشروع
                <input
                  value={editingProjectForm.code}
                  onChange={(e) =>
                    setEditingProjectForm({ ...editingProjectForm, code: e.target.value })
                  }
                />
              </label>

              <label className="field-pro">
                الحالة
                <select
                  value={editingProjectForm.status}
                  onChange={(e) =>
                    setEditingProjectForm({ ...editingProjectForm, status: e.target.value })
                  }
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>

              <div className="form-actions">
                <button type="submit" disabled={savingProjectEdit} className="btn-primary-strong">
                  {savingProjectEdit ? "جاري الحفظ..." : "حفظ تعديل المشروع"}
                </button>
                <button
                  type="button"
                  className="btn-soft"
                  onClick={() => {
                    setEditingProjectId("");
                    setEditingProjectForm({ name: "", code: "", status: "active" });
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>

      <section className="pro-card table-card">
        <div className="section-head">
          <div>
            <h2>البكجات</h2>
            <p>عرض وتعديل وحذف البكجات.</p>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>اسم البكج</th>
                <th>الكود</th>
                <th>المشروع</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {packagesRows.length === 0 ? (
                <tr>
                  <td colSpan="5">لا توجد بكجات</td>
                </tr>
              ) : (
                packagesRows.map((pkg) => (
                  <tr key={pkg.id}>
                    <td>{pkg.name}</td>
                    <td>{pkg.code || "-"}</td>
                    <td>{pkg.projectName}</td>
                    <td>
                      <span
                        className={`status-badge ${
                          String(pkg.status || "active").toLowerCase() === "active"
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {pkg.status || "active"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="mini-btn edit"
                          onClick={() => startEditPackage(pkg)}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="mini-btn delete"
                          onClick={() => deletePackage(pkg)}
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {editingPackageId ? (
          <div className="edit-box">
            <form className="form-grid-pro" onSubmit={savePackageEdit}>
              <h3>تعديل البكج</h3>

              <label className="field-pro">
                اسم البكج
                <input
                  value={editingPackageForm.name}
                  onChange={(e) =>
                    setEditingPackageForm({ ...editingPackageForm, name: e.target.value })
                  }
                />
              </label>

              <label className="field-pro">
                كود البكج
                <input
                  value={editingPackageForm.code}
                  onChange={(e) =>
                    setEditingPackageForm({ ...editingPackageForm, code: e.target.value })
                  }
                />
              </label>

              <label className="field-pro">
                الحالة
                <select
                  value={editingPackageForm.status}
                  onChange={(e) =>
                    setEditingPackageForm({ ...editingPackageForm, status: e.target.value })
                  }
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>

              <div className="form-actions">
                <button type="submit" disabled={savingPackageEdit} className="btn-primary-strong">
                  {savingPackageEdit ? "جاري الحفظ..." : "حفظ تعديل البكج"}
                </button>
                <button
                  type="button"
                  className="btn-soft"
                  onClick={() => {
                    setEditingPackageId("");
                    setEditingPackageForm({ name: "", code: "", status: "active" });
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>
    </div>
  );
}