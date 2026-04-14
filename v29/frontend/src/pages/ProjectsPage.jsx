import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProjectsPage() {
  const { user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  const [projectForm, setProjectForm] = useState({
    name: '',
    projectManagerUserId: '',
    cmUserId: ''
  });

  const [packageForm, setPackageForm] = useState({
    projectId: '',
    name: ''
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('✅ NEW PROJECTS PAGE BUILD LOADED');
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setMessage('');
      setError('');

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

      console.log('PROJECTS RESPONSE:', safeProjects);
      console.log('USERS RESPONSE:', safeUsers);

      setProjects(safeProjects);
      setUsers(safeUsers);

      setPackageForm((prev) => {
        const stillExists =
          prev.projectId &&
          safeProjects.some((project) => project.id === String(prev.projectId));

        return {
          ...prev,
          projectId: stillExists ? String(prev.projectId) : ''
        };
      });
    } catch (err) {
      console.error('LOAD DATA ERROR:', err);
      setError(err.message || 'فشل تحميل البيانات');
      setProjects([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  async function createProject(event) {
    event.preventDefault();

    try {
      setMessage('');
      setError('');

      const name = String(projectForm.name || '').trim();

      console.log('CREATE PROJECT CLICKED');
      console.log('PROJECT FORM:', projectForm);

      if (!name) {
        setError('اكتب اسم المشروع');
        return;
      }

      const response = await apiFetch('/projects', {
        method: 'POST',
        headers: { 'x-actor-name': user?.name || 'System Owner' },
        body: JSON.stringify({
          name
        })
      });

      console.log('CREATE PROJECT RESPONSE:', response);

      setProjectForm({
        name: '',
        projectManagerUserId: '',
        cmUserId: ''
      });

      setMessage(response?.message || 'تم إنشاء المشروع');
      await loadData();
    } catch (err) {
      console.error('CREATE PROJECT ERROR:', err);
      setError(err.message || 'فشل إنشاء المشروع');
    }
  }

  async function createPackage(event) {
    event.preventDefault();

    console.log('🔥 BUTTON CLICKED');
    console.log('CURRENT PACKAGE STATE BEFORE SUBMIT:', packageForm);

    try {
      setMessage('');
      setError('');

      const projectId = String(packageForm.projectId || '').trim();
      const name = String(packageForm.name || '').trim();

      console.log('DATA:', { projectId, name });

      if (!projectId) {
        setError('اختر مشروع أول');
        return;
      }

      if (!name) {
        setError('اكتب اسم البكج');
        return;
      }

      const response = await apiFetch('/projects/packages', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          name
        })
      });

      console.log('CREATE PACKAGE RESPONSE:', response);

      setMessage(response?.message || 'تم إنشاء البكج');
      setPackageForm({
        projectId,
        name: ''
      });

      await loadData();
    } catch (err) {
      console.error('CREATE PACKAGE ERROR:', err);
      setError(err.message || 'فشل إنشاء البكج');
    }
  }

  if (loading) {
    return (
      <div className="page">
        <section className="card">
          <h1>Projects PAGE - NEW BUILD</h1>
          <p>Loading...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page grid-two">
      <section className="card">
        <div className="page-header compact">
          <div>
            <h1>Projects PAGE - NEW BUILD</h1>
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
              {users.map((item) => (
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
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <button className="span-2" type="submit">
            Create Project
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
              value={packageForm.projectId || ''}
              onChange={(e) => {
                const value = String(e.target.value || '');
                console.log('SELECTED PROJECT:', value);

                setPackageForm({
                  ...packageForm,
                  projectId: value
                });
              }}
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
            />
          </label>

          <button className="span-2" type="submit">
            Create Package
          </button>
        </form>

        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}
      </section>

      <section className="card table-wrap">
        <div className="page-header compact">
          <div>
            <h1>Projects & Packages</h1>
            <p>عرض الخصوصية لكل مشروع والبكجات التابعة له.</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Project Manager</th>
              <th>CM</th>
              <th>Packages</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan="5">No projects found</td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project.id}>
                  <td>{project.name}</td>
                  <td>{project.projectManagerName || '-'}</td>
                  <td>{project.cmName || '-'}</td>
                  <td>
                    {project.packages.length > 0
                      ? project.packages.map((pkg) => pkg.name).join('، ')
                      : '-'}
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