import pool from "./config/db.js";




(async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("🟢 Connected successfully:", res.rows[0]);
  } catch (err) {
    console.error("🔴 Connection error:", err.message);
  } finally {
    pool.end();
  }
})();