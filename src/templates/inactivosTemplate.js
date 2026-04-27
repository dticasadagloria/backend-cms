export const inactivosTemplate = (membros, { username, dataGeracao, total, ativos, inativos }) => {
  const linhas = membros
    .map(
      (m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${m.nome_membro || "—"}</td>
          <td>${m.nome_branch || "—"}</td>
          <td>${m.contacto || "—"}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SOS Socorros — Membros Inactivos</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 30px; }

    .header { text-align: center; margin-bottom: 28px; border-bottom: 2px solid #b6852e; padding-bottom: 16px; }
    .header img { width: 90px; height: auto; display: block; margin: 0 auto 10px; }
    .header h1 { font-size: 17px; color: #1e293b; font-weight: bold; }
    .header h2 { font-size: 13px; color: #ef4444; font-weight: 600; margin-top: 4px; }

    .meta { display: flex; justify-content: space-between; margin-bottom: 18px; font-size: 10px; color: #64748b; }

    .summary { display: flex; gap: 14px; margin-bottom: 22px; }
    .summary-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; background: #f8fafc; }
    .summary-card .value { font-size: 26px; font-weight: bold; }
    .summary-card .label { font-size: 10px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
    .value-total   { color: #475569; }
    .value-ativo   { color: #16a34a; }
    .value-inativo { color: #ef4444; }

    .section-title { font-size: 12px; font-weight: bold; color: #1e293b; margin: 0 0 10px; border-left: 3px solid #ef4444; padding-left: 8px; text-transform: uppercase; letter-spacing: 0.05em; }

    table { width: 100%; border-collapse: collapse; }
    thead th { background: #fee2e2; color: #991b1b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 10px; text-align: left; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) { background: #fafafa; }

    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
    @media print { body { padding: 15px; } }
  </style>
</head>
<body>

  <div class="header">
    <img src="https://casadagloria-cms.vercel.app/Logo1.png" alt="Logo IICGP" />
    <h1>Igreja Internacional Casa da Glória da Palavra</h1>
    <h2>SOS Socorros — Membros Inactivos</h2>
  </div>

  <div class="meta">
    <span>Gerado por: <strong>${username}</strong></span>
    <span>Data: <strong>${dataGeracao}</strong></span>
    <span>Total de registos: <strong>${inativos}</strong></span>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="value value-total">${total}</div>
      <div class="label">Total Membros</div>
    </div>
    <div class="summary-card">
      <div class="value value-ativo">${ativos}</div>
      <div class="label">Activos</div>
    </div>
    <div class="summary-card">
      <div class="value value-inativo">${inativos}</div>
      <div class="label">Inactivos</div>
    </div>
  </div>

  <div class="section-title">Lista de Membros Inactivos para Contactar</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Nome</th>
        <th>Filial</th>
        <th>Contacto</th>
      </tr>
    </thead>
    <tbody>
      ${linhas || '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px;">Sem membros inactivos</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    Sistema de Gestão IICGP &middot; SOS Socorros &middot; Gerado em ${dataGeracao}
  </div>

</body>
</html>`;
};
