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
        p.code,
        p.is_active
      FROM projects p
      ORDER BY p.created_at DESC
      `
    );

    const packagesResult = await query(
      `
      SELECT
        pk.id,
        pk.project_id,
        pk.name,
        pk.code,
        pk.is_active,
        p.name AS project_name
      FROM packages pk
      JOIN projects p ON p.id = pk.project_id
      ORDER BY pk.created_at DESC
      `
    );

    const allPackages = packagesResult.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      name: row.name,
      code: row.code || "",
      status: row.is_active ? "active" : "inactive"
    }));

    const projects = projectsResult.rows.map((row) => {
      const projectPackages = allPackages.filter(
        (pkg) => String(pkg.projectId) === String(row.id)
      );

      return {
        id: row.id,
        name: row.name,
        code: row.code || "",
        projectManagerName: "",
        cmName: "",
        packages: projectPackages,
        status: row.is_active ? "active" : "inactive"
      };
    });

    return res.json({
      projects,
      packages: allPackages
    });
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({ message: "Failed to load projects." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, code } = req.body || {};

    const resolvedName = String(name || "").trim();
    const resolvedCode = String(code || "").trim() || null;

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
      INSERT INTO projects (name, code, is_active)
      VALUES ($1, $2, TRUE)
      RETURNING id, name, code, is_active
      `,
      [resolvedName, resolvedCode]
    );

    const row = insertResult.rows[0];

    return res.status(201).json({
      ok: true,
      message: "تم إنشاء المشروع",
      project: {
        id: row.id,
        name: row.name,
        code: row.code || "",
        projectManagerName: "",
        cmName: "",
        packages: [],
        status: row.is_active ? "active" : "inactive"
      }
    });
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({ message: error.message || "Failed to create project." });
  }
});

router.post("/packages", async (req, res) => {
  try {
    const { name, packageName, code, projectId } = req.body || {};

    const resolvedName = String(name || packageName || "").trim();
    const resolvedCode = String(code || "").trim() || null;

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
      INSERT INTO packages (project_id, name, code, is_active)
      VALUES ($1, $2, $3, TRUE)
      RETURNING id, project_id, name, code, is_active
      `,
      [projectId, resolvedName, resolvedCode]
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
        code: row.code || "",
        status: row.is_active ? "active" : "inactive"
      }
    });
  } catch (error) {
    console.error("Create package error:", error);
    return res.status(500).json({
      message: error.message || "Failed to create package."
    });
  }
});

export default router;