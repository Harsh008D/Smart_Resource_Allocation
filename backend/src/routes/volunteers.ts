/**
 * Volunteer Registry endpoints
 * POST /api/volunteers          — create volunteer profile
 * GET  /api/volunteers/:id      — get volunteer profile
 * PUT  /api/volunteers/:id      — update volunteer profile
 * GET  /api/volunteers          — list/filter volunteers
 */
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db";

export const volunteersRouter = Router();

// ── POST /api/volunteers ──────────────────────────────────────────────────────
volunteersRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { name, email, phone, skills, latitude, longitude, availability, rating, notification_pref } = req.body;
    const missing: string[] = [];

    if (!name) missing.push("name");
    if (!email) missing.push("email");
    if (!skills || (Array.isArray(skills) && skills.length === 0)) missing.push("skills");
    if (latitude === undefined || latitude === null) missing.push("latitude");
    if (longitude === undefined || longitude === null) missing.push("longitude");

    if (missing.length > 0) {
      return res.status(400).json({ error: "Missing required fields", missing_fields: missing });
    }

    const volunteerId = `V${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const skillsArr = Array.isArray(skills) ? skills : [skills];

    // Check for duplicate email
    const existing = await pool.query("SELECT volunteer_id FROM volunteers WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered", volunteer_id: existing.rows[0].volunteer_id });
    }

    await pool.query(
      `INSERT INTO volunteers
         (volunteer_id, name, email, phone, skills, latitude, longitude, availability, rating, notification_pref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        volunteerId, name, email, phone ?? null, skillsArr,
        parseFloat(latitude), parseFloat(longitude),
        availability !== undefined ? Boolean(availability) : true,
        rating !== undefined ? parseFloat(rating) : 5.0,
        notification_pref ?? "email",
      ]
    );

    return res.status(201).json({ volunteer_id: volunteerId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Volunteers POST]", msg);
    return res.status(500).json({ error: msg });
  }
});

// ── GET /api/volunteers/:id ───────────────────────────────────────────────────
volunteersRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM volunteers WHERE volunteer_id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Volunteer not found" });
    return res.json(result.rows[0]);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── PUT /api/volunteers/:id ───────────────────────────────────────────────────
volunteersRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const allowed = ["name", "email", "phone", "skills", "latitude", "longitude", "availability", "rating", "notification_pref"];
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        values.push(key === "skills" && !Array.isArray(req.body[key]) ? [req.body[key]] : req.body[key]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    await pool.query(
      `UPDATE volunteers SET ${updates.join(", ")} WHERE volunteer_id = $${idx}`,
      values
    );

    return res.json({ message: "Volunteer updated" });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /api/volunteers ───────────────────────────────────────────────────────
volunteersRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { skill, available, bbox } = req.query;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (skill) {
      conditions.push(`$${idx++} = ANY(skills)`);
      params.push(String(skill));
    }
    if (available !== undefined) {
      conditions.push(`availability = $${idx++}`);
      params.push(available === "true");
    }
    if (bbox) {
      const [minLat, minLon, maxLat, maxLon] = String(bbox).split(",").map(Number);
      conditions.push(`latitude BETWEEN $${idx++} AND $${idx++}`);
      conditions.push(`longitude BETWEEN $${idx++} AND $${idx++}`);
      params.push(minLat, maxLat, minLon, maxLon);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(`SELECT * FROM volunteers ${where} ORDER BY rating DESC`, params);
    return res.json(result.rows);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
