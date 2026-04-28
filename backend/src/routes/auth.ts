/**
 * Auth endpoints
 * POST /api/auth/signup
 * POST /api/auth/login
 * POST /api/auth/ngo/create-volunteer
 */
import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../db";
import { authenticate, requireRole } from "../middleware/auth";

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "dev_secret";

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
authRouter.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, role, ngo_id } = req.body;
    if (!email || !password || !role) {
      return res.status(400).json({ error: "email, password, and role are required" });
    }
    if (!["public_user", "ngo_admin", "volunteer"].includes(role)) {
      return res.status(400).json({ error: "role must be public_user, ngo_admin, or volunteer" });
    }

    const existing = await pool.query("SELECT user_id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);
    const userId = `U${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    await pool.query(
      "INSERT INTO users (user_id, email, password_hash, role, ngo_id) VALUES ($1,$2,$3,$4,$5)",
      [userId, email, hash, role, ngo_id ?? null]
    );

    return res.status(201).json({ user_id: userId, role });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const result = await pool.query(
      "SELECT user_id, password_hash, role, ngo_id, volunteer_id FROM users WHERE email = $1",
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { userId: user.user_id, role: user.role, ngoId: user.ngo_id, volunteerId: user.volunteer_id },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.json({ token, role: user.role, user_id: user.user_id });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/auth/ngo/create-volunteer ───────────────────────────────────────
authRouter.post("/ngo/create-volunteer", authenticate, requireRole("ngo_admin"), async (req: Request, res: Response) => {
  try {
    const { name, email, password, skills, latitude, longitude } = req.body;
    const ngoId = req.user!.ngoId;

    if (!name || !email || !password || !skills || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "name, email, password, skills, latitude, longitude required" });
    }
    if (!ngoId) return res.status(400).json({ error: "NGO admin must have an ngo_id" });

    // Create volunteer profile
    const volunteerId = `V${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const skillsArr = Array.isArray(skills) ? skills : [skills];
    const volEmail = email.toLowerCase();

    // Check duplicate email in volunteers
    const existingVol = await pool.query("SELECT volunteer_id FROM volunteers WHERE email = $1", [volEmail]);
    if (existingVol.rows.length > 0) {
      return res.status(409).json({ error: "Volunteer email already exists" });
    }

    await pool.query(
      `INSERT INTO volunteers (volunteer_id, name, email, skills, latitude, longitude, availability, rating)
       VALUES ($1,$2,$3,$4,$5,$6,true,5.0)`,
      [volunteerId, name, volEmail, skillsArr, parseFloat(latitude), parseFloat(longitude)]
    );

    // Create user account
    const hash = await bcrypt.hash(password, 10);
    const userId = `U${uuidv4().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    await pool.query(
      "INSERT INTO users (user_id, email, password_hash, role, ngo_id, volunteer_id) VALUES ($1,$2,$3,'volunteer',$4,$5)",
      [userId, volEmail, hash, ngoId, volunteerId]
    );

    return res.status(201).json({ user_id: userId, volunteer_id: volunteerId });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
