import express from "express";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";

const router = express.Router();

router.use(requireAuth);

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase() === "inactive" ? false : true;
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function getCurrentUserId(req) {
  return req.user?.id || req.user?.userId || req.user?.user_id || null;
}

function isHighAccessRole(req) {
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

function cleanUuid(value) {
  const text = String(value || "").trim();
  return text || null;
}

async function canManageProject(req, projectId) {
  if (isHighAccessRole(req)) return true;

  const userId = getCurrentUserId(req);
  if (!userId) return false;

  const result = await query(
    `
    SELECT id
    FROM projects
    WHERE id = $1
      AND manager_id = $2
    LIMIT 1
    `,
    [projectId, userId]
  );

  return result.rows.length > 0;
}

async function canManagePackage(req, packageId) {
  if (isHighAccessRole(req)) return true;

  const userId = getCurrentUserId(req);
  if (!userId) return false;

  const result = await query(
    `
    SELECT pk.id
    FROM packages pk
    LEFT JOIN projects p ON p.id = pk.project_id
    WHERE pk.id = $1
      AND (
        pk.manager_id = $2
        OR p.manager_id = $2
      )
    LIMIT 1
    `,
    [packageId, userId]
  );

  return result.rows.length > 0;
}

/*
  مهم:
  هذا الراوت لازم يكون قبل /:projectId
*/
router.get("/archived", async (req, res) => {
  try {
    const seeAll = isHighAccessRole(req);
    const userId = getCurrentUserId(req);

    let projectWhere = `WHERE p.is_active = FALSE`;
    const projectParams = [];

    if (!seeAll) {
      projectParams.push(userId);
      projectWhere += `
        AND (
          p.manager_id = $1
          OR EXISTS (
            SELECT 1
            FROM packages pk2
            WHERE pk2.project_id = p.id
              AND pk2.manager_id = $1
          )
        )
      `;
    }

    const projectsResult = await query(
      `
      SELECT
        p.id,
        p.name,
        p.code,
        p.is_active,
        p.created_at,
        p.manager_id AS "managerId",
        COALESCE(u.full_name, u.name, u.username) AS "managerName"
      FROM projects p
      LEFT JOIN users u ON u.id = p.manager_id
      ${projectWhere}
      ORDER BY p.created_at DESC
      `,
      projectParams
    );

    let packageWhere = `WHERE pk.is_active = FALSE`;
    const packageParams = [];

    if (!seeAll) {
      packageParams.push(userId);
      packageWhere += `
        AND (
          pk.manager_id = $1
          OR p.manager_id = $1
        )
      `;
    }

    const packagesResult = await query(
      `
      SELECT
        pk.id,
        pk.project_id,
        pk.name,
        pk.code,
        pk.is_active,
        pk.created_at,
        pk.manager_id AS "managerId",
        COALESCE(u.full_name, u.name, u.username) AS "managerName",
        p.name AS "projectName"
      FROM packages pk
      LEFT JOIN projects p ON p.id = pk.project_id
      LEFT JOIN users u ON u.id = pk.manager_id
      ${packageWhere}
      ORDER BY pk.created_at DESC
      `,
      packageParams
    );

    return res.json({
      projects: projectsResult.rows.map((row) => ({
        id: String(row.id),
        name: row.name,
        code: row.code || "",
        status: row.is_active ? "active" : "inactive",
        managerId: row.managerId || "",
        managerName: row.managerName || "-",
      })),
      packages: packagesResult.rows.map((row) => ({
        id: String(row.id),
        projectId: String(row.project_id),
        projectName: row.projectName || "-",
        name: row.name,
        code: row.code || "",
        status: row.is_active ? "active" : "inactive",
        managerId: row.managerId || "",
        managerName: row.managerName || "-",
      })),
    });
  } catch (error) {
    console.error("Get archived projects error:", error);
    return res.status(500).json({
      message: "Failed to load archived data.",
      error: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const seeAll = isHighAccessRole(req);
    const userId = getCurrentUserId(req);

    let projectsWhere = `WHERE p.is_active = TRUE`;
    const params = [];

    if (!seeAll) {
      params.push(userId);
      projectsWhere += `
        AND (
          p.manager_id = $1
          OR EXISTS (
            SELECT 1
            FROM packages pk2
            WHERE pk2.project_id = p.id
              AND pk2.manager_id = $1
              AND pk2.is_active = TRUE
          )
        )
      `;
    }

    const projectsResult = await query(
      `
      SELECT
        p.id,
        p.name,
        p.code,
        p.is_active,
        p.created_at,
        p.manager_id AS "managerId",
        COALESCE(u.full_name, u.name, u.username) AS "managerName"
      FROM projects p
      LEFT JOIN users u ON u.id = p.manager_id
      ${projectsWhere}
      ORDER BY p.created_at DESC
      `,
      params
    );

    const projectIds = projectsResult.rows.map((project) => project.id);

    let packagesRows = [];

    if (projectIds.length > 0) {
      let packagesWhere = `
        WHERE pk.is_active = TRUE
          AND pk.project_id = ANY($1::uuid[])
      `;

      const packageParams = [projectIds];

      if (!seeAll) {
        packageParams.push(userId);
        packagesWhere += `
          AND (
            pk.manager_id = $2
            OR p.manager_id = $2
          )
        `;
      }

      const packagesResult = await query(
        `
        SELECT
          pk.id,
          pk.project_id,
          pk.name,
          pk.code,
          pk.is_active,
          pk.created_at,
          pk.manager_id AS "managerId",
          COALESCE(u.full_name, u.name, u.username) AS "managerName"
        FROM packages pk
        LEFT JOIN projects p ON p.id = pk.project_id
        LEFT JOIN users u ON u.id = pk.manager_id
        ${packagesWhere}
        ORDER BY pk.created_at DESC
        `,
        packageParams
      );

      packagesRows = packagesResult.rows;
    }

    const packages = packagesRows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      name: row.name,
      code: row.code || "",
      status: row.is_active ? "active" : "inactive",
      managerId: row.managerId || "",
      managerName: row.managerName || "-",
    }));

    const projects = projectsResult.rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      code: row.code || "",
      status: row.is_active ? "active" : "inactive",
      managerId: row.managerId || "",
      managerName: row.managerName || "-",
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
    if (!isHighAccessRole(req)) {
      return res.status(403).json({
        message: "You do not have permission to create projects",
      });
    }

    const { name, code, initialPackageName, initialPackageCode } = req.body || {};

    const projectName = String(name || "").trim();
    const projectCode = String(code || "").trim() || null;
    const packageName = String(initialPackageName || "").trim();
    const packageCode = String(initialPackageCode || "").trim() || null;
    const managerId = cleanUuid(req.body.managerId);
    const packageManagerId = cleanUuid(req.body.packageManagerId) || managerId;

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
      INSERT INTO projects (name, code, manager_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, TRUE, NOW(), NOW())
      RETURNING id, name, code, manager_id, is_active
      `,
      [projectName, projectCode, managerId]
    );

    const projectId = String(insertedProject.rows[0].id);

    const insertedPackage = await query(
      `
      INSERT INTO packages (project_id, name, code, manager_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
      RETURNING id, project_id, name, code, manager_id, is_active
      `,
      [projectId, packageName, packageCode, packageManagerId]
    );

    return res.status(201).json({
      message: "تم إنشاء المشروع وأول بكج بنجاح",
      project: {
        id: projectId,
        name: insertedProject.rows[0].name,
        code: insertedProject.rows[0].code || "",
        managerId: insertedProject.rows[0].manager_id || "",
        status: insertedProject.rows[0].is_active ? "active" : "inactive",
        packages: [
          {
            id: String(insertedPackage.rows[0].id),
            projectId: String(insertedPackage.rows[0].project_id),
            name: insertedPackage.rows[0].name,
            code: insertedPackage.rows[0].code || "",
            managerId: insertedPackage.rows[0].manager_id || "",
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

router.post("/packages", async (req, res) => {
  try {
    const { projectId, name, code } = req.body || {};

    const resolvedProjectId = String(projectId || "").trim();
    const packageName = String(name || "").trim();
    const packageCode = String(code || "").trim() || null;
    const managerId = cleanUuid(req.body.managerId);

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

    const allowed = await canManageProject(req, resolvedProjectId);
    if (!allowed) {
      return res.status(403).json({
        message: "You do not have permission to add packages to this project",
      });
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
      INSERT INTO packages (project_id, name, code, manager_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
      RETURNING id, project_id, name, code, manager_id, is_active
      `,
      [resolvedProjectId, packageName, packageCode, managerId]
    );

    return res.status(201).json({
      message: "تم إنشاء البكج بنجاح",
      package: {
        id: String(inserted.rows[0].id),
        projectId: String(inserted.rows[0].project_id),
        name: inserted.rows[0].name,
        code: inserted.rows[0].code || "",
        managerId: inserted.rows[0].manager_id || "",
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

router.put("/packages/:packageId/restore", async (req, res) => {
  try {
    const packageId = String(req.params.packageId || "").trim();

    const allowed = await canManagePackage(req, packageId);
    if (!allowed) {
      return res.status(403).json({
        message: "You do not have permission to restore this package",
      });
    }

    await query(
      `
      UPDATE packages
      SET is_active = TRUE,
          updated_at = NOW()
      WHERE id = $1
      `,
      [packageId]
    );

    return res.json({ message: "تم استرجاع البكج بنجاح" });
  } catch (error) {
    console.error("Restore package error:", error);
    return res.status(500).json({
      message: error.message || "Failed to restore package.",
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
    const managerId = req.body.managerId !== undefined ? cleanUuid(req.body.managerId) : undefined;

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

    const allowed = await canManagePackage(req, packageId);
    if (!allowed) {
      return res.status(403).json({
        message: "You do not have permission to manage this package",
      });
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

    const params = [packageName, packageCode, isActive, packageId];
    let managerSql = "";

    if (managerId !== undefined && isHighAccessRole(req)) {
      params.push(managerId);
      managerSql = `, manager_id = $${params.length}`;
    }

    await query(
      `
      UPDATE packages
      SET name = $1,
          code = $2,
          is_active = $3,
          updated_at = NOW()
          ${managerSql}
      WHERE id = $4
      `,
      params
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

    const allowed = await canManagePackage(req, packageId);
    if (!allowed) {
      return res.status(403).json({
        message: "You do not have permission to archive this package",
      });
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

router.put("/:projectId/restore", async (req, res) => {
  try {
    const projectId = String(req.params.projectId || "").trim();

    const allowed = await canManageProject(req, projectId);
    if (!allowed) {
      return res.status(403).json({
        message: "You do not have permission to restore this project",
      });
    }

    await query(
      `
      UPDATE projects
      SET is_active = TRUE,
          updated_at = NOW()
      WHERE id = $1
      `,
      [projectId]
    );

    await query(
      `
      UPDATE packages
      SET is_active = TRUE,
          updated_at = NOW()
      WHERE project_id = $1
      `,
      [projectId]
    );

    return res.json({ message: "تم استرجاع المشروع والبكجات التابعة له بنجاح" });
  } catch (error) {
    console.error("Restore project error:", error);
    return res.status(500).json({
      message: error.message || "Failed to restore project.",
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
    const managerId = req.body.managerId !== undefined ? cleanUuid(req.body.managerId) : undefined;

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

    const allowed = await canManageProject(req, projectId);
    if (!allowed) {
      return res.status(403).json({
        message: "You do not have permission to manage this project",
      });
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

    const params = [projectName, projectCode, isActive, projectId];
    let managerSql = "";

    if (managerId !== undefined && isHighAccessRole(req)) {
      params.push(managerId);
      managerSql = `, manager_id = $${params.length}`;
    }

    await query(
      `
      UPDATE projects
      SET name = $1,
          code = $2,
          is_active = $3,
          updated_at = NOW()
          ${managerSql}
      WHERE id = $4
      `,
      params
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

    const allowed = await canManageProject(req, projectId);
    if (!allowed) {
      return res.status(403).json({
        message: "You do not have permission to archive this project",
      });
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

export default router;
