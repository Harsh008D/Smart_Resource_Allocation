import dotenv from "dotenv";
dotenv.config();

export const config = {
  port:          parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl:   process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/volunteer_coordination",
  aiServiceUrl:  process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  jwtSecret:     process.env.JWT_SECRET ?? "dev_secret_change_in_production",
  nodeEnv:       process.env.NODE_ENV ?? "development",
};
