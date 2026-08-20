import { authenticateToken, enforceMaintenance } from "../middleware_auth.js";
import { Router } from "express";
import {
  listNotificationsForUserRepo,
  getUnreadNotificationsCountRepo,
  markNotificationReadRepo,
  markAllNotificationsReadRepo,
} from "../data/leaveNotificationRepository.js";
import { query } from "../data/index.js";

const router = Router();

router.use(authenticateToken, enforceMaintenance);

router.get("/", async (req, res) => {
  try {
    const user = req.user;

    const [items, unreadCount, preferencesResult] = await Promise.all([
      listNotificationsForUserRepo(user.id),
      getUnreadNotificationsCountRepo(user.id),
      query(`SELECT notification_sound AS "notificationSound",
        browser_notifications AS "browserNotifications",
        notification_duration_seconds AS "notificationDurationSeconds"
        FROM system_settings ORDER BY updated_at DESC LIMIT 1`).catch(() => ({ rows: [] })),
    ]);

    return res.json({
      items,
      unreadCount,
      preferences: preferencesResult.rows[0] || {
        notificationSound: true, browserNotifications: true, notificationDurationSeconds: 7,
      },
    });
  } catch (error) {
    console.error("Notifications list error:", error);
    return res.status(500).json({
      message: "Failed to load notifications",
      error: error.message,
    });
  }
});

router.post("/:id/read", async (req, res) => {
  try {
    const user = req.user;

    const item = await markNotificationReadRepo(req.params.id, user.id);

    if (!item) {
      return res.status(404).json({
        message: "الإشعار غير موجود",
      });
    }

    const unreadCount = await getUnreadNotificationsCountRepo(user.id);

    return res.json({
      item,
      unreadCount,
    });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return res.status(500).json({
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
});

router.post("/read-all", async (req, res) => {
  try {
    const user = req.user;

    const updated = await markAllNotificationsReadRepo(user.id);
    const unreadCount = await getUnreadNotificationsCountRepo(user.id);

    return res.json({
      updated,
      unreadCount,
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return res.status(500).json({
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
});

export default router;
