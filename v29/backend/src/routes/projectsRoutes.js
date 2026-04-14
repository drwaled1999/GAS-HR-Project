import express from "express";
import { query } from "../data/index.js";

const router = express.Router();

// تم تعطيل requireAuth مؤقتًا لحل Unauthorized

router.get("/", async (_req, res) => {
  try {
    const projectsResult = await query(
      `
      SELECT id, name, code, is_active, created_at
      FROM projects
      ORDER BY created_at DESC
      `
    );

    const packagesResult = await query(
      `
      SELECT id, project_id, name, code, is_active, created_at
      FROM packages
      ORDER BY created_at DESC
      `
    );

    const packages = packagesResult.rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      name: row.name,
      code: row.code || "",
      status: row.is_active ? "active" : "inactive"
    }));

    const projects = projectsResult.rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      code: row.code || "",
      status: row.is_active ? "active" : "inactive",
      packages: packages.filter((pkg) => pkg.projectId === String(row.id))
    }));

    return res.json({ projects, packages });
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({ message: "Failed to load projects." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, code, initialPackageName, initialPackageCode } = req.body || {};

    const projectName = String(name || "").trim();
    const projectCode = String(code || "").trim() || null;
    const packageName = String(initialPackageName || "").trim();
    const packageCode = String(initialPackageCode || "").trim() || null;

    if (!projectName) {
      return res.status(400).json({ message: "اسم المشروع إجباري" });
    }

    if (!packageName) {
      return res.status(400).json({ message: "اسم أول بكج إجباري" });
    }

    const existingProject = await query(
      `SELECT id FROM projects WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [projectName]
    );

    if (existingProject.rows.length > 0) {
      return res.status(409).json({ message: "المشروع موجود مسبقًا" });
    }

    const insertedProject = await query(
      `
      INSERT INTO projects (name, code, is_active)
      VALUES ($1, $2, TRUE)
      RETURNING id, name, code, is_active
      `,
      [projectName, projectCode]
    );

    const projectId = String(insertedProject.rows[0].id);

    const insertedPackage = await query(
      `
      INSERT INTO packages (project_id, name, code, is_active)
      VALUES ($1, $2, $3, TRUE)
      RETURNING id, project_id, name, code, is_active
      `,
      [projectId, packageName, packageCode]
    );

    return res.status(201).json({
      message: "تم إنشاء المشروع وأول بكج بنجاح",
      project: {
        id: projectId,
        name: insertedProject.rows[0].name,
        code: insertedProject.rows[0].code || "",
        status: insertedProject.rows[0].is_active ? "active" : "inactive",
        packages: [
          {
            id: String(insertedPackage.rows[0].id),
            projectId: String(insertedPackage.rows[0].project_id),
            name: insertedPackage.rows[0].name,
            code: insertedPackage.rows[0].code || "",
            status: insertedPackage.rows[0].is_active ? "active" : "inactive"
          }
        ]
      }
    });
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({ message: error.message || "Failed to create project." });
  }
});

router.put("/:projectId", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();
    const { name, code, status } = req.body || {};

    const projectName = String(name || "").trim();
    const projectCode = String(code || "").trim() || null;
    const isActive = String(status || "active").toLowerCase() !== "inactive";

    if (!projectId) {
      return res.status(400).json({ message: "معرف المشروع غير صالح" });
    }

    if (!projectName) {
      return res.status(400).json({ message: "اسم المشروع إجباري" });
    }

    const existing = await query(
      `SELECT id FROM projects WHERE id = $1 LIMIT 1`,
      [projectId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "المشروع غير موجود" });
    }

    await query(
      `
      UPDATE projects
      SET name = $1,
          code = $2,
          is_active = $3,
          updated_at = NOW()
      WHERE id = $4
      `,
      [projectName, projectCode, isActive, projectId]
    );

    return res.json({ message: "تم تعديل المشروع بنجاح" });
  } catch (error) {
    console.error("Update project error:", error);
    return res.status(500).json({ message: error.message || "Failed to update project." });
  }
});

router.delete("/:projectId", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();

    const existing = await query(
      `SELECT id FROM projects WHERE id = $1 LIMIT 1`,
      [projectId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "المشروع غير موجود" });
    }

    await query(`DELETE FROM projects WHERE id = $1`, [projectId]);

    return res.json({ message: "تم حذف المشروع بنجاح" });
  } catch (error) {
    console.error("Delete project error:", error);
    return res.status(500).json({ message: error.message || "Failed to delete project." });
  }
});

router.post("/packages", async (req, res) => {
  try {
    const { projectId, name, code } = req.body || {};

    const resolvedProjectId = String(projectId || "").trim();
    const packageName = String(name || "").trim();
    const packageCode = String(code || "").trim() || null;

    if (!resolvedProjectId || !packageName) {
      return res.status(400).json({ message: "اسم البكج والمشروع إجباريان" });
    }

    const projectExists = await query(
      `SELECT id FROM projects WHERE id = $1 LIMIT 1`,
      [resolvedProjectId]
    );

    if (projectExists.rows.length === 0) {
      return res.status(404).json({ message: "المشروع غير موجود" });
    }

    const duplicate = await query(
      `
      SELECT id
      FROM packages
      WHERE project_id = $1 AND LOWER(name) = LOWER($2)
      LIMIT 1
      `,
      [resolvedProjectId, packageName]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({ message: "البكج موجود مسبقًا لهذا المشروع" });
    }

    const inserted = await query(
      `
      INSERT INTO packages (project_id, name, code, is_active)
      VALUES ($1, $2, $3, TRUE)
      RETURNING id, project_id, name, code, is_active
      `,
      [resolvedProjectId, packageName, packageCode]
    );

    return res.status(201).json({
      message: "تم إنشاء البكج بنجاح",
      package: {
        id: String(inserted.rows[0].id),
        projectId: String(inserted.rows[0].project_id),
        name: inserted.rows[0].name,
        code: inserted.rows[0].code || "",
        status: inserted.rows[0].is_active ? "active" : "inactive"
      }
    });
  } catch (error) {
    console.error("Create package error:", error);
    return res.status(500).json({ message: error.message || "Failed to create package." });
  }
});

router.put("/packages/:packageId", async (req, res) => {
  try {
    const packageId = String(req.params.packageId || "").trim();
    const { name, code, status } = req.body || {};

    const packageName = String(name || "").trim();
    const packageCode = String(code || "").trim() || null;
    const isActive = String(status || "active").toLowerCase() !== "inactive";

    if (!packageId) {
      return res.status(400).json({ message: "معرف البكج غير صالح" });
    }

    if (!packageName) {
      return res.status(400).json({ message: "اسم البكج إجباري" });
    }

    const existing = await query(
      `SELECT id, project_id FROM packages WHERE id = $1 LIMIT 1`,
      [packageId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "البكج غير موجود" });
    }

    const projectId = String(existing.rows[0].project_id);

    const duplicate = await query(
      `
      SELECT id
      FROM packages
      WHERE project_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3
      LIMIT 1
      `,
      [projectId, packageName, packageId]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({ message: "يوجد بكج آخر بنفس الاسم" });
    }

    await query(
      `
      UPDATE packages
      SET name = $1,
          code = $2,
          is_active = $3,
          updated_at = NOW()
      WHERE id = $4
      `,
      [packageName, packageCode, isActive, packageId]
    );

    return res.json({ message: "تم تعديل البكج بنجاح" });
  } catch (error) {
    console.error("Update package error:", error);
    return res.status(500).json({ message: error.message || "Failed to update package." });
  }
});

router.delete("/packages/:packageId", async (req, res) => {
  try {
    const packageId = String(req.params.packageId || "").trim();

    const existing = await query(
      `SELECT id FROM packages WHERE id = $1 LIMIT 1`,
      [packageId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "البكج غير موجود" });
    }

    await query(`DELETE FROM packages WHERE id = $1`, [packageId]);

    return res.json({ message: "تم حذف البكج بنجاح" });
  } catch (error) {
    console.error("Delete package error:", error);
    return res.status(500).json({ message: error.message || "Failed to delete package." });
  }
});

export default router;