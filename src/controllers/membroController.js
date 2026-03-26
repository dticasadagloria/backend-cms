import { query } from "../config/db.js";
import {
  getAllMembros,
  createMembro,
  findMembroById,
  updateMembro,
  deactivateMembro,
  deleteMembroHard,
  reactivateMembro,
} from "../models/membroModel.js";

// GET /api/membros — Listar todos
export const getAllMembrosHandler = async (req, res) => {
  console.log("\n GET ALL MEMBROS - User:", req.user?.username);

  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    const membros = await getAllMembros(isAdmin ? null : branch_id);

    console.log(`Returned ${membros.length} membros`);
    res.status(200).json({
      success: true,
      count: membros.length,
      membros,
    });
  } catch (error) {
    console.error("GET MEMBROS ERROR:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/membros — Criar novo
export const createMembroHandler = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  // Força branch_id do user se não for admin
  if (!isAdmin) {
    req.body.branch_id = branch_id;
  }

  try {
    const membro = await createMembro(req.body);
    res.status(201).json({ success: true, membro });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/membros/:id — Actualizar
// export const updateMembroHandler = async (req, res) => {
//   console.log('\n UPDATE MEMBRO - ID:', req.params.id);

//   const { id } = req.params;
//   const { codigo, nome, genero, branch_id } = req.body;

//   try {
//     const existing = await findMembroById(id);
//     if (!existing) {
//       return res.status(404).json({ message: 'Membro não encontrado' });
//     }

//     const updated = await updateMembro(id, { codigo, nome, genero, branch_id });

//     console.log('Membro updated:', updated);
//     res.status(200).json({
//       message: 'Membro actualizado com sucesso',
//       membro: updated,
//     });

//   } catch (error) {
//     console.error('UPDATE MEMBRO ERROR:', error.message);
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };
export const updateMembroHandler = async (req, res) => {
  console.log("\n UPDATE MEMBRO - ID:", req.params.id);
  console.log("Body:", req.body);

  const { id } = req.params;

  try {
    // Validações
    if (!req.body.nome) {
      return res.status(400).json({ message: "Nome é obrigatório" });
    }

    // NORMALIZA OS DADOS antes de passar pro model
    const normalizedData = {
      codigo: req.body.codigo,
      nome: req.body.nome || req.body.nome_membro, // ← aceita ambos
      genero: req.body.genero,
      branch_id: req.body.branch_id,
      celula_id: req.body.celula_id,
      data_nascimento: req.body.data_nascimento,
      faixa_etaria: req.body.faixa_etaria,
      bairro: req.body.bairro,
      estado_civil: req.body.estado_civil,
      batizado: req.body.batizado,
      data_batismo: req.body.data_batismo,
      ocupacao: req.body.ocupacao,
      ano_ingresso: req.body.ano_ingresso,
      escola_da_verdade: req.body.escola_da_verdade,
      data_conclusao_escola: req.body.data_conclusao_escola,
      contacto: req.body.contacto,
      email: req.body.email,
      tipo_documento: req.body.tipo_documento,
      numero_documento: req.body.numero_documento,
      parceiro: req.body.parceiro,
    };

    const updated = await updateMembro(id, normalizedData);

    console.log("Membro updated:", updated);
    res.status(200).json({
      message: "Membro actualizado com sucesso",
      membro: updated,
    });
  } catch (error) {
    console.error("UPDATE MEMBRO ERROR:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/membros/:id — Desactivar
export const deleteMembroHandler = async (req, res) => {
  console.log("\n DELETE MEMBRO - ID:", req.params.id);

  const { id } = req.params;

  try {
    const existing = await findMembroById(id);
    if (!existing) {
      return res.status(404).json({ message: "Membro não encontrado" });
    }

    const deleted = await deactivateMembro(id);

    console.log("Membro deactivated:", deleted);
    res.status(200).json({
      message: "Membro desactivado com sucesso",
      membro: deleted,
    });
  } catch (error) {
    console.error("DELETE MEMBRO ERROR:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/membros/:id
export const getMembroByIdHandler = async (req, res) => {
  const membro = await findMembroById(req.params.id);
  if (!membro) return res.status(404).json({ message: "Não encontrado" });
  res.json({ membro });
};

// ==================== DELETE (HARD DELETE) MEMBRO ====================
export const deleteMembroHardHandler = async (req, res) => {
  console.log("\n DELETE MEMBRO (HARD) - ID:", req.params.id);

  const { id } = req.params;

  try {
    const existing = await findMembroById(id);
    if (!existing)
      return res.status(404).json({ message: "Membro não encontrado" });

    // APAGA PERMANENTEMENTE da base de dados
    const deleted = await deleteMembroHard(id);

    console.log("Membro PERMANENTLY deleted:", deleted.nome);
    res.status(200).json({
      message: "Membro eliminado permanentemente da base de dados",
      membro: deleted,
    });
  } catch (error) {
    console.error("DELETE MEMBRO ERROR:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== REACTIVATE MEMBRO ====================
export const reactivateMembroHandler = async (req, res) => {
  console.log("\n REACTIVATE MEMBRO - ID:", req.params.id);

  const { id } = req.params;

  try {
    const existing = await findMembroById(id);
    if (!existing)
      return res.status(404).json({ message: "Membro não encontrado" });
    if (existing.ativo)
      return res.status(400).json({ message: "Membro já está activo" });

    const reactivated = await reactivateMembro(id);
    console.log("Membro reactivated:", reactivated.nome);
    res.status(200).json({ message: "Membro reactivado", membro: reactivated });
  } catch (error) {
    console.error("REACTIVATE MEMBRO ERROR:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Membros sem célula ───────────────────────────────────────────────────────
export const membrosSemCelula = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        m.id,
        m.nome AS nome_membro,
        m.contacto,
        m.codigo,
        b.nome as nome_branch
      FROM membros m
      LEFT JOIN branches b ON m.branch_id = b.id
      WHERE m.celula_id IS NULL
      ORDER BY m.nome ASC
    `);

    const statsResult = await query(`
      SELECT
        COUNT(*)                    as total,
        COUNT(celula_id)            as com_celula,
        COUNT(*) - COUNT(celula_id) as sem_celula
      FROM membros
    `);

    const s = statsResult.rows[0];

    res.json({
      success: true,
      semCelula: result.rows,
      stats: {
        total:     parseInt(s.total),
        comCelula: parseInt(s.com_celula),
        semCelula: parseInt(s.sem_celula),
      }
    });
  } catch (err) {
    console.error("membrosSemCelula error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};