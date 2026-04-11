import { authenticateToken, enforceMaintenance } from '../middleware_auth.js';
import { Router } from 'express';
import { createPackage, createProject, db, getUserById } from '../data/store.js';

const router = Router();
router.use(authenticateToken, enforceMaintenance);

router.get('/', (_req, res) => {
  const projects = db.projects.map((project) => ({
    ...project,
    projectManagerName: project.projectManagerUserId ? getUserById(project.projectManagerUserId)?.name : null,
    cmName: project.cmUserId ? getUserById(project.cmUserId)?.name : null,
    packages: db.packages.filter((pkg) => pkg.projectId === project.id)
  }));

  res.json({ projects, packages: db.packages });
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'اسم المشروع إجباري' });
  }
  const actor = req.user?.name || 'System Owner';
  const project = createProject(req.body, actor);
  return res.status(201).json({ project });
});

router.post('/packages', (req, res) => {
  const { name, projectId } = req.body;
  if (!name || !projectId) {
    return res.status(400).json({ message: 'اسم البكج والمشروع إجباريان' });
  }
  const actor = req.user?.name || 'System Owner';
  const pkg = createPackage(req.body, actor);
  return res.status(201).json({ package: pkg });
});

export default router;
