import ExcelJS from "exceljs";
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
import { gerarMembrosHTML } from "../templates/membrosTemplate.js";

// ── Helper: monta WHERE clause a partir do filtro ────────────────────────────
const buildFiltroWhere = (filtro, isAdmin, branch_id, filterBranch) => {
  const conditions = [];
  const params     = [];
  let   idx        = 1;

  if (!isAdmin) {
    conditions.push(`m.branch_id = $${idx++}`);
    params.push(branch_id);
  } else if (filterBranch) {
    conditions.push(`m.branch_id = $${idx++}`);
    params.push(filterBranch);
  }

  switch (filtro) {
    case "ativos":              conditions.push("m.ativo = true");  break;
    case "inativos":            conditions.push("m.ativo = false"); break;
    case "batizados":           conditions.push("m.batizado = true"); break;
    case "nao_batizados":       conditions.push("m.batizado = false"); break;
    case "escola_concluido":    conditions.push("m.escola_da_verdade = 'Concluido'"); break;
    case "escola_emcurso":      conditions.push("m.escola_da_verdade = 'Em curso'"); break;
    case "escola_naofrequenta": conditions.push("m.escola_da_verdade = 'Nao frequenta'"); break;
    case "lideres":             conditions.push("m.lider_celula = true"); break;
    case "parceiros":           conditions.push("m.parceiro = true"); break;
    case "nao_parceiros":       conditions.push("(m.parceiro = false OR m.parceiro IS NULL)"); break;
    case "maiores_18":          conditions.push("m.data_nascimento IS NOT NULL AND m.data_nascimento <= CURRENT_DATE - INTERVAL '18 years'"); break;
    case "menores_18":          conditions.push("m.data_nascimento IS NOT NULL AND m.data_nascimento > CURRENT_DATE - INTERVAL '18 years'"); break;
  }

  return {
    where:  conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
};

// ── Query base de membros para exportação ─────────────────────────────────────
const queryMembrosExport = async (where, params) => {
  const result = await query(`
    SELECT
      m.id, m.codigo, m.nome AS nome_membro, m.genero,
      m.data_nascimento, m.faixa_etaria, m.bairro,
      m.estado_civil, m.batizado, m.ano_batismo,
      m.ocupacao, m.ano_ingresso, m.escola_da_verdade,
      m.ano_conclusao_escola, m.contacto, m.email,
      m.parceiro, m.ativo, m.data_registo,
      COALESCE(b.nome, 'Sem Filial') AS nome_branch,
      COALESCE(c.nome, 'Sem Célula') AS nome_celula
    FROM membros m
    LEFT JOIN branches b ON m.branch_id = b.id
    LEFT JOIN celulas  c ON m.celula_id = c.id
    ${where}
    ORDER BY m.nome ASC
  `, params);
  return result.rows;
};
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
// ✅ filtra por filial do utilizador autenticado (não-Admin só vê a própria
// filial); Admin (role_id 1 ou 2) continua a ver todas — mesmo padrão já
// usado no endpoint /exportar/call-center/pdf.
export const membrosSemCelula = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;

  try {
    const result = await query(
      `
      SELECT
        m.id,
        m.nome AS nome_membro,
        m.contacto,
        m.codigo,
        b.nome as nome_branch
      FROM membros m
      LEFT JOIN branches b ON m.branch_id = b.id
      WHERE m.celula_id IS NULL
        ${!isAdmin ? "AND m.branch_id = $1" : ""}
      ORDER BY m.nome ASC
    `,
      isAdmin ? [] : [branch_id],
    );

    const statsResult = await query(
      `
      SELECT
        COUNT(*)                    as total,
        COUNT(celula_id)            as com_celula,
        COUNT(*) - COUNT(celula_id) as sem_celula
      FROM membros
      ${!isAdmin ? "WHERE branch_id = $1" : ""}
    `,
      isAdmin ? [] : [branch_id],
    );

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

// ── Exportar membros como HTML imprimível (PDF) ───────────────────────────────
export const exportarMembrosPDF = async (req, res) => {
  const { role_id, branch_id, username } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const { filtro, branch_id: filterBranch } = req.query;

  try {
    const { where, params } = buildFiltroWhere(filtro, isAdmin, branch_id, filterBranch);
    const membros = await queryMembrosExport(where, params);

    const html = gerarMembrosHTML({
      membros,
      username: username ?? "Sistema",
      filtro:   filtro ?? null,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("exportarMembrosPDF error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── Exportar membros como Excel (.xlsx) ──────────────────────────────────────
export const exportarMembrosExcel = async (req, res) => {
  const { role_id, branch_id } = req.user;
  const isAdmin = role_id === 1 || role_id === 2;
  const { filtro, branch_id: filterBranch } = req.query;

  const FILTRO_LABELS = {
    ativos: "Activos", inativos: "Inactivos",
    batizados: "Batizados", nao_batizados: "Não Batizados",
    escola_concluido: "Escola Concluída", escola_emcurso: "Escola Em Curso",
    escola_naofrequenta: "Escola Não Frequenta",
    lideres: "Líderes", parceiros: "Parceiros", nao_parceiros: "Não Parceiros",
    maiores_18: "Maiores de 18 anos", menores_18: "Menores de 18 anos",
  };

  try {
    const { where, params } = buildFiltroWhere(filtro, isAdmin, branch_id, filterBranch);
    const membros = await queryMembrosExport(where, params);

    const wb = new ExcelJS.Workbook();
    wb.creator  = "Sistema IICGP";
    wb.created  = new Date();

    const ws = wb.addWorksheet("Membros", { views: [{ state: "frozen", ySplit: 3 }] });

    // ── Linha de título ──
    ws.mergeCells("A1:S1");
    const titleCell   = ws.getCell("A1");
    titleCell.value   = "Igreja Internacional Casa da Glória da Palavra — Relatório de Membros";
    titleCell.font    = { bold: true, size: 13, color: { argb: "FF92400E" } };
    titleCell.fill    = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 24;

    // ── Linha de subtítulo / filtro ──
    ws.mergeCells("A2:S2");
    const subCell   = ws.getCell("A2");
    subCell.value   = `Filtro: ${FILTRO_LABELS[filtro] ?? "Todos os membros"}  |  Total: ${membros.length} membros  |  Exportado em: ${new Date().toLocaleDateString("pt-MZ")}`;
    subCell.font    = { size: 9, color: { argb: "FF64748B" } };
    subCell.fill    = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    subCell.alignment = { horizontal: "center" };
    ws.getRow(2).height = 16;

    // ── Cabeçalhos ──
    const headers = [
      { header: "#",                  key: "idx",                width: 5  },
      { header: "Código",             key: "codigo",             width: 12 },
      { header: "Nome",               key: "nome_membro",        width: 32 },
      { header: "Género",             key: "genero",             width: 12 },
      { header: "Filial",             key: "nome_branch",        width: 20 },
      { header: "Célula",             key: "nome_celula",        width: 18 },
      { header: "Data Nascimento",    key: "data_nascimento",    width: 16 },
      { header: "Idade",              key: "idade",              width: 8  },
      { header: "Faixa Etária",       key: "faixa_etaria",       width: 14 },
      { header: "Bairro",             key: "bairro",             width: 18 },
      { header: "Estado Civil",       key: "estado_civil",       width: 14 },
      { header: "Batizado",           key: "batizado",           width: 10 },
      { header: "Ano Batismo",        key: "ano_batismo",        width: 12 },
      { header: "Escola da Verdade",  key: "escola_da_verdade",  width: 18 },
      { header: "Ocupação",           key: "ocupacao",           width: 18 },
      { header: "Ano Ingresso",       key: "ano_ingresso",       width: 13 },
      { header: "Contacto",           key: "contacto",           width: 16 },
      { header: "Email",              key: "email",              width: 24 },
      { header: "Parceiro",           key: "parceiro",           width: 10 },
      { header: "Estado",             key: "estado",             width: 10 },
      { header: "Data Registo",       key: "data_registo",       width: 14 },
    ];

    ws.columns = headers;

    const headerRow = ws.getRow(3);
    headerRow.values = headers.map((h) => h.header);
    headerRow.font  = { bold: true, size: 9, color: { argb: "FF92400E" } };
    headerRow.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    headerRow.height = 20;

    headers.forEach((h, i) => {
      ws.getColumn(i + 1).width = h.width;
    });

    // ── Calcular idade ──
    const calcIdade = (dataNasc) => {
      if (!dataNasc) return "";
      const hoje = new Date();
      const nasc = new Date(dataNasc);
      let idade  = hoje.getFullYear() - nasc.getFullYear();
      const m    = hoje.getMonth() - nasc.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
      return idade;
    };

    // ── Dados ──
    membros.forEach((m, i) => {
      const row = ws.addRow([
        i + 1,
        m.codigo ?? "",
        m.nome_membro ?? "",
        m.genero ?? "",
        m.nome_branch ?? "",
        m.nome_celula ?? "",
        m.data_nascimento ? new Date(m.data_nascimento).toLocaleDateString("pt-MZ") : "",
        calcIdade(m.data_nascimento),
        m.faixa_etaria ?? "",
        m.bairro ?? "",
        m.estado_civil ?? "",
        m.batizado ? "Sim" : "Não",
        m.ano_batismo ?? "",
        m.escola_da_verdade ?? "",
        m.ocupacao ?? "",
        m.ano_ingresso ?? "",
        m.contacto ?? "",
        m.email ?? "",
        m.parceiro ? "Sim" : "Não",
        m.ativo ? "Activo" : "Inactivo",
        m.data_registo ? new Date(m.data_registo).toLocaleDateString("pt-MZ") : "",
      ]);

      row.font = { size: 9 };
      row.height = 14;

      // Zebra striping
      if (i % 2 === 1) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
      }

      // Colorir coluna Estado
      const estadoCell = row.getCell(20);
      if (m.ativo) {
        estadoCell.font = { size: 9, bold: true, color: { argb: "FF065F46" } };
      } else {
        estadoCell.font = { size: 9, bold: true, color: { argb: "FF991B1B" } };
      }
    });

    // Bordas no cabeçalho
    headerRow.eachCell((cell) => {
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFB6852E" } },
      };
    });

    const filename = `membros_${filtro ?? "todos"}_${Date.now()}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("exportarMembrosExcel error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
