import express from "express";
import { query } from "../data/index.js";
import { requireAuth } from "../middleware_auth.js";
import {
  listUsersRepo,
  getUserByIdRepo,
  updateUserRepo,
  unlockUserRepo,
  archiveUserRepo,
} from "../data/userEmployeeRepository.js";

const router = express.Router();

router.use(requireAuth);

// جلب كل المستخدمين
router.get("/", async (_req, res) => {
  try {
    const users = await listUsersRepo();

    return res.json({
      users,
      employees: users, // دعم للواجهات القديمة إذا كانت تنتظر employees
    });
  } catch (error) {
    console.error("List users error:", error);
    return res.status(500).json({
      message: "Failed to load users",
      error: error.message,
    });
  }
});

// جلب مستخدم واحد
router.get("/:id", async (req, res) => {
  try {
    const user = await getUserByIdRepo(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({
      message: "Failed to load user",
      error: error.message,
    });
  }
});

// تحديث بيانات مستخدم
router.put("/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const updated = await updateUserRepo(userId, {
      name: req.body.name,
      gasId: req.body.gasId,
      division: req.body.division,
      jobTitle: req.body.jobTitle,
      roleId: req.body.roleId,
      projectId: req.body.projectId,
      packageId: req.body.packageId,
      supervisorId: req.body.supervisorId,
      accessScope: req.body.accessScope,
      status: req.body.status,
      permissions: req.body.permissions,
      allowDuringMaintenance: req.body.allowDuringMaintenance,
      forcePasswordChange: req.body.forcePasswordChange,
      nationalityType: req.body.nationalityType,
    });

    if (!updated) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      message: "User updated successfully",
      user: updated,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({
      message: "Failed to update user",
      error: error.message,
    });
  }
});

// حفظ صلاحيات المستخدم
router.post("/:id/permissions", async (req, res) => {
  try {
    const userId = req.params.id;
    const permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions
      : [];

    await query(
      `DELETE FROM user_permissions WHERE user_id = $1`,
      [userId]
    );

    for (const permissionCode of permissions) {
      await query(
        `
        INSERT INTO user_permissions (user_id, permission_code, is_allowed)
        VALUES ($1, $2, true)
        `,
        [userId, permissionCode]
      );
    }

    const updated = await updateUserRepo(userId, {
      permissions,
    });

    return res.json({
      message: "Permissions saved successfully",
      user: updated,
    });
  } catch (error) {
    console.error("Save permissions error:", error);
    return res.status(500).json({
      message: "Failed to save permissions",
      error: error.message,
    });
  }
});

// فك قفل مستخدم
router.post("/:id/unlock", async (req, res) => {
  try {
    const updated = await unlockUserRepo(req.params.id);

    if (!updated) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      message: "User unlocked successfully",
      user: updated,
    });
  } catch (error) {
    console.error("Unlock user error:", error);
    return res.status(500).json({
      message: "Failed to unlock user",
      error: error.message,
    });
  }
});

// أرشفة مستخدم
router.delete("/:id", async (req, res) => {
  try {
    const updated = await archiveUserRepo(req.params.id);

    if (!updated) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      message: "User archived successfully",
      user: updated,
    });
  } catch (error) {
    console.error("Archive user error:", error);
    return res.status(500).json({
      message: "Failed to archive user",
      error: error.message,
    });
  }
});

export default router;
