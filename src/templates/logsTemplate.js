const ACTION_LABELS = {
  CREATE:        "Criação",
  UPDATE:        "Actualização",
  DELETE:        "Eliminação",
  DELETE_HARD:   "Elim. Total",
  REACTIVATE:    "Reactivação",
  STATUS_CHANGE: "Mudança de Status",
  LOGIN:         "Login",
  LOGOUT:        "Logout",
  REGISTER:      "Registo",
};

const ACTION_COLORS = {
  CREATE:        { bg: "#d1fae5", text: "#065f46" },
  UPDATE:        { bg: "#fef3c7", text: "#92400e" },
  DELETE:        { bg: "#fee2e2", text: "#991b1b" },
  DELETE_HARD:   { bg: "#ffe4e6", text: "#be123c" },
  REACTIVATE:    { bg: "#e0f2fe", text: "#0369a1" },
  STATUS_CHANGE: { bg: "#f3e8ff", text: "#7e22ce" },
  LOGIN:         { bg: "#f1f5f9", text: "#475569" },
  LOGOUT:        { bg: "#f1f5f9", text: "#64748b" },
  REGISTER:      { bg: "#ccfbf1", text: "#0f766e" },
};

const ENTITY_LABELS = {
  membro:      "Membro",
  user:        "Utilizador",
  culto:       "Culto",
  visitante:   "Visitante",
  convertido:  "Convertido",
  requisicao:  "Requisição",
  restauracao: "Restauração",
  auth:        "Autenticação",
};

const formatTs = (ts) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-MZ", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const actionBadge = (action) => {
  const label = ACTION_LABELS[action] ?? action;
  const color = ACTION_COLORS[action] ?? { bg: "#f1f5f9", text: "#475569" };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;background:${color.bg};color:${color.text}">${label}</span>`;
};

// ── Calcula estatísticas a partir dos logs ───────────────────────────────────
const buildStats = (logs) => {
  const counts = {};
  for (const l of logs) {
    counts[l.action] = (counts[l.action] || 0) + 1;
  }
  return counts;
};

export const gerarLogsHTML = ({ logs, username, filtros = {} }) => {
  const stats   = buildStats(logs);
  const total   = logs.length;
  const dataHoje = new Date().toLocaleDateString("pt-MZ");

  const filtroDesc = [
    filtros.from      && `De: ${filtros.from}`,
    filtros.to        && `Até: ${filtros.to}`,
    filtros.action    && `Acção: ${ACTION_LABELS[filtros.action] ?? filtros.action}`,
    filtros.entity_type && `Módulo: ${ENTITY_LABELS[filtros.entity_type] ?? filtros.entity_type}`,
    filtros.search    && `Pesquisa: "${filtros.search}"`,
  ].filter(Boolean).join(" · ") || "Sem filtros aplicados";

  return `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 28px; }

    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #b6852e; padding-bottom: 14px; }
    .header h1 { font-size: 18px; color: #1e293b; }
    .header p  { color: #64748b; font-size: 10px; margin-top: 3px; }

    .meta { display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 10px; color: #64748b; gap: 8px; flex-wrap: wrap; }
    .meta strong { color: #1e293b; }

    .filtros { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 18px; font-size: 10px; color: #64748b; }
    .filtros span { font-weight: 700; color: #475569; }

    .summary { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .summary-card { flex: 1; min-width: 90px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; text-align: center; }
    .summary-card .val  { font-size: 20px; font-weight: 700; color: #b6852e; }
    .summary-card .lbl  { font-size: 9px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: .04em; }
    .summary-card.hi    { background: #fef3c7; border-color: #b6852e; }
    .summary-card.hi .val { color: #92400e; }

    .section-title { font-size: 12px; font-weight: 700; color: #1e293b; margin: 18px 0 8px; border-left: 3px solid #b6852e; padding-left: 7px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #fef3c7; color: #92400e; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; padding: 6px 8px; text-align: left; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 10px; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #fafafa; }

    .mono { font-family: monospace; font-size: 10px; color: #64748b; white-space: nowrap; }
    .user-chip { display: inline-flex; align-items: center; gap: 4px; }
    .user-chip .av { width: 18px; height: 18px; border-radius: 4px; background: #fef3c7; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 700; color: #92400e; }
    .desc { max-width: 240px; word-break: break-word; }

    .footer { margin-top: 24px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }

    @media print {
      body { padding: 0; }
      button { display: none; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>

  <!-- Cabeçalho -->
  <div class="header">
    <img src="https://casadagloria-cms.vercel.app/Logo1.png"
         style="width:100px;height:auto;display:block;margin:0 auto 10px;" alt="Logo IICGP" />
    <h1>Igreja Internacional Casa da Glória da Palavra</h1>
    <p>Relatório de Actividades do Sistema</p>
  </div>

  <!-- Meta -->
  <div class="meta">
    <span>Gerado por: <strong>${username}</strong></span>
    <span>Data de exportação: <strong>${dataHoje}</strong></span>
    <span>Total de registos: <strong>${total}</strong></span>
  </div>

  <!-- Filtros aplicados -->
  <div class="filtros">
    <span>Filtros:</span> ${filtroDesc}
  </div>

  <!-- Cards de resumo -->
  <div class="summary">
    <div class="summary-card hi">
      <div class="val">${total}</div>
      <div class="lbl">Total</div>
    </div>
    ${Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([action, count]) => `
      <div class="summary-card">
        <div class="val">${count}</div>
        <div class="lbl">${ACTION_LABELS[action] ?? action}</div>
      </div>
    `).join("")}
  </div>

  <!-- Tabela de logs -->
  <div class="section-title">Detalhe das Actividades (${total} registos)</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Data / Hora</th>
        <th>Utilizador</th>
        <th>Acção</th>
        <th>Módulo</th>
        <th>Registo</th>
        <th>Filial</th>
        <th>Descrição</th>
      </tr>
    </thead>
    <tbody>
      ${logs.map((log, i) => `
        <tr>
          <td style="color:#94a3b8">${i + 1}</td>
          <td class="mono">${formatTs(log.criado_em)}</td>
          <td>
            <div class="user-chip">
              <span class="av">${(log.username ?? "?").slice(0, 2).toUpperCase()}</span>
              <strong>${log.username ?? "—"}</strong>
            </div>
          </td>
          <td>${actionBadge(log.action)}</td>
          <td style="color:#475569">${ENTITY_LABELS[log.entity_type] ?? log.entity_type ?? "—"}</td>
          <td style="font-weight:600">${log.entity_label ?? "—"}</td>
          <td style="color:#64748b">${log.nome_branch ?? "—"}</td>
          <td class="desc" style="color:#64748b">${log.description ?? "—"}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="footer">
    Sistema de Gestão IICGP · Relatório de Actividades · ${dataHoje}
  </div>

</body>
</html>`;
};
