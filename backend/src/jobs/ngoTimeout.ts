/**
 * NGO Timeout job — auto-assign volunteers if no NGO responds in 30 min
 */
import cron from "node-cron";
import { pool } from "../db";
import { assignVolunteers } from "../services/volunteerAssignment";

export function startNgoTimeoutJob() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const result = await pool.query(
        `SELECT task_id FROM tasks
         WHERE status = 'sent_to_ngo'
           AND ngo_sent_at < NOW() - INTERVAL '30 minutes'`
      );
      for (const row of result.rows) {
        console.log(`[NGO Timeout] Auto-assigning task ${row.task_id}`);
        await pool.query(
          "UPDATE ngo_claims SET status = 'timed_out' WHERE task_id = $1 AND status = 'pending'",
          [row.task_id]
        );
        await assignVolunteers(row.task_id);
      }
    } catch (err) {
      console.error("[NGO Timeout] Error:", err);
    }
  });
}
