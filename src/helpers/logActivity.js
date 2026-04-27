import { query } from "../config/db.js";

/**
 * Log any write action performed by an authenticated user.
 * Called after the main operation succeeds. Errors here never block the response.
 *
 * @param {import('express').Request} req  - Express request (needs req.user)
 * @param {object} opts
 * @param {string}  opts.action       - 'CREATE' | 'UPDATE' | 'DELETE' | 'DELETE_HARD' | 'REACTIVATE' | 'STATUS_CHANGE'
 * @param {string}  [opts.entity_type]  - 'membro' | 'user' | 'culto' | 'visitante' | 'convertido' | 'requisicao' | 'restauracao'
 * @param {number}  [opts.entity_id]
 * @param {string}  [opts.entity_label] - human-readable name, e.g. "João Silva"
 * @param {object}  [opts.old_values]
 * @param {object}  [opts.new_values]
 * @param {string}  opts.description   - readable sentence, e.g. "Criou o membro João Silva"
 */
export const logActivity = async (req, {
  action,
  entity_type = null,
  entity_id   = null,
  entity_label = null,
  old_values  = null,
  new_values  = null,
  description,
}) => {
  try {
    const u  = req?.user || {};
    const ip = req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
               ?? req?.socket?.remoteAddress
               ?? null;

    await query(
      `INSERT INTO activity_logs
         (user_id, username, role_id, branch_id,
          action, entity_type, entity_id, entity_label,
          old_values, new_values, description, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12)`,
      [
        u.id       ?? null,
        u.username ?? null,
        u.role_id  ?? null,
        u.branch_id ?? null,
        action,
        entity_type,
        entity_id  ?? null,
        entity_label ?? null,
        old_values  ? JSON.stringify(old_values)  : null,
        new_values  ? JSON.stringify(new_values)  : null,
        description,
        ip,
      ],
    );
  } catch (err) {
    console.error("logActivity error:", err.message);
  }
};

/**
 * Log auth events (login / register) where req.user is not yet populated.
 */
export const logAuthEvent = async (req, {
  user_id,
  username,
  role_id    = null,
  branch_id  = null,
  action,
  description,
}) => {
  try {
    const ip = req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
               ?? req?.socket?.remoteAddress
               ?? null;

    await query(
      `INSERT INTO activity_logs
         (user_id, username, role_id, branch_id,
          action, entity_type, entity_id, entity_label,
          description, ip_address)
       VALUES ($1,$2,$3,$4,$5,'auth',$1,$2,$6,$7)`,
      [user_id ?? null, username ?? null, role_id, branch_id, action, description, ip],
    );
  } catch (err) {
    console.error("logAuthEvent error:", err.message);
  }
};
