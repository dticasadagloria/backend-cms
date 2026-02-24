import {
  getAllMembros,
  createMembro,
  findMembroById,
  updateMembro,
  deactivateMembro,
  deleteMembroHard,
  reactivateMembro,
} from '../models/membroModel.js';

// GET /api/membros — Listar todos
export const getAllMembrosHandler = async (req, res) => {
  console.log('\n GET ALL MEMBROS - User:', req.user?.username);

  try {
    const membros = await getAllMembros();

    console.log(`Returned ${membros.length} membros`);
    res.status(200).json({
      success: true,
      count: membros.length,
      membros,
    });

  } catch (error) {
    console.error('GET MEMBROS ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /api/membros — Criar novo
// export const createMembroHandler = async (req, res) => {
//   console.log('\n CREATE MEMBRO - User:', req.user?.username);

//   const { codigo, nome, genero, branch_id } = req.body;

//   try {
//     if (!nome) {
//       return res.status(400).json({ message: 'Nome é obrigatório' });
//     }

//     const newMembro = await createMembro(
//       { codigo, nome, genero, branch_id },
//       req.user.id
//     );

//     console.log('Membro created:', newMembro);
//     res.status(201).json({
//       message: 'Membro criado com sucesso',
//       membro: newMembro,
//     });

//   } catch (error) {
//     console.error('CREATE MEMBRO ERROR:', error.message);
//     if (error.code === '23505') {
//       return res.status(409).json({ message: 'Código já existe' });
//     }
//     res.status(500).json({ message: 'Internal server error' });
//   }
// };
// membroController.js
export const createMembroHandler = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      nome: req.body.nome_membro,  // mapeia o campo
    };
    const membro = await createMembro(payload, req.user.id);
    res.status(201).json(membro);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
  console.log('\n UPDATE MEMBRO - ID:', req.params.id);
  console.log('Body:', req.body);

  const { id } = req.params;

  try {
    // Validações
    if (!req.body.nome) {
      return res.status(400).json({ message: 'Nome é obrigatório' });
    }

    // NORMALIZA OS DADOS antes de passar pro model
    const normalizedData = {
      codigo: req.body.codigo,
      nome: req.body.nome || req.body.nome_membro,  // ← aceita ambos
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

    console.log('Membro updated:', updated);
    res.status(200).json({
      message: 'Membro actualizado com sucesso',
      membro: updated,
    });

  } catch (error) {
    console.error('UPDATE MEMBRO ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/membros/:id — Desactivar
export const deleteMembroHandler = async (req, res) => {
  console.log('\n DELETE MEMBRO - ID:', req.params.id);

  const { id } = req.params;

  try {
    const existing = await findMembroById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Membro não encontrado' });
    }

    const deleted = await deactivateMembro(id);

    console.log('Membro deactivated:', deleted);
    res.status(200).json({
      message: 'Membro desactivado com sucesso',
      membro: deleted,
    });

  } catch (error) {
    console.error('DELETE MEMBRO ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
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
  console.log('\n DELETE MEMBRO (HARD) - ID:', req.params.id);

  const { id } = req.params;

  try {
    const existing = await findMembroById(id);
    if (!existing) return res.status(404).json({ message: 'Membro não encontrado' });

    // APAGA PERMANENTEMENTE da base de dados
    const deleted = await deleteMembroHard(id);

    console.log('Membro PERMANENTLY deleted:', deleted.nome);
    res.status(200).json({
      message: 'Membro eliminado permanentemente da base de dados',
      membro: deleted,
    });
  } catch (error) {
    console.error('DELETE MEMBRO ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ==================== REACTIVATE MEMBRO ====================
export const reactivateMembroHandler = async (req, res) => {
  console.log('\n REACTIVATE MEMBRO - ID:', req.params.id);

  const { id } = req.params;

  try {
    const existing = await findMembroById(id);
    if (!existing) return res.status(404).json({ message: 'Membro não encontrado' });
    if (existing.ativo) return res.status(400).json({ message: 'Membro já está activo' });

    const reactivated = await reactivateMembro(id);
    console.log('Membro reactivated:', reactivated.nome);
    res.status(200).json({ message: 'Membro reactivado', membro: reactivated });
  } catch (error) {
    console.error('REACTIVATE MEMBRO ERROR:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};