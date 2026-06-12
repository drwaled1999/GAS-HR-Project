import { query } from "./index.js";
import admin from "../utils/firebaseAdmin.js";

export async function createNotificationRepo(
  userId,
  message,
  type = "general",
  link = "/notifications",
  data = {}
) {
  if (!userId || !message) {
    throw new Error("userId and message are required");
  }

  const result = await query(
    `
    INSERT INTO notifications (
      user_id, message, type, link, data, is_read, created_at
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, FALSE, NOW())
    RETURNING
      id,
      user_id AS "userId",
      message,
      type,
      link,
      data,
      is_read AS "isRead",
      created_at AS "createdAt"
    `,
    [userId, message, type || "general", link || "/notifications", JSON.stringify(data || {})]
  );

  const notification = result.rows[0];

  try {
    const tokensResult = await query(
      `
      SELECT token
      FROM user_fcm_tokens
      WHERE user_id = $1
      `,
      [userId]
    );

    const tokens = tokensResult.rows.map((row) => row.token).filter(Boolean);

    if (tokens.length > 0) {
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: "GAS HR",
          body: message,
        },
        data: {
          type: String(type || "general"),
          link: String(link || "/notifications"),
          notificationId: String(notification.id),
        },
      });
    }
  } catch (pushError) {
    console.error("Push notification error:", pushError);
  }

  return notification;
}

export async function listNotificationsForUserRepo(userId) {
  if (!userId) return [];

  const result = await query(
    `
    SELECT
      id,
      user_id AS "userId",
      message,
      type,
      link,
      data,
      is_read AS "isRead",
      created_at AS "createdAt"
    FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
    `,
    [userId]
  );

  return result.rows;
}

export async function getUnreadNotificationsCountRepo(userId) {
  if (!userId) return 0;

  const result = await query(
    `
    SELECT COUNT(*)::int AS count
    FROM notifications
    WHERE user_id = $1
      AND COALESCE(is_read, FALSE) = FALSE
    `,
    [userId]
  );

  return result.rows[0]?.count || 0;
}

export async function markNotificationReadRepo(notificationId, userId) {
  if (!notificationId || !userId) return null;

  const result = await query(
    `
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = $1
      AND user_id = $2
    RETURNING
      id,
      user_id AS "userId",
      message,
      type,
      link,
      data,
      is_read AS "isRead",
      created_at AS "createdAt"
    `,
    [notificationId, userId]
  );

  return result.rows[0] || null;
}

export async function markAllNotificationsReadRepo(userId) {
  if (!userId) return 0;

  const result = await query(
    `
    UPDATE notifications
    SET is_read = TRUE
    WHERE user_id = $1
      AND COALESCE(is_read, FALSE) = FALSE
    RETURNING id
    `,
    [userId]
  );

  return result.rowCount || 0;
}
