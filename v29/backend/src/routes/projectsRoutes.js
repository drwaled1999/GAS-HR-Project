router.post("/packages", async (req, res) => {
  try {
    const { name, packageName, code, projectId } = req.body || {};

    const resolvedName = String(name || packageName || "").trim();
    const router = Router();
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
