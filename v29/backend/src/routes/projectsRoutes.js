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
        ROW_NUMBER() OVER (ORDER BY project_name) AS id,
        project_name AS name,
        COUNT(*)::int AS employees
      FROM employees
      WHERE project_name IS NOT NULL AND project_name <> ''
      GROUP BY project_name
      ORDER BY project_name
      `
    );

    const packagesResult = await query(
      `
      SELECT
        ROW_NUMBER() OVER (ORDER BY package_name) AS id,
        package_name AS name,
        project_name,
        COUNT(*)::int AS employees
      FROM employees
      WHERE package_name IS NOT NULL AND package_name <> ''
      GROUP BY package_name, project_name
      ORDER BY package_name
      `
    );

    return res.json({
      projects: projectsResult.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        employees: row.employees
      })),
      packages: packagesResult.rows.map((row) => ({
        id: Number(row.id),
        name: row.name,
        projectName: row.project_name || "",
        employees: row.employees
      }))
    });
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({ message: "Failed to load projects." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { name } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "اسم المشروع إجباري" });
    }

    return res.status(201).json({
      ok: true,
      project: {
        id: Date.now(),
        name: String(name).trim(),
        employees: 0
      }
    });
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({ message: "Failed to create project." });
  }
});

router.post("/packages", requireAuth, async (req, res) => {
  try {
    const { name, projectId, projectName } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "اسم البكج إجباري" });
    }

    return res.status(201).json({
      ok: true,
      package: {
        id: Date.now(),
        name: String(name).trim(),
        projectId: projectId || null,
        projectName: projectName || "",
        employees: 0
      }
    });
  } catch (error) {
    console.error("Create package error:", error);
    return res.status(500).json({ message: "Failed to create package." });
  }
});

export default router;