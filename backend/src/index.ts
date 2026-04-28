import express from "express";
import { config } from "./config";
import { authRouter }        from "./routes/auth";
import { reportsRouter }     from "./routes/reports";
import { volunteersRouter }  from "./routes/volunteers";
import { tasksRouter }       from "./routes/tasks";
import { feedbackRouter }    from "./routes/feedback";
import { taskSubmitRouter }  from "./routes/taskSubmit";
import { ngoClaimsRouter }   from "./routes/ngoClaims";
import { startRematchJob }   from "./jobs/rematch";
import { startReminderJob }  from "./jobs/reminder";
import { startNgoTimeoutJob } from "./jobs/ngoTimeout";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — allow frontend (both local and deployed)
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",        authRouter);
app.use("/api/tasks/submit", taskSubmitRouter);
app.use("/api/reports",     reportsRouter);
app.use("/api/volunteers",  volunteersRouter);
app.use("/api/tasks",       tasksRouter);
app.use("/api/feedback",    feedbackRouter);
app.use("/api/ngo-claims",  ngoClaimsRouter);
app.use("/api",             ngoClaimsRouter);   // /api/ngo/* routes

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Error]", err.message);
  res.status(500).json({ error: err.message });
});

process.on("unhandledRejection", (reason) => {
  console.error("[UnhandledRejection]", reason);
});

// ── Background jobs ───────────────────────────────────────────────────────────
if (config.nodeEnv !== "test") {
  startRematchJob();
  startReminderJob();
  startNgoTimeoutJob();
}

app.listen(config.port, () => {
  console.log(`Backend API running on http://localhost:${config.port}`);
});

export default app;
