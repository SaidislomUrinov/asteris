const monitoringService = require("../services/monitoring.service");

module.exports = {
  // DIQQAT: bu loyihadagi YAGONA endpoint bo'lib HTTP status kodini
  // haqiqatan o'zgartiradi (200/503) — uptime monitoring xizmatlari
  // (UptimeRobot, k8s liveness) javob tanasini emas, statusni o'qiydi.
  // Qolgan API konvensiyasi (doim 200 + `{ ok }`) o'zgarmaydi.
  //
  // Auth yo'q, shuning uchun hech qanday maxfiy ma'lumot qaytmaydi.
  check: async (req, res) => {
    try {
      const data = await monitoringService.getHealth();

      return res.status(data.healthy ? 200 : 503).send({
        ok: data.healthy,
        status: data.status,
        uptime: data.uptime,
        version: data.version,
        pid: data.pid,
      });
    } catch {
      return res.status(503).send({
        ok: false,
        status: "degraded",
        uptime: Math.floor(process.uptime()),
        version: "",
        pid: process.pid,
      });
    }
  },
};
