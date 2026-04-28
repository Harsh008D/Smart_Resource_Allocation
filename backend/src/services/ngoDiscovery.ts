/**
 * NGO Discovery
 * Rules:
 *  1. Only registered NGOs (have at least one ngo_admin user account)
 *  2. Skill must match need_type
 *  3. Sort by distance ascending
 *  4. If no skill-matching NGO within MAX_DISTANCE_KM, fall back to
 *     nearest skill-matching registered NGO regardless of distance
 */
import { pool } from "../db";

const MAX_DISTANCE_KM = 500; // prefer NGOs within 500 km

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

export interface NGO {
  ngo_id: string;
  name: string;
  email: string;
  latitude: number;
  longitude: number;
  skill_tags: string[];
  distance_km: number;
}

export async function findTopNGOs(
  latitude: number,
  longitude: number,
  requiredSkills: string[],
  limit = 3
): Promise<NGO[]> {
  // Only registered NGOs (have an ngo_admin account)
  const result = await pool.query(`
    SELECT DISTINCT n.*
    FROM ngos n
    INNER JOIN users u ON u.ngo_id = n.ngo_id AND u.role = 'ngo_admin'
  `);

  const allWithDistance: NGO[] = result.rows.map((ngo) => ({
    ...ngo,
    distance_km: haversine(latitude, longitude, ngo.latitude, ngo.longitude),
  }));

  // Filter by skill match
  const skillMatched = requiredSkills?.length
    ? allWithDistance.filter((ngo) =>
        requiredSkills.some((s) => ngo.skill_tags.includes(s))
      )
    : allWithDistance;

  // Sort by distance
  skillMatched.sort((a, b) => a.distance_km - b.distance_km);

  // Prefer nearby NGOs (within MAX_DISTANCE_KM)
  const nearby = skillMatched.filter((n) => n.distance_km <= MAX_DISTANCE_KM);

  // If none nearby, fall back to all skill-matched sorted by distance
  const candidates = nearby.length > 0 ? nearby : skillMatched;

  return candidates.slice(0, limit);
}
