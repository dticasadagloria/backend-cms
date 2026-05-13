const FILTRO_LABELS = {
  ativos:              "Activos",
  inativos:            "Inactivos",
  batizados:           "Batizados",
  nao_batizados:       "Não Batizados",
  escola_concluido:    "Escola Concluída",
  escola_emcurso:      "Escola Em Curso",
  escola_naofrequenta: "Escola Não Frequenta",
  lideres:             "Líderes",
  parceiros:           "Parceiros",
  nao_parceiros:       "Não Parceiros",
  maiores_18:          "Maiores de 18 anos",
  menores_18:          "Menores de 18 anos",
};

const calcularIdade = (dataNasc) => {
  if (!dataNasc) return null;
  const hoje = new Date();
  const nasc = new Date(dataNasc);
  let idade  = hoje.getFullYear() - nasc.getFullYear();
  const m    = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
};

const fmt = (v) => (v ?? "—");

const badge = (text, tipo) => {
  const map = {
    green:  "background:#d1fae5;color:#065f46",
    red:    "background:#fee2e2;color:#991b1b",
    amber:  "background:#fef3c7;color:#92400e",
    blue:   "background:#dbeafe;color:#1d4ed8",
    gray:   "background:#f1f5f9;color:#475569",
    purple: "background:#f3e8ff;color:#7e22ce",
  };
  const style = map[tipo] ?? map.gray;
  return `<span style="display:inline-block;padding:2px 7px;border-radius:999px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;${style}">${text}</span>`;
};

export const gerarMembrosHTML = ({ membros, username, filtro }) => {
  const total      = membros.length;
  const ativos     = membros.filter((m) => m.ativo).length;
  const inativos   = total - ativos;
  const masc       = membros.filter((m) => m.genero === "Masculino").length;
  const fem        = membros.filter((m) => m.genero === "Feminino").length;
  const batizados  = membros.filter((m) => m.batizado).length;
  const parceiros  = membros.filter((m) => m.parceiro).length;

  const filtroLabel = FILTRO_LABELS[filtro] ?? (filtro ? filtro : "Todos os membros");
  const dataHoje    = new Date().toLocaleDateString("pt-MZ", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const linhas = membros.map((m, i) => {
    const idade    = calcularIdade(m.data_nascimento);
    const dataNasc = m.data_nascimento
      ? new Date(m.data_nascimento).toLocaleDateString("pt-MZ", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "—";

    return `
      <tr>
        <td style="color:#94a3b8;text-align:center">${i + 1}</td>
        <td style="font-family:monospace;font-size:9px;color:#b6852e;font-weight:700">${fmt(m.codigo)}</td>
        <td style="font-weight:600">${fmt(m.nome_membro)}</td>
        <td>${m.genero === "Masculino" ? badge("Masc.", "blue") : m.genero === "Feminino" ? badge("Fem.", "purple") : "—"}</td>
        <td style="color:#475569">${fmt(m.nome_branch)}</td>
        <td style="color:#475569">${fmt(m.nome_celula)}</td>
        <td style="color:#475569">${dataNasc}${idade !== null ? ` <span style="color:#94a3b8;font-size:8px">(${idade}a)</span>` : ""}</td>
        <td>${m.batizado ? badge("Sim", "green") : badge("Não", "gray")}</td>
        <td style="color:#475569;font-size:9px">${fmt(m.escola_da_verdade)}</td>
        <td>${m.parceiro ? badge("Sim", "amber") : badge("Não", "gray")}</td>
        <td style="color:#475569">${fmt(m.contacto)}</td>
        <td>${m.ativo ? badge("Activo", "green") : badge("Inactivo", "red")}</td>
      </tr>`;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #1e293b; padding: 20px; }

    .header { text-align:center; margin-bottom:20px; border-bottom:2px solid #b6852e; padding-bottom:12px; }
    .header h1 { font-size:16px; color:#1e293b; }
    .header h2 { font-size:12px; color:#b6852e; font-weight:600; margin-top:3px; }
    .header p  { color:#64748b; font-size:9px; margin-top:2px; }

    .meta { display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px; margin-bottom:14px; font-size:9px; color:#64748b; }
    .meta strong { color:#1e293b; }

    .filtro { background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:6px 10px; margin-bottom:14px; font-size:9px; color:#64748b; }
    .filtro span { font-weight:700; color:#475569; }

    .summary { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .card { flex:1; min-width:72px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:8px 10px; text-align:center; }
    .card.hi { background:#fef3c7; border-color:#b6852e; }
    .card .val { font-size:18px; font-weight:700; color:#b6852e; }
    .card.hi .val { color:#92400e; }
    .card .lbl { font-size:8px; color:#64748b; margin-top:2px; text-transform:uppercase; letter-spacing:.04em; }

    .section-title { font-size:11px; font-weight:700; color:#1e293b; margin:0 0 8px; border-left:3px solid #b6852e; padding-left:6px; text-transform:uppercase; letter-spacing:.04em; }

    table { width:100%; border-collapse:collapse; }
    th { background:#fef3c7; color:#92400e; font-size:8px; text-transform:uppercase; letter-spacing:.05em; padding:5px 6px; text-align:left; white-space:nowrap; }
    td { padding:4px 6px; border-bottom:1px solid #f1f5f9; font-size:9px; vertical-align:middle; }
    tr:last-child td { border-bottom:none; }
    tr:nth-child(even) td { background:#fafafa; }

    .footer { margin-top:20px; text-align:center; font-size:8px; color:#94a3b8; border-top:1px solid #f1f5f9; padding-top:8px; }

    @media print {
      body { padding:0; }
      @page { margin:10mm; size:A4 landscape; }
    }
  </style>
</head>
<body>

  <div class="header">
    <img src="https://casadagloria-cms.vercel.app/Logo1.png"
         style="width:80px;height:auto;display:block;margin:0 auto 8px;" alt="Logo IICGP" />
    <h1>Igreja Internacional Casa da Glória da Palavra</h1>
    <h2>Relatório de Membros</h2>
    <p>${filtroLabel}</p>
  </div>

  <div class="meta">
    <span>Gerado por: <strong>${username}</strong></span>
    <span>Data: <strong>${dataHoje}</strong></span>
    <span>Total: <strong>${total} membros</strong></span>
  </div>

  <div class="filtro">
    <span>Filtro aplicado:</span> ${filtroLabel}
  </div>

  <div class="summary">
    <div class="card hi">
      <div class="val">${total}</div>
      <div class="lbl">Total</div>
    </div>
    <div class="card">
      <div class="val" style="color:#059669">${ativos}</div>
      <div class="lbl">Activos</div>
    </div>
    <div class="card">
      <div class="val" style="color:#dc2626">${inativos}</div>
      <div class="lbl">Inactivos</div>
    </div>
    <div class="card">
      <div class="val" style="color:#1d4ed8">${masc}</div>
      <div class="lbl">Masculinos</div>
    </div>
    <div class="card">
      <div class="val" style="color:#7e22ce">${fem}</div>
      <div class="lbl">Femininos</div>
    </div>
    <div class="card">
      <div class="val">${batizados}</div>
      <div class="lbl">Batizados</div>
    </div>
    <div class="card">
      <div class="val">${parceiros}</div>
      <div class="lbl">Parceiros</div>
    </div>
  </div>

  <div class="section-title">Lista de Membros (${total})</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Código</th>
        <th>Nome</th>
        <th>Género</th>
        <th>Filial</th>
        <th>Célula</th>
        <th>Nasc. / Idade</th>
        <th>Batizado</th>
        <th>Escola da Verdade</th>
        <th>Parceiro</th>
        <th>Contacto</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      ${linhas || '<tr><td colspan="12" style="text-align:center;color:#94a3b8;padding:16px;">Sem membros para mostrar</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    Sistema de Gestão IICGP &middot; Relatório de Membros &middot; ${dataHoje}
  </div>

</body>
</html>`;
};
