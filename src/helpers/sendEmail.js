import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const enviarEmailRequisicao = async ({ requisicao, nomeFilial, nomeDepartamento }) => {
  const { codigo, descricao, valor, nome_solicitante, contacto_solicitante } = requisicao;

  const formatMt = (v) =>
    new Intl.NumberFormat("pt-MZ", { style: "currency", currency: "MZN" }).format(v || 0);

  // ── Email para o solicitante ──────────────────────────────────────────────
  if (contacto_solicitante && contacto_solicitante.includes("@")) {
    await resend.emails.send({
      from:    "IICGP <notificacoes@teudominio.com>",
      to:      contacto_solicitante,
      subject: `✅ Requisição ${codigo} submetida com sucesso`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e2e8f0">
          <h2 style="color:#f59e0b;margin-bottom:4px">Requisição Recebida</h2>
          <p style="color:#64748b;font-size:14px;margin-top:0">A tua requisição foi submetida com sucesso.</p>

          <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:24px 0">
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              <tr><td style="color:#94a3b8;padding:6px 0">Código</td>      <td style="font-weight:700;color:#f59e0b">${codigo}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Descrição</td>   <td style="color:#334155">${descricao}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Valor</td>       <td style="font-weight:700;color:#334155">${formatMt(valor)}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Filial</td>      <td style="color:#334155">${nomeFilial || "—"}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Departamento</td><td style="color:#334155">${nomeDepartamento || "—"}</td></tr>
              <tr><td style="color:#94a3b8;padding:6px 0">Estado</td>      <td><span style="background:#fef3c7;color:#d97706;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600">Em Espera</span></td></tr>
            </table>
          </div>

          <p style="color:#64748b;font-size:13px">Serás notificado quando o estado da requisição for actualizado.</p>
          <p style="color:#cbd5e1;font-size:12px;margin-top:32px">IICGP · Sistema de Gestão</p>
        </div>
      `,
    });
  }

  // ── Email para o Admin ────────────────────────────────────────────────────
  await resend.emails.send({
    from:    "IICGP <notificacoes@teudominio.com>",
    to:      process.env.ADMIN_EMAIL,
    subject: `🔔 Nova Requisição: ${codigo} — ${nomeFilial}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e2e8f0">
        <h2 style="color:#334155;margin-bottom:4px">Nova Requisição Submetida</h2>
        <p style="color:#64748b;font-size:14px;margin-top:0">Uma nova requisição aguarda aprovação.</p>

        <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:24px 0">
          <table style="width:100%;font-size:14px;border-collapse:collapse">
            <tr><td style="color:#94a3b8;padding:6px 0">Código</td>      <td style="font-weight:700;color:#f59e0b">${codigo}</td></tr>
            <tr><td style="color:#94a3b8;padding:6px 0">Solicitante</td> <td style="color:#334155">${nome_solicitante || "—"}</td></tr>
            <tr><td style="color:#94a3b8;padding:6px 0">Contacto</td>    <td style="color:#334155">${contacto_solicitante || "—"}</td></tr>
            <tr><td style="color:#94a3b8;padding:6px 0">Descrição</td>   <td style="color:#334155">${descricao}</td></tr>
            <tr><td style="color:#94a3b8;padding:6px 0">Valor</td>       <td style="font-weight:700;color:#334155">${formatMt(valor)}</td></tr>
            <tr><td style="color:#94a3b8;padding:6px 0">Filial</td>      <td style="color:#334155">${nomeFilial || "—"}</td></tr>
            <tr><td style="color:#94a3b8;padding:6px 0">Departamento</td><td style="color:#334155">${nomeDepartamento || "—"}</td></tr>
          </table>
        </div>

        <p style="color:#64748b;font-size:13px">Acede ao sistema para aprovar ou rejeitar esta requisição.</p>
        <p style="color:#cbd5e1;font-size:12px;margin-top:32px">IICGP · Sistema de Gestão</p>
      </div>
    `,
  });
};