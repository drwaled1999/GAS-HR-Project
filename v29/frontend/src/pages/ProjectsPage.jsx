import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../services/api';

const emptyProjectForm = {
  name: '',
  code: '',
  initialPackageName: '',
  initialPackageCode: ''
};

const emptyPackageForm = {
  projectId: '',
  name: '',
  code: ''
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [packageForm, setPackageForm] = useState(emptyPackageForm);

  const [editingProjectId, setEditingProjectId] = useState('');
  const [editingProjectForm, setEditingProjectForm] = useState({
    name: '',
    code: '',
    status: 'active'
  });

  const [editingPackageId, setEditingPackageId] = useState('');
  const [editingPackageForm, setEditingPackageForm] = useState({
    name: '',
    code: '',
    status: 'active'
  });

  const [loading, setLoading] = useState(true);
  const [submittingProject, setSubmittingProject] = useState(false);
  const [submittingPackage, setSubmittingPackage] = useState(false);
  const [savingProjectEdit, setSavingProjectEdit] = useState(false);
  const [savingPackageEdit, setSavingPackageEdit] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setMessage('');
      setError('');

      const response = await apiFetch('/projects');

      const safeProjects = Array.isArray(response?.projects)
        ? response.projects.map((project) => ({
            ...project,
            id: String(project.id),
            packages: Array.isArray(project.packages)
              ? project.packages.map((pkg) => ({
                  ...pkg,
                  id: String(pkg.id),
                  projectId: String(pkg.projectId)
                }))
              : []
          }))
        : [];

      setProjects(safeProjects);

      setPackageForm((current) => {
        const exists =
          current.projectId &&
          safeProjects.some((project) => project.id === current.projectId);

        return {
          ...current,
          projectId: exists ? current.projectId : ''
        };
      });
    } catch (err) {
      setProjects([]);
      setError(err.message || 'فشل تحميل المشاريع والبكجات');
    } finally {
      setLoading(false);
    }
  }

  const packagesRows = useMemo(() => {
    return projects.flatMap((project) =>
      project.packages.map((pkg) => ({
        ...pkg,
        projectName: project.name
      }))
    );
  }, [projects]);

  async function handleCreateProject(event) {
    event.preventDefault();

    try {
      setSubmittingProject(true);
      setMessage('');
      setError('');

      const name = String(projectForm.name || '').trim();
      const code = String(projectForm.code || '').trim();
      const initialPackageName = String(projectForm.initialPackageName || '').trim();
      const initialPackageCode = String(projectForm.initialPackageCode || '').trim();

      if (!name) {
        setError('اكتب اسم المشروع');
        return;
      }

      if (!initialPackageName) {
        setError('اكتب اسم أول بكج مع المشروع');
        return;
      }

      const response = await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          code: code || null,
          initialPackageName,
          initialPackageCode: initialPackageCode || null
        })
      });

      setProjectForm(emptyProjectForm);
      setMessage(response?.message || 'تم إنشاء المشروع وأول بكج');
      await loadData();
    } catch (err) {
      setError(err.message || 'فشل إنشاء المشروع');
    } finally {
      setSubmittingProject(false);
    }
  }

  async function handleCreatePackage(event) {
    event.preventDefault();

    try {
      setSubmittingPackage(true);
      setMessage('');
      setError('');

      const projectId = String(packageForm.projectId || '').trim();
      const name = String(packageForm.name || '').trim();
      const code = String(packageForm.code || '').trim();

      if (!projectId) {
        setError('اختر المشروع');
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
          name,
          code: code || null
        })
      });

      setPackageForm({
        projectId,
        name: '',
        code: ''
      });

      setMessage(response?.message || 'تم إنشاء البكج');
      await loadData();
    } catch (err) {
      setError(err.message || 'فشل إنشاء البكج');
    } finally {
      setSubmittingPackage(false);
    }
  }

  function startEditProject(project) {
    setEditingProjectId(project.id);
    setEditingProjectForm({
      name: project.name || '',
      code: project.code || '',
      status: project.status || 'active'
    });
    setMessage('');
    setError('');
  }

  async function saveProjectEdit(event) {
    event.preventDefault();

    try {
      setSavingProjectEdit(true);
      setMessage('');
      setError('');

      const response = await apiFetch(`/projects/${editingProjectId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingProjectForm.name,
          code: editingProjectForm.code || null,
          status: editingProjectForm.status
        })
      });

      setEditingProjectId('');
      setEditingProjectForm({
        name: '',
        code: '',
        status: 'active'
      });

      setMessage(response?.message || 'تم تعديل المشروع');
      await loadData();
    } catch (err) {
      setError(err.message || 'فشل تعديل المشروع');
    } finally {
      setSavingProjectEdit(false);
    }
  }

  async function deleteProject(project) {
    const confirmed = window.confirm(`هل تريد حذف المشروع "${project.name}"؟ سيتم حذف البكجات التابعة له أيضًا.`);
    if (!confirmed) return;

    try {
      setMessage('');
      setError('');

      const response = await apiFetch(`/projects/${project.id}`, {
        method: 'DELETE'
      });

      if (editingProjectId === project.id) {
        setEditingProjectId('');
      }

      setMessage(response?.message || 'تم حذف المشروع');
      await loadData();
    } catch (err) {
      setError(err.message || 'فشل حذف المشروع');
    }
  }

  function startEditPackage(pkg) {
    setEditingPackageId(pkg.id);
    setEditingPackageForm({
      name: pkg.name || '',
      code: pkg.code || '',
      status: pkg.status || 'active'
    });
    setMessage('');
    setError('');
  }

  async function savePackageEdit(event) {
    event.preventDefault();

    try {
      setSavingPackageEdit(true);
      setMessage('');
      setError('');

      const response = await apiFetch(`/projects/packages/${editingPackageId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingPackageForm.name,
          code: editingPackageForm.code || null,
          status: editingPackageForm.status
        })
      });

      setEditingPackageId('');
      setEditingPackageForm({
        name: '',
        code: '',
        status: 'active'
      });

      setMessage(response?.message || 'تم تعديل البكج');
      await loadData();
    } catch (err) {
      setError(err.message || 'فشل تعديل البكج');
    } finally {
      setSavingPackageEdit(false);
    }
  }

  async function deletePackage(pkg) {
    const confirmed = window.confirm(`هل تريد حذف البكج "${pkg.name}"؟`);
    if (!confirmed) return;

    try {
      setMessage('');
      setError('');

      const response = await apiFetch(`/projects/packages/${pkg.id}`, {
        method: 'DELETE'
      });

      if (editingPackageId === pkg.id) {
        setEditingPackageId('');
      }

      setMessage(response?.message || 'تم حذف البكج');
      await loadData();
    } catch (err) {
      setError(err.message || 'فشل حذف البكج');
    }
  }

  if (loading) {
    return (
      <div className="page">
        <section className="card">
          <h1>Projects & Packages</h1>
          <p>Loading...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page" style={{ display: 'grid', gap: '20px' }}>
      <section className="card">
        <div className="page-header compact">
          <div>
            <h1>إنشاء مشروع جديد</h1>
            <p>لازم تضيف أول بكج مع المشروع في نفس الفورم.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleCreateProject}>
          <label>
            اسم المشروع
            <input
              value={projectForm.name}
              onChange={(e) =>
                setProjectForm({ ...projectForm, name: e.target.value })
              }
              placeholder="مثال: Zuluf Project"
            />
          </label>

          <label>
            كود المشروع
            <input
              value={projectForm.code}
              onChange={(e) =>
                setProjectForm({ ...projectForm, code: e.target.value })
              }
              placeholder="اختياري"
            />
          </label>

          <label>
            اسم أول بكج
            <input
              value={projectForm.initialPackageName}
              onChange={(e) =>
                setProjectForm({ ...projectForm, initialPackageName: e.target.value })
              }
              placeholder="مثال: Package 01"
            />
          </label>

          <label>
            كود أول بكج
            <input
              value={projectForm.initialPackageCode}
              onChange={(e) =>
                setProjectForm({ ...projectForm, initialPackageCode: e.target.value })
              }
              placeholder="اختياري"
            />
          </label>

          <button type="submit" disabled={submittingProject}>
            {submittingProject ? 'جاري الإنشاء...' : 'إنشاء المشروع مع أول بكج'}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="page-header compact">
          <div>
            <h1>إضافة بكج لمشروع موجود</h1>
            <p>اختر المشروع ثم أضف البكج الجديد.</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleCreatePackage}>
          <label>
            المشروع
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
            اسم البكج
            <input
              value={packageForm.name}
              onChange={(e) =>
                setPackageForm({ ...packageForm, name: e.target.value })
              }
              placeholder="مثال: Package 02"
            />
          </label>

          <label>
            كود البكج
            <input
              value={packageForm.code}
              onChange={(e) =>
                setPackageForm({ ...packageForm, code: e.target.value })
              }
              placeholder="اختياري"
            />
          </label>

          <button type="submit" disabled={submittingPackage}>
            {submittingPackage ? 'جاري الإنشاء...' : 'إضافة بكج'}
          </button>
        </form>
      </section>

      {message ? <div className="alert success">{message}</div> : null}
      {error ? <div className="alert error">{error}</div> : null}

      <section className="card table-wrap">
        <div className="page-header compact">
          <div>
            <h1>المشاريع</h1>
            <p>عرض وتعديل وحذف المشاريع.</p>
          </div>
        </div>

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
                  <td>{project.code || '-'}</td>
                  <td>
                    {project.packages.length > 0
                      ? project.packages.map((pkg) => pkg.name).join('، ')
                      : '-'}
                  </td>
                  <td>{project.status}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" className="ghost" onClick={() => startEditProject(project)}>
                        تعديل
                      </button>
                      <button type="button" className="ghost danger" onClick={() => deleteProject(project)}>
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {editingProjectId ? (
          <form className="form-grid" onSubmit={saveProjectEdit} style={{ marginTop: '20px' }}>
            <h3>تعديل المشروع</h3>

            <label>
              اسم المشروع
              <input
                value={editingProjectForm.name}
                onChange={(e) =>
                  setEditingProjectForm({ ...editingProjectForm, name: e.target.value })
                }
              />
            </label>

            <label>
              كود المشروع
              <input
                value={editingProjectForm.code}
                onChange={(e) =>
                  setEditingProjectForm({ ...editingProjectForm, code: e.target.value })
                }
              />
            </label>

            <label>
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

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="submit" disabled={savingProjectEdit}>
                {savingProjectEdit ? 'جاري الحفظ...' : 'حفظ تعديل المشروع'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditingProjectId('');
                  setEditingProjectForm({ name: '', code: '', status: 'active' });
                }}
              >
                إلغاء
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="card table-wrap">
        <div className="page-header compact">
          <div>
            <h1>البكجات</h1>
            <p>عرض وتعديل وحذف البكجات.</p>
          </div>
        </div>

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
                  <td>{pkg.code || '-'}</td>
                  <td>{pkg.projectName}</td>
                  <td>{pkg.status}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" className="ghost" onClick={() => startEditPackage(pkg)}>
                        تعديل
                      </button>
                      <button type="button" className="ghost danger" onClick={() => deletePackage(pkg)}>
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {editingPackageId ? (
          <form className="form-grid" onSubmit={savePackageEdit} style={{ marginTop: '20px' }}>
            <h3>تعديل البكج</h3>

            <label>
              اسم البكج
              <input
                value={editingPackageForm.name}
                onChange={(e) =>
                  setEditingPackageForm({ ...editingPackageForm, name: e.target.value })
                }
              />
            </label>

            <label>
              كود البكج
              <input
                value={editingPackageForm.code}
                onChange={(e) =>
                  setEditingPackageForm({ ...editingPackageForm, code: e.target.value })
                }
              />
            </label>

            <label>
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

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="submit" disabled={savingPackageEdit}>
                {savingPackageEdit ? 'جاري الحفظ...' : 'حفظ تعديل البكج'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditingPackageId('');
                  setEditingPackageForm({ name: '', code: '', status: 'active' });
                }}
              >
                إلغاء
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}