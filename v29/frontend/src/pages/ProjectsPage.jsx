import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../services/api";

const emptyProjectForm = {
  name: "",
  code: "",
  managerId: "",
  initialPackageName: "",
  initialPackageCode: "",
  initialPackageManagerId: "",
};

const emptyPackageForm = {
  projectId: "",
  name: "",
  code: "",
  managerId: "",
};

function normalizeUsersResponse(response) {
  const list = Array.isArray(response) ? response : response?.users || response?.employees || [];

  return list
    .map((user) => ({
      id: String(user.id || user.userId || ""),
      name: user.name || user.full_name || user.fullName || user.username || "-",
      username: user.username || "",
      role: user.role || user.roleName || user.roleCode || "",
    }))
    .filter((user) => user.id);
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [archivedProjects, setArchivedProjects] = useState([]);
  const [archivedPackages, setArchivedPackages] = useState([]);
  const [users, setUsers] = useState([]);

  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [packageForm, setPackageForm] = useState(emptyPackageForm);

  const [editingProjectId, setEditingProjectId] = useState("");
  const [editingProjectForm, setEditingProjectForm] = useState({
    name: "",
    code: "",
    managerId: "",
    status: "active",
  });

  const [editingPackageId, setEditingPackageId] = useState("");
  const [editingPackageForm, setEditingPackageForm] = useState({
    name: "",
    code: "",
    managerId: "",
    status: "active",
  });

  const [activeView, setActiveView] = useState("active");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [submittingProject, setSubmittingProject] = useState(false);
  const [submittingPackage, setSubmittingPackage] = useState(false);
  const [savingProjectEdit, setSavingProjectEdit] = useState(false);
  const [savingPackageEdit, setSavingPackageEdit] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    await Promise.all([loadUsers(), loadData(), loadArchived()]);
  }

  async function loadUsers() {
    try {
      const response = await apiFetch("/users");
      setUsers(normalizeUsersResponse(response));
    } catch (err) {
      console.error("Load users error:", err);
      setUsers([]);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setMessage("");
      setError("");

      const response = await apiFetch("/projects");

      const safeProjects = Array.isArray(response?.projects)
        ? response.projects
            .map((project) => ({
              ...project,
              id: String(project.id),
              managerId: project.managerId || "",
              managerName: project.managerName || "-",
              status: project.status || "active",
              packages: Array.isArray(project.packages)
                ? project.packages.map((pkg) => ({
                    ...pkg,
                    id: String(pkg.id),
                    projectId: String(pkg.projectId),
                    managerId: pkg.managerId || "",
                    managerName: pkg.managerName || "-",
                    status: pkg.status || "active",
                  }))
                : [],
            }))
            .filter((project) => String(project.status || "active").toLowerCase() === "active")
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

  async function loadArchived() {
    try {
      setArchiveLoading(true);

      const response = await apiFetch("/projects/archived");

      setArchivedProjects(
        Array.isArray(response?.projects)
          ? response.projects.map((project) => ({
              ...project,
              id: String(project.id),
              managerId: project.managerId || "",
              managerName: project.managerName || "-",
            }))
          : []
      );

      setArchivedPackages(
        Array.isArray(response?.packages)
          ? response.packages.map((pkg) => ({
              ...pkg,
              id: String(pkg.id),
              projectId: String(pkg.projectId || pkg.project_id || ""),
              projectName: pkg.projectName || pkg.project_name || "-",
              managerId: pkg.managerId || "",
              managerName: pkg.managerName || "-",
            }))
          : []
      );
    } catch (err) {
      console.error("Load archived error:", err);
    } finally {
      setArchiveLoading(false);
    }
  }

  const packagesRows = useMemo(() => {
    return projects.flatMap((project) =>
      project.packages
        .filter((pkg) => String(pkg.status || "active").toLowerCase() === "active")
        .map((pkg) => ({
          ...pkg,
          projectName: project.name,
        }))
    );
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;

    return projects.filter((project) =>
      [
        project.name,
        project.code,
        project.managerName,
        ...project.packages.map((pkg) => pkg.name),
        ...project.packages.map((pkg) => pkg.managerName),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [projects, search]);

  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packagesRows;

    return packagesRows.filter((pkg) =>
      [pkg.name, pkg.code, pkg.projectName, pkg.managerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [packagesRows, search]);

  const filteredArchivedProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return archivedProjects;

    return archivedProjects.filter((project) =>
      [project.name, project.code, project.managerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [archivedProjects, search]);

  const filteredArchivedPackages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return archivedPackages;

    return archivedPackages.filter((pkg) =>
      [pkg.name, pkg.code, pkg.projectName, pkg.managerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [archivedPackages, search]);

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
          managerId: projectForm.managerId || null,
          initialPackageName,
          initialPackageCode: initialPackageCode || null,
          packageManagerId: projectForm.initialPackageManagerId || projectForm.managerId || null,
        }),
      });

      setProjectForm(emptyProjectForm);
      setMessage(response?.message || "تم إنشاء المشروع وأول بكج");
      await Promise.all([loadData(), loadArchived()]);
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
          managerId: packageForm.managerId || null,
        }),
      });

      setPackageForm({
        projectId,
        name: "",
        code: "",
        managerId: "",
      });

      setMessage(response?.message || "تم إنشاء البكج");
      await Promise.all([loadData(), loadArchived()]);
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
      managerId: project.managerId || "",
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
          managerId: editingProjectForm.managerId || null,
          status: editingProjectForm.status,
        }),
      });

      setEditingProjectId("");
      setEditingProjectForm({
        name: "",
        code: "",
        managerId: "",
        status: "active",
      });

      setMessage(response?.message || "تم تعديل المشروع");
      await Promise.all([loadData(), loadArchived()]);
    } catch (err) {
      setError(err.message || "فشل تعديل المشروع");
    } finally {
      setSavingProjectEdit(false);
    }
  }

  async function archiveProject(project) {
    const confirmed = window.confirm(
      `هل تريد أرشفة المشروع "${project.name}"؟ سيتم أرشفة البكجات التابعة له أيضًا.`
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

      setMessage(response?.message || "تم أرشفة المشروع");
      await Promise.all([loadData(), loadArchived()]);
    } catch (err) {
      setError(err.message || "فشل أرشفة المشروع");
    }
  }

  async function restoreProject(project) {
    const confirmed = window.confirm(`هل تريد استرجاع المشروع "${project.name}"؟`);
    if (!confirmed) return;

    try {
      setMessage("");
      setError("");

      const response = await apiFetch(`/projects/${project.id}/restore`, {
        method: "PUT",
      });

      setMessage(response?.message || "تم استرجاع المشروع");
      await Promise.all([loadData(), loadArchived()]);
    } catch (err) {
      setError(err.message || "فشل استرجاع المشروع");
    }
  }

  function startEditPackage(pkg) {
    setEditingPackageId(pkg.id);
    setEditingPackageForm({
      name: pkg.name || "",
      code: pkg.code || "",
      managerId: pkg.managerId || "",
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
          managerId: editingPackageForm.managerId || null,
          status: editingPackageForm.status,
        }),
      });

      setEditingPackageId("");
      setEditingPackageForm({
        name: "",
        code: "",
        managerId: "",
        status: "active",
      });

      setMessage(response?.message || "تم تعديل البكج");
      await Promise.all([loadData(), loadArchived()]);
    } catch (err) {
      setError(err.message || "فشل تعديل البكج");
    } finally {
      setSavingPackageEdit(false);
    }
  }

  async function archivePackage(pkg) {
    const confirmed = window.confirm(`هل تريد أرشفة البكج "${pkg.name}"؟`);

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

      setMessage(response?.message || "تم أرشفة البكج");
      await Promise.all([loadData(), loadArchived()]);
    } catch (err) {
      setError(err.message || "فشل أرشفة البكج");
    }
  }

  async function restorePackage(pkg) {
    const confirmed = window.confirm(`هل تريد استرجاع البكج "${pkg.name}"؟`);
    if (!confirmed) return;

    try {
      setMessage("");
      setError("");

      const response = await apiFetch(`/projects/packages/${pkg.id}/restore`, {
        method: "PUT",
      });

      setMessage(response?.message || "تم استرجاع البكج");
      await Promise.all([loadData(), loadArchived()]);
    } catch (err) {
      setError(err.message || "فشل استرجاع البكج");
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
          gap: 22px;
          width: 100%;
          max-width: 100%;
        }

        .projects-pro-page * {
          box-sizing: border-box;
        }

        .projects-pro-page .pro-card,
        .projects-pro-page .hero-main,
        .projects-pro-page .hero-side {
          border-radius: 30px;
          border: 1px solid rgba(226, 232, 240, 0.9);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(14px);
        }

        .projects-pro-page .hero-shell {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.9fr);
          gap: 20px;
        }

        .projects-pro-page .hero-main {
          position: relative;
          overflow: hidden;
          padding: 34px;
          background:
            radial-gradient(circle at top right, rgba(59,130,246,.35), transparent 35%),
            linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e3a8a 100%);
          color: #fff;
          border: none;
        }

        .projects-pro-page .hero-main::after {
          content: "";
          position: absolute;
          width: 280px;
          height: 280px;
          right: -80px;
          bottom: -120px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
        }

        .projects-pro-page .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 9px 15px;
          font-size: 0.82rem;
          font-weight: 900;
          background: rgba(255,255,255,.14);
          color: #fff;
          margin-bottom: 16px;
        }

        .projects-pro-page .hero-main h1 {
          margin: 0 0 12px 0;
          font-size: 2.55rem;
          font-weight: 950;
          letter-spacing: -0.04em;
          color: #fff;
        }

        .projects-pro-page .hero-main p {
          margin: 0;
          max-width: 780px;
          color: rgba(255,255,255,.82);
          line-height: 1.8;
          font-size: 1rem;
        }

        .projects-pro-page .hero-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-top: 24px;
        }

        .projects-pro-page .hero-kpi {
          border-radius: 22px;
          padding: 18px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.15);
        }

        .projects-pro-page .hero-kpi .label {
          display: block;
          color: rgba(255,255,255,.75);
          font-size: .82rem;
          font-weight: 800;
          margin-bottom: 10px;
        }

        .projects-pro-page .hero-kpi .value {
          font-size: 1.75rem;
          font-weight: 950;
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
          font-size: 1.05rem;
          font-weight: 950;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .projects-pro-page .side-stat {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 15px 16px;
          border-radius: 18px;
          background: #f8fafc;
          border: 1px solid #edf2f7;
        }

        .projects-pro-page .side-stat span {
          color: #64748b;
          font-size: .9rem;
          font-weight: 800;
        }

        .projects-pro-page .side-stat strong {
          color: #0f172a;
          font-size: 1.02rem;
          font-weight: 950;
        }

        .projects-pro-page .alert-pro {
          border-radius: 18px;
          padding: 14px 16px;
          font-weight: 850;
          font-size: .94rem;
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

        .projects-pro-page .toolbar-card {
          padding: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .projects-pro-page .tabs-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .projects-pro-page .tab-btn {
          min-height: 42px;
          border-radius: 999px;
          border: 1px solid #dbe2ea;
          background: #fff;
          color: #334155;
          padding: 0 16px;
          font-weight: 950;
          cursor: pointer;
        }

        .projects-pro-page .tab-btn.active {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }

        .projects-pro-page .search-box {
          min-height: 46px;
          border-radius: 999px;
          border: 1px solid #dbe2ea;
          padding: 0 16px;
          min-width: 280px;
          font-weight: 800;
          color: #0f172a;
        }

        .projects-pro-page .search-box:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37,99,235,.09);
        }

        .projects-pro-page .grid-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .projects-pro-page .section-card,
        .projects-pro-page .table-card {
          padding: 24px;
        }

        .projects-pro-page .section-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .projects-pro-page .section-head h2 {
          margin: 0 0 6px 0;
          font-size: 1.28rem;
          font-weight: 950;
          color: #0f172a;
        }

        .projects-pro-page .section-head p {
          margin: 0;
          color: #64748b;
          font-size: .93rem;
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
          font-weight: 800;
        }

        .projects-pro-page .field-pro.full {
          grid-column: span 2;
        }

        .projects-pro-page .field-pro input,
        .projects-pro-page .field-pro select {
          min-height: 52px;
          width: 100%;
          border-radius: 17px;
          border: 1px solid #dbe2ea;
          padding: 0 14px;
          background: #fff;
          color: #0f172a;
          font-size: .95rem;
        }

        .projects-pro-page .field-pro input:focus,
        .projects-pro-page .field-pro select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 4px rgba(37,99,235,.09);
        }

        .projects-pro-page .form-actions {
          grid-column: span 2;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
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
          font-size: .9rem;
          font-weight: 950;
          cursor: pointer;
          transition: transform .18s ease, opacity .2s ease, box-shadow .2s ease;
        }

        .projects-pro-page .btn-primary-strong:hover,
        .projects-pro-page .btn-soft:hover,
        .projects-pro-page .btn-danger:hover {
          transform: translateY(-1px);
        }

        .projects-pro-page .btn-primary-strong {
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          box-shadow: 0 14px 30px rgba(37,99,235,.24);
        }

        .projects-pro-page .btn-soft {
          background: #eef4ff;
          color: #1d4ed8;
        }

        .projects-pro-page .btn-danger {
          background: #d92d20;
          color: #fff;
        }

        .projects-pro-page .projects-grid,
        .projects-pro-page .packages-grid,
        .projects-pro-page .archive-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
          gap: 18px;
          margin-top: 18px;
        }

        .projects-pro-page .dash-card {
          position: relative;
          overflow: hidden;
          border-radius: 26px;
          padding: 20px;
          background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e5eaf2;
          box-shadow: 0 14px 35px rgba(15, 23, 42, .06);
          transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
        }

        .projects-pro-page .dash-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 24px 55px rgba(15, 23, 42, .11);
          border-color: #bfdbfe;
        }

        .projects-pro-page .dash-card-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }

        .projects-pro-page .dash-card h3 {
          margin: 0;
          color: #0f172a;
          font-size: 1.14rem;
          font-weight: 950;
          line-height: 1.35;
        }

        .projects-pro-page .dash-sub {
          margin-top: 6px;
          color: #64748b;
          font-size: .86rem;
          font-weight: 750;
        }

        .projects-pro-page .manager-chip {
          margin-top: 14px;
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 8px 12px;
          font-size: .82rem;
          font-weight: 900;
        }

        .projects-pro-page .pkg-list {
          margin-top: 14px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .projects-pro-page .pkg-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 7px 11px;
          background: #eef2ff;
          color: #3730a3;
          font-size: .78rem;
          font-weight: 900;
        }

        .projects-pro-page .pkg-more {
          background: #e2e8f0;
          color: #334155;
        }

        .projects-pro-page .dash-actions {
          margin-top: 16px;
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .projects-pro-page .mini-btn {
          min-height: 38px;
          padding: 0 13px;
          border-radius: 13px;
          border: none;
          font-size: .84rem;
          font-weight: 950;
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

        .projects-pro-page .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: .76rem;
          font-weight: 950;
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

        .projects-pro-page .edit-box {
          margin-top: 18px;
          padding: 20px;
          border-radius: 22px;
          background: #f8fafc;
          border: 1px solid #eaecf0;
        }

        .projects-pro-page .edit-box h3 {
          margin: 0 0 14px 0;
          font-size: 1.06rem;
          color: #0f172a;
          font-weight: 950;
        }

        .projects-pro-page .empty-state {
          padding: 28px;
          border-radius: 22px;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          color: #64748b;
          font-weight: 900;
          text-align: center;
        }

        .projects-pro-page .loading-card {
          padding: 34px;
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
          .projects-pro-page .hero-main {
            padding: 24px;
          }

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

          .projects-pro-page .projects-grid,
          .projects-pro-page .packages-grid,
          .projects-pro-page .archive-grid {
            grid-template-columns: 1fr;
          }

          .projects-pro-page .search-box {
            width: 100%;
            min-width: 0;
          }
        }
      `}</style>

      <section className="hero-shell">
        <div className="hero-main">
          <div className="hero-badge">Projects Command Center</div>
          <h1>Projects & Packages</h1>
          <p>
            Manage project structure, packages, assigned managers, active records,
            archived data, and access-controlled operations from one executive dashboard.
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
              <span className="label">Archived Projects</span>
              <strong className="value">{archivedProjects.length}</strong>
            </div>
            <div className="hero-kpi">
              <span className="label">Archived Packages</span>
              <strong className="value">{archivedPackages.length}</strong>
            </div>
          </div>
        </div>

        <div className="hero-side">
          <div className="side-title">Current Snapshot</div>

          <div className="side-stat">
            <span>Active Projects</span>
            <strong>{activeProjects}</strong>
          </div>

          <div className="side-stat">
            <span>Active Packages</span>
            <strong>{activePackages}</strong>
          </div>

          <div className="side-stat">
            <span>Managers Loaded</span>
            <strong>{users.length}</strong>
          </div>

          <div className="side-stat">
            <span>View Mode</span>
            <strong>{activeView === "active" ? "Active" : "Archived"}</strong>
          </div>
        </div>
      </section>

      {message ? <div className="alert-pro success">{message}</div> : null}
      {error ? <div className="alert-pro error">{error}</div> : null}

      <section className="pro-card toolbar-card">
        <div className="tabs-row">
          <button
            type="button"
            className={`tab-btn ${activeView === "active" ? "active" : ""}`}
            onClick={() => setActiveView("active")}
          >
            Active Projects
          </button>
          <button
            type="button"
            className={`tab-btn ${activeView === "archived" ? "active" : ""}`}
            onClick={() => setActiveView("archived")}
          >
            Archived
          </button>
        </div>

        <input
          className="search-box"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search project, package, manager..."
        />
      </section>

      {activeView === "active" ? (
        <>
          <section className="grid-two">
            <div className="pro-card section-card">
              <div className="section-head">
                <div>
                  <h2>إنشاء مشروع جديد</h2>
                  <p>اختر مسؤول المشروع ومسؤول أول بكج.</p>
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

                <label className="field-pro full">
                  مسؤول المشروع
                  <select
                    value={projectForm.managerId}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, managerId: e.target.value })
                    }
                  >
                    <option value="">بدون مسؤول</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} {user.username ? `(@${user.username})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-pro">
                  اسم أول بكج
                  <input
                    value={projectForm.initialPackageName}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        initialPackageName: e.target.value,
                      })
                    }
                    placeholder="مثال: Package 01"
                  />
                </label>

                <label className="field-pro">
                  كود أول بكج
                  <input
                    value={projectForm.initialPackageCode}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        initialPackageCode: e.target.value,
                      })
                    }
                    placeholder="اختياري"
                  />
                </label>

                <label className="field-pro full">
                  مسؤول أول بكج
                  <select
                    value={projectForm.initialPackageManagerId}
                    onChange={(e) =>
                      setProjectForm({
                        ...projectForm,
                        initialPackageManagerId: e.target.value,
                      })
                    }
                  >
                    <option value="">نفس مسؤول المشروع أو بدون مسؤول</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} {user.username ? `(@${user.username})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="form-actions">
                  <button
                    type="submit"
                    disabled={submittingProject}
                    className="btn-primary-strong"
                  >
                    {submittingProject ? "جاري الإنشاء..." : "إنشاء المشروع مع أول بكج"}
                  </button>
                </div>
              </form>
            </div>

            <div className="pro-card section-card">
              <div className="section-head">
                <div>
                  <h2>إضافة بكج لمشروع موجود</h2>
                  <p>اختر المشروع والمسؤول عن البكج.</p>
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

                <label className="field-pro full">
                  مسؤول البكج
                  <select
                    value={packageForm.managerId}
                    onChange={(e) =>
                      setPackageForm({ ...packageForm, managerId: e.target.value })
                    }
                  >
                    <option value="">بدون مسؤول</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} {user.username ? `(@${user.username})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="form-actions">
                  <button
                    type="submit"
                    disabled={submittingPackage}
                    className="btn-primary-strong"
                  >
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
                <p>Dashboard view للمشاريع مع المسؤول والبكجات والإجراءات.</p>
              </div>
            </div>

            <div className="projects-grid">
              {filteredProjects.length === 0 ? (
                <div className="empty-state">لا توجد مشاريع</div>
              ) : (
                filteredProjects.map((project) => (
                  <article key={project.id} className="dash-card">
                    <div className="dash-card-top">
                      <div>
                        <h3>{project.name}</h3>
                        <div className="dash-sub">Code: {project.code || "-"}</div>
                      </div>

                      <span
                        className={`status-badge ${
                          String(project.status || "active").toLowerCase() === "active"
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {project.status || "active"}
                      </span>
                    </div>

                    <div className="manager-chip">👤 {project.managerName || "-"}</div>

                    <div className="pkg-list" title={project.packages.map((pkg) => pkg.name).join("، ")}>
                      {project.packages.length === 0 ? (
                        <span className="pkg-badge pkg-more">No Packages</span>
                      ) : (
                        project.packages.slice(0, 4).map((pkg) => (
                          <span key={pkg.id} className="pkg-badge">
                            {pkg.name}
                          </span>
                        ))
                      )}

                      {project.packages.length > 4 ? (
                        <span className="pkg-badge pkg-more">
                          +{project.packages.length - 4}
                        </span>
                      ) : null}
                    </div>

                    <div className="dash-actions">
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
                        onClick={() => archiveProject(project)}
                      >
                        أرشفة
                      </button>
                    </div>
                  </article>
                ))
              )}
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
                        setEditingProjectForm({
                          ...editingProjectForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="field-pro">
                    كود المشروع
                    <input
                      value={editingProjectForm.code}
                      onChange={(e) =>
                        setEditingProjectForm({
                          ...editingProjectForm,
                          code: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="field-pro">
                    مسؤول المشروع
                    <select
                      value={editingProjectForm.managerId}
                      onChange={(e) =>
                        setEditingProjectForm({
                          ...editingProjectForm,
                          managerId: e.target.value,
                        })
                      }
                    >
                      <option value="">بدون مسؤول</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} {user.username ? `(@${user.username})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-pro">
                    الحالة
                    <select
                      value={editingProjectForm.status}
                      onChange={(e) =>
                        setEditingProjectForm({
                          ...editingProjectForm,
                          status: e.target.value,
                        })
                      }
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </label>

                  <div className="form-actions">
                    <button
                      type="submit"
                      disabled={savingProjectEdit}
                      className="btn-primary-strong"
                    >
                      {savingProjectEdit ? "جاري الحفظ..." : "حفظ تعديل المشروع"}
                    </button>

                    <button
                      type="button"
                      className="btn-soft"
                      onClick={() => {
                        setEditingProjectId("");
                        setEditingProjectForm({
                          name: "",
                          code: "",
                          managerId: "",
                          status: "active",
                        });
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
                <p>Dashboard view للبكجات حسب المشروع والمسؤول.</p>
              </div>
            </div>

            <div className="packages-grid">
              {filteredPackages.length === 0 ? (
                <div className="empty-state">لا توجد بكجات</div>
              ) : (
                filteredPackages.map((pkg) => (
                  <article key={pkg.id} className="dash-card">
                    <div className="dash-card-top">
                      <div>
                        <h3>{pkg.name}</h3>
                        <div className="dash-sub">Code: {pkg.code || "-"}</div>
                        <div className="dash-sub">Project: {pkg.projectName || "-"}</div>
                      </div>

                      <span
                        className={`status-badge ${
                          String(pkg.status || "active").toLowerCase() === "active"
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {pkg.status || "active"}
                      </span>
                    </div>

                    <div className="manager-chip">👤 {pkg.managerName || "-"}</div>

                    <div className="dash-actions">
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
                        onClick={() => archivePackage(pkg)}
                      >
                        أرشفة
                      </button>
                    </div>
                  </article>
                ))
              )}
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
                        setEditingPackageForm({
                          ...editingPackageForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="field-pro">
                    كود البكج
                    <input
                      value={editingPackageForm.code}
                      onChange={(e) =>
                        setEditingPackageForm({
                          ...editingPackageForm,
                          code: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="field-pro">
                    مسؤول البكج
                    <select
                      value={editingPackageForm.managerId}
                      onChange={(e) =>
                        setEditingPackageForm({
                          ...editingPackageForm,
                          managerId: e.target.value,
                        })
                      }
                    >
                      <option value="">بدون مسؤول</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} {user.username ? `(@${user.username})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-pro">
                    الحالة
                    <select
                      value={editingPackageForm.status}
                      onChange={(e) =>
                        setEditingPackageForm({
                          ...editingPackageForm,
                          status: e.target.value,
                        })
                      }
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </label>

                  <div className="form-actions">
                    <button
                      type="submit"
                      disabled={savingPackageEdit}
                      className="btn-primary-strong"
                    >
                      {savingPackageEdit ? "جاري الحفظ..." : "حفظ تعديل البكج"}
                    </button>

                    <button
                      type="button"
                      className="btn-soft"
                      onClick={() => {
                        setEditingPackageId("");
                        setEditingPackageForm({
                          name: "",
                          code: "",
                          managerId: "",
                          status: "active",
                        });
                      }}
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <>
          <section className="pro-card table-card">
            <div className="section-head">
              <div>
                <h2>Archived Projects</h2>
                <p>المشاريع المؤرشفة ويمكن استرجاعها حسب الصلاحية.</p>
              </div>
              {archiveLoading ? <p>Loading archive...</p> : null}
            </div>

            <div className="archive-grid">
              {filteredArchivedProjects.length === 0 ? (
                <div className="empty-state">لا توجد مشاريع مؤرشفة</div>
              ) : (
                filteredArchivedProjects.map((project) => (
                  <article key={project.id} className="dash-card">
                    <div className="dash-card-top">
                      <div>
                        <h3>{project.name}</h3>
                        <div className="dash-sub">Code: {project.code || "-"}</div>
                      </div>

                      <span className="status-badge inactive">archived</span>
                    </div>

                    <div className="manager-chip">👤 {project.managerName || "-"}</div>

                    <div className="dash-actions">
                      <button
                        type="button"
                        className="mini-btn edit"
                        onClick={() => restoreProject(project)}
                      >
                        Restore
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="pro-card table-card">
            <div className="section-head">
              <div>
                <h2>Archived Packages</h2>
                <p>البكجات المؤرشفة ويمكن استرجاعها حسب الصلاحية.</p>
              </div>
            </div>

            <div className="archive-grid">
              {filteredArchivedPackages.length === 0 ? (
                <div className="empty-state">لا توجد بكجات مؤرشفة</div>
              ) : (
                filteredArchivedPackages.map((pkg) => (
                  <article key={pkg.id} className="dash-card">
                    <div className="dash-card-top">
                      <div>
                        <h3>{pkg.name}</h3>
                        <div className="dash-sub">Code: {pkg.code || "-"}</div>
                        <div className="dash-sub">Project: {pkg.projectName || "-"}</div>
                      </div>

                      <span className="status-badge inactive">archived</span>
                    </div>

                    <div className="manager-chip">👤 {pkg.managerName || "-"}</div>

                    <div className="dash-actions">
                      <button
                        type="button"
                        className="mini-btn edit"
                        onClick={() => restorePackage(pkg)}
                      >
                        Restore
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
