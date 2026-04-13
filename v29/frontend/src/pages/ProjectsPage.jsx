import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProjectsPage() {
  const { user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  const [projectForm, setProjectForm] = useState({
    name: '',
    code: '',
    projectManagerUserId: '',
    cmUserId: ''
  });

  const [packageForm, setPackageForm] = useState({
    projectId: '',
    name: '',
    code: ''
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingProject, setSubmittingProject] = useState(false);
  const [submittingPackage, setSubmittingPackage] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      setMessage('');

      const [projectsResponse, usersResponse] = await Promise.all([
        apiFetch('/projects'),
        apiFetch('/users')
      ]);

      const safeProjects = Array.isArray(projectsResponse?.projects)
        ? projectsResponse.projects.map((project) => ({
            ...project,
            id: String(project.id),
            packages: Array.isArray(project.packages) ? project.packages : []
          }))
        : [];

      const safeUsers = Array.isArray(usersResponse?.users)
        ? usersResponse.users
        : [];

      setProjects(safeProjects);
      setUsers(safeUsers);

      setPackageForm((current) => {
        const currentExists =
          current.projectId &&
          safeProjects.some((project) => project.id === String(current.projectId));

        return {
          ...current,
          projectId: currentExists ? String(current.projectId) : ''
        };
      });
    } catch (err) {
      setProjects([]);
      setUsers([]);
      setError(err.message || 'Failed to load projects data.');
    } finally {
      setLoading(false);
    }
  }

  const projectManagers = useMemo(() => {
    return users.filter((item) =>
      ['Project Manager', 'System Owner', 'HR Manager', 'CM'].includes(item.role || item.jobTitle)
    );
  }, [users]);

  const cms = useMemo(() => {
    return users.filter((item) =>
      ['CM', 'System Owner', 'HR Manager', 'Project Manager'].includes(item.role || item.jobTitle)
    );
  }, [users]);

  async function createProject(event) {
    event.preventDefault();

    try {
      setSubmittingProject(true);
      setMessage('');
      setError('');

      const name = String(projectForm.name || '').trim();
      const code = String(projectForm.code || '').trim();

      if (!name) {
        setError('اكتب اسم المشروع');
        return;
      }

      const response = await apiFetch('/projects', {
        method: 'POST',
        headers: {
          'x-actor-name': user?.name || 'System Owner'
        },
        body: JSON.stringify({
          name,
          code: code || null,
          projectManagerUserId: projectForm.projectManagerUserId || null,
          cmUserId: projectForm.cmUserId || null
        })
      });

      setProjectForm({
        name: '',
        code: '',
        projectManagerUserId: '',
        cmUserId: ''
      });

      setMessage(response?.message || 'تم إنشاء المشروع بنجاح');
      await loadData();
    } catch (err) {
      setError(err.message || 'فشل إنشاء المشروع');
    } finally {
      setSubmittingProject(false);
    }
  }

  async function createPackage(event) {
    event.preventDefault();

    try {
      setSubmittingPackage(true);
      setMessage('');
      setError('');

      const selectedProjectId = String(packageForm.projectId || '').trim();
      const name = String(packageForm.name || '').trim();
      const code = String(packageForm.code || '').trim();

      if (!selectedProjectId) {
        setError('اختر مشروع أولًا');
        return;
      }

      if (!name) {
        setError('اكتب اسم البكج');
        return;
      }

      const selectedProject = projects.find(
        (project) => project.id === selectedProjectId
      );

      if (!selectedProject) {
        setError('المشروع المختار غير موجود');
        return;
      }

      const duplicateInUi = (selectedProject.packages || []).some(
        (pkg) => String(pkg.name || '').trim().toLowerCase() === name.toLowerCase()
      );

      if (duplicateInUi) {
        setError('البكج موجود مسبقًا لهذا المشروع');
        return;
      }

      const response = await apiFetch('/projects/packages', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProjectId,
          name,
          code: code || null
        })
      });

      setPackageForm({
        projectId: selectedProjectId,
        name: '',
        code: ''
      });

      setMessage(response?.message || 'تم إنشاء البكج بنجاح');
      await loadData();
    } catch (err) {
      setError(err.message || 'فشل إنشاء البكج');
    } finally {
      setSubmittingPackage(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <section className="card">
          <div className="page-header compact">
            <div>
              <h1>Projects</h1>
              <p>Loading projects and packages...</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page grid-two">
      <section className="card">
        <div className="page-header compact">
          <div>
            <h1>Projects</h1>
            <p>إضافة المشاريع وتحديد مدير المشروع و CM.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={createProject}>
          <label className="span-2">
            Project Name
            <input
              value={projectForm.name}
              onChange={(e) =>
                setProjectForm({
                  ...projectForm,
                  name: e.target.value
                })
              }
              placeholder="مثال: Zuluf Project"
            />
          </label>

          <label className="span-2">
            Project Code
            <input
              value={projectForm.code}
              onChange={(e) =>
                setProjectForm({
                  ...projectForm,
                  code: e.target.value
                })
              }
              placeholder="مثال: ZLF-01"
            />
          </label>

          <label>
            Project Manager
            <select
              value={projectForm.projectManagerUserId}
              onChange={(e) =>
                setProjectForm({
                  ...projectForm,
                  projectManagerUserId: e.target.value
                })
              }
            >
              <option value="">Select</option>
              {projectManagers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            CM
            <select
              value={projectForm.cmUserId}
              onChange={(e) =>
                setProjectForm({
                  ...projectForm,
                  cmUserId: e.target.value
                })
              }
            >
              <option value="">Select</option>
              {cms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <button className="span-2" type="submit" disabled={submittingProject}>
            {submittingProject ? 'Creating...' : 'Create Project'}
          </button>
        </form>

        <hr className="spacer" />

        <div className="page-header compact">
          <div>
            <h1>Packages</h1>
            <p>البكج يتبع للمشروع المختار فقط.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={createPackage}>
          <label>
            Project
            <select
              value={packageForm.projectId}
              onChange={(e) =>
                setPackageForm({
                  ...packageForm,
                  projectId: String(e.target.value || '')
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

          <label>
            Package Name
            <input
              value={packageForm.name}
              onChange={(e) =>
                setPackageForm({
                  ...packageForm,
                  name: e.target.value
                })
              }
              placeholder="مثال: Package 01"
            />
          </label>

          <label className="span-2">
            Package Code
            <input
              value={packageForm.code}
              onChange={(e) =>
                setPackageForm({
                  ...packageForm,
                  code: e.target.value
                })
              }
              placeholder="مثال: PKG-01"
            />
          </label>

          <button className="span-2" type="submit" disabled={submittingPackage}>
            {submittingPackage ? 'Creating...' : 'Create Package'}
          </button>
        </form>

        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}
      </section>

      <section className="card table-wrap">
        <div className="page-header compact">
          <div>
            <h1>Projects & Packages</h1>
            <p>عرض كل مشروع والبكجات التابعة له.</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Code</th>
              <th>Project Manager</th>
              <th>CM</th>
              <th>Packages</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan="6">No projects found</td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.code || '-'}</td>
                  <td>{project.projectManagerName || '-'}</td>
                  <td>{project.cmName || '-'}</td>
                  <td>
                    {project.packages.length > 0 ? (
                      project.packages.map((pkg) => pkg.name).join('، ')
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{project.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}