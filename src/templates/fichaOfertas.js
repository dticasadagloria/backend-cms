export const gerarFichaOfertasHTML = ({ titulo, username, culto, ofertas }) => {
  const TIPOS  = ['Dizimo', 'Shiloh', 'Parceria', 'Oferta'];
  const CANAIS = ['Numerario', 'Mpesa', 'Emola', 'BIM', 'Conta Movel'];
  const LABEL  = { Dizimo: 'Dízimos', Shiloh: 'Shiloh', Parceria: 'Parceria', Oferta: 'Oferta Normal' };

  const fmt = (n) =>
    Number(n || 0).toLocaleString('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MT';

  const resumo = {};
  for (const tipo of TIPOS) {
    resumo[tipo] = {};
    for (const canal of CANAIS) resumo[tipo][canal] = 0;
  }
  let totalGeral = 0;
  for (const o of ofertas) {
    if (resumo[o.tipo]?.[o.canal] !== undefined) {
      resumo[o.tipo][o.canal] += parseFloat(o.valor || 0);
      totalGeral               += parseFloat(o.valor || 0);
    }
  }

  const canaisAtivos  = CANAIS.filter((c) => TIPOS.some((t) => resumo[t][c] > 0));
  const totalPorTipo  = {};
  for (const tipo of TIPOS) {
    totalPorTipo[tipo] = CANAIS.reduce((s, c) => s + resumo[tipo][c], 0);
  }
  const porTipo = {};
  for (const tipo of TIPOS) {
    porTipo[tipo] = ofertas.filter((o) => o.tipo === tipo);
  }

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 30px; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #b6852e; padding-bottom: 15px; }
    .header h1 { font-size: 18px; color: #1e293b; margin-top: 8px; }
    .header p  { color: #64748b; font-size: 11px; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 11px; color: #64748b; }
    .culto-info { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; padding: 10px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 11px; }
    .culto-info span strong { color: #92400e; }
    .summary { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
    .summary-card { flex: 1; min-width: 90px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
    .summary-card .value { font-size: 15px; font-weight: bold; color: #b6852e; margin-bottom: 3px; }
    .summary-card .label { font-size: 10px; color: #64748b; }
    .summary-card.total { background: #fef3c7; border-color: #b6852e; }
    .summary-card.total .value { color: #92400e; font-size: 17px; }
    .section-title { font-size: 13px; font-weight: bold; color: #1e293b; margin: 20px 0 10px; border-left: 3px solid #b6852e; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #fef3c7; color: #92400e; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; text-align: left; }
    th.r { text-align: right; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; vertical-align: middle; }
    td.r { text-align: right; }
    td.bold { font-weight: bold; }
    tfoot td { background: #fef3c7; font-weight: bold; color: #92400e; }
    .badge { display: inline-block; background: #eff6ff; color: #1e40af; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-family: monospace; }
    .empty { color: #94a3b8; font-style: italic; margin-bottom: 16px; font-size: 11px; }
    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
    @media print { body { padding: 15px; } }
  </style>
</head>
<body>

  <div class="header">
    <img src="https://casadagloria-cms.vercel.app/Logo1.png"
         style="width:100px;height:auto;display:block;margin:0 auto 8px;" alt="Logo IICGP" />
    <h1>Igreja Internacional Casa da Glória da Palavra</h1>
    <p>${titulo}</p>
  </div>

  <div class="meta">
    <span>Gerado por: <strong>${username}</strong></span>
    <span>Data de emissão: <strong>${new Date().toLocaleDateString('pt-MZ')}</strong></span>
  </div>

  <div class="culto-info">
    <span>Data: <strong>${culto.data_formatada}</strong></span>
    <span>Tipo: <strong>${culto.tipo}</strong></span>
    <span>Filial: <strong>${culto.filial || '—'}</strong></span>
    ${culto.horario ? `<span>Horário: <strong>${culto.horario}</strong></span>` : ''}
  </div>

  <!-- Resumo por tipo -->
  <div class="summary">
    ${TIPOS.map((tipo) => `
      <div class="summary-card">
        <div class="value">${fmt(totalPorTipo[tipo])}</div>
        <div class="label">${LABEL[tipo]}</div>
      </div>
    `).join('')}
    <div class="summary-card total">
      <div class="value">${fmt(totalGeral)}</div>
      <div class="label">Total Geral</div>
    </div>
  </div>

  <!-- Resumo por canal -->
  ${canaisAtivos.length > 0 ? `
  <div class="section-title">Resumo por Canal de Pagamento</div>
  <table>
    <thead>
      <tr>
        <th>Canal</th>
        ${TIPOS.map((t) => `<th class="r">${LABEL[t]}</th>`).join('')}
        <th class="r">Total</th>
      </tr>
    </thead>
    <tbody>
      ${canaisAtivos.map((canal) => {
        const rowTotal = TIPOS.reduce((s, t) => s + resumo[t][canal], 0);
        return `<tr>
          <td>${canal}</td>
          ${TIPOS.map((t) => `<td class="r">${resumo[t][canal] > 0 ? fmt(resumo[t][canal]) : '<span style="color:#cbd5e1">—</span>'}</td>`).join('')}
          <td class="r bold">${fmt(rowTotal)}</td>
        </tr>`;
      }).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        ${TIPOS.map((t) => `<td class="r">${fmt(totalPorTipo[t])}</td>`).join('')}
        <td class="r">${fmt(totalGeral)}</td>
      </tr>
    </tfoot>
  </table>
  ` : '<p class="empty">Sem ofertas registadas para este culto.</p>'}

  <!-- Detalhe Dízimos / Shiloh / Parceria -->
  ${['Dizimo', 'Shiloh', 'Parceria'].map((tipo) => {
    const linhas = porTipo[tipo];
    if (!linhas.length) return '';
    return `
      <div class="section-title">${LABEL[tipo]} — ${linhas.length} registo(s)</div>
      <table>
        <thead>
          <tr>
            <th style="width:30px">#</th>
            <th style="width:90px">Código</th>
            <th>Nome do Membro</th>
            <th>Canal</th>
            <th class="r">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${linhas.map((o, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><span class="badge">${o.codigo_membro || '—'}</span></td>
              <td>${o.membro_nome || '—'}</td>
              <td>${o.canal}</td>
              <td class="r bold">${fmt(o.valor)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }).join('')}

  <!-- Detalhe Oferta Normal -->
  ${porTipo['Oferta'].length > 0 ? `
  <div class="section-title">Oferta Normal — ${porTipo['Oferta'].length} registo(s)</div>
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Canal</th>
        <th class="r">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${porTipo['Oferta'].map((o, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${o.canal}</td>
          <td class="r bold">${fmt(o.valor)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="footer">
    Sistema de Gestão IICGP · Ficha de Ofertas gerada automaticamente · Ano de Impacto
  </div>

</body>
</html>`;
};
