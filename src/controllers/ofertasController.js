// controllers/ofertasController.js
// Requer: pg (node-postgres)
// Todas as queries usam pool de conexões passado via req.app.locals.db

const TIPOS_VALIDOS = ['Dizimo', 'Shiloh', 'Parceria', 'Oferta'];
const CANAIS_VALIDOS = ['Numerario', 'Mpesa', 'Emola', 'BIM', 'Conta Movel'];

// ─── POST /api/ofertas/batch ──────────────────────────────────────────────────
// Recebe todas as linhas do culto e insere em batch dentro de uma transacção.
// Body: { culto_id: number, ofertas: [{ tipo, canal, valor, membro_id? }] }
async function batchInserir(req, res) {
  const db = req.app.locals.db;
  const { culto_id, ofertas } = req.body;

  // Validação básica
  if (!culto_id || !Array.isArray(ofertas) || ofertas.length === 0) {
    return res.status(400).json({ message: 'culto_id e ofertas[] são obrigatórios.' });
  }

  // Valida cada linha
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
    // Dízimos, Shiloh e Parceria exigem membro_id
    if (['Dizimo', 'Shiloh', 'Parceria'].includes(o.tipo) && !o.membro_id) {
      return res.status(400).json({
        message: `Linha ${i + 1}: ${o.tipo} requer um membro identificado.`,
      });
    }
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Verifica se o culto existe
    const cultoCheck = await client.query(
      'SELECT id FROM cultos WHERE id = $1',
      [culto_id]
    );
    if (cultoCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: `Culto ${culto_id} não encontrado.` });
    }

    // Remove ofertas anteriores do mesmo culto (permite re-submissão)
    await client.query('DELETE FROM ofertas WHERE culto_id = $1', [culto_id]);

    // Insert em batch
    const registado_por = req.user?.id || null;
    for (const o of ofertas) {
      await client.query(
        `INSERT INTO ofertas (culto_id, membro_id, tipo, canal, valor, registado_por)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [culto_id, o.membro_id || null, o.tipo, o.canal, o.valor, registado_por]
      );
    }

    await client.query('COMMIT');

    // Busca o resumo calculado pelo trigger
    const resumo = await client.query(
      `SELECT tipo, canal, total FROM ofertas_resumo WHERE culto_id = $1 ORDER BY tipo, canal`,
      [culto_id]
    );

    return res.status(201).json({
      message: 'Ofertas guardadas com sucesso.',
      total_linhas: ofertas.length,
      resumo: resumo.rows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ofertas/batch] Erro:', err.message);
    return res.status(500).json({ message: 'Erro interno ao guardar ofertas.' });
  } finally {
    client.release();
  }
}

// ─── GET /api/ofertas/resumo/:culto_id ────────────────────────────────────────
// Devolve o resumo agregado do culto (da tabela ofertas_resumo mantida pelo trigger).
async function getResumo(req, res) {
  const db = req.app.locals.db;
  const { culto_id } = req.params;

  try {
    const result = await db.query(
      `SELECT * FROM v_resumo_culto WHERE culto_id = $1`,
      [culto_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Nenhuma oferta encontrada para este culto.' });
    }
    return res.json(result.rows);
  } catch (err) {
    console.error('[ofertas/resumo] Erro:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar resumo.' });
  }
}

// ─── GET /api/ofertas/detalhe/:culto_id ───────────────────────────────────────
// Devolve todas as linhas individuais do culto com nome do membro.
// Aceita query param: ?tipo=Dizimo
async function getDetalhe(req, res) {
  const db = req.app.locals.db;
  const { culto_id } = req.params;
  const { tipo } = req.query;

  try {
    let query = `SELECT * FROM v_detalhe_ofertas WHERE culto_id = $1`;
    const params = [culto_id];

    if (tipo && TIPOS_VALIDOS.includes(tipo)) {
      query += ` AND tipo = $2`;
      params.push(tipo);
    }

    query += ` ORDER BY tipo, data_registo`;
    const result = await db.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('[ofertas/detalhe] Erro:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar detalhes.' });
  }
}

// ─── GET /api/membros/lookup ──────────────────────────────────────────────────
// Lookup de membro por código.
// Query: ?codigo=M-00042
// async function lookupMembro(req, res) {
//   const db = req.app.locals.db;
//   const { codigo } = req.query;

//   if (!codigo) {
//     return res.status(400).json({ message: 'Parâmetro "codigo" é obrigatório.' });
//   }

//   // O código tem formato M-XXXXX onde XXXXX é o id com zeros à esquerda
//   const match = codigo.match(/^M-0*(\d+)$/i);
//   if (!match) {
//     return res.status(400).json({ message: 'Formato de código inválido. Use M-00001.' });
//   }

//   const membro_id = parseInt(match[1], 10);

//   try {
//     const result = await db.query(
//       `SELECT id, nome, contacto, ativo FROM membros WHERE id = $1`,
//       [membro_id]
//     );
//     if (result.rowCount === 0) {
//       return res.status(404).json({ message: 'Membro não encontrado.' });
//     }
//     const m = result.rows[0];
//     if (!m.ativo) {
//       return res.status(400).json({ message: `Membro "${m.nome}" está inactivo.` });
//     }
//     return res.json({
//       id: m.id,
//       nome: m.nome,
//       contacto: m.contacto,
//       codigo: `M-${String(m.id).padStart(5, '0')}`,
//     });
//   } catch (err) {
//     console.error('[membros/lookup] Erro:', err.message);
//     return res.status(500).json({ message: 'Erro ao buscar membro.' });
//   }
// }
// controllers/ofertasController.js  — função lookupMembro

async function lookupMembro(req, res) {
  const db = req.app.locals.db;
  const { codigo } = req.query;

  if (!codigo) {
    return res.status(400).json({ message: 'Parâmetro "codigo" é obrigatório.' });
  }

  // Aceita M000094 OU M-000094 (com ou sem hífen)
  const match = codigo.match(/^M-?0*(\d+)$/i);
  if (!match) {
    return res.status(400).json({ message: 'Formato inválido. Use M000001.' });
  }

  const membro_id = parseInt(match[1], 10);

  try {
    const result = await db.query(
      `SELECT id, nome, contacto, ativo FROM membros WHERE id = $1`,
      [membro_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Membro não encontrado.' });
    }
    const m = result.rows[0];
    if (!m.ativo) {
      return res.status(400).json({ message: `Membro "${m.nome}" está inactivo.` });
    }
    return res.json({
      id: m.id,
      nome: m.nome,
      contacto: m.contacto,
      // Devolve no mesmo formato da view: M000094
      codigo: `M${String(m.id).padStart(6, '0')}`,
    });
  } catch (err) {
    console.error('[membros/lookup] Erro:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar membro.' });
  }
}

// ─── GET /api/ofertas/historico/:membro_id ────────────────────────────────────
// Historial de ofertas de um membro (ex: para ver dízimos do ano).
// Query params: ?tipo=Dizimo&ano=2025
async function getHistoricoMembro(req, res) {
  const db = req.app.locals.db;
  const { membro_id } = req.params;
  const { tipo, ano } = req.query;

  try {
    let query = `
      SELECT
        c.data,
        c.tipo AS culto,
        b.nome AS filial,
        o.tipo,
        o.canal,
        o.valor
      FROM ofertas o
      JOIN cultos c ON c.id = o.culto_id
      JOIN branches b ON b.id = c.branch_id
      WHERE o.membro_id = $1
    `;
    const params = [membro_id];

    if (tipo && TIPOS_VALIDOS.includes(tipo)) {
      params.push(tipo);
      query += ` AND o.tipo = $${params.length}`;
    }
    if (ano) {
      params.push(ano);
      query += ` AND EXTRACT(YEAR FROM c.data) = $${params.length}`;
    }

    query += ` ORDER BY c.data DESC`;
    const result = await db.query(query, params);

    const total = result.rows.reduce((s, r) => s + parseFloat(r.valor), 0);
    return res.json({ historico: result.rows, total });
  } catch (err) {
    console.error('[ofertas/historico] Erro:', err.message);
    return res.status(500).json({ message: 'Erro ao buscar histórico.' });
  }
}

export {
  batchInserir,
  getResumo,
  getDetalhe,
  lookupMembro,
  getHistoricoMembro,
};