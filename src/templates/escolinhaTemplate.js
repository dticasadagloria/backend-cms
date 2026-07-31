export const gerarEscolinhaHTML = ({
  titulo, username, aulas, presentes, totalPresencasCard, aula_id
}) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 30px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #b6852e; padding-bottom: 15px; }
        .header h1 { font-size: 20px; color: #1e293b; }
        .header p  { color: #64748b; font-size: 11px; margin-top: 4px; }
        .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 11px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        th { background: #fef3c7; color: #92400e; font-size: 10px; text-transform: uppercase; padding: 8px 10px; text-align: left; }
        td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: bold; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-red   { background: #fee2e2; color: #991b1b; }
        .badge-amber { background: #fef3c7; color: #92400e; }
        .badge-indigo { background: #e0e7ff; color: #3730a3; }
        .section-title { font-size: 13px; font-weight: bold; color: #1e293b; margin: 20px 0 10px; border-left: 3px solid #b6852e; padding-left: 8px; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
        .summary { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
        .summary-card { flex: 1; min-width: 100px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
        .summary-card .value { font-size: 22px; font-weight: bold; color: #b6852e; }
        .summary-card .label { font-size: 10px; color: #64748b; margin-top: 2px; }
        .summary-card.highlight { background: #fef3c7; border-color: #b6852e; }
        .summary-card.highlight .value { color: #92400e; }
      </style>
    </head>
    <body>
      <div class="header">
        <img
          src="https://casadagloria-cms.vercel.app/Logo1.png"
          style="width: 120px; height: auto; display: block; margin: 0 auto 10px;"
          alt="Logo IICGP"
        />
        <h1>Igreja Internacional Casa da Glória da Palavra</h1>
        <p>${titulo}</p>
      </div>

      <div class="meta">
        <span>Gerado por: <strong>${username}</strong></span>
        <span>Data: <strong>${new Date().toLocaleDateString("pt-MZ")}</strong></span>
        <span>Total de aulas: <strong>${aulas.length}</strong></span>
      </div>

      <div class="summary">
        <div class="summary-card">
          <div class="value">${aulas.length}</div>
          <div class="label">Aulas</div>
        </div>
        <div class="summary-card highlight">
          <div class="value">${totalPresencasCard}</div>
          <div class="label">Presenças de Crianças</div>
        </div>
      </div>

      <div class="section-title">Detalhes por Aula</div>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Turma</th>
            <th>Tema</th>
            <th>Filial</th>
            <th>Presentes</th>
            <th>Ausentes</th>
            <th>Taxa</th>
          </tr>
        </thead>
        <tbody>
          ${aulas.map((a) => `
              <tr>
                <td>${a.data_formatada}</td>
                <td>
                  <span class="badge ${a.turma === "Grandes" ? "badge-indigo" : "badge-amber"}">${a.turma}</span>
                </td>
                <td>${a.tema || "—"}</td>
                <td>${a.nome_branch || "—"}</td>
                <td><span class="badge badge-green">${a.presentes}</span></td>
                <td><span class="badge badge-red">${a.ausentes}</span></td>
                <td><span class="badge badge-amber">${a.taxa ?? 0}%</span></td>
              </tr>
            `).join("")}
        </tbody>
      </table>

      <!-- Lista de presentes por aula -->
      ${aulas.map((a) => {
        const presentesDaAula = presentes.filter((p) => String(p.aula_id) === String(a.id));
        if (!presentesDaAula.length) return "";
        return `
          <div class="section-title">Presentes — ${a.turma} (${a.data_formatada})${a.tema ? ` — ${a.tema}` : ""} — ${presentesDaAula.length}</div>
          <table>
            <thead>
              <tr><th>#</th><th>Nome</th><th>Filial</th></tr>
            </thead>
            <tbody>
              ${presentesDaAula.map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${p.nome_crianca || "—"}</td>
                  <td>${p.nome_branch || "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }).join("")}

      <div class="footer">
        Sistema de Gestão IICGP · Escolinha da Verdade · Relatório gerado automaticamente<br>
        Metodologia: Ausentes = Total de crianças activas da turma e filial − Presentes.
      </div>
    </body>
    </html>
  `;
};
