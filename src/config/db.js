import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER?.trim(),
  host: process.env.DB_HOST?.trim(),
  database: process.env.DB_NAME?.trim(),
  password: process.env.DB_PASSWORD?.trim(),
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

// Debug logs
pool.on("connect", () => {
  console.log("Connected to Neon PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);
export default pool;