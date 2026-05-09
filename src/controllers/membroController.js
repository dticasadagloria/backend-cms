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
import { logActivity } from "../helpers/logActivity.js";

// GET /api/membros — Listar todos
export const getAllMembrosHandler = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    const membros = await getAllMembros(isAdmin ? null : branch_id);
    res.status(200).json({ success: true, count: membros.length, membros });
  } catch (error) {
    console.error("GET MEMBROS ERROR:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /api/membros — Criar novo
export const createMembroHandler = async (req, res) => {
  const { role_id, branch_id } = req.user;

  // Quem pode criar membros
  const allowedRoles = [1, 2, 8, 11];

  // Apenas admins reais
  const adminRoles = [1, 2];

  const canCreate = allowedRoles.includes(role_id);
  const isAdmin = adminRoles.includes(role_id);

  if (!canCreate) {
    return res.status(403).json({
      success: false,
      error: "Sem permissão",
    });
  }

  // Não-admins usam apenas a própria branch
  if (!isAdmin) {
    req.body.branch_id = branch_id;
  }

  try {
    const membro = await createMembro(req.body);

    await logActivity(req, {
      action: "CREATE",
      entity_type: "membro",
      entity_id: membro.id,
      entity_label: membro.nome,
      new_values: membro,
      description: `Registou o membro ${membro.nome}`,
    });

    res.status(201).json({
      success: true,
      membro,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// PUT /api/membros/:id — Actualizar
export const updateMembroHandler = async (req, res) => {
  const { id } = req.params;

  try {
    if (!req.body.nome) {
      return res.status(400).json({ message: "Nome é obrigatório" });
    }

    const existing = await findMembroById(id);

    const normalizedData = {
      codigo: req.body.codigo,
      nome: req.body.nome || req.body.nome_membro,
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
    await logActivity(req, {
      action: "UPDATE",
      entity_type: "membro",
      entity_id: parseInt(id),
      entity_label: updated.nome,
      old_values: existing,
      new_values: updated,
      description: `Actualizou o membro ${updated.nome}`,
    });
    res
      .status(200)
      .json({ message: "Membro actualizado com sucesso", membro: updated });
  } catch (error) {
    console.error("UPDATE MEMBRO ERROR:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/membros/:id — Desactivar
export const deleteMembroHandler = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await findMembroById(id);
    if (!existing)
      return res.status(404).json({ message: "Membro não encontrado" });

    const deleted = await deactivateMembro(id);
    await logActivity(req, {
      action: "DELETE",
      entity_type: "membro",
      entity_id: parseInt(id),
      entity_label: deleted.nome,
      description: `Desactivou o membro ${deleted.nome}`,
    });
    res
      .status(200)
      .json({ message: "Membro desactivado com sucesso", membro: deleted });
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

// DELETE /api/membros/:id/hard
export const deleteMembroHardHandler = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await findMembroById(id);
    if (!existing)
      return res.status(404).json({ message: "Membro não encontrado" });

    const deleted = await deleteMembroHard(id);
    await logActivity(req, {
      action: "DELETE_HARD",
      entity_type: "membro",
      entity_id: parseInt(id),
      entity_label: deleted.nome,
      old_values: existing,
      description: `Eliminou permanentemente o membro ${deleted.nome}`,
    });
    res
      .status(200)
      .json({
        message: "Membro eliminado permanentemente da base de dados",
        membro: deleted,
      });
  } catch (error) {
    console.error("DELETE MEMBRO ERROR:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// PATCH /api/membros/:id/reactivate
export const reactivateMembroHandler = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await findMembroById(id);
    if (!existing)
      return res.status(404).json({ message: "Membro não encontrado" });
    if (existing.ativo)
      return res.status(400).json({ message: "Membro já está activo" });

    const reactivated = await reactivateMembro(id);
    await logActivity(req, {
      action: "REACTIVATE",
      entity_type: "membro",
      entity_id: parseInt(id),
      entity_label: reactivated.nome,
      description: `Reactivou o membro ${reactivated.nome}`,
    });
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
        total: parseInt(s.total),
        comCelula: parseInt(s.com_celula),
        semCelula: parseInt(s.sem_celula),
      },
    });
  } catch (err) {
    console.error("membrosSemCelula error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
