import {
  getAllCriancas,
  findCriancaById,
  createCrianca,
  updateCrianca,
  deactivateCrianca,
  getPresencasByData,
  markPresenca,
  getHistoricoPresencas,
  getStatsCriancas,
} from '../models/criancaModel.js';

// ==================== GET ALL CRIANÇAS ====================
export const getAllCriancasHandler = async (req, res) => {
  const { turma } = req.query; // ?turma=Grandes ou ?turma=Pequenos

  try {
    const criancas = await getAllCriancas(turma || null);
    res.status(200).json({ success: true, count: criancas.length, criancas });
  } catch (error) {
    console.error('💥 GET CRIANCAS ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== GET CRIANÇA BY ID ====================
export const getCriancaByIdHandler = async (req, res) => {
  try {
    const crianca = await findCriancaById(req.params.id);
    if (!crianca) return res.status(404).json({ message: 'Criança não encontrada' });
    res.status(200).json({ crianca });
  } catch (error) {
    console.error('💥 GET CRIANCA BY ID ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== CREATE CRIANÇA ====================
export const createCriancaHandler = async (req, res) => {
  try {
    if (!req.body.nome) return res.status(400).json({ message: 'Nome é obrigatório' });
    if (!req.body.turma) return res.status(400).json({ message: 'Turma é obrigatória' });
    if (!['Pequenos', 'Grandes'].includes(req.body.turma)) {
      return res.status(400).json({ message: 'Turma deve ser "Pequenos" ou "Grandes"' });
    }

    const newCrianca = await createCrianca(req.body, req.user.id);
    res.status(201).json({ message: 'Criança registada com sucesso', crianca: newCrianca });
  } catch (error) {
    console.error('💥 CREATE CRIANCA ERROR:', error.message);
    if (error.code === '23505') return res.status(409).json({ message: 'Código já existe' });
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== UPDATE CRIANÇA ====================
export const updateCriancaHandler = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await findCriancaById(id);
    if (!existing) return res.status(404).json({ message: 'Criança não encontrada' });
    if (!req.body.nome) return res.status(400).json({ message: 'Nome é obrigatório' });
    if (!req.body.turma) return res.status(400).json({ message: 'Turma é obrigatória' });

    const updated = await updateCrianca(id, req.body);
    res.status(200).json({ message: 'Criança actualizada com sucesso', crianca: updated });
  } catch (error) {
    console.error('💥 UPDATE CRIANCA ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== DEACTIVATE CRIANÇA ====================
export const deactivateCriancaHandler = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await findCriancaById(id);
    if (!existing) return res.status(404).json({ message: 'Criança não encontrada' });

    const deactivated = await deactivateCrianca(id);
    res.status(200).json({ message: 'Criança desactivada', crianca: deactivated });
  } catch (error) {
    console.error('💥 DEACTIVATE CRIANCA ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== GET PRESENÇAS (CHAMADA) ====================
// GET /api/criancas/presencas?data=2026-07-26&turma=Grandes
export const getPresencasHandler = async (req, res) => {
  const { data, turma } = req.query;

  try {
    if (!data) return res.status(400).json({ message: 'Data é obrigatória (?data=YYYY-MM-DD)' });

    const presencas = await getPresencasByData(data, turma || null);
    res.status(200).json({ success: true, data, turma: turma || 'todas', presencas });
  } catch (error) {
    console.error('💥 GET PRESENCAS ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== MARCAR PRESENÇA ====================
// POST /api/criancas/presencas  { crianca_id, data_presenca, presente, turma }
export const markPresencaHandler = async (req, res) => {
  const { crianca_id, data_presenca, presente, turma } = req.body;

  try {
    if (!crianca_id || !data_presenca) {
      return res.status(400).json({ message: 'crianca_id e data_presenca são obrigatórios' });
    }

    const result = await markPresenca(crianca_id, data_presenca, presente, turma, req.user.id);
    res.status(200).json({ message: 'Presença registada', presenca: result });
  } catch (error) {
    console.error('💥 MARK PRESENCA ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== MARCAR PRESENÇAS EM LOTE (chamada toda de uma vez) ====================
// POST /api/criancas/presencas/lote  { data_presenca, turma, registos: [{crianca_id, presente}] }
export const markPresencasLoteHandler = async (req, res) => {
  const { data_presenca, turma, registos } = req.body;

  try {
    if (!data_presenca || !Array.isArray(registos)) {
      return res.status(400).json({ message: 'data_presenca e registos[] são obrigatórios' });
    }

    const resultados = [];
    for (const r of registos) {
      const result = await markPresenca(r.crianca_id, data_presenca, r.presente, turma, req.user.id);
      resultados.push(result);
    }

    res.status(200).json({ message: `${resultados.length} presenças registadas`, presencas: resultados });
  } catch (error) {
    console.error('💥 MARK PRESENCAS LOTE ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== HISTÓRICO DE PRESENÇAS ====================
export const getHistoricoHandler = async (req, res) => {
  try {
    const historico = await getHistoricoPresencas(req.params.id);
    res.status(200).json({ historico });
  } catch (error) {
    console.error('💥 GET HISTORICO ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== STATS ====================
export const getStatsHandler = async (req, res) => {
  try {
    const stats = await getStatsCriancas();
    res.status(200).json({ stats });
  } catch (error) {
    console.error('💥 GET STATS ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};
