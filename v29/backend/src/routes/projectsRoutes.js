import { Router } from "express";
import { requireAuth } from "../middleware_auth.js";
import { query } from "../data/index.js";

const router = Router();

router.use(requireAuth);

// جلب المشاريع مع البكجات
router.get("/", async (_req, res) => {
  try {
    const projectsResult = await query(
      `
      SELECT
        p.id,
        p.name,
        p.code,
        p.is_active,
        p.created_at
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
        pk.created_at
      FROM packages pk
      ORDER BY pk.created_at DESC
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

// إنشاء مشروع + أول بكج معه
router.post("/", async (req, res) => {
  try {
    const { name, code, initialPackageName, initialPackageCode } = req.body || {};

    const resolvedName = String(name || "").trim();
    const resolvedCode = String(code || "").trim() || null;
    const resolvedInitialPackageName = String(initialPackageName || "").trim();
    const resolvedInitialPackageCode = String(initialPackageCode || "").trim() || null;

    if (!resolvedName) {
      return res.status(400).json({ message: "اسم المشروع إجباري" });
    }

    if (!resolvedInitialPackageName) {
      return res.status(400).json({ message: "اسم أول بكج إجباري" });
    }

    const existingProject = await query(
      `SELECT id FROM projects WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [resolvedName]
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
      [resolvedName, resolvedCode]
    );

    const projectRow = insertedProject.rows[0];
    const projectId = String(projectRow.id);

    const insertedPackage = await query(
      `
      INSERT INTO packages (project_id, name, code, is_active)
      VALUES ($1, $2, $3, TRUE)
      RETURNING id, project_id, name, code, is_active
      `,
      [projectId, resolvedInitialPackageName, resolvedInitialPackageCode]
    );

    const packageRow = insertedPackage.rows[0];

    return res.status(201).json({
      message: "تم إنشاء المشروع وأول بكج بنجاح",
      project: {
        id: projectId,
        name: projectRow.name,
        code: projectRow.code || "",
        status: projectRow.is_active ? "active" : "inactive",
        packages: [
          {
            id: String(packageRow.id),
            projectId: String(packageRow.project_id),
            name: packageRow.name,
            code: packageRow.code || "",
            status: packageRow.is_active ? "active" : "inactive"
          }
        ]
      }
    });
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({
      message: error.message || "Failed to create project."
    });
  }
});

// تعديل مشروع
router.put("/:projectId", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();
    const { name, code, status } = req.body || {};

    const resolvedName = String(name || "").trim();
    const resolvedCode = String(code || "").trim() || null;
    const resolvedStatus = String(status || "active").trim().toLowerCase();
    const isActive = resolvedStatus !== "inactive";

    if (!projectId) {
      return res.status(400).json({ message: "معرف المشروع غير صالح" });
    }

    if (!resolvedName) {
      return res.status(400).json({ message: "اسم المشروع إجباري" });
    }

    const exists = await query(
      `SELECT id FROM projects WHERE id = $1 LIMIT 1`,
      [projectId]
    );

    if (exists.rows.length === 0) {
      return res.status(404).json({ message: "المشروع غير موجود" });
    }

    const duplicate = await query(
      `
      SELECT id
      FROM projects
      WHERE LOWER(name) = LOWER($1) AND id <> $2
      LIMIT 1
      `,
      [resolvedName, projectId]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({ message: "يوجد مشروع آخر بنفس الاسم" });
    }

    const updated = await query(
      `
      UPDATE projects
      SET name = $1,
          code = $2,
          is_active = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING id, name, code, is_active
      `,
      [resolvedName, resolvedCode, isActive, projectId]
    );

    const row = updated.rows[0];

    return res.json({
      message: "تم تعديل المشروع بنجاح",
      project: {
        id: String(row.id),
        name: row.name,
        code: row.code || "",
        status: row.is_active ? "active" : "inactive"
      }
    });
  } catch (error) {
    console.error("Update project error:", error);
    return res.status(500).json({
      message: error.message || "Failed to update project."
    });
  }
});

// حذف مشروع (البكجات تحذف معه تلقائيًا)
router.delete("/:projectId", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();

    if (!projectId) {
      return res.status(400).json({ message: "معرف المشروع غير صالح" });
    }

    const exists = await query(
      `SELECT id FROM projects WHERE id = $1 LIMIT 1`,
      [projectId]
    );

    if (exists.rows.length === 0) {
      return res.status(404).json({ message: "المشروع غير موجود" });
    }

    await query(`DELETE FROM projects WHERE id = $1`, [projectId]);

    return res.json({ message: "تم حذف المشروع بنجاح" });
  } catch (error) {
    console.error("Delete project error:", error);
    return res.status(500).json({
      message: error.message || "Failed to delete project."
    });
  }
});

// إضافة بكج لمشروع موجود
router.post("/packages", async (req, res) => {
  try {
    const { projectId, name, code } = req.body || {};

    const resolvedProjectId = String(projectId || "").trim();
    const resolvedName = String(name || "").trim();
    const resolvedCode = String(code || "").trim() || null;

    if (!resolvedProjectId || !resolvedName) {
      return res.status(400).json({ message: "اسم البكج والمشروع إجباريان" });
    }

    const projectExists = await query(
      `SELECT id, name FROM projects WHERE id = $1 LIMIT 1`,
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
      [resolvedProjectId, resolvedName]
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
      [resolvedProjectId, resolvedName, resolvedCode]
    );

    const row = inserted.rows[0];

    return res.status(201).json({
      message: "تم إنشاء البكج بنجاح",
      package: {
        id: String(row.id),
        projectId: String(row.project_id),
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

// تعديل بكج
router.put("/packages/:packageId", async (req, res) => {
  try {
    const packageId = String(req.params.packageId || "").trim();
    const { name, code, status } = req.body || {};

    const resolvedName = String(name || "").trim();
    const resolvedCode = String(code || "").trim() || null;
    const resolvedStatus = String(status || "active").trim().toLowerCase();
    const isActive = resolvedStatus !== "inactive";

    if (!packageId) {
      return res.status(400).json({ message: "معرف البكج غير صالح" });
    }

    if (!resolvedName) {
      return res.status(400).json({ message: "اسم البكج إجباري" });
    }

    const existingPackage = await query(
      `
      SELECT id, project_id
      FROM packages
      WHERE id = $1
      LIMIT 1
      `,
      [packageId]
    );

    if (existingPackage.rows.length === 0) {
      return res.status(404).json({ message: "البكج غير موجود" });
    }

    const projectId = String(existingPackage.rows[0].project_id);

    const duplicate = await query(
      `
      SELECT id
      FROM packages
      WHERE project_id = $1
        AND LOWER(name) = LOWER($2)
        AND id <> $3
      LIMIT 1
      `,
      [projectId, resolvedName, packageId]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({ message: "يوجد بكج آخر بنفس الاسم في هذا المشروع" });
    }

    const updated = await query(
      `
      UPDATE packages
      SET name = $1,
          code = $2,
          is_active = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING id, project_id, name, code, is_active
      `,
      [resolvedName, resolvedCode, isActive, packageId]
    );

    const row = updated.rows[0];

    return res.json({
      message: "تم تعديل البكج بنجاح",
      package: {
        id: String(row.id),
        projectId: String(row.project_id),
        name: row.name,
        code: row.code || "",
        status: row.is_active ? "active" : "inactive"
      }
    });
  } catch (error) {
    console.error("Update package error:", error);
    return res.status(500).json({
      message: error.message || "Failed to update package."
    });
  }
});

// حذف بكج
router.delete("/packages/:packageId", async (req, res) => {
  try {
    const packageId = String(req.params.packageId || "").trim();

    if (!packageId) {
      return res.status(400).json({ message: "معرف البكج غير صالح" });
    }

    const exists = await query(
      `SELECT id FROM packages WHERE id = $1 LIMIT 1`,
      [packageId]
    );

    if (exists.rows.length === 0) {
      return res.status(404).json({ message: "البكج غير موجود" });
    }

    await query(`DELETE FROM packages WHERE id = $1`, [packageId]);

    return res.json({ message: "تم حذف البكج بنجاح" });
  } catch (error) {
    console.error("Delete package error:", error);
    return res.status(500).json({
      message: error.message || "Failed to delete package."
    });
  }
});

export default router;