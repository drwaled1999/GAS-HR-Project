import { query } from "../data/index.js";
import {
  calculateAttendanceDisciplineScore,
  calculatePunctualityScore,
  calculateOverallAutoScore,
} from "../services/performanceAutoScoreService.js";

function clean(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function roleValues(req) {
  return [req.user?.role, req.user?.roleName, req.user?.roleCode]
    .map((v) => clean(v).toLowerCase())
    .filter(Boolean);
}

function isSystemOwner(req) {
  return roleValues(req).some((r) =>
    ["owner", "system owner", "system_owner"].includes(r)
  );
}

function isHRManager(req) {
  return roleValues(req).some((r) =>
    ["hr manager", "hr_manager"].includes(r)
  );
}

function isHR(req) {
  return roleValues(req).some((r) =>
    ["hr", "hr admin", "hr_admin", "admin", "admin assistant", "admin_assistant"].includes(r)
  );
}

function isSupervisor(req) {
  return roleValues(req).some((r) =>
    ["supervisor", "engineer", "cm", "project manager", "project_manager"].includes(r)
  );
}

function canManageTemplates(req) {
  return isSystemOwner(req) || isHRManager(req);
}

function canViewAll(req) {
  return isSystemOwner(req) || isHRManager(req) || isHR(req);
}

function userId(req) {
  return req.user?.id || null;
}

function userName(req) {
  return req.user?.name || req.user?.username || "Unknown User";
}

async function auditLog({ reviewId = null, templateId = null, req, action, details = {} }) {
  await query(
    `
    INSERT INTO performance_review_audit_logs
    (review_id, template_id, user_id, user_name, action, details, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,NOW())
    `,
    [reviewId, templateId, userId(req), userName(req), action, details]
  );
}

function finalRating(score) {
  const n = Number(score || 0);
  if (n >= 90) return "Outstanding";
  if (n >= 80) return "Exceeds Expectations";
  if (n >= 70) return "Meets Expectations";
  if (n >= 60) return "Needs Improvement";
  return "Unsatisfactory";
}

async function recalcReview(reviewId) {
  const result = await query(
    `
    SELECT
      COALESCE(SUM((COALESCE(final_score, supervisor_score, hr_score, employee_score, 0) / 10.0) * weight), 0) AS total_score
    FROM performance_review_scores
    WHERE review_id = $1
      AND include_in_score = true
      AND score_type <> 'text'
    `,
    [reviewId]
  );

  const totalScore = Number(result.rows[0]?.total_score || 0);
  const rating = finalRating(totalScore);

  await query(
    `
    UPDATE performance_reviews
    SET total_score = $2,
        final_rating = $3,
        updated_at = NOW()
    WHERE id = $1
    `,
    [reviewId, totalScore, rating]
  );

  return { totalScore, rating };
}

async function getReviewAccess(req, reviewId) {
  const result = await query(
    `
    SELECT *
    FROM performance_reviews
    WHERE id = $1
    LIMIT 1
    `,
    [reviewId]
  );

  const review = result.rows[0];
  if (!review) return { allowed: false, status: 404, message: "Review not found" };

  if (canViewAll(req)) return { allowed: true, review };

  const reqEmployeeId = clean(req.user?.employeeId || req.user?.employee_id);
  if (reqEmployeeId && clean(review.employee_id) === reqEmployeeId) {
    return { allowed: true, review };
  }

  if (isSupervisor(req)) {
    const myProject = clean(req.user?.projectName || req.user?.project_name).toLowerCase();
    const myPackage = clean(req.user?.packageName || req.user?.package_name).toLowerCase();
    const reviewProject = clean(review.project_name).toLowerCase();
    const reviewPackage = clean(review.package_name).toLowerCase();

    if (myProject && myProject === reviewProject) {
      if (!myPackage || !reviewPackage || myPackage === reviewPackage) {
        return { allowed: true, review };
      }
    }
  }

  return { allowed: false, status: 403, message: "You do not have access to this review" };
}

export async function listTemplates(req, res) {
  try {
    const result = await query(
      `
      SELECT
        t.*,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', i.id,
                'title', i.title,
                'description', i.description,
                'weight', i.weight,
                'scoreType', i.score_type,
                'isRequired', i.is_required,
                'includeInScore', i.include_in_score,
                'visibleToEmployee', i.visible_to_employee,
                'autoScoreKey', i.auto_score_key,
                'sortOrder', i.sort_order
              )
              ORDER BY i.sort_order ASC, i.created_at ASC
            )
            FROM performance_review_template_items i
            WHERE i.template_id = t.id
          ),
          '[]'::json
        ) AS items
      FROM performance_review_templates t
      ORDER BY t.created_at DESC
      `
    );

    return res.json({ templates: result.rows });
  } catch (error) {
    console.error("listTemplates error:", error);
    return res.status(500).json({ message: "Failed to load templates", error: error.message });
  }
}

export async function createTemplate(req, res) {
  try {
    if (!canManageTemplates(req)) {
      return res.status(403).json({ message: "HR Manager access required" });
    }

    const name = clean(req.body.name);
    const reviewType = clean(req.body.reviewType || req.body.review_type, "annual");
    const description = clean(req.body.description, null);
    const allowSelfReview = req.body.allowSelfReview ?? req.body.allow_self_review ?? true;

    if (!name) return res.status(400).json({ message: "Template name is required" });

    const result = await query(
      `
      INSERT INTO performance_review_templates
      (name, review_type, description, status, allow_self_review, created_by, created_at, updated_at)
      VALUES ($1,$2,$3,'draft',$4,$5,NOW(),NOW())
      RETURNING *
      `,
      [name, reviewType, description, Boolean(allowSelfReview), userId(req)]
    );

    await auditLog({
      req,
      templateId: result.rows[0].id,
      action: "template_created",
      details: { name, reviewType },
    });

    return res.status(201).json({
      message: "Template created successfully",
      template: result.rows[0],
    });
  } catch (error) {
    console.error("createTemplate error:", error);
    return res.status(500).json({ message: "Failed to create template", error: error.message });
  }
}

export async function updateTemplate(req, res) {
  try {
    if (!canManageTemplates(req)) {
      return res.status(403).json({ message: "HR Manager access required" });
    }

    const { id } = req.params;

    const existing = await query(`SELECT * FROM performance_review_templates WHERE id = $1`, [id]);
    if (!existing.rows[0]) return res.status(404).json({ message: "Template not found" });

    if (existing.rows[0].status === "locked") {
      return res.status(400).json({ message: "Locked template cannot be edited. Duplicate it first." });
    }

    const result = await query(
      `
      UPDATE performance_review_templates
      SET
        name = COALESCE($2, name),
        review_type = COALESCE($3, review_type),
        description = COALESCE($4, description),
        allow_self_review = COALESCE($5, allow_self_review),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        req.body.name ?? null,
        req.body.reviewType ?? req.body.review_type ?? null,
        req.body.description ?? null,
        req.body.allowSelfReview ?? req.body.allow_self_review ?? null,
      ]
    );

    await auditLog({
      req,
      templateId: id,
      action: "template_updated",
      details: req.body,
    });

    return res.json({ message: "Template updated successfully", template: result.rows[0] });
  } catch (error) {
    console.error("updateTemplate error:", error);
    return res.status(500).json({ message: "Failed to update template", error: error.message });
  }
}

export async function duplicateTemplate(req, res) {
  try {
    if (!canManageTemplates(req)) {
      return res.status(403).json({ message: "HR Manager access required" });
    }

    const { id } = req.params;

    const original = await query(`SELECT * FROM performance_review_templates WHERE id = $1`, [id]);
    if (!original.rows[0]) return res.status(404).json({ message: "Template not found" });

    const inserted = await query(
      `
      INSERT INTO performance_review_templates
      (name, review_type, description, version, status, allow_self_review, created_by, created_at, updated_at)
      VALUES ($1,$2,$3,$4,'draft',$5,$6,NOW(),NOW())
      RETURNING *
      `,
      [
        `${original.rows[0].name} Copy`,
        original.rows[0].review_type,
        original.rows[0].description,
        Number(original.rows[0].version || 1) + 1,
        original.rows[0].allow_self_review,
        userId(req),
      ]
    );

    const newTemplate = inserted.rows[0];

    await query(
      `
      INSERT INTO performance_review_template_items
      (template_id, title, description, weight, score_type, is_required, include_in_score, visible_to_employee, auto_score_key, sort_order, created_at)
      SELECT
        $2, title, description, weight, score_type, is_required, include_in_score, visible_to_employee, auto_score_key, sort_order, NOW()
      FROM performance_review_template_items
      WHERE template_id = $1
      `,
      [id, newTemplate.id]
    );

    await auditLog({
      req,
      templateId: newTemplate.id,
      action: "template_duplicated",
      details: { fromTemplateId: id },
    });

    return res.status(201).json({
      message: "Template duplicated successfully",
      template: newTemplate,
    });
  } catch (error) {
    console.error("duplicateTemplate error:", error);
    return res.status(500).json({ message: "Failed to duplicate template", error: error.message });
  }
}

export async function updateTemplateStatus(req, res) {
  try {
    if (!canManageTemplates(req)) {
      return res.status(403).json({ message: "HR Manager access required" });
    }

    const { id } = req.params;
    const status = clean(req.body.status);

    if (!["draft", "active", "archived", "locked"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (status === "active") {
      const weightCheck = await query(
        `
        SELECT COALESCE(SUM(weight), 0) AS total
        FROM performance_review_template_items
        WHERE template_id = $1
          AND include_in_score = true
          AND score_type <> 'text'
        `,
        [id]
      );

      const total = Number(weightCheck.rows[0]?.total || 0);
      if (Math.round(total) !== 100) {
        return res.status(400).json({
          message: "Template weights must equal 100% before activation",
          totalWeight: total,
        });
      }
    }

    const result = await query(
      `
      UPDATE performance_review_templates
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id, status]
    );

    if (!result.rows[0]) return res.status(404).json({ message: "Template not found" });

    await auditLog({
      req,
      templateId: id,
      action: "template_status_updated",
      details: { status },
    });

    return res.json({ message: "Template status updated", template: result.rows[0] });
  } catch (error) {
    console.error("updateTemplateStatus error:", error);
    return res.status(500).json({ message: "Failed to update template status", error: error.message });
  }
}

export async function deleteTemplate(req, res) {
  try {
    if (!canManageTemplates(req)) {
      return res.status(403).json({ message: "HR Manager access required" });
    }

    const { id } = req.params;

    const used = await query(
      `SELECT id FROM performance_reviews WHERE template_id = $1 LIMIT 1`,
      [id]
    );

    if (used.rows[0]) {
      await query(
        `
        UPDATE performance_review_templates
        SET status = 'archived',
            updated_at = NOW()
        WHERE id = $1
        `,
        [id]
      );

      return res.json({ message: "Template is used before, so it has been archived instead of deleted" });
    }

    await query(`DELETE FROM performance_review_templates WHERE id = $1`, [id]);

    await auditLog({
      req,
      templateId: id,
      action: "template_deleted",
      details: {},
    });

    return res.json({ message: "Template deleted successfully" });
  } catch (error) {
    console.error("deleteTemplate error:", error);
    return res.status(500).json({ message: "Failed to delete template", error: error.message });
  }
}

export async function addTemplateItem(req, res) {
  try {
    if (!canManageTemplates(req)) {
      return res.status(403).json({ message: "HR Manager access required" });
    }

    const { id } = req.params;

    const title = clean(req.body.title);
    const scoreType = clean(req.body.scoreType || req.body.score_type, "scale_1_10");

    if (!title) return res.status(400).json({ message: "Item title is required" });

    const result = await query(
      `
      INSERT INTO performance_review_template_items
      (template_id, title, description, weight, score_type, is_required, include_in_score, visible_to_employee, auto_score_key, sort_order, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
      RETURNING *
      `,
      [
        id,
        title,
        req.body.description || null,
        Number(req.body.weight || 0),
        scoreType,
        req.body.isRequired ?? req.body.is_required ?? true,
        req.body.includeInScore ?? req.body.include_in_score ?? true,
        req.body.visibleToEmployee ?? req.body.visible_to_employee ?? true,
        req.body.autoScoreKey ?? req.body.auto_score_key ?? null,
        Number(req.body.sortOrder ?? req.body.sort_order ?? 0),
      ]
    );

    await auditLog({
      req,
      templateId: id,
      action: "template_item_added",
      details: result.rows[0],
    });

    return res.status(201).json({ message: "Item added successfully", item: result.rows[0] });
  } catch (error) {
    console.error("addTemplateItem error:", error);
    return res.status(500).json({ message: "Failed to add item", error: error.message });
  }
}

export async function updateTemplateItem(req, res) {
  try {
    if (!canManageTemplates(req)) {
      return res.status(403).json({ message: "HR Manager access required" });
    }

    const { id } = req.params;

    const result = await query(
      `
      UPDATE performance_review_template_items
      SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        weight = COALESCE($4, weight),
        score_type = COALESCE($5, score_type),
        is_required = COALESCE($6, is_required),
        include_in_score = COALESCE($7, include_in_score),
        visible_to_employee = COALESCE($8, visible_to_employee),
        auto_score_key = COALESCE($9, auto_score_key),
        sort_order = COALESCE($10, sort_order)
      WHERE id = $1
      RETURNING *
      `,
      [
        id,
        req.body.title ?? null,
        req.body.description ?? null,
        req.body.weight ?? null,
        req.body.scoreType ?? req.body.score_type ?? null,
        req.body.isRequired ?? req.body.is_required ?? null,
        req.body.includeInScore ?? req.body.include_in_score ?? null,
        req.body.visibleToEmployee ?? req.body.visible_to_employee ?? null,
        req.body.autoScoreKey ?? req.body.auto_score_key ?? null,
        req.body.sortOrder ?? req.body.sort_order ?? null,
      ]
    );

    if (!result.rows[0]) return res.status(404).json({ message: "Template item not found" });

    await auditLog({
      req,
      templateId: result.rows[0].template_id,
      action: "template_item_updated",
      details: result.rows[0],
    });

    return res.json({ message: "Item updated successfully", item: result.rows[0] });
  } catch (error) {
    console.error("updateTemplateItem error:", error);
    return res.status(500).json({ message: "Failed to update item", error: error.message });
  }
}

export async function deleteTemplateItem(req, res) {
  try {
    if (!canManageTemplates(req)) {
      return res.status(403).json({ message: "HR Manager access required" });
    }

    const { id } = req.params;

    const existing = await query(`SELECT * FROM performance_review_template_items WHERE id = $1`, [id]);
    if (!existing.rows[0]) return res.status(404).json({ message: "Template item not found" });

    await query(`DELETE FROM performance_review_template_items WHERE id = $1`, [id]);

    await auditLog({
      req,
      templateId: existing.rows[0].template_id,
      action: "template_item_deleted",
      details: existing.rows[0],
    });

    return res.json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("deleteTemplateItem error:", error);
    return res.status(500).json({ message: "Failed to delete item", error: error.message });
  }
}

export async function assignReview(req, res) {
  try {
    if (!canViewAll(req) && !isSupervisor(req)) {
      return res.status(403).json({ message: "You do not have permission to assign reviews" });
    }

    const templateId = clean(req.body.templateId || req.body.template_id);
    const employeeIds = Array.isArray(req.body.employeeIds) ? req.body.employeeIds : [];
    const periodStart = clean(req.body.periodStart || req.body.period_start);
    const periodEnd = clean(req.body.periodEnd || req.body.period_end);

    if (!templateId) return res.status(400).json({ message: "Template is required" });
    if (!periodStart || !periodEnd) return res.status(400).json({ message: "Review period is required" });

    const templateResult = await query(
      `SELECT * FROM performance_review_templates WHERE id = $1 AND status = 'active' LIMIT 1`,
      [templateId]
    );

    const template = templateResult.rows[0];
    if (!template) return res.status(404).json({ message: "Active template not found" });

    let employeesSql = `
      SELECT
        e.id,
        e.full_name,
        e.gas_id,
        e.project_name,
        e.package_name,
        e.job_title
      FROM employees e
      WHERE 1=1
    `;
    const params = [];

    if (employeeIds.length > 0) {
      params.push(employeeIds);
      employeesSql += ` AND e.id = ANY($${params.length}::uuid[])`;
    }

    if (req.body.projectName || req.body.project_name) {
      params.push(clean(req.body.projectName || req.body.project_name));
      employeesSql += ` AND LOWER(TRIM(e.project_name)) = LOWER(TRIM($${params.length}))`;
    }

    if (req.body.packageName || req.body.package_name) {
      params.push(clean(req.body.packageName || req.body.package_name));
      employeesSql += ` AND LOWER(TRIM(e.package_name)) = LOWER(TRIM($${params.length}))`;
    }

    employeesSql += ` ORDER BY e.full_name ASC`;

    const employees = await query(employeesSql, params);

    if (employees.rows.length === 0) {
      return res.status(400).json({ message: "No employees found for this assignment" });
    }

    const createdReviews = [];

    for (const emp of employees.rows) {
      const reviewResult = await query(
        `
        INSERT INTO performance_reviews
        (
          template_id,
          employee_id,
          employee_name,
          gas_id,
          project_name,
          package_name,
          job_title,
          review_type,
          period_start,
          period_end,
          status,
          assigned_by,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'assigned',$11,NOW(),NOW())
        RETURNING *
        `,
        [
          templateId,
          emp.id,
          emp.full_name,
          emp.gas_id,
          emp.project_name,
          emp.package_name,
          emp.job_title,
          template.review_type,
          periodStart,
          periodEnd,
          userId(req),
        ]
      );

      const review = reviewResult.rows[0];

      await query(
        `
        INSERT INTO performance_review_scores
        (review_id, template_item_id, title, weight, score_type, include_in_score, auto_score_key, sort_order, created_at, updated_at)
        SELECT
          $1, id, title, weight, score_type, include_in_score, auto_score_key, sort_order, NOW(), NOW()
        FROM performance_review_template_items
        WHERE template_id = $2
        ORDER BY sort_order ASC
        `,
        [review.id, templateId]
      );

      await query(
        `
        INSERT INTO performance_review_recommendations
        (review_id, created_at, updated_at)
        VALUES ($1,NOW(),NOW())
        ON CONFLICT DO NOTHING
        `,
        [review.id]
      );

      await auditLog({
        req,
        reviewId: review.id,
        templateId,
        action: "review_assigned",
        details: { employeeId: emp.id, employeeName: emp.full_name },
      });

      createdReviews.push(review);
    }

    return res.status(201).json({
      message: "Reviews assigned successfully",
      count: createdReviews.length,
      reviews: createdReviews,
    });
  } catch (error) {
    console.error("assignReview error:", error);
    return res.status(500).json({ message: "Failed to assign reviews", error: error.message });
  }
}

export async function listReviews(req, res) {
  try {
    let sql = `
      SELECT *
      FROM performance_reviews
      WHERE 1=1
    `;
    const params = [];

    if (!canViewAll(req)) {
      if (isSupervisor(req)) {
        const projectName = clean(req.user?.projectName || req.user?.project_name);
        const packageName = clean(req.user?.packageName || req.user?.package_name);

        if (projectName) {
          params.push(projectName);
          sql += ` AND LOWER(TRIM(project_name)) = LOWER(TRIM($${params.length}))`;
        }

        if (packageName) {
          params.push(packageName);
          sql += ` AND LOWER(TRIM(package_name)) = LOWER(TRIM($${params.length}))`;
        }
      } else {
        const employeeId = clean(req.user?.employeeId || req.user?.employee_id);
        params.push(employeeId || "00000000-0000-0000-0000-000000000000");
        sql += ` AND employee_id = $${params.length}::uuid`;
      }
    }

    if (req.query.status) {
      params.push(clean(req.query.status));
      sql += ` AND status = $${params.length}`;
    }

    if (req.query.reviewType) {
      params.push(clean(req.query.reviewType));
      sql += ` AND review_type = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, params);

    return res.json({ reviews: result.rows });
  } catch (error) {
    console.error("listReviews error:", error);
    return res.status(500).json({ message: "Failed to load reviews", error: error.message });
  }
}

export async function getReview(req, res) {
  try {
    const access = await getReviewAccess(req, req.params.id);
    if (!access.allowed) {
      return res.status(access.status).json({ message: access.message });
    }

    const scores = await query(
      `
      SELECT *
      FROM performance_review_scores
      WHERE review_id = $1
      ORDER BY sort_order ASC, created_at ASC
      `,
      [req.params.id]
    );

    const recommendation = await query(
      `
      SELECT *
      FROM performance_review_recommendations
      WHERE review_id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    const comments = await query(
      `
      SELECT *
      FROM performance_review_comments
      WHERE review_id = $1
      ORDER BY created_at ASC
      `,
      [req.params.id]
    );

    const signatures = await query(
      `
      SELECT *
      FROM performance_review_signatures
      WHERE review_id = $1
      ORDER BY signed_at ASC
      `,
      [req.params.id]
    );

    return res.json({
      review: access.review,
      scores: scores.rows,
      recommendation: recommendation.rows[0] || null,
      comments: comments.rows,
      signatures: signatures.rows,
    });
  } catch (error) {
    console.error("getReview error:", error);
    return res.status(500).json({ message: "Failed to load review", error: error.message });
  }
}

async function updateScores(req, res, actor) {
  const access = await getReviewAccess(req, req.params.id);
  if (!access.allowed) {
    return res.status(access.status).json({ message: access.message });
  }

  const review = access.review;

  if (["approved", "locked"].includes(review.status) && !isSystemOwner(req)) {
    return res.status(400).json({ message: "Approved or locked review cannot be edited" });
  }

  const scores = Array.isArray(req.body.scores) ? req.body.scores : [];
  if (scores.length === 0) return res.status(400).json({ message: "Scores are required" });

  for (const item of scores) {
    const scoreId = clean(item.id || item.scoreId || item.score_id);
    if (!scoreId) continue;

    if (actor === "employee") {
      await query(
        `
        UPDATE performance_review_scores
        SET employee_score = $2,
            employee_comment = $3,
            updated_at = NOW()
        WHERE id = $1 AND review_id = $4
        `,
        [scoreId, item.score ?? item.employeeScore ?? null, item.comment ?? item.employeeComment ?? null, req.params.id]
      );
    }

    if (actor === "supervisor") {
      await query(
        `
        UPDATE performance_review_scores
        SET supervisor_score = $2,
            supervisor_comment = $3,
            final_score = COALESCE($2, final_score),
            updated_at = NOW()
        WHERE id = $1 AND review_id = $4
        `,
        [scoreId, item.score ?? item.supervisorScore ?? null, item.comment ?? item.supervisorComment ?? null, req.params.id]
      );
    }

    if (actor === "hr") {
      await query(
        `
        UPDATE performance_review_scores
        SET hr_score = $2,
            hr_comment = $3,
            final_score = COALESCE($2, final_score),
            updated_at = NOW()
        WHERE id = $1 AND review_id = $4
        `,
        [scoreId, item.score ?? item.hrScore ?? null, item.comment ?? item.hrComment ?? null, req.params.id]
      );
    }
  }

  let newStatus = review.status;

  if (actor === "employee") newStatus = "self_review_completed";
  if (actor === "supervisor") newStatus = "supervisor_completed";
  if (actor === "hr") newStatus = "hr_reviewed";

  await query(
    `
    UPDATE performance_reviews
    SET status = $2,
        ${actor === "supervisor" ? "supervisor_id = $3," : ""}
        ${actor === "hr" ? "hr_id = $3," : ""}
        updated_at = NOW()
    WHERE id = $1
    `,
    actor === "employee" ? [req.params.id, newStatus] : [req.params.id, newStatus, userId(req)]
  );

  const calc = await recalcReview(req.params.id);

  await auditLog({
    req,
    reviewId: req.params.id,
    action: `${actor}_review_submitted`,
    details: { totalScore: calc.totalScore, rating: calc.rating },
  });

  return res.json({
    message: "Review saved successfully",
    totalScore: calc.totalScore,
    finalRating: calc.rating,
  });
}

export async function submitSelfReview(req, res) {
  try {
    return await updateScores(req, res, "employee");
  } catch (error) {
    console.error("submitSelfReview error:", error);
    return res.status(500).json({ message: "Failed to submit self review", error: error.message });
  }
}

export async function submitSupervisorReview(req, res) {
  try {
    if (!isSupervisor(req) && !canViewAll(req)) {
      return res.status(403).json({ message: "Supervisor access required" });
    }

    return await updateScores(req, res, "supervisor");
  } catch (error) {
    console.error("submitSupervisorReview error:", error);
    return res.status(500).json({ message: "Failed to submit supervisor review", error: error.message });
  }
}

export async function submitHRReview(req, res) {
  try {
    if (!isHR(req) && !isHRManager(req) && !isSystemOwner(req)) {
      return res.status(403).json({ message: "HR access required" });
    }

    return await updateScores(req, res, "hr");
  } catch (error) {
    console.error("submitHRReview error:", error);
    return res.status(500).json({ message: "Failed to submit HR review", error: error.message });
  }
}

export async function updateRecommendation(req, res) {
  try {
    const access = await getReviewAccess(req, req.params.id);
    if (!access.allowed) return res.status(access.status).json({ message: access.message });

    if (!isSupervisor(req) && !canViewAll(req)) {
      return res.status(403).json({ message: "You do not have permission to update recommendation" });
    }

    const result = await query(
      `
      INSERT INTO performance_review_recommendations
      (
        review_id,
        recommend_promotion,
        recommend_salary_increase,
        training_required,
        warning_required,
        no_action,
        training_topics,
        custom_training,
        recommendation_notes,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
      ON CONFLICT (review_id)
      DO UPDATE SET
        recommend_promotion = EXCLUDED.recommend_promotion,
        recommend_salary_increase = EXCLUDED.recommend_salary_increase,
        training_required = EXCLUDED.training_required,
        warning_required = EXCLUDED.warning_required,
        no_action = EXCLUDED.no_action,
        training_topics = EXCLUDED.training_topics,
        custom_training = EXCLUDED.custom_training,
        recommendation_notes = EXCLUDED.recommendation_notes,
        updated_at = NOW()
      RETURNING *
      `,
      [
        req.params.id,
        Boolean(req.body.recommendPromotion ?? req.body.recommend_promotion),
        Boolean(req.body.recommendSalaryIncrease ?? req.body.recommend_salary_increase),
        Boolean(req.body.trainingRequired ?? req.body.training_required),
        Boolean(req.body.warningRequired ?? req.body.warning_required),
        Boolean(req.body.noAction ?? req.body.no_action),
        Array.isArray(req.body.trainingTopics ?? req.body.training_topics)
          ? req.body.trainingTopics ?? req.body.training_topics
          : [],
        req.body.customTraining ?? req.body.custom_training ?? null,
        req.body.recommendationNotes ?? req.body.recommendation_notes ?? null,
      ]
    );

    await auditLog({
      req,
      reviewId: req.params.id,
      action: "recommendation_updated",
      details: result.rows[0],
    });

    return res.json({ message: "Recommendation updated", recommendation: result.rows[0] });
  } catch (error) {
    console.error("updateRecommendation error:", error);
    return res.status(500).json({ message: "Failed to update recommendation", error: error.message });
  }
}

export async function finalApproveReview(req, res) {
  try {
    if (!isHRManager(req) && !isSystemOwner(req)) {
      return res.status(403).json({ message: "HR Manager access required" });
    }

    const calc = await recalcReview(req.params.id);

    const result = await query(
      `
      UPDATE performance_reviews
      SET status = 'approved',
          total_score = $2,
          final_rating = $3,
          hr_manager_id = $4,
          approved_by = $4,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id, calc.totalScore, calc.rating, userId(req)]
    );

    if (!result.rows[0]) return res.status(404).json({ message: "Review not found" });

    await auditLog({
      req,
      reviewId: req.params.id,
      action: "review_final_approved",
      details: { totalScore: calc.totalScore, rating: calc.rating },
    });

    return res.json({ message: "Review approved successfully", review: result.rows[0] });
  } catch (error) {
    console.error("finalApproveReview error:", error);
    return res.status(500).json({ message: "Failed to approve review", error: error.message });
  }
}

export async function rejectReview(req, res) {
  try {
    if (!isHRManager(req) && !isHR(req) && !isSystemOwner(req)) {
      return res.status(403).json({ message: "HR access required" });
    }

    const reason = clean(req.body.reason || req.body.comment);

    const result = await query(
      `
      UPDATE performance_reviews
      SET status = 'rejected',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ message: "Review not found" });

    if (reason) {
      await query(
        `
        INSERT INTO performance_review_comments
        (review_id, user_id, user_name, role_name, comment, created_at)
        VALUES ($1,$2,$3,$4,$5,NOW())
        `,
        [req.params.id, userId(req), userName(req), req.user?.roleName || req.user?.role || "", reason]
      );
    }

    await auditLog({
      req,
      reviewId: req.params.id,
      action: "review_rejected",
      details: { reason },
    });

    return res.json({ message: "Review rejected", review: result.rows[0] });
  } catch (error) {
    console.error("rejectReview error:", error);
    return res.status(500).json({ message: "Failed to reject review", error: error.message });
  }
}

export async function lockReview(req, res) {
  try {
    if (!isHRManager(req) && !isSystemOwner(req)) {
      return res.status(403).json({ message: "HR Manager access required" });
    }

    const result = await query(
      `
      UPDATE performance_reviews
      SET status = 'locked',
          locked_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ message: "Review not found" });

    await auditLog({
      req,
      reviewId: req.params.id,
      action: "review_locked",
      details: {},
    });

    return res.json({ message: "Review locked successfully", review: result.rows[0] });
  } catch (error) {
    console.error("lockReview error:", error);
    return res.status(500).json({ message: "Failed to lock review", error: error.message });
  }
}

export async function addComment(req, res) {
  try {
    const access = await getReviewAccess(req, req.params.id);
    if (!access.allowed) return res.status(access.status).json({ message: access.message });

    const comment = clean(req.body.comment);
    if (!comment) return res.status(400).json({ message: "Comment is required" });

    const result = await query(
      `
      INSERT INTO performance_review_comments
      (review_id, user_id, user_name, role_name, comment, created_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      RETURNING *
      `,
      [req.params.id, userId(req), userName(req), req.user?.roleName || req.user?.role || "", comment]
    );

    await auditLog({
      req,
      reviewId: req.params.id,
      action: "comment_added",
      details: { comment },
    });

    return res.status(201).json({ message: "Comment added", comment: result.rows[0] });
  } catch (error) {
    console.error("addComment error:", error);
    return res.status(500).json({ message: "Failed to add comment", error: error.message });
  }
}

export async function signReview(req, res) {
  try {
    const access = await getReviewAccess(req, req.params.id);
    if (!access.allowed) return res.status(access.status).json({ message: access.message });

    const signerRole = clean(req.body.signerRole || req.body.signer_role || req.user?.roleCode || "employee");

    const result = await query(
      `
      INSERT INTO performance_review_signatures
      (review_id, signer_role, signer_id, signer_name, signature_text, signed_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      RETURNING *
      `,
      [
        req.params.id,
        signerRole,
        userId(req),
        userName(req),
        req.body.signatureText || req.body.signature_text || userName(req),
      ]
    );

    await auditLog({
      req,
      reviewId: req.params.id,
      action: "review_signed",
      details: { signerRole },
    });

    return res.status(201).json({ message: "Review signed", signature: result.rows[0] });
  } catch (error) {
    console.error("signReview error:", error);
    return res.status(500).json({ message: "Failed to sign review", error: error.message });
  }
}

export async function dashboard(req, res) {
  try {
    if (!canViewAll(req) && !isSupervisor(req)) {
      return res.status(403).json({ message: "You do not have access to performance dashboard" });
    }

    const result = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'assigned')::int AS assigned,
        COUNT(*) FILTER (WHERE status = 'self_review_completed')::int AS self_completed,
        COUNT(*) FILTER (WHERE status = 'supervisor_completed')::int AS supervisor_completed,
        COUNT(*) FILTER (WHERE status = 'hr_reviewed')::int AS hr_reviewed,
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE status = 'locked')::int AS locked,
        ROUND(AVG(total_score), 2) AS average_score
      FROM performance_reviews
    `);

    const top = await query(`
      SELECT id, employee_name, gas_id, project_name, package_name, total_score, final_rating
      FROM performance_reviews
      WHERE total_score IS NOT NULL
      ORDER BY total_score DESC
      LIMIT 10
    `);

    const low = await query(`
      SELECT id, employee_name, gas_id, project_name, package_name, total_score, final_rating
      FROM performance_reviews
      WHERE total_score IS NOT NULL
      ORDER BY total_score ASC
      LIMIT 10
    `);

    return res.json({
      summary: result.rows[0],
      topPerformers: top.rows,
      lowPerformers: low.rows,
    });
  } catch (error) {
    console.error("dashboard error:", error);
    return res.status(500).json({ message: "Failed to load dashboard", error: error.message });
  }
}
