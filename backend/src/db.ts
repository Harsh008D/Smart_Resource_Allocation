import { Pool } from "pg";
import { config } from "./config";

// Singleton connection pool
export const pool = new Pool({ connectionString: config.databaseUrl });

pool.on("error", (err) => {
  console.error("Unexpected DB pool error:", err);
});
