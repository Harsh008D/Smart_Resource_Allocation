/**
 * Task Submission — public user creates a task
 * POST /api/tasks/submit
 */
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db";
import { aiClient } from "../lib/aiClient";
import { findTopNGOs } from "../services/ngoDiscovery";
import { assignVolunteers } from "../services/volunteerAssignment";

export const taskSubmitRouter = Router();

// City → coordinates map for convenience
const CITY_COORDS: Record<string, [number, number]> = {
  Mumbai: [18.9388, 72.8354], Delhi: [28.6139, 77.2090], Bangalore: [12.9716, 77.5946],
  Hyderabad: [17.3850, 78.4867], Chennai: [13.0827, 80.2707], Kolkata: [22.5726, 88.3639],
  Pune: [18.5204, 73.8567], Ahmedabad: [23.0225, 72.5714], Jaipur: [26.9124, 75.7873],
  Lucknow: [26.8467, 80.9462], Patna: [25.5941, 85.1376], Bhopal: [23.2599, 77.4126],
  Nagpur: [21.1458, 79.0882], Kochi: [9.9312, 76.2673], Guwahati: [26.1445, 91.7362],
  Chandigarh: [30.7333, 76.7794], Surat: [21.1702, 72.8311], Indore: [22.7196, 75.8577],
  Coimbatore: [11.0168, 76.9558], Kanpur: [26.4499, 80.3319],
};

taskSubmitRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { description, city, latitude, longitude, contact_number, people_affected } = req.body;

    if (!description?.trim()) {
      return res.status(400).json({ error: "description is required" });
    }

    // Resolve coordinates
    let lat = latitude ? parseFloat(latitude) : null;
    let lon = longitude ? parseFloat(longitude) : null;
    if (!lat || !lon) {
      const coords = city ? CITY_COORDS[city] : null;
      if (!coords) return res.status(400).json({ error: "Provide latitude/longitude or a valid city" });
      lat = coords[0] + (Math.random() * 0.1 - 0.05);
      lon = coords[1] + (Math.random() * 0.1 - 0.05);
    }

    const taskId = `T${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    // Step 1: NLP processing
    let needType: string | null = null;
    let urgencyScore = 0.5;
    let priorityScore = 5.0;
    let isIncomplete = false;

    try {
      const nlpResult = await aiClient.process({ text: description });
      needType = nlpResult.need_type;
      urgencyScore = nlpResult.urgency_score;

      const priorityResult = await aiClient.priority({
        urgency_score: urgencyScore,
        people_affected: people_affected ? parseInt(people_affected) : undefined,
        timestamp: new Date().toISOString(),
      });
      priorityScore = priorityResult.priority_score;
      isIncomplete = priorityResult.is_incomplete_score;
    } catch (aiErr) {
      console.error("[AI] Processing failed, using defaults:", aiErr);
    }

    // Step 2: Duplicate check (simple location-based)
    let isDuplicate = false;
    let duplicateOf: string | null = null;
    const nearbyTasks = await pool.query(
      `SELECT task_id, description, latitude, longitude FROM tasks
       WHERE latitude BETWEEN $1 AND $2 AND longitude BETWEEN $3 AND $4
         AND status NOT IN ('completed','cancelled')
         AND created_at > NOW() - INTERVAL '24 hours'`,
      [lat - 0.1, lat + 0.1, lon - 0.1, lon + 0.1]
    );
    for (const t of nearbyTasks.rows) {
      if (t.description && description) {
        const wordsA = new Set(String(description).toLowerCase().split(/\s+/));
        const wordsB = new Set(String(t.description).toLowerCase().split(/\s+/));
        const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
        const similarity = intersection / Math.max(wordsA.size, wordsB.size);
        if (similarity > 0.7) {
          isDuplicate = true;
          duplicateOf = String(t.task_id);
          break;
        }
      }
    }

    // Step 3: Emergency mode — urgency > 0.9 skips NGO flow
    const isEmergency = urgencyScore > 0.9;

    // Step 4: Insert task
    await pool.query(
      `INSERT INTO tasks
         (task_id, description, latitude, longitude, priority_score, urgency_score,
          status, contact_number, city, is_emergency, is_duplicate, duplicate_of,
          required_skills, is_incomplete_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        taskId, description, lat, lon, priorityScore, urgencyScore,
        isEmergency ? "volunteers_assigned" : "pending",
        contact_number ?? null, city ?? null,
        isEmergency, isDuplicate, duplicateOf,
        needType ? [needType] : [],
        isIncomplete,
      ]
    );

    let assignedVolunteers: string[] = [];
    let topNGOs: { ngo_id: string; name: string; distance_km: number }[] = [];

    if (isEmergency) {
      // Emergency: assign volunteers directly
      try {
        assignedVolunteers = await assignVolunteers(taskId);
      } catch (e) { console.error("[Emergency] Volunteer assignment failed:", e); }
    } else {
      // Normal: find top NGOs and send claims
      try {
        const ngos = await findTopNGOs(lat, lon, needType ? [needType] : []);
        topNGOs = ngos.map((n) => ({ ngo_id: n.ngo_id, name: n.name, distance_km: n.distance_km }));

        if (ngos.length > 0) {
          // Insert NGO claims
          for (const ngo of ngos) {
            const claimId = `C${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
            await pool.query(
              "INSERT INTO ngo_claims (claim_id, task_id, ngo_id) VALUES ($1,$2,$3)",
              [claimId, taskId, ngo.ngo_id]
            );
          }
          await pool.query(
            "UPDATE tasks SET status = 'sent_to_ngo', ngo_sent_at = NOW() WHERE task_id = $1",
            [taskId]
          );
        } else {
          // No registered NGO with matching skills at all
          console.warn(`[NGO Discovery] No registered NGO found for need_type=${needType}`);
        }
      } catch (e) { console.error("[NGO Discovery] Failed:", e); }
    }

    return res.status(201).json({
      task_id: taskId,
      need_type: needType,
      urgency_score: urgencyScore,
      priority_score: priorityScore,
      is_emergency: isEmergency,
      is_duplicate: isDuplicate,
      duplicate_of: duplicateOf,
      status: isEmergency ? "volunteers_assigned" : "sent_to_ngo",
      assigned_volunteers: assignedVolunteers,
      ngos_notified: topNGOs,
    });
  } catch (err: unknown) {
    console.error("[TaskSubmit]", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
