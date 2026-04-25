import express from "express";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.use(requireAuth);

function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "inactive" ? false : true;
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function canSeeAllProjects(req) {
  const role = normalizeRole(req.user?.roleCode || req.user?.role || req.user?.roleName);

  return [
    "owner",
    "system owner",
    "system_owner",
    "hr_manager",
    "hr manager",
    "hr_admin",
    "hr admin",
    "hr",
    "admin",
  ].includes(role);
}

function getUserProjectName(req) {
  return (
    req.user?.projectName ||
    req.user?.project_name ||
    req.user?.project ||
    ""
  );
}

router.get("/", async (req, res) => {
  try {
    const seeAll = canSeeAllProjects(req);
    const userProjectName = String(getUserProjectName(req) || "").trim();

    let projectWhere = `WHERE is_active = TRUE`;
    const projectParams = [];

    if (!seeAll && userProjectName) {
      projectWhere += ` AND LOWER(name) = LOWER($1)`;
      projectParams.push(userProjectName);
    }

    const projectsResult = await query(
      `
      SELECT id, name, code, is_active, created_at
      FROM projects
      ${projectWhere}
      ORDER BY created_at DESC
      `,
      projectParams
    );

    const projectIds = projectsResult.rows.map((project) => project.id);

    let packagesRows = [];

    if (projectIds.length > 0) {
      const packagesResult = await query(
        `
        SELECT id, project_id, name, code, is_active, created_at
        FROM packages
        WHERE is_active = TRUE
          AND project_id = ANY($1::uuid[])
        ORDER BY created_at DESC
        `,
        [projectIds]
      );

      packagesRows = packagesResult.rows;
    }

    const packages = packagesRows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      name: row.name,
      code: row.code || "",
      status: row.is_active ? "active" : "inactive",
    }));

    const projects = projectsResult.rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      code: row.code || "",
      status: row.is_active ? "active" : "inactive",
      packages: packages.filter((pkg) => pkg.projectId === String(row.id)),
    }));

    return res.json({ projects, packages });
  } catch (error) {
    console.error("Get projects error:", error);
    return res.status(500).json({
      message: "Failed to load projects.",
      error: error.message,
    });
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
      `
      SELECT id
      FROM projects
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1
      `,
      [projectName]
    );

    if (existingProject.rows.length > 0) {
      return res.status(409).json({ message: "المشروع موجود مسبقًا" });
    }

    if (projectCode) {
      const duplicateCode = await query(
        `
        SELECT id
        FROM projects
        WHERE LOWER(code) = LOWER($1)
        LIMIT 1
        `,
        [projectCode]
      );

      if (duplicateCode.rows.length > 0) {
        return res.status(409).json({ message: "كود المشروع مستخدم مسبقًا" });
      }
    }

    const insertedProject = await query(
      `
      INSERT INTO projects (name, code, is_active, created_at, updated_at)
      VALUES ($1, $2, TRUE, NOW(), NOW())
      RETURNING id, name, code, is_active
      `,
      [projectName, projectCode]
    );

    const projectId = String(insertedProject.rows[0].id);

    const insertedPackage = await query(
      `
      INSERT INTO packages (project_id, name, code, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, TRUE, NOW(), NOW())
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
            status: insertedPackage.rows[0].is_active ? "active" : "inactive",
          },
        ],
      },
    });
  } catch (error) {
    console.error("Create project error:", error);
    return res.status(500).json({
      message: error.message || "Failed to create project.",
      error: error.message,
    });
  }
});

router.put("/:projectId", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();
    const { name, code, status } = req.body || {};

    const projectName = String(name || "").trim();
    const projectCode = String(code || "").trim() || null;
    const isActive = normalizeStatus(status);

    if (!projectId) {
      return res.status(400).json({ message: "معرف المشروع غير صالح" });
    }

    if (!projectName) {
      return res.status(400).json({ message: "اسم المشروع إجباري" });
    }

    const existing = await query(
      `
      SELECT id
      FROM projects
      WHERE id = $1
      LIMIT 1
      `,
      [projectId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "المشروع غير موجود" });
    }

    const duplicateName = await query(
      `
      SELECT id
      FROM projects
      WHERE LOWER(name) = LOWER($1)
        AND id <> $2
      LIMIT 1
      `,
      [projectName, projectId]
    );

    if (duplicateName.rows.length > 0) {
      return res.status(409).json({ message: "يوجد مشروع آخر بنفس الاسم" });
    }

    if (projectCode) {
      const duplicateCode = await query(
        `
        SELECT id
        FROM projects
        WHERE LOWER(code) = LOWER($1)
          AND id <> $2
        LIMIT 1
        `,
        [projectCode, projectId]
      );

      if (duplicateCode.rows.length > 0) {
        return res.status(409).json({ message: "يوجد مشروع آخر بنفس الكود" });
      }
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
    return res.status(500).json({
      message: error.message || "Failed to update project.",
      error: error.message,
    });
  }
});

router.delete("/:projectId", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();

    const existing = await query(
      `
      SELECT id
      FROM projects
      WHERE id = $1
      LIMIT 1
      `,
      [projectId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "المشروع غير موجود" });
    }

    await query(
      `
      UPDATE projects
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      `,
      [projectId]
    );

    await query(
      `
      UPDATE packages
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE project_id = $1
      `,
      [projectId]
    );

    return res.json({ message: "تم أرشفة المشروع والبكجات التابعة له بنجاح" });
  } catch (error) {
    console.error("Archive project error:", error);
    return res.status(500).json({
      message: error.message || "Failed to archive project.",
      error: error.message,
    });
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
      `
      SELECT id
      FROM projects
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [resolvedProjectId]
    );

    if (projectExists.rows.length === 0) {
      return res.status(404).json({ message: "المشروع غير موجود أو غير نشط" });
    }

    const duplicate = await query(
      `
      SELECT id
      FROM packages
      WHERE project_id = $1
        AND LOWER(name) = LOWER($2)
      LIMIT 1
      `,
      [resolvedProjectId, packageName]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({ message: "البكج موجود مسبقًا لهذا المشروع" });
    }

    if (packageCode) {
      const duplicateCode = await query(
        `
        SELECT id
        FROM packages
        WHERE project_id = $1
          AND LOWER(code) = LOWER($2)
        LIMIT 1
        `,
        [resolvedProjectId, packageCode]
      );

      if (duplicateCode.rows.length > 0) {
        return res.status(409).json({ message: "كود البكج مستخدم مسبقًا في هذا المشروع" });
      }
    }

    const inserted = await query(
      `
      INSERT INTO packages (project_id, name, code, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, TRUE, NOW(), NOW())
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
        status: inserted.rows[0].is_active ? "active" : "inactive",
      },
    });
  } catch (error) {
    console.error("Create package error:", error);
    return res.status(500).json({
      message: error.message || "Failed to create package.",
      error: error.message,
    });
  }
});

router.put("/packages/:packageId", async (req, res) => {
  try {
    const packageId = String(req.params.packageId || "").trim();
    const { name, code, status } = req.body || {};

    const packageName = String(name || "").trim();
    const packageCode = String(code || "").trim() || null;
    const isActive = normalizeStatus(status);

    if (!packageId) {
      return res.status(400).json({ message: "معرف البكج غير صالح" });
    }

    if (!packageName) {
      return res.status(400).json({ message: "اسم البكج إجباري" });
    }

    const existing = await query(
      `
      SELECT id, project_id
      FROM packages
      WHERE id = $1
      LIMIT 1
      `,
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
      WHERE project_id = $1
        AND LOWER(name) = LOWER($2)
        AND id <> $3
      LIMIT 1
      `,
      [projectId, packageName, packageId]
    );

    if (duplicate.rows.length > 0) {
      return res.status(409).json({ message: "يوجد بكج آخر بنفس الاسم" });
    }

    if (packageCode) {
      const duplicateCode = await query(
        `
        SELECT id
        FROM packages
        WHERE project_id = $1
          AND LOWER(code) = LOWER($2)
          AND id <> $3
        LIMIT 1
        `,
        [projectId, packageCode, packageId]
      );

      if (duplicateCode.rows.length > 0) {
        return res.status(409).json({ message: "يوجد بكج آخر بنفس الكود" });
      }
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
    return res.status(500).json({
      message: error.message || "Failed to update package.",
      error: error.message,
    });
  }
});

router.delete("/packages/:packageId", async (req, res) => {
  try {
    const packageId = String(req.params.packageId || "").trim();

    const existing = await query(
      `
      SELECT id
      FROM packages
      WHERE id = $1
      LIMIT 1
      `,
      [packageId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "البكج غير موجود" });
    }

    await query(
      `
      UPDATE packages
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      `,
      [packageId]
    );

    return res.json({ message: "تم أرشفة البكج بنجاح" });
  } catch (error) {
    console.error("Archive package error:", error);
    return res.status(500).json({
      message: error.message || "Failed to archive package.",
      error: error.message,
    });
  }
});

export default router;
