import express from "express";
import { query } from "../config/db.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM branches ORDER BY nome ASC`);
    res.json({ success: true, branches: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;