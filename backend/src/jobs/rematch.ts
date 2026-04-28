/**
 * Re-match job: every 15 minutes, find tasks pending > 24 hours
 * and trigger a new matching request.
 */
import cron from "node-cron";
import { pool } from "../db";
import { aiClient } from "../lib/aiClient";

export function startRematchJob() {
  cron.schedule("*/15 * * * *", async () => {
    console.log("[Rematch] Checking for stale pending tasks...");
    try {
      const result = await pool.query(
        `SELECT t.task_id, t.report_id, t.latitude, t.longitude,
                r.need_type
         FROM   tasks t
         JOIN   reports r ON r.report_id = t.report_id
         WHERE  t.status = 'pending'
           AND  t.created_at < NOW() - INTERVAL '24 hours'`
      );

      for (const task of result.rows) {
        const volResult = await pool.query(
          "SELECT volunteer_id, skills, latitude, longitude, availability, rating FROM volunteers WHERE availability = true"
        );
        const volunteers = volResult.rows.map((v) => ({
          volunteer_id: v.volunteer_id,
          skills: v.skills,
          latitude: parseFloat(v.latitude),
          longitude: parseFloat(v.longitude),
          availability: v.availability,
          rating: parseFloat(v.rating),
        }));

        if (volunteers.length === 0) continue;

        const matchResult = await aiClient.match({
          task_id: task.task_id,
          need_type: task.need_type ?? "general",
          latitude: parseFloat(task.latitude),
          longitude: parseFloat(task.longitude),
          volunteers,
        });

        const newVolIds = matchResult.matches.map((m: { volunteer_id: string }) => m.volunteer_id);
        await pool.query(
          `UPDATE tasks SET assigned_volunteer_ids = $1, last_rematched_at = NOW()
           WHERE task_id = $2`,
          [newVolIds, task.task_id]
        );
        console.log(`[Rematch] Re-matched task ${task.task_id} → ${newVolIds.join(", ")}`);
      }
    } catch (err) {
      console.error("[Rematch] Error:", err);
    }
  });
}
