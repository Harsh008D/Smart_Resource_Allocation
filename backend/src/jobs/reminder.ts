/**
 * Reminder job: every 10 minutes, find notifications sent > 2 hours ago
 * with no response and send a reminder.
 */
import cron from "node-cron";
import { pool } from "../db";
import { notificationService } from "../services/notification";

export function startReminderJob() {
  cron.schedule("*/10 * * * *", async () => {
    console.log("[Reminder] Checking for unanswered notifications...");
    try {
      const result = await pool.query(
        `SELECT volunteer_id, task_id
         FROM   notifications
         WHERE  sent_at < NOW() - INTERVAL '2 hours'
           AND  responded_at IS NULL`
      );

      for (const row of result.rows) {
        console.log(`[Reminder] Sending reminder to ${row.volunteer_id} for task ${row.task_id}`);
        await notificationService.send(row.volunteer_id, row.task_id);
      }
    } catch (err) {
      console.error("[Reminder] Error:", err);
    }
  });
}
