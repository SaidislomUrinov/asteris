const path = require("path");

// __dirname'ga bog'liq aniq yo'l — PM2 qaysi joydan ishga tushirilishidan
// (masalan boshqa cwd'dan `pm2 start /path/to/ecosystem.config.js`)
// qat'iy nazar shu papkadagi .env'ni topadi.
require("dotenv").config({ path: path.join(__dirname, ".env") });

module.exports = {
  apps: [
    {
      name: "asteris-server",
      script: "app.js",
      cwd: __dirname,
      // MUHIM: fork + instances:1. app.js O'ZI production'da Node
      // `cluster` moduli bilan CPU yadrolari soniga qarab worker'larga
      // bo'linadi (CLUSTER_WORKERS yoki availableParallelism(), pastga
      // qarang) — schedulerlar/bot Redis qulfi bilan faqat bitta worker'da
      // ishlaydi, Socket.IO esa redis-adapter orqali workerlar aro
      // sinxronlanadi. PM2'ni HAM "cluster"/instances>1 qilib qo'yish bu
      // ichki clusteringni PM2 protsesslari soniga ko'paytirib yuboradi
      // (masalan 2 PM2 instance x 8 core = 16 protsess) — shuning uchun
      // PM2 shu yerda faqat BITTA fork sifatida ishlaydi, ko'p yadroli
      // scale qilish app.js zimmasida qoladi.
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "1G",
      // Productionda fayl tizimini kuzatib qayta ishga tushirish xavfli —
      // uploads/backups/log fayllar doimiy yozilib turadi, restart
      // storm'ga olib kelishi mumkin. Deploy paytida yangi kod uchun
      // `pm2 reload` qo'lda chaqiriladi.
      watch: false,
      out_file: path.join(__dirname, "logs", "out.log"),
      error_file: path.join(__dirname, "logs", "error.log"),
      merge_logs: true,
      time: true,
      env: {
        ...process.env,
        NODE_ENV: "production",
      },
    },
  ],
};
