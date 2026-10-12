const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const redis = require("../configs/redis.config");
const metrics = require("../middlewares/metrics.middleware");
const { getNow, addDays } = require("../utils/date.util");

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

let pkgVersion = "1.0.0";
try {
  pkgVersion = require(path.join(process.cwd(), "package.json")).version || pkgVersion;
} catch {
  // package.json topilmasa default qiymat qoladi
}

const mb = (bytes) => Number((bytes / 1024 / 1024).toFixed(2));

// CPU foizi ikki o'lchov orasidagi FARQdan hisoblanadi — process.cpuUsage()
// protsess boshlanganidan beri to'plangan qiymat, uni to'g'ridan-to'g'ri
// foizga aylantirib bo'lmaydi.
let lastCpu = process.cpuUsage();
let lastCpuAt = Date.now();

const cpuPercent = () => {
  try {
    const now = Date.now();
    const diff = process.cpuUsage(lastCpu);
    const elapsedMs = Math.max(1, now - lastCpuAt);

    lastCpu = process.cpuUsage();
    lastCpuAt = now;

    const usedMs = (diff.user + diff.system) / 1000;
    return Number(((usedMs / elapsedMs) * 100).toFixed(1));
  } catch {
    return 0;
  }
};

// ---- Mongo ----
const mongoStatus = async () => {
  const result = {
    status: "down",
    latencyMs: 0,
    dbName: "",
    collections: 0,
    dataSizeMb: 0,
    indexSizeMb: 0,
    connections: 0,
  };

  try {
    const conn = mongoose.connection;
    if (conn.readyState !== 1 || !conn.db) return result;

    const startedAt = Date.now();
    await conn.db.admin().command({ ping: 1 });
    result.latencyMs = Date.now() - startedAt;
    result.status = result.latencyMs > 500 ? "degraded" : "healthy";
    result.dbName = conn.name || "";

    try {
      const stats = await conn.db.stats();
      result.collections = stats.collections || 0;
      result.dataSizeMb = mb(stats.dataSize || 0);
      result.indexSizeMb = mb(stats.indexSize || 0);
    } catch {
      // stats huquqi bo'lmasa ham ping natijasi yetarli
    }

    try {
      const serverStatus = await conn.db.admin().serverStatus();
      result.connections = serverStatus?.connections?.current || 0;
    } catch {
      // Atlas'ning ba'zi tariflarida serverStatus taqiqlangan
    }
  } catch {
    result.status = "down";
  }

  return result;
};

// ---- Redis ----
const parseInfo = (info) => {
  const map = {};
  for (const line of String(info || "").split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1 || line.startsWith("#")) continue;
    map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return map;
};

const redisStatus = async () => {
  const result = {
    status: "down",
    latencyMs: 0,
    usedMemoryMb: 0,
    keys: 0,
    hitRate: 0,
    evictedKeys: 0,
  };

  try {
    const startedAt = Date.now();
    await redis.ping();
    result.latencyMs = Date.now() - startedAt;
    result.status = result.latencyMs > 300 ? "degraded" : "healthy";

    const [memory, stats, keys] = await Promise.all([
      redis.info("memory").catch(() => ""),
      redis.info("stats").catch(() => ""),
      redis.dbsize().catch(() => 0),
    ]);

    const mem = parseInfo(memory);
    const st = parseInfo(stats);

    result.usedMemoryMb = mb(Number(mem.used_memory || 0));
    result.keys = Number(keys) || 0;
    result.evictedKeys = Number(st.evicted_keys || 0);

    const hits = Number(st.keyspace_hits || 0);
    const misses = Number(st.keyspace_misses || 0);
    result.hitRate = hits + misses ? Number(((hits / (hits + misses)) * 100).toFixed(2)) : 0;
  } catch {
    result.status = "down";
  }

  return result;
};

// ---- Socket ----
const socketStatus = () => {
  const result = { status: "down", connectedSockets: 0, rooms: 0, adapter: "redis" };

  try {
    const io = require("../configs/socket.config").getIo();
    result.connectedSockets = io.sockets?.size || 0;
    result.rooms = io.adapter?.rooms?.size || 0;
    result.status = "healthy";
  } catch {
    // initIo hali chaqirilmagan (masalan skript orqali ishga tushirilgan)
  }

  return result;
};

// ---- Storage ----
// Asinxron yurish — avval readdirSync/statSync edi va har daqiqada
// (healthCheck) + admin sahifasida har 10s event loop'ni to'xtatardi;
// minglab o'quvchi rasmida bu worker API'ga javob bermay qolardi.
const dirUsage = async (dir) => {
  let usedBytes = 0;
  let filesCount = 0;

  const walk = async (current) => {
    for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        try {
          usedBytes += (await fs.promises.stat(full)).size;
          filesCount++;
        } catch {
          // yurish paytida o'chirilgan fayl
        }
      }
    }
  };

  await walk(dir);
  return { usedBytes, filesCount };
};

// Hajm sekin o'zgaradi — natija 10 daqiqa keshlanadi, parallel so'rovlar
// bitta yurishni kutadi.
const DIR_USAGE_TTL_MS = 10 * 60 * 1000;
let dirUsageCache = null;
let dirUsagePending = null;
const cachedDirUsage = async (dir) => {
  if (dirUsageCache && Date.now() - dirUsageCache.at < DIR_USAGE_TTL_MS) return dirUsageCache.value;
  if (!dirUsagePending) {
    dirUsagePending = dirUsage(dir)
      .then((value) => {
        dirUsageCache = { value, at: Date.now() };
        return value;
      })
      .finally(() => {
        dirUsagePending = null;
      });
  }
  return dirUsagePending;
};

const storageStatus = async () => {
  const result = {
    status: "down",
    path: UPLOAD_DIR,
    usedMb: 0,
    freeMb: 0,
    totalMb: 0,
    filesCount: 0,
  };

  try {
    if (!fs.existsSync(UPLOAD_DIR)) return result;

    const { usedBytes, filesCount } = await cachedDirUsage(UPLOAD_DIR);
    result.usedMb = mb(usedBytes);
    result.filesCount = filesCount;
    result.status = "healthy";

    try {
      // Node 18.15+ — eski versiyada mavjud bo'lmasligi mumkin.
      const stat = await fs.promises.statfs?.(UPLOAD_DIR);
      if (stat) {
        result.freeMb = mb(stat.bsize * stat.bavail);
        result.totalMb = mb(stat.bsize * stat.blocks);
        // Disk 95% to'lgan bo'lsa ogohlantirish darajasi.
        if (result.totalMb && result.freeMb / result.totalMb < 0.05) result.status = "degraded";
      }
    } catch {
      // statfs yo'q — faqat used/filesCount qaytadi
    }
  } catch {
    result.status = "down";
  }

  return result;
};

// ---- Tenants ----
const tenantStats = async () => {
  const result = { clients: 0, activeSubscriptions: 0, expiringSoon: 0, blockedCenters: 0 };

  try {
    const Client = require("../models/Client");
    const Subscription = require("../models/Subscription");
    const Center = require("../models/Center");

    const now = getNow();
    const soon = addDays(now, 2);

    const [clients, active, expiring, blocked] = await Promise.all([
      Client.countDocuments({ isDeleted: false }),
      Subscription.countDocuments({ status: "active", endDate: { $gt: now } }),
      Subscription.countDocuments({ status: "active", endDate: { $gt: now, $lte: soon } }),
      Center.countDocuments({ status: "blocked", isDeleted: false }),
    ]);

    result.clients = clients;
    result.activeSubscriptions = active;
    result.expiringSoon = expiring;
    result.blockedCenters = blocked;
  } catch {
    // hisoblash uddalanmasa nol qaytadi — monitoring qulamaydi
  }

  return result;
};

// Umumiy holat: Mongo yoki Redis tushgan bo'lsa "down", biror komponent
// sekinlashgan bo'lsa "degraded".
const overallStatus = (parts) => {
  if (parts.mongo.status === "down" || parts.redis.status === "down") return "down";
  if (Object.values(parts).some((p) => p.status === "degraded")) return "degraded";
  return "healthy";
};

/**
 * `/api/health` uchun yengil tekshiruv — faqat Mongo va Redis ping.
 * Og'ir aggregate/disk hisob-kitobi qilinmaydi (endpoint har daqiqada
 * tashqi monitoring xizmati tomonidan chaqiriladi).
 */
const getHealth = async () => {
  const [mongo, redisPart] = await Promise.all([mongoStatus(), redisStatus()]);
  const healthy = mongo.status !== "down" && redisPart.status !== "down";

  return {
    healthy,
    status: healthy ? "healthy" : "degraded",
    uptime: Math.floor(process.uptime()),
    version: pkgVersion,
    pid: process.pid,
    mongo: mongo.status,
    redis: redisPart.status,
  };
};

const getSnapshot = async () => {
  const [mongo, redisPart, storage, tenants, buckets] = await Promise.all([
    mongoStatus(),
    redisStatus(),
    storageStatus(),
    tenantStats(),
    metrics.readBuckets(metrics.recentMinuteKeys(5)),
  ]);

  const socket = socketStatus();
  const memory = process.memoryUsage();

  return {
    status: overallStatus({ mongo, redis: redisPart, socket, storage }),
    uptime: Math.floor(process.uptime()),
    version: pkgVersion,
    nodeVersion: process.version,
    pid: process.pid,
    workers: os.cpus().length,
    mongo,
    redis: redisPart,
    socket,
    storage,
    api: metrics.aggregate(buckets, 5),
    process: {
      cpuPercent: cpuPercent(),
      memoryMb: mb(memory.rss),
      heapUsedMb: mb(memory.heapUsed),
      heapTotalMb: mb(memory.heapTotal),
      loadAvg: os.loadavg().map((v) => Number(v.toFixed(2))),
    },
    tenants,
    checkedAt: getNow(),
  };
};

/**
 * Tarix — daqiqalik bucketlar soatlik guruhlanadi.
 * `[{ t, mongo, redis, errorRate, rps }]` — eskisidan yangisiga.
 */
const getHistory = async ({ hours = 24 } = {}) => {
  const limitHours = Math.min(24, Math.max(1, Number(hours) || 24));
  const buckets = await metrics.readBuckets(metrics.recentMinuteKeys(limitHours * 60));

  const groups = new Map();
  for (const b of buckets) {
    // minuteKey = YYYYMMDDHHmm → soat kaliti YYYYMMDDHH
    const hourKey = b.minuteKey.slice(0, 10);
    if (!groups.has(hourKey)) groups.set(hourKey, []);
    groups.get(hourKey).push(b);
  }

  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([hourKey, list]) => {
      const count = list.reduce((s, b) => s + b.count, 0);
      const errors = list.reduce((s, b) => s + b["4xx"] + b["5xx"], 0);
      const pings = list.reduce((s, b) => s + b.pings, 0);

      return {
        t: `${hourKey.slice(0, 4)}-${hourKey.slice(4, 6)}-${hourKey.slice(6, 8)} ${hourKey.slice(8, 10)}:00`,
        mongo: pings ? Math.round(list.reduce((s, b) => s + b.mongoMs, 0) / pings) : 0,
        redis: pings ? Math.round(list.reduce((s, b) => s + b.redisMs, 0) / pings) : 0,
        errorRate: count ? Number(((errors / count) * 100).toFixed(2)) : 0,
        rps: Number((count / 3600).toFixed(2)),
        avgLatencyMs: count ? Math.round(list.reduce((s, b) => s + b.duration, 0) / count) : 0,
        requests: count,
      };
    });
};

module.exports = { getHealth, getSnapshot, getHistory };
