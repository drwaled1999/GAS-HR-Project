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
      const [projectsResponse, usersResponse] = await Promise.all([
        apiFetch('/projects'),
        apiFetch('/users')
      ]);

      setProjects(projectsResponse.projects || []);
      setUsers(usersResponse.users || []);

      // 🔥 مهم: نحط أول مشروع تلقائي
      if (projectsResponse.projects?.length > 0) {
        setPackageForm((prev) => ({
          ...prev,
          projectId: projectsResponse.projects[0].id
        }));
      }
    } catch (err) {
      setError('فشل تحميل البيانات');
    }
  }

  async function createProject(event) {
    event.preventDefault();

    try {
      await apiFetch('/projects', {
        method: 'POST',
        headers: { 'x-actor-name': user?.name || 'System Owner' },
        body: JSON.stringify(projectForm)
      });

      setProjectForm({
        name: '',
        projectManagerUserId: '',
        cmUserId: ''
      });

      setMessage('تم إنشاء المشروع');
      loadData();
    } catch {
      setError('فشل إنشاء المشروع');
    }
  }

  async function createPackage(event) {
    event.preventDefault();

    console.log("SENDING:", packageForm); // 👈 مهم

    try {
      await apiFetch('/projects/packages', {
        method: 'POST',
        body: JSON.stringify(packageForm)
      });

      setPackageForm((prev) => ({
        ...prev,
        name: ''
      }));

      setMessage('تم إنشاء البكج');
      loadData();
    } catch (err) {
      setError(err.message || 'فشل إنشاء البكج');
    }
  }

  return (
    <div className="page grid-two">

      {/* ====== CREATE ====== */}
      <section className="card">
        <h2>Projects</h2>

        <form onSubmit={createProject}>
          <input
            placeholder="Project Name"
            value={projectForm.name}
            onChange={(e) =>
              setProjectForm({ ...projectForm, name: e.target.value })
            }
          />

          <button>Create Project</button>
        </form>

        <hr />

        <h2>Packages</h2>

        <form onSubmit={createPackage}>
          {/* 🔥 هذا أهم جزء */}
          <select
            value={packageForm.projectId || ''}
            onChange={(e) => {
              console.log("SELECT:", e.target.value);

              setPackageForm({
                ...packageForm,
                projectId: e.target.value
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

          <input
            placeholder="Package Name"
            value={packageForm.name}
            onChange={(e) =>
              setPackageForm({
                ...packageForm,
                name: e.target.value
              })
            }
          />

          <button>Create Package</button>
        </form>

        {message && <p style={{ color: 'green' }}>{message}</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </section>

      {/* ====== TABLE ====== */}
      <section className="card">
        <h2>Projects List</h2>

        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Packages Count</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td>{project.packages}</td>
                <td>{project.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

    </div>
  );
}