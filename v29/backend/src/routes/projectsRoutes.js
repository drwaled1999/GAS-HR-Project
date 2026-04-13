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

    const projects = projectsResult.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      employees: row.employees
    }));

    const packages = packagesResult.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      projectName: row.project_name || "",
      employees: row.employees
    }));

    return res.json({ projects, packages });
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({ message: "Failed to load projects." });
  }
});

export default router;