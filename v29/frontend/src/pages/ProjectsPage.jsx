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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setError('');
      const [projectsResponse, usersResponse] = await Promise.all([
        apiFetch('/projects'),
        apiFetch('/users')
      ]);

      const safeProjects = Array.isArray(projectsResponse?.projects)
        ? projectsResponse.projects
        : [];

      const safeUsers = Array.isArray(usersResponse?.users)
        ? usersResponse.users
        : [];

      setProjects(safeProjects);
      setUsers(safeUsers);

      setPackageForm((prev) => ({
        ...prev,
        projectId:
          prev.projectId && safeProjects.some((p) => String(p.id) === String(prev.projectId))
            ? prev.projectId
            : safeProjects[0]?.id || ''
      }));
    } catch (err) {
      setProjects([]);
      setUsers([]);
      setError(err.message || 'Failed to load data');
    }
  }

  async function createProject(event) {
    event.preventDefault();

    try {
      setMessage('');
      setError('');

      const response = await apiFetch('/projects', {
        method: 'POST',
        headers: { 'x-actor-name': user?.name || 'System Owner' },
        body: JSON.stringify({
          name: projectForm.name
        })
      });

      setProjectForm({
        name: '',
        projectManagerUserId: '',
        cmUserId: ''
      });

      setMessage(response?.message || 'تم إنشاء المشروع');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create project');
    }
  }

  async function createPackage(event) {
    event.preventDefault();

    try {
      setMessage('');
      setError('');

      console.log('SENDING PACKAGE FORM:', packageForm);

      const response = await apiFetch('/projects/packages', {
        method: 'POST',
        body: JSON.stringify({
          projectId: packageForm.projectId,
          name: packageForm.name
        })
      });

      setPackageForm((prev) => ({
        ...prev,
        name: ''
      }));

      setMessage(response?.message || 'تم إنشاء البكج');
      await loadData();
    } catch (err) {
      setError(err.message || 'Failed to create package');
    }
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
                setProjectForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </label>

          <label>
            Project Manager
            <select
              value={projectForm.projectManagerUserId}
              onChange={(e) =>
                setProjectForm((prev) => ({
                  ...prev,
                  projectManagerUserId: e.target.value
                }))
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
                setProjectForm((prev) => ({
                  ...prev,
                  cmUserId: e.target.value
                }))
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
              onChange={(e) =>
                setPackageForm((prev) => ({
                  ...prev,
                  projectId: e.target.value
                }))
              }
            >
              <option value="">Select Project</option>
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
                setPackageForm((prev) => ({ ...prev, name: e.target.value }))
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
                    {Array.isArray(project.packages) && project.packages.length > 0
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