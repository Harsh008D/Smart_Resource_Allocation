/**
 * Ingestion Service — Report endpoints
 * POST /api/reports  — submit a new report
 * GET  /api/reports  — list reports (optional ?status= filter)
 * GET  /api/reports/:id — get single report
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db";
import { aiClient } from "../lib/aiClient";
import { ocrService } from "../services/ocr";

export const reportsRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ── POST /api/reports ─────────────────────────────────────────────────────────
reportsRouter.post("/", upload.single("image"), async (req: Request, res: Response) => {
  const { text, latitude, longitude } = req.body;
  const missingFields: string[] = [];

  if (!text || !String(text).trim()) missingFields.push("text");
  if (latitude === undefined || latitude === null || latitude === "") missingFields.push("latitude");
  if (longitude === undefined || longitude === null || longitude === "") missingFields.push("longitude");

  if (missingFields.length > 0) {
    return res.status(400).json({ error: "Missing required fields", missing_fields: missingFields });
  }

  const reportId = `R${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  let rawText = String(text).trim();

  // OCR: extract text from image if provided
  let isFlaggedReview = false;
  if (req.file) {
    const extracted = await ocrService.extractText(req.file.buffer);
    if (extracted) {
      rawText += " " + extracted;
    } else {
      isFlaggedReview = true;
    }
  }

  // Insert raw report
  await pool.query(
    `INSERT INTO reports (report_id, raw_text, latitude, longitude, is_flagged_review, processing_status)
     VALUES ($1, $2, $3, $4, $5, 'pending')`,
    [reportId, rawText, parseFloat(latitude), parseFloat(longitude), isFlaggedReview]
  );

  // Async AI processing (fire-and-forget; errors logged but don't fail the request)
  processReportAsync(reportId, rawText, parseFloat(latitude), parseFloat(longitude)).catch(
    (err) => console.error(`[AI] Failed to process report ${reportId}:`, err)
  );

  return res.status(201).json({ report_id: reportId });
});

async function processReportAsync(
  reportId: string,
  text: string,
  latitude: number,
  longitude: number
) {
  // Step 1: NLP processing
  const nlpResult = await aiClient.process({ report_id: reportId, text });

  // Step 2: Priority scoring
  const priorityResult = await aiClient.priority({
    report_id: reportId,
    urgency_score: nlpResult.urgency_score,
    people_affected: undefined,
    timestamp: new Date().toISOString(),
  });

  // Step 3: Update report with structured fields
  await pool.query(
    `UPDATE reports
     SET need_type = $1, urgency_score = $2, priority_score = $3,
         is_flagged_review = $4, is_incomplete_score = $5, processing_status = 'done'
     WHERE report_id = $6`,
    [
      nlpResult.need_type,
      nlpResult.urgency_score,
      priorityResult.priority_score,
      nlpResult.is_flagged_review,
      priorityResult.is_incomplete_score,
      reportId,
    ]
  );
}

// ── GET /api/reports ──────────────────────────────────────────────────────────
reportsRouter.get("/", async (req: Request, res: Response) => {
  const { status } = req.query;
  let query = "SELECT * FROM reports";
  const params: string[] = [];

  if (status) {
    query += " WHERE processing_status = $1";
    params.push(String(status));
  }

  query += " ORDER BY priority_score DESC NULLS LAST";
  const result = await pool.query(query, params);
  return res.json(result.rows);
});

// ── GET /api/reports/:id ──────────────────────────────────────────────────────
reportsRouter.get("/:id", async (req: Request, res: Response) => {
  const result = await pool.query("SELECT * FROM reports WHERE report_id = $1", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Report not found" });
  return res.json(result.rows[0]);
});
