import express from "express";
import multer from "multer";
import { authenticateToken, enforceMaintenance } from "../middleware_auth.js";
import {
  listLeavePoliciesRepo,
  createLeaveRequestRepo,
  reviewLeaveRequestRepo,
  listScopedLeaveRequestsRepo,
  createNotificationRepo,
  listNotificationsForUserRepo,
  getUnreadNotificationsCountRepo,
  markNotificationReadRepo,
  markAllNotificationsReadRepo,
} from "../data/leaveNotificationRepository.js";
import {
  getUserByUsernameRepo,
  getEmployeeByGasIdRepo,
  getScopedEmployeesForUserRepo,
} from "../data/userEmployeeRepository.js";
import { listAttendanceAdjustmentsRepo } from "../data/attendanceRepository.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function normalizePolicyToType(policy) {
  const code = String(policy.code || "").trim();
  const label = String(policy.label || code).trim();

  const lowerCode = code.toLowerCase();
  const lowerLabel = label.toLowerCase();

  const requiresBankFields =
    lowerCode.includes("salary_transfer") ||
    lowerCode.includes("bank") ||
    lowerLabel.includes("salary transfer") ||
    lowerLabel.includes("bank");

  const requiresDateRange = !requiresBankFields;

  return {
    code,
    label,
    requiresAttachment: Boolean(policy.requiresAttachment),
    requiresDateRange,
    requiresBankFields,
    deductFromBalance: Boolean(policy.deductFromBalance),
    active: policy.active !== false,
  };
}

async function getActorFromUsername(username) {
  if (!username) return null;
  return getUserByUsernameRepo(String(username).trim());
}

async function resolveTargetEmployee(actor, { employeeId, employeeGasId }) {
  const scopedEmployees = await getScopedEmployeesForUserRepo(actor);

  if (employeeId) {
    const found = scopedEmployees.find(
      (item) => String(item.id) === String(employeeId)
    );
    if (found) return found;
  }

  if (employeeGasId) {
    const found = scopedEmployees.find(
      (item) => String(item.gasId) === String(employeeGasId)
    );
    if (found) return found;

    return getEmployeeByGasIdRepo(employeeGasId);
  }

  return null;
}

// أنواع الطلبات
router.get(
  "/types",
  authenticateToken,
  enforceMaintenance,
  async (_req, res) => {
    try {
      const policies = await listLeavePoliciesRepo();
      const types = policies
        .filter((item) => item.active !== false)
        .map(normalizePolicyToType);

      return res.json({ types });
    } catch (error) {
      console.error("Leave types error:", error);
      return res.status(500).json({
        message: "Failed to load request types",
        error: error.message,
      });
    }
  }
);

// قائمة الطلبات + تعديلات الحضور ضمن نطاق المستخدم
router.get(
  "/list",
  authenticateToken,
  enforceMaintenance,
  async (req, res) => {
    try {
      const username =
        String(req.query.username || req.user?.username || "").trim();

      const actor =
        (await getActorFromUsername(username)) ||
        (await getActorFromUsername(req.user?.username));

      if (!actor) {
        return res.status(404).json({ message: "User not found" });
      }

      const leaveRequests = await listScopedLeaveRequestsRepo(actor);
      const attendanceAdjustments = await listAttendanceAdjustmentsRepo();

      const scopedEmployees = await getScopedEmployeesForUserRepo(actor);
      const allowedEmployeeIds = new Set(
        scopedEmployees.map((item) => String(item.id))
      );

      const filteredAttendanceAdjustments = attendanceAdjustments.filter(
        (item) =>
          allowedEmployeeIds.has(String(item.employeeId)) ||
          String(item.requestedById || "") === String(actor.id)
      );

      return res.json({
        leaveRequests,
        attendanceAdjustments: filteredAttendanceAdjustments,
      });
    } catch (error) {
      console.error("Requests list error:", error);
      return res.status(500).json({
        message: "Failed to load requests",
        error: error.message,
      });
    }
  }
);

// إنشاء طلب جديد
router.post(
  "/leave",
  authenticateToken,
  enforceMaintenance,
  upload.single("attachment"),
  async (req, res) => {
    try {
      const username =
        String(req.body.username || req.user?.username || "").trim();

      const actor =
        (await getActorFromUsername(username)) ||
        (await getActorFromUsername(req.user?.username));

      if (!actor) {
        return res.status(404).json({ message: "User not found" });
      }

      const {
        employeeId,
        employeeGasId,
        type,
        startDate,
        endDate,
        note,
        currentBank,
        newBank,
        newIban,
      } = req.body;

      if (!type) {
        return res.status(400).json({ message: "Request type is required" });
      }

      const targetEmployee = await resolveTargetEmployee(actor, {
        employeeId,
        employeeGasId,
      });

      if (!targetEmployee) {
        return res.status(400).json({
          message: "Target employee not found within your scope",
        });
      }

      const payload = {
        employeeId: targetEmployee.id,
        employeeName: targetEmployee.name,
        employeeGasId: targetEmployee.gasId,
        projectId: targetEmployee.projectId || null,
        packageId: targetEmployee.packageId || null,
        type,
        startDate: startDate || new Date().toISOString().slice(0, 10),
        endDate: endDate || startDate || new Date().toISOString().slice(0, 10),
        note: note || "",
        category: "leave",
        currentBank: currentBank || "",
        newBank: newBank || "",
        newIban: newIban || "",
        attachmentName: req.file?.originalname || null,
        attachmentPath: null,
        requestedById: actor.id,
        requestedByName: actor.name || actor.username,
        approverUserId: null,
      };

      const created = await createLeaveRequestRepo(
        payload,
        actor.name || actor.username
      );

      return res.status(201).json({
        message: "Request created successfully",
        request: created,
      });
    } catch (error) {
      console.error("Create leave request error:", error);
      return res.status(500).json({
        message: "Failed to create request",
        error: error.message,
      });
    }
  }
);

// مراجعة طلب
router.post(
  "/leave/:id/review",
  authenticateToken,
  enforceMaintenance,
  async (req, res) => {
    try {
      const requestId = req.params.id;
      const username =
        String(req.body.username || req.user?.username || "").trim();

      const actor =
        (await getActorFromUsername(username)) ||
        (await getActorFromUsername(req.user?.username));

      if (!actor) {
        return res.status(404).json({ message: "User not found" });
      }

      const decision = String(req.body.decision || "").trim().toLowerCase();
      if (!["approved", "rejected"].includes(decision)) {
        return res.status(400).json({
          message: "Decision must be approved or rejected",
        });
      }

      const reviewed = await reviewLeaveRequestRepo(
        requestId,
        {
          decision,
          reviewerId: actor.id,
          reviewerName: actor.name || actor.username,
          rejectionReason: req.body.rejectionReason || "",
        },
        actor.name || actor.username
      );

      if (!reviewed) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (reviewed.requestedById) {
        await createNotificationRepo(
          reviewed.requestedById,
          decision === "approved"
            ? `Your request #${reviewed.id} has been approved`
            : `Your request #${reviewed.id} has been rejected`,
          "request_reviewed",
          "/requests",
          {
            requestId: reviewed.id,
            decision,
          }
        );
      }

      return res.json({
        message:
          decision === "approved"
            ? "Request approved successfully"
            : "Request rejected successfully",
        request: reviewed,
      });
    } catch (error) {
      console.error("Review leave request error:", error);
      return res.status(500).json({
        message: "Failed to review request",
        error: error.message,
      });
    }
  }
);

// إشعارات المستخدم
router.get(
  "/notifications",
  authenticateToken,
  enforceMaintenance,
  async (req, res) => {
    try {
      const username =
        String(req.query.username || req.user?.username || "").trim();

      const actor =
        (await getActorFromUsername(username)) ||
        (await getActorFromUsername(req.user?.username));

      if (!actor) {
        return res.status(404).json({ message: "User not found" });
      }

      const items = await listNotificationsForUserRepo(actor.id);
      const unreadCount = await getUnreadNotificationsCountRepo(actor.id);

      return res.json({
        notifications: items,
        unreadCount,
      });
    } catch (error) {
      console.error("Notifications list error:", error);
      return res.status(500).json({
        message: "Failed to load notifications",
        error: error.message,
      });
    }
  }
);

// تعليم إشعار كمقروء
router.post(
  "/notifications/:id/read",
  authenticateToken,
  enforceMaintenance,
  async (req, res) => {
    try {
      const username =
        String(req.body.username || req.user?.username || "").trim();

      const actor =
        (await getActorFromUsername(username)) ||
        (await getActorFromUsername(req.user?.username));

      if (!actor) {
        return res.status(404).json({ message: "User not found" });
      }

      const item = await markNotificationReadRepo(req.params.id, actor.id);

      return res.json({
        message: "Notification marked as read",
        notification: item,
      });
    } catch (error) {
      console.error("Read notification error:", error);
      return res.status(500).json({
        message: "Failed to mark notification as read",
        error: error.message,
      });
    }
  }
);

// تعليم كل الإشعارات كمقروءة
router.post(
  "/notifications/read-all",
  authenticateToken,
  enforceMaintenance,
  async (req, res) => {
    try {
      const username =
        String(req.body.username || req.user?.username || "").trim();

      const actor =
        (await getActorFromUsername(username)) ||
        (await getActorFromUsername(req.user?.username));

      if (!actor) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedCount = await markAllNotificationsReadRepo(actor.id);

      return res.json({
        message: "All notifications marked as read",
        updatedCount,
      });
    } catch (error) {
      console.error("Read all notifications error:", error);
      return res.status(500).json({
        message: "Failed to mark all notifications as read",
        error: error.message,
      });
    }
  }
);

export default router;