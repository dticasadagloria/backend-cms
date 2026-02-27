import { query } from "../config/db.js";

export const verificarPresencasMembros = async () => {
  console.log("🔄 A verificar presenças dos membros...");

  try {
    // ── Busca todos os cultos do último mês ──────────────────────────────
    const cultosUltimoMes = await query(`
      SELECT id FROM cultos
      WHERE data >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
        AND data <  date_trunc('month', CURRENT_DATE)
    `);

    const totalCultos = cultosUltimoMes.rows.length;

    // Se não houve cultos no último mês, não faz nada
    if (totalCultos === 0) {
      console.log("ℹ️ Nenhum culto registado no último mês — verificação ignorada.");
      return;
    }

    const cultoIds = cultosUltimoMes.rows.map((c) => c.id);

    // ── Busca todos os membros ───────────────────────────────────────────
    const membros = await query(`SELECT id FROM membros`);

    let inactivados = 0;
    let reactivados = 0;

    for (const membro of membros.rows) {
      // Quantas vezes esteve presente nos cultos do último mês
      const presencas = await query(`
        SELECT COUNT(*) as total
        FROM frequencias
        WHERE membro_id = $1
          AND culto_id = ANY($2::int[])
          AND presente = true
      `, [membro.id, cultoIds]);

      const totalPresente = parseInt(presencas.rows[0].total);

      // ── Regra: ausente em TODOS os cultos do último mês → inactivo ────
      if (totalPresente === 0) {
        await query(
          `UPDATE membros SET ativo = false WHERE id = $1 AND ativo = true`,
          [membro.id]
        );
        inactivados++;
      }

      // ── Regra: presente em pelo menos 1 culto → activo ────────────────
      if (totalPresente > 0) {
        await query(
          `UPDATE membros SET ativo = true WHERE id = $1 AND ativo = false`,
          [membro.id]
        );
        reactivados++;
      }
    }

    console.log(`✅ Verificação concluída: ${inactivados} inactivados, ${reactivados} reactivados.`);

  } catch (err) {
    console.error("❌ Erro na verificação de presenças:", err.message);
  }
};