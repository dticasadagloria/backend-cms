import { query } from "../config/db.js";

export const verificarPresencasMembros = async () => {
  console.log("A verificar presenças dos membros...");

  try {
    const cultosUltimoMes = await query(`
      SELECT id FROM cultos
      WHERE data >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
        AND data <  date_trunc('month', CURRENT_DATE)
    `);

    if (!cultosUltimoMes.rows.length) {
      console.log("ℹNenhum culto no último mês — ignorado.");
      return;
    }

    const cultoIds = cultosUltimoMes.rows.map((c) => c.id);

    // ── Uma única query para inactivar quem não foi a nenhum culto ──────
    const inactivados = await query(`
      UPDATE membros
      SET ativo = false
      WHERE ativo = true
        AND id NOT IN (
          SELECT DISTINCT membro_id
          FROM frequencias
          WHERE culto_id = ANY($1::int[])
            AND presente = true
        )
      RETURNING id
    `, [cultoIds]);

    // ── Uma única query para reactivar quem foi a pelo menos 1 culto ────
    const reactivados = await query(`
      UPDATE membros
      SET ativo = true
      WHERE ativo = false
        AND id IN (
          SELECT DISTINCT membro_id
          FROM frequencias
          WHERE culto_id = ANY($1::int[])
            AND presente = true
        )
      RETURNING id
    `, [cultoIds]);

    console.log(`Verificação concluída: ${inactivados.rowCount} inactivados, ${reactivados.rowCount} reactivados.`);

  } catch (err) {
    console.error("Erro na verificação:", err.message);
  }
};