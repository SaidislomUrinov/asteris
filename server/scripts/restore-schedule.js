/**
 * restore-schedule.js — guruh JADVALINI backupdan tiklaydi.
 *
 * Sabab: `/schedule` avto-saqlashi `mode: "full"` bilan ishlab, jadvalda
 * qolmagan guruhlarning `room/days/startTime/endTime` maydonlarini tozalab
 * yuborgan (API_CONTRACT_group_schedule_per_group.md).
 *
 * Bu skript BUTUN BAZANI QAYTARMAYDI. U backupni vaqtinchalik alohida bazaga
 * tiklaydi, undan faqat 4 ta maydonni o'qiydi va joriy bazaga ko'chiradi.
 * To'lov, davomat, o'quvchi, oylik — hech biriga TEGILMAYDI.
 *
 * Ishlatish (server/ papkasidan):
 *
 *   # 1. Avval nima o'zgarishini KO'RISH (hech narsa yozilmaydi):
 *   node --env-file=.env scripts/restore-schedule.js backups/asteris-2026-09-09T03-00-00.gz
 *
 *   # 2. Rozi bo'lsangiz — yozish:
 *   node --env-file=.env scripts/restore-schedule.js backups/asteris-...gz --apply
 *
 * Talab: `mongorestore` o'rnatilgan bo'lishi kerak (backup `mongodump --gzip
 * --archive` bilan olingan — systemSetting.service.js#runBackup).
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// Faqat shu maydonlar tiklanadi — boshqasiga tegilmaydi.
const FIELDS = ["room", "days", "startTime", "endTime"];

const TEMP_DB = "asteris_restore_tmp";

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (c) => (stderr += String(c)));
    child.on("error", () => reject(new Error(`${cmd} topilmadi — o'rnatilganmi?`)));
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(stderr.trim().split("\n").pop() || `${cmd} xato`)),
    );
  });

// `mongodb://host:port/dbName?opts` → dbName'ni almashtirib beradi.
const withDbName = (uri, dbName) => {
  const [base, query] = uri.split("?");
  const trimmed = base.replace(/\/[^/]*$/, "");
  return `${trimmed}/${dbName}${query ? `?${query}` : ""}`;
};

const sameSchedule = (a, b) =>
  String(a.room || "") === String(b.room || "") &&
  (a.startTime || "") === (b.startTime || "") &&
  (a.endTime || "") === (b.endTime || "") &&
  JSON.stringify(a.days || []) === JSON.stringify(b.days || []);

const main = async () => {
  const archive = process.argv[2];
  const apply = process.argv.includes("--apply");

  if (!archive) {
    console.error("Backup fayl yo'li kerak.\n  node --env-file=.env scripts/restore-schedule.js backups/asteris-....gz [--apply]");
    process.exit(1);
  }
  const archivePath = path.resolve(archive);
  if (!fs.existsSync(archivePath)) {
    console.error(`Fayl topilmadi: ${archivePath}`);
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI yo'q — `--env-file=.env` bilan ishga tushiring.");
    process.exit(1);
  }

  const liveUri = process.env.MONGO_URI;
  const tempUri = withDbName(liveUri, TEMP_DB);

  console.log(`Backup      : ${archivePath}`);
  console.log(`Vaqtinchalik: ${TEMP_DB}`);
  console.log(`Rejim       : ${apply ? "YOZISH (--apply)" : "faqat ko'rish (dry-run)"}\n`);

  // ─── 1. Backupni vaqtinchalik bazaga tiklash ──────────────────────────
  // `--nsFrom/--nsTo` bilan FAQAT groups kolleksiyasi tiklanadi — boshqa
  // kolleksiyalar umuman diskka tushmaydi.
  console.log("mongorestore ishlamoqda (faqat `groups`)...");
  const backupDbName = process.env.BACKUP_DB_NAME || liveUri.split("?")[0].split("/").pop();
  await run("mongorestore", [
    `--uri=${tempUri}`,
    "--gzip",
    `--archive=${archivePath}`,
    `--nsFrom=${backupDbName}.groups`,
    `--nsTo=${TEMP_DB}.groups`,
    "--drop",
  ]);

  // ─── 2. Taqqoslash ────────────────────────────────────────────────────
  const live = await mongoose.createConnection(liveUri).asPromise();
  const temp = await mongoose.createConnection(tempUri).asPromise();

  const oldGroups = await temp.collection("groups").find({}).toArray();
  const oldById = new Map(oldGroups.map((g) => [String(g._id), g]));
  const nowGroups = await live.collection("groups").find({}).toArray();

  const changes = [];
  let missing = 0;

  for (const cur of nowGroups) {
    const old = oldById.get(String(cur._id));
    if (!old) {
      missing += 1; // backupdan keyin yaratilgan guruh — tegilmaydi
      continue;
    }
    if (sameSchedule(old, cur)) continue;

    // Faqat YO'QOLGAN jadvalni tiklaymiz: hozir bo'sh, backupda bor edi.
    // Backupdan keyin QO'LDA kiritilgan yangi jadval ustidan yozilmasin.
    const curEmpty = !cur.startTime && !cur.endTime && (!cur.days || !cur.days.length);
    const oldHas = !!old.startTime || !!old.endTime || (old.days && old.days.length);
    if (!curEmpty || !oldHas) continue;

    const set = {};
    for (const f of FIELDS) set[f] = old[f] ?? (f === "days" ? [] : f === "room" ? null : "");
    changes.push({ _id: cur._id, set, old, cur });
  }

  console.log(`\nJoriy bazada guruh   : ${nowGroups.length}`);
  console.log(`Backupda yo'q (yangi): ${missing}`);
  console.log(`TIKLANADI            : ${changes.length}\n`);

  for (const c of changes.slice(0, 40)) {
    const d = (g) => `${(g.days || []).join(",") || "—"} ${g.startTime || "—"}-${g.endTime || "—"}`;
    console.log(`  ${c._id}  [${d(c.cur)}]  →  [${d(c.old)}]`);
  }
  if (changes.length > 40) console.log(`  ... yana ${changes.length - 40} ta`);

  // ─── 3. Yozish ────────────────────────────────────────────────────────
  if (!apply) {
    console.log("\nHech narsa yozilmadi. Yozish uchun oxiriga `--apply` qo'shing.");
  } else if (changes.length) {
    const ops = changes.map((c) => ({
      updateOne: { filter: { _id: c._id }, update: { $set: c.set } },
    }));
    const res = await live.collection("groups").bulkWrite(ops);
    console.log(`\nYozildi: ${res.modifiedCount} ta guruh.`);
  } else {
    console.log("\nTiklanadigan guruh yo'q.");
  }

  // ─── 4. Vaqtinchalik bazani o'chirish ─────────────────────────────────
  await temp.dropDatabase();
  console.log(`Vaqtinchalik baza (${TEMP_DB}) o'chirildi.`);

  await live.close();
  await temp.close();
};

main().catch((error) => {
  console.error("\nXATO:", error.message);
  process.exit(1);
});
