import { query } from "../config/db.js";
import { gerarLogsHTML } from "../templates/logsTemplate.js";

export const listarLogs = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2 || role_id === 8 || role_id === 12; // Admin, SuperAdmin ou Sede

  const {
    page        = 1,
    limit       = 50,
    action,
    entity_type,
    user_id,
    branch_id:  filterBranch,
    from,
    to,
    search,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (!isAdmin) {
      conditions.push(`l.branch_id = $${idx++}`);
      params.push(branch_id);
    } else if (filterBranch) {
      conditions.push(`l.branch_id = $${idx++}`);
      params.push(filterBranch);
    }

    if (action) {
      conditions.push(`l.action = ANY($${idx++}::text[])`);
      params.push(action.split(","));
    }

    if (entity_type) {
      conditions.push(`l.entity_type = $${idx++}`);
      params.push(entity_type);
    }

    if (user_id) {
      conditions.push(`l.user_id = $${idx++}`);
      params.push(user_id);
    }

    if (from) {
      conditions.push(`l.criado_em >= $${idx++}`);
      params.push(from);
    }

    if (to) {
      conditions.push(`l.criado_em < ($${idx++}::date + interval '1 day')`);
      params.push(to);
    }

    if (search) {
      conditions.push(
        `(l.description ILIKE $${idx} OR l.entity_label ILIKE $${idx} OR l.username ILIKE $${idx})`,
      );
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM activity_logs l ${where}`,
      params,
    );

    const result = await query(
      `SELECT
         l.*,
         b.nome AS nome_branch
       FROM activity_logs l
       LEFT JOIN branches b ON l.branch_id = b.id
       ${where}
       ORDER BY l.criado_em DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset],
    );

    res.json({
      success: true,
      total:   parseInt(countResult.rows[0].total),
      page:    parseInt(page),
      limit:   parseInt(limit),
      logs:    result.rows,
    });
  } catch (err) {
    console.error("listarLogs error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Exportar logs como HTML (imprimível / save-as-PDF) ───────────────────────
export const exportarLogsPDF = async (req, res) => {
  const { role_id, branch_id, username } = req.user;
  const isAdmin = role_id === 1 || role_id === 2 ; // Admin, SuperAdmin ou Sede

  const { action, entity_type, from, to, search, branch_id: filterBranch } = req.query;

  try {
    const conditions = [];
    const params     = [];
    let   idx        = 1;

    if (!isAdmin) {
      conditions.push(`l.branch_id = $${idx++}`);
      params.push(branch_id);
    } else if (filterBranch) {
      conditions.push(`l.branch_id = $${idx++}`);
      params.push(filterBranch);
    }

    if (action) {
      conditions.push(`l.action = ANY($${idx++}::text[])`);
      params.push(action.split(","));
    }
    if (entity_type) {
      conditions.push(`l.entity_type = $${idx++}`);
      params.push(entity_type);
    }
    if (from) {
      conditions.push(`l.criado_em >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`l.criado_em < ($${idx++}::date + interval '1 day')`);
      params.push(to);
    }
    if (search) {
      conditions.push(
        `(l.description ILIKE $${idx} OR l.entity_label ILIKE $${idx} OR l.username ILIKE $${idx})`,
      );
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await query(
      `SELECT l.*, b.nome AS nome_branch
       FROM activity_logs l
       LEFT JOIN branches b ON l.branch_id = b.id
       ${where}
       ORDER BY l.criado_em DESC
       LIMIT 2000`,
      params,
    );

    const html = gerarLogsHTML({
      logs:     result.rows,
      username: username ?? "Sistema",
      filtros:  { action, entity_type, from, to, search },
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("exportarLogsPDF error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
