import { Router } from "express";
import { requireAuth } from "../middleware_auth.js";
import { query } from "../data/index.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (_req, res) => {
  try {
    const projectsResult = await query(
      `
      SELECT
        p.id,
        p.name,
        p.project_manager_name,
        p.cm_name,
        p.status,
        COALESCE(COUNT(pk.id), 0)::int AS packages_count
      FROM projects p
      LEFT JOIN packages pk ON pk.project_id = p.id
      GROUP BY p.id, p.name, p.project_manager_name, p.cm_name, p.status
      ORDER BY p.id DESC
      `
    );

    const packagesResult = await query(
      `
      SELECT
        pk.id,
        pk.project_id,
        pk.name,
        pk.status,
        p.name AS project_name
      FROM packages pk
      JOIN projects p ON p.id = pk.project_id
      ORDER BY pk.id DESC
      `
    );

    const projects = projectsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      projectManagerName: row.project_manager_name || "",
      cmName: row.cm_name || "",
      packages: row.packages_count || 0,
      status: row.status || "active"
    }));

    const packages = packagesResult.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      name: row.name,
      status: row.status || "active"
    }));

    return res.json({ projects, packages });
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({ message: "Failed to load projects." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      name,
      projectName,
      projectManagerName,
      projectManager,
      cmName,
      cm,
      status
    } = req.body || {};

    const resolvedName = String(name || projectName || "").trim();
    const resolvedPm = String(projectManagerName || projectManager || "").trim();
    const resolvedCm = String(cmName || cm || "").trim();
    const resolvedStatus = String(status || "active").trim().toLowerCase();

    if (!resolvedName) {
      return res.status(400).json({ message: "اسم المشروع إجباري" });
    }

    const exists = await query(
      `SELECT id FROM projects WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [resolvedName]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "المشروع موجود مسبقًا" });
    }

    const insertResult = await query(
      `
      INSERT INTO projects (name, project_manager_name, cm_name, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, project_manager_name, cm_name, status
      `,
      [
        resolvedName,
        resolvedPm || null,
        resolvedCm || null,
        resolvedStatus || "active"
      ]
    );

    const row = insertResult.rows[0];

    return res.status(201).json({
      ok: true,
      message: "تم إنشاء المشروع",
      project: {
        id: row.id,
        name: row.name,
        projectManagerName: row.project_manager_name || "",
        cmName: row.cm_name || "",
        packages: 0,
        status: row.status || "active"
      }
    });
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({ message: "Failed to create project." });
  }
});

router.post("/packages", requireAuth, async (req, res) => {
  try {
    const { name, packageName, projectId, status } = req.body || {};

    const resolvedName = String(name || packageName || "").trim();

    if (!projectId || !resolvedName) {
      return res.status(400).json({ message: "اسم البكج والمشروع إجباريان" });
    }

    const projectResult = await query(
      `SELECT id, name FROM projects WHERE id = $1 LIMIT 1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: "المشروع غير موجود" });
    }

    const exists = await query(
      `
      SELECT id
      FROM packages
      WHERE project_id = $1 AND LOWER(name) = LOWER($2)
      LIMIT 1
      `,
      [projectId, resolvedName]
    );

    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "البكج موجود مسبقًا لهذا المشروع" });
    }

    const insertResult = await query(
      `
      INSERT INTO packages (project_id, name, status)
      VALUES ($1, $2, $3)
      RETURNING id, project_id, name, status
      `,
      [projectId, resolvedName, String(status || "active").trim().toLowerCase()]
    );

    const row = insertResult.rows[0];
    const projectName = projectResult.rows[0].name;

    return res.status(201).json({
      ok: true,
      message: "تم إنشاء البكج",
      package: {
        id: row.id,
        projectId: row.project_id,
        projectName,
        name: row.name,
        status: row.status || "active"
      }
    });
  } catch (error) {
    console.error("Create package error:", error);
    return res.status(500).json({ message: "Failed to create package." });
  }
});

export default router;