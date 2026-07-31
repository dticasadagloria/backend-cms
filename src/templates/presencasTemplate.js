export const gerarPresencasHTML = ({
  titulo, username, cultos, presentes, visitantes,
  convertidos, totalPresencasCard, totalVisitantesCard,
  totalConvertidosCard, culto_id
}) => {

  const totalGeral = totalPresencasCard + totalVisitantesCard;

  // Verifica se algum culto do relatório é inter-filial, para decidir se mostramos a legenda geral
  const temInterFilial = cultos.some((c) => c.inter_filial);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-user-select: text; user-select: text; }
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
        .badge-blue  { background: #dbeafe; color: #1e40af; }
        .section-title { font-size: 13px; font-weight: bold; color: #1e293b; margin: 20px 0 10px; border-left: 3px solid #b6852e; padding-left: 8px; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
        .summary { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
        .summary-card { flex: 1; min-width: 100px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
        .summary-card .value { font-size: 22px; font-weight: bold; color: #b6852e; }
        .summary-card .label { font-size: 10px; color: #64748b; margin-top: 2px; }
        .summary-card.highlight { background: #fef3c7; border-color: #b6852e; }
        .summary-card.highlight .value { color: #92400e; }
        .nota-metodologia {
          background: #FFF8E1;
          border-left: 4px solid #E2962B;
          padding: 10px 14px;
          margin: 10px 0 20px;
          font-size: 10.5px;
          color: #5a4a1f;
          border-radius: 4px;
        }
        .nota-metodologia strong { color: #92400e; }
        .nota-culto-inline {
          font-size: 9.5px;
          color: #92400e;
          font-style: italic;
        }
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
        <span>Total de cultos: <strong>${cultos.length}</strong></span>
      </div>

      <!-- Cards -->
      <div class="summary">
        <div class="summary-card">
          <div class="value">${cultos.length}</div>
          <div class="label">Cultos</div>
        </div>
        <div class="summary-card">
          <div class="value">${totalPresencasCard}</div>
          <div class="label">Presenças de Membros</div>
        </div>
        <div class="summary-card">
          <div class="value">${totalVisitantesCard}</div>
          <div class="label">Visitantes${culto_id ? " neste Culto" : ""}</div>
        </div>
        <div class="summary-card highlight">
          <div class="value">${totalGeral}</div>
          <div class="label">Total Presenças</div>
        </div>
        <div class="summary-card">
          <div class="value">${totalConvertidosCard}</div>
          <div class="label">Novos Convertidos${culto_id ? " neste Culto" : ""}</div>
        </div>
      </div>

      ${temInterFilial ? `
        <div class="nota-metodologia">
          ℹ️ <strong>Nota sobre cultos Inter-Filiais:</strong> quando um culto é marcado como
          <strong>Inter-Filial</strong>, o número de "Ausentes" é calculado sobre o total de
          membros ativos de <strong>todas as filiais da igreja</strong>, e não apenas da filial
          onde o culto ocorreu. Isto está assinalado com <span class="badge badge-blue">Inter-Filial</span>
          na tabela abaixo.
        </div>
      ` : ""}

      <!-- Tabela de cultos -->
      <div class="section-title">Detalhes por Culto</div>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Filial</th>
            <th>Âmbito</th>
            <th>Membros</th>
            <th>Ausentes</th>
            <th>Visitantes</th>
            <th>Total</th>
            <th>Convertidos</th>
            <th>Taxa</th>
          </tr>
        </thead>
        <tbody>
          ${cultos.map((c) => {
            const vis  = visitantes.filter((v) => v.culto_id === c.id).length;
            const conv = convertidos.filter((v) => v.culto_id === c.id).length;
            const totalCulto = parseInt(c.presentes || 0) + vis;
            return `
              <tr>
                <td>${c.data_formatada}</td>
                <td>${c.tipo}</td>
                <td>${c.nome_branch || "—"}</td>
                <td>
                  ${c.inter_filial
                    ? '<span class="badge badge-blue">Inter-Filial</span>'
                    : '<span class="badge badge-amber">Filial</span>'
                  }
                </td>
                <td><span class="badge badge-green">${c.presentes}</span></td>
                <td>
                  <span class="badge badge-red">${c.ausentes}</span>
                  ${c.inter_filial
                    ? `<div class="nota-culto-inline">*base: ${c.total_membros_culto ?? "—"} membros (todas as filiais)</div>`
                    : ""
                  }
                </td>
                <td>${vis}</td>
                <td><strong>${totalCulto}</strong></td>
                <td>${conv}</td>
                <td><span class="badge badge-amber">${c.taxa ?? 0}%</span></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>

      <!-- Lista de presentes por culto -->
      ${cultos.map((c) => {
        const presentesDoCulto = presentes.filter(
          (p) => String(p.culto_id) === String(c.id)
        );
        if (!presentesDoCulto.length) return "";
        return `
          <div class="section-title">Presentes — ${c.tipo} (${c.data_formatada}) — ${presentesDoCulto.length}</div>
          <table>
            <thead>
              <tr><th>#</th><th>Nome</th><th>Contacto</th><th>Filial</th></tr>
            </thead>
            <tbody>
              ${presentesDoCulto.map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${p.nome_membro || "—"}</td>
                  <td>${p.contacto || "—"}</td>
                  <td>${p.nome_branch || "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }).join("")}

      <!-- Lista de visitantes por culto -->
      ${cultos.map((c) => {
        const visDoculto = visitantes.filter((v) => v.culto_id === c.id);
        if (!visDoculto.length) return "";
        return `
          <div class="section-title">Visitantes — ${c.tipo} (${c.data_formatada}) — ${visDoculto.length}</div>
          <table>
            <thead>
              <tr><th>#</th><th>Nome</th><th>Contacto</th><th>Bairro</th><th>Igreja Origem</th></tr>
            </thead>
            <tbody>
              ${visDoculto.map((v, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${v.nome}</td>
                  <td>${v.contacto || "—"}</td>
                  <td>${v.bairro || "—"}</td>
                  <td>${v.igreja_origem || "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }).join("")}

      <!-- Lista de convertidos por culto -->
      ${cultos.map((c) => {
        const convDoCulto = convertidos.filter((v) => v.culto_id === c.id);
        if (!convDoCulto.length) return "";
        return `
          <div class="section-title">Novos Convertidos — ${c.tipo} (${c.data_formatada}) — ${convDoCulto.length}</div>
          <table>
            <thead>
              <tr><th>#</th><th>Nome</th><th>Contacto</th><th>Bairro</th></tr>
            </thead>
            <tbody>
              ${convDoCulto.map((cv, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${cv.nome}</td>
                  <td>${cv.contacto || "—"}</td>
                  <td>${cv.bairro || "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }).join("")}

      <div class="footer">
        Sistema de Gestão IICGP · Relatório gerado automaticamente<br>
        Metodologia: Ausentes = Total de membros ativos elegíveis − Presentes.
        Em cultos marcados como <strong>Inter-Filial</strong>, "membros ativos elegíveis"
        inclui todas as filiais da igreja; caso contrário, apenas a filial onde o culto ocorreu.
      </div>
    </body>
    </html>
  `;
};
