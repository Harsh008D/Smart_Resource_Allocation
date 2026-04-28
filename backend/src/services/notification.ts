/**
 * Notification Service
 * Sends task assignment notifications via the volunteer's preferred channel.
 * Stub implementation: logs to console + inserts to notifications table.
 * Swap in real push/SMS/email provider without changing the interface.
 */
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db";

type Channel = "push" | "sms" | "email";

export const notificationService = {
  async send(volunteerId: string, taskId: string): Promise<void> {
    // Look up volunteer's preferred channel
    const result = await pool.query(
      "SELECT notification_pref FROM volunteers WHERE volunteer_id = $1",
      [volunteerId]
    );
    const channel: Channel = (result.rows[0]?.notification_pref as Channel) ?? "email";

    // Dispatch (stub)
    console.log(`[Notify] Sending ${channel} notification to ${volunteerId} for task ${taskId}`);

    // Insert notification record
    const notifId = `N${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    await pool.query(
      `INSERT INTO notifications (notification_id, volunteer_id, task_id, channel, sent_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [notifId, volunteerId, taskId, channel]
    );
  },
};
