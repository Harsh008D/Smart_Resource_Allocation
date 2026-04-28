/**
 * Feedback Collector endpoints
 * POST /api/feedback                        — submit post-task feedback
 * GET  /api/feedback/metrics?volunteer=&task_type= — aggregated metrics
 */
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db";
import { aiClient } from "../lib/aiClient";

export const feedbackRouter = Router();

// ── POST /api/feedback ────────────────────────────────────────────────────────
feedbackRouter.post("/", async (req: Request, res: Response) => {
  const { task_id, volunteer_id, report_id, completion_status, ground_reality_text, difficulty_rating } = req.body;
  const missing: string[] = [];

  if (!task_id) missing.push("task_id");
  if (!volunteer_id) missing.push("volunteer_id");
  if (!report_id) missing.push("report_id");
  if (!completion_status) missing.push("completion_status");

  if (missing.length > 0) {
    return res.status(400).json({ error: "Missing required fields", missing_fields: missing });
  }

  const feedbackId = `F${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  await pool.query(
    `INSERT INTO feedback
       (feedback_id, task_id, volunteer_id, report_id, completion_status, ground_reality_text, difficulty_rating)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [feedbackId, task_id, volunteer_id, report_id, completion_status, ground_reality_text ?? null, difficulty_rating ?? null]
  );

  // Update volunteer rating: weighted rolling average (new = old * 0.8 + score * 0.2)
  if (difficulty_rating !== undefined && difficulty_rating !== null) {
    const score = parseFloat(difficulty_rating);
    // Invert difficulty to performance: 5 = easy (good), 1 = hard (poor)
    const performanceScore = (6 - score);  // maps 1→5, 5→1 on 1-5 scale
    await pool.query(
      `UPDATE volunteers
       SET rating = LEAST(5.0, GREATEST(0.0, rating * 0.8 + $1 * 0.2)),
           updated_at = NOW()
       WHERE volunteer_id = $2`,
      [performanceScore, volunteer_id]
    );
  }

  // Re-process ground reality text if provided
  if (ground_reality_text && String(ground_reality_text).trim()) {
    updatePriorityFromFeedback(report_id, String(ground_reality_text)).catch((err) =>
      console.error(`[Feedback] Priority recalculation failed for ${report_id}:`, err)
    );
  }

  return res.status(201).json({ feedback_id: feedbackId });
});

async function updatePriorityFromFeedback(reportId: string, text: string) {
  const nlpResult = await aiClient.process({ report_id: reportId, text });
  const priorityResult = await aiClient.priority({
    report_id: reportId,
    urgency_score: nlpResult.urgency_score,
    timestamp: new Date().toISOString(),
  });

  await pool.query(
    `UPDATE reports
     SET need_type = COALESCE($1, need_type),
         urgency_score = $2,
         priority_score = $3,
         is_incomplete_score = $4
     WHERE report_id = $5`,
    [nlpResult.need_type, nlpResult.urgency_score, priorityResult.priority_score,
     priorityResult.is_incomplete_score, reportId]
  );
}

// ── GET /api/feedback/metrics ─────────────────────────────────────────────────
feedbackRouter.get("/metrics", async (req: Request, res: Response) => {
  const { volunteer, task_type } = req.query;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (volunteer) {
    conditions.push(`f.volunteer_id = $${idx++}`);
    params.push(String(volunteer));
  }
  if (task_type) {
    conditions.push(`r.need_type = $${idx++}`);
    params.push(String(task_type));
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT
       f.volunteer_id,
       COUNT(*)                          AS total_feedback,
       AVG(f.difficulty_rating)          AS avg_difficulty,
       SUM(CASE WHEN f.completion_status = 'success' THEN 1 ELSE 0 END) AS completed_count,
       SUM(CASE WHEN f.completion_status = 'failed'  THEN 1 ELSE 0 END) AS failed_count
     FROM feedback f
     JOIN reports r ON r.report_id = f.report_id
     ${where}
     GROUP BY f.volunteer_id
     ORDER BY completed_count DESC`,
    params
  );

  return res.json(result.rows);
});
