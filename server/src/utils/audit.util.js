const AuditLog = require("../models/AuditLog");
const emit = require("./emitter.util");
const { formatDate } = require("./date.util");

// Audit yozuvi — `emitter.util.js` bilan bir xil falsafada: FIRE-AND-FORGET
// va xatoni O'ZI yutadi. Jurnal yozilmagani asosiy amalni (to'lov, o'quvchi
// yaratish...) buzmasligi kerak — audit yordamchi qatlam, moliyaviy haqiqat
// manbai emas.
//
// Chaqiruv joyi — SERVIS ichi (middleware emas): "nima o'zgardi" (diff)
// faqat servisda ma'lum. `actor` esa controller'da `buildActor(req)` bilan
// yasaladi va argument bo'lib keladi — servis `req` ni KO'RMAYDI (CLAUDE.md).

// Jurnalga tushadigan yozuvning frontend uchun tayyor ko'rinishi. Bu yerda
// (audit.service.js'da emas) turibdi, chunki socket emiti ham shu shaklni
// yuboradi va ikki joyda ikki xil bo'lib qolmasligi kerak.
const DTO = (data) => ({
  _id: data?._id,
  action: data?.action,
  createdAt: data?.createdAt,
  date: data?.createdAt ? formatDate(data.createdAt) : "",
  actor: {
    id: data?.actor?.id,
    kind: data?.actor?.kind,
    name: data?.actor?.name || "",
    role: data?.actor?.role || "",
  },
  entity: {
    type: data?.entity?.type,
    id: data?.entity?.id || null,
    label: data?.entity?.label || "",
  },
  changes: (data?.changes || []).map((c) => ({ field: c.field, from: c.from, to: c.to })),
  meta: data?.meta || {},
  center: data?.center || null,
  client: data?.client || null,
});

/**
 * Bitta audit yozuvini saqlaydi va realtime tarqatadi.
 * Hech qachon `throw` qilmaydi.
 */
const log = async ({ actor, client = null, center = null, action, entity, changes = [], meta = {} }) => {
  try {
    if (!actor?.id || !action || !entity?.type) return;

    const doc = await AuditLog.create({
      client: client || null,
      center: center || null,
      actor: {
        id: actor.id,
        kind: actor.kind,
        name: actor.name || "",
        role: actor.role || "",
      },
      action,
      entity: {
        type: entity.type,
        id: entity.id || null,
        label: entity.label || "",
      },
      changes: Array.isArray(changes) ? changes : [],
      meta: meta || {},
    });

    const dto = DTO(doc);
    // Tenant amali bo'lsa — o'sha tenantning xonasiga; platforma amali
    // bo'lsa faqat adminlar xonasiga.
    if (client) emit(`client:${client}`, "audit:created", dto);
    emit("admins", "audit:created", dto);
  } catch {
    // jimgina o'tkazamiz — yuqoridagi izohga qara
  }
};

// Ikki holat orasidagi FARQNI qaytaradi. `fields` berilmasa `after` dagi
// barcha kalitlar solishtiriladi. Taqqoslash `JSON.stringify` orqali —
// ObjectId/array/obyekt maydonlar ham to'g'ri ishlashi uchun.
const diff = (before = {}, after = {}, fields = null) => {
  const keys = fields && fields.length ? fields : Object.keys(after || {});
  const result = [];

  for (const field of keys) {
    const from = before?.[field];
    const to = after?.[field];
    if (to === undefined) continue;

    const norm = (v) => (v === undefined || v === null ? null : JSON.parse(JSON.stringify(v)));
    const a = norm(from);
    const b = norm(to);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;

    result.push({ field, from: a, to: b });
  }

  return result;
};

/**
 * `req` dan amal bajaruvchini yasaydi. FAQAT controller'da chaqiriladi —
 * natija servisga oddiy obyekt sifatida uzatiladi.
 */
const buildActor = (req) => {
  if (req?.admin?._id) {
    return {
      id: req.admin._id,
      kind: "admin",
      name: req.admin.name || "",
      role: req.admin.role || "",
    };
  }

  if (req?.staff?._id) {
    return {
      id: req.staff._id,
      kind: "staff",
      name: req.staff.name || "",
      role: req.staff.role || "",
      center: req.staff.center || null,
    };
  }

  return {
    id: req?.client?._id,
    kind: "client",
    name: req?.client?.name || "",
    role: "owner",
  };
};

// So'rov konteksti (IP, brauzer) — asosan `auth:signin/signout/failed`
// uchun. Proxy ortida `x-forwarded-for` birinchi IP haqiqiy mijoz.
const buildMeta = (req) => ({
  ip: (req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || req?.ip || "",
  userAgent: req?.headers?.["user-agent"] || "",
});

module.exports = { DTO, log, diff, buildActor, buildMeta };
