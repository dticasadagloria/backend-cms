import cron from "node-cron";
import { verificarPresencasMembros } from "./verificarPresencas.js";

export const iniciarScheduler = () => {
  // Corre toda segunda-feira às 06:00
  cron.schedule("0 6 * * 1", async () => {
    console.log("⏰ Job semanal iniciado — segunda-feira 06:00");
    await verificarPresencasMembros();
  }, {
    timezone: "Africa/Maputo"
  });

  console.log("✅ Scheduler iniciado — verifica presenças toda segunda-feira às 06:00");
};