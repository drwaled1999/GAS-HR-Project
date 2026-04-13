import { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [projectForm, setProjectForm] = useState({ name: '', projectManagerUserId: '', cmUserId: '' });
  const [packageForm, setPackageForm] = useState({ projectId: 1, name: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [projectsResponse, usersResponse] = await Promise.all([apiFetch('/projects'), apiFetch('/users')]);
    setProjects(projectsResponse.projects);
    setUsers(usersResponse.users);
  }

  async function createProject(event) {
    event.preventDefault();
    await apiFetch('/projects', {
      method: 'POST',
      headers: { 'x-actor-name': user?.name || 'System Owner' },
      body: JSON.stringify(projectForm)
    });
    setProjectForm({ name: '', projectManagerUserId: '', cmUserId: '' });
    setMessage('تم إنشاء المشروع');
    loadData();
  }

  async function createPackage(event) {
    event.preventDefault();
    await apiFetch('/projects/packages', {
      method: 'POST',
      body: JSON.stringify({
        projectId: selectedProjectId,
        name: packageName
      })
    });
    setPackageForm({ ...packageForm, name: '' });
    setMessage('تم إنشاء البكج');
    loadData();
  }

  return (
    <div className="page grid-two">
      <section className="card">
        <div className="page-header compact"><div><h1>Projects</h1><p>إضافة المشاريع وتحديد مدير المشروع و CM.</p></div></div>
        <form className="form-grid" onSubmit={createProject}>
          <label className="span-2">Project Name<input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} /></label>
          <label>Project Manager<select value={projectForm.projectManagerUserId} onChange={(e) => setProjectForm({ ...projectForm, projectManagerUserId: e.target.value })}><option value="">Select</option>{users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>CM<select value={projectForm.cmUserId} onChange={(e) => setProjectForm({ ...projectForm, cmUserId: e.target.value })}><option value="">Select</option>{users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <button className="span-2">Create Project</button>
        </form>

        <hr className="spacer" />

        <div className="page-header compact"><div><h1>Packages</h1><p>البكج يتبع للمشروع المختار فقط.</p></div></div>
        <form className="form-grid" onSubmit={createPackage}>
          <label>Project<select value={packageForm.projectId} onChange={(e) => setPackageForm({ ...packageForm, projectId: Number(e.target.value) })}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label>Package Name<input value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} /></label>
          <button className="span-2">Create Package</button>
        </form>
        {message && <div className="alert success">{message}</div>}
      </section>

      <section className="card table-wrap">
        <div className="page-header compact"><div><h1>Projects & Packages</h1><p>عرض الخصوصية لكل مشروع والبكجات التابعة له.</p></div></div>
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
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td>{project.projectManagerName || '-'}</td>
                <td>{project.cmName || '-'}</td>
                <td>{project.packages.map((pkg) => pkg.name).join('، ')}</td>
                <td>{project.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
