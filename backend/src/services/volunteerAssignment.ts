/**
 * Volunteer Assignment — runs after NGO accepts or timeout
 */
import { pool } from "../db";
import { aiClient } from "../lib/aiClient";
import { notificationService } from "./notification";

export async function assignVolunteers(taskId: string): Promise<string[]> {
  const taskResult = await pool.query(
    `SELECT t.*, COALESCE(t.description, r.raw_text) as text_content,
            COALESCE(t.required_skills[1], r.need_type, 'general') as need_type
     FROM tasks t
     LEFT JOIN reports r ON r.report_id = t.report_id
     WHERE t.task_id = $1`,
    [taskId]
  );
  if (taskResult.rows.length === 0) throw new Error(`Task ${taskId} not found`);
  const task = taskResult.rows[0];

  // Get available volunteers
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

  if (volunteers.length === 0) return [];

  const matchResult = await aiClient.match({
    task_id: taskId,
    need_type: task.need_type || "general",
    latitude: parseFloat(task.latitude),
    longitude: parseFloat(task.longitude),
    volunteers,
  });

  const assignedIds = matchResult.matches.map((m: { volunteer_id: string }) => m.volunteer_id);

  await pool.query(
    "UPDATE tasks SET assigned_volunteer_ids = $1, status = 'volunteers_assigned' WHERE task_id = $2",
    [assignedIds, taskId]
  );

  // Notify each volunteer
  for (const volId of assignedIds) {
    notificationService.send(volId, taskId).catch(console.error);
  }

  return assignedIds;
}
