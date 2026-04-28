/**
 * Task Manager endpoints
 */
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db";
import { aiClient } from "../lib/aiClient";
import { notificationService } from "../services/notification";
import { authenticate } from "../middleware/auth";

export const tasksRouter = Router();

const VALID_STATUSES = [
  "pending","sent_to_ngo","accepted_by_ngo","volunteers_assigned",
  "in_progress","completed","cancelled",
];

// ── GET /api/tasks/volunteer/tasks (JWT auth) ─────────────────────────────────
tasksRouter.get("/volunteer/tasks", authenticate, async (req: Request, res: Response) => {
  try {
    const volunteerId = req.user?.volunteerId;
    if (!volunteerId) return res.status(400).json({ error: "No volunteer ID in token" });
    const result = await pool.query(
      `SELECT * FROM tasks WHERE $1 = ANY(assigned_volunteer_ids)
         AND status IN ('volunteers_assigned','in_progress','completed')
       ORDER BY priority_score DESC`,
      [volunteerId]
    );
    return res.json(result.rows);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/tasks ───────────────────────────────────────────────────────────
tasksRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { report_id, priority_score, required_skills, latitude, longitude } = req.body;
    if (!report_id || priority_score === undefined || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const taskId = `T${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const skillsArr = Array.isArray(required_skills) ? required_skills : (required_skills ? [required_skills] : []);

    const volResult = await pool.query(
      "SELECT volunteer_id, skills, latitude, longitude, availability, rating FROM volunteers WHERE availability = true"
    );
    const volunteers = volResult.rows.map((v) => ({
      volunteer_id: v.volunteer_id, skills: v.skills,
      latitude: parseFloat(v.latitude), longitude: parseFloat(v.longitude),
      availability: v.availability, rating: parseFloat(v.rating),
    }));

    const reportResult = await pool.query("SELECT need_type FROM reports WHERE report_id = $1", [report_id]);
    const needType = reportResult.rows[0]?.need_type ?? "general";

    let assignedVolunteerIds: string[] = [];
    let isUnderstaffed = false;

    if (volunteers.length > 0) {
      try {
        const matchResult = await aiClient.match({
          task_id: taskId, need_type: needType,
          latitude: parseFloat(latitude), longitude: parseFloat(longitude), volunteers,
        });
        assignedVolunteerIds = matchResult.matches.map((m: { volunteer_id: string }) => m.volunteer_id);
        isUnderstaffed = matchResult.is_understaffed;
      } catch (err) { console.error("[Matching]", err); }
    }

    await pool.query(
      `INSERT INTO tasks (task_id, report_id, priority_score, status, assigned_volunteer_ids,
         required_skills, latitude, longitude, is_understaffed)
       VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8)`,
      [taskId, report_id, parseFloat(priority_score), assignedVolunteerIds, skillsArr,
       parseFloat(latitude), parseFloat(longitude), isUnderstaffed]
    );

    for (const volId of assignedVolunteerIds) {
      notificationService.send(volId, taskId).catch(console.error);
    }

    return res.status(201).json({ task_id: taskId, assigned_volunteer_ids: assignedVolunteerIds, is_understaffed: isUnderstaffed });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /api/tasks/:id ────────────────────────────────────────────────────────
tasksRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM tasks WHERE task_id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Task not found" });
    return res.json(result.rows[0]);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── PUT /api/tasks/:id/status ─────────────────────────────────────────────────
tasksRouter.put("/:id/status", async (req: Request, res: Response) => {
  try {
    const { status, volunteer_id } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    const taskResult = await pool.query("SELECT status FROM tasks WHERE task_id = $1", [req.params.id]);
    if (taskResult.rows.length === 0) return res.status(404).json({ error: "Task not found" });

    const updates: string[] = ["status = $1"];
    const params: unknown[] = [status];
    let idx = 2;

    if (status === "in_progress") {
      updates.push("accepted_at = NOW()");
      if (volunteer_id) {
        pool.query(
          "UPDATE notifications SET responded_at = NOW(), response = 'accepted' WHERE volunteer_id = $1 AND task_id = $2",
          [volunteer_id, req.params.id]
        ).catch(console.error);
      }
    }
    if (status === "completed") updates.push("completed_at = NOW()");

    params.push(req.params.id);
    await pool.query(`UPDATE tasks SET ${updates.join(", ")} WHERE task_id = $${idx}`, params);

    return res.json({ message: "Task status updated", task_id: req.params.id, status });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /api/tasks ────────────────────────────────────────────────────────────
tasksRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { status, volunteer, region } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) { conditions.push(`status = $${idx++}`); params.push(String(status)); }
    if (volunteer) { conditions.push(`$${idx++} = ANY(assigned_volunteer_ids)`); params.push(String(volunteer)); }
    if (region) {
      const [minLat, minLon, maxLat, maxLon] = String(region).split(",").map(Number);
      conditions.push(`latitude BETWEEN $${idx++} AND $${idx++}`);
      conditions.push(`longitude BETWEEN $${idx++} AND $${idx++}`);
      params.push(minLat, maxLat, minLon, maxLon);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(`SELECT * FROM tasks ${where} ORDER BY priority_score DESC`, params);
    return res.json(result.rows);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
