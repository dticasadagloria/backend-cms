import { query } from "../config/db.js";

const TIPOS_VALIDOS  = ['Dizimo', 'Shiloh', 'Parceria', 'Oferta'];
const CANAIS_VALIDOS = ['Numerario', 'Mpesa', 'Emola', 'BIM', 'Conta Movel'];

// ─── GET /api/membros/lookup?codigo=M000094 ───────────────────────────────────
// export const lookupMembro = async (req, res) => {
//   const { codigo } = req.query;

//   if (!codigo) {
//     return res.status(400).json({ message: 'Parâmetro "codigo" é obrigatório.' });
//   }

//   // Aceita M000094 ou M-000094 (com ou sem hífen)
//   const match = codigo.match(/^M-?0*(\d+)$/i);
//   if (!match) {
//     return res.status(400).json({ message: 'Formato inválido. Use M000001.' });
//   }

//   const membro_id = parseInt(match[1], 10);

//   try {
//     const result = await query(
//       `SELECT id, nome, contacto, ativo FROM membros WHERE id = $1`,
//       [membro_id]
//     );

//     if (!result.rows.length) {
//       return res.status(404).json({ message: 'Membro não encontrado.' });
//     }

//     const m = result.rows[0];

//     if (!m.ativo) {
//       return res.status(400).json({ message: `Membro "${m.nome}" está inactivo.` });
//     }

//     return res.json({
//       id:       m.id,
//       nome:     m.nome,
//       contacto: m.contacto,
//       codigo:   `M${String(m.id).padStart(6, '0')}`,
//     });
//   } catch (err) {
//     console.error('[membros/lookup] Erro:', err.message);
//     return res.status(500).json({ message: 'Erro ao buscar membro.' });
//   }
// };
export const lookupMembro = async (req, res) => {
  const { codigo } = req.query;

  if (!codigo) {
    return res.status(400).json({ message: 'Parâmetro "codigo" é obrigatório.' });
  }

  try {
    const result = await query(
      `SELECT id, nome, contacto, ativo 
       FROM membros 
       WHERE codigo = $1`,
      [codigo.toUpperCase()]  // M000094
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: 'Membro não encontrado.' });
    }

    const m = result.rows[0];

    if (!m.ativo) {
      return res.status(400).json({ message: `Membro "${m.nome}" está inactivo.` });
    }

    return res.json({
      id:       m.id,
      nome:     m.nome,
      contacto: m.contacto,
      codigo:   codigo.toUpperCase(),
    });
  } catch (err) {
    console.error('[membros/lookup] Erro:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar membro.' });
  }
};

// ─── POST /api/ofertas/batch ──────────────────────────────────────────────────
export const batchInserir = async (req, res) => {
  const { culto_id, ofertas } = req.body;

  if (!culto_id || !Array.isArray(ofertas) || ofertas.length === 0) {
    return res.status(400).json({ message: 'culto_id e ofertas[] são obrigatórios.' });
  }

  // Validação de cada linha
  for (const [i, o] of ofertas.entries()) {
    if (!TIPOS_VALIDOS.includes(o.tipo)) {
      return res.status(400).json({ message: `Linha ${i + 1}: tipo inválido "${o.tipo}".` });
    }
    if (!CANAIS_VALIDOS.includes(o.canal)) {
      return res.status(400).json({ message: `Linha ${i + 1}: canal inválido "${o.canal}".` });
    }
    if (!o.valor || o.valor <= 0) {
      return res.status(400).json({ message: `Linha ${i + 1}: valor deve ser maior que zero.` });
    }
    if (['Dizimo', 'Shiloh', 'Parceria'].includes(o.tipo) && !o.membro_id) {
      return res.status(400).json({
        message: `Linha ${i + 1}: ${o.tipo} requer um membro identificado.`,
      });
    }
  }

  try {
    // Verifica se culto existe
    const cultoCheck = await query('SELECT id FROM cultos WHERE id = $1', [culto_id]);
    if (!cultoCheck.rows.length) {
      return res.status(404).json({ message: `Culto ${culto_id} não encontrado.` });
    }

    // Remove ofertas anteriores do mesmo culto (permite re-submissão)
    await query('DELETE FROM ofertas WHERE culto_id = $1', [culto_id]);

    // Insere cada linha
    const registado_por = req.user?.id || null;
    for (const o of ofertas) {
      await query(
        `INSERT INTO ofertas (culto_id, membro_id, tipo, canal, valor, registado_por)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [culto_id, o.membro_id || null, o.tipo, o.canal, o.valor, registado_por]
      );
    }

    // Busca resumo calculado pelo trigger
    const resumo = await query(
      `SELECT tipo, canal, total FROM ofertas_resumo WHERE culto_id = $1 ORDER BY tipo, canal`,
      [culto_id]
    );

    return res.status(201).json({
      message:      'Ofertas guardadas com sucesso.',
      total_linhas: ofertas.length,
      resumo:       resumo.rows,
    });
  } catch (err) {
    console.error('[ofertas/batch] Erro:', err.message);
    return res.status(500).json({ message: 'Erro interno ao guardar ofertas.' });
  }
};

// ─── GET /api/ofertas/resumo/:culto_id ────────────────────────────────────────
export const getResumo = async (req, res) => {
  const { culto_id } = req.params;
  try {
    const result = await query(
      `SELECT * FROM v_resumo_culto WHERE culto_id = $1`,
      [culto_id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ message: 'Nenhuma oferta encontrada para este culto.' });
    }
    return res.json(result.rows);
  } catch (err) {
    console.error('[ofertas/resumo] Erro:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar resumo.' });
  }
};

// ─── GET /api/ofertas/detalhe/:culto_id?tipo=Dizimo ───────────────────────────
export const getDetalhe = async (req, res) => {
  const { culto_id } = req.params;
  const { tipo }     = req.query;

  try {
    let sql    = `SELECT * FROM v_detalhe_ofertas WHERE culto_id = $1`;
    const params = [culto_id];

    if (tipo && TIPOS_VALIDOS.includes(tipo)) {
      params.push(tipo);
      sql += ` AND tipo = $${params.length}`;
    }

    sql += ` ORDER BY tipo, data_registo`;
    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[ofertas/detalhe] Erro:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar detalhes.' });
  }
};

// ─── GET /api/ofertas/historico/:membro_id?tipo=Dizimo&ano=2025 ───────────────
export const getHistoricoMembro = async (req, res) => {
  const { membro_id } = req.params;
  const { tipo, ano } = req.query;

  try {
    let sql      = `
      SELECT
        c.data,
        c.tipo  AS culto,
        b.nome  AS filial,
        o.tipo,
        o.canal,
        o.valor
      FROM ofertas o
      JOIN cultos   c ON c.id = o.culto_id
      JOIN branches b ON b.id = c.branch_id
      WHERE o.membro_id = $1
    `;
    const params = [membro_id];

    if (tipo && TIPOS_VALIDOS.includes(tipo)) {
      params.push(tipo);
      sql += ` AND o.tipo = $${params.length}`;
    }
    if (ano) {
      params.push(ano);
      sql += ` AND EXTRACT(YEAR FROM c.data) = $${params.length}`;
    }

    sql += ` ORDER BY c.data DESC`;
    const result = await query(sql, params);
    const total  = result.rows.reduce((s, r) => s + parseFloat(r.valor), 0);

    return res.json({ historico: result.rows, total });
  } catch (err) {
    console.error('[ofertas/historico] Erro:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar histórico.' });
  }
};