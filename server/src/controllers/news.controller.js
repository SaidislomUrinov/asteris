const newsService = require("../services/news.service");
const { sanitizeNewsHtml, stripHtml } = require("../utils/richText.util");
const { buildActor } = require("../utils/audit.util");

// server/ da zod paketi ulanmagan (package.json'da yo'q) — repo konvensiyasiga
// mos (calendar.controller.js), validatsiya shu yerda qo'lda qilinadi.
// Natija — servis to'g'ridan-to'g'ri saqlaydigan normallashtirilgan payload.

const MAX_MEDIA = 10;
const MAX_RESOURCES = 10;
const MAX_DESCRIPTION = 20000;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

// youtube.com/watch?v=, youtu.be/, /shorts/, /embed/, /live/ (+ m./music./
// youtube-nocookie.com). Topilmasa null.
const parseYoutubeId = (raw) => {
  let url;
  try {
    const str = String(raw || "").trim();
    url = new URL(/^https?:\/\//i.test(str) ? str : `https://${str}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");
  let id = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      id = m?.[1] || null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
};

const validateMedia = (media) => {
  if (!Array.isArray(media) || media.length > MAX_MEDIA) throw new Error("news.invalidMedia");
  return media.map((m) => {
    const type = m?.type;
    const url = typeof m?.url === "string" ? m.url.trim() : "";
    if (!newsService.MEDIA_TYPES.includes(type) || !url) throw new Error("news.invalidMedia");

    if (type === "youtube") {
      const youtubeId = parseYoutubeId(url);
      if (!youtubeId) throw new Error("news.invalidYoutube");
      return { type, url, youtubeId };
    }

    // Faqat o'zimiz yuklagan fayl — tashqi URL / path traversal yo'q.
    if (!url.startsWith("/uploads/news/") || url.includes("..") || /\s/.test(url)) {
      throw new Error("news.invalidMedia");
    }
    return { type, url, youtubeId: null };
  });
};

const validateResources = (resources) => {
  if (!Array.isArray(resources) || resources.length > MAX_RESOURCES) {
    throw new Error("news.invalidResource");
  }
  return resources.map((r) => {
    const label = typeof r?.label === "string" ? r.label.trim() : "";
    const url = typeof r?.url === "string" ? r.url.trim() : "";
    const kind = r?.kind;
    if (!label || label.length > 80 || !url || !newsService.RESOURCE_KINDS.includes(kind)) {
      throw new Error("news.invalidResource");
    }
    const ok =
      kind === "internal"
        ? url.startsWith("/") && !url.startsWith("//") && !/\s/.test(url)
        : /^https?:\/\/[^\s/]+\S*$/i.test(url);
    if (!ok) throw new Error("news.invalidResource");
    return { label, url, kind };
  });
};

// `partial` — PATCH: faqat kelgan maydonlar tekshiriladi.
const validatePayload = (body = {}, { partial = false } = {}) => {
  const out = {};

  if (!partial || body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) throw new Error("news.titleRequired");
    if (title.length > 200) throw new Error("news.titleTooLong");
    out.title = title;
  }

  if (!partial || body.description !== undefined) {
    const html = sanitizeNewsHtml(body.description);
    // Faqat bo'sh teglar qolgan bo'lsa (masalan "<p><br></p>") — bo'sh deb olinadi.
    const description = stripHtml(html) ? html : "";
    if (description.length > MAX_DESCRIPTION) throw new Error("news.descriptionTooLong");
    out.description = description;
  }

  if (!partial || body.media !== undefined) out.media = validateMedia(body.media ?? []);
  if (!partial || body.resources !== undefined) {
    out.resources = validateResources(body.resources ?? []);
  }

  if (!partial || body.level !== undefined) {
    const level = body.level ?? "important";
    if (!newsService.LEVELS.includes(level)) throw new Error("news.invalidLevel");
    out.level = level;
  }

  if (!partial || body.audience !== undefined) {
    const audience = body.audience ?? "all";
    if (!newsService.AUDIENCES.includes(audience)) throw new Error("news.invalidAudience");
    out.audience = audience;
  }

  return out;
};

// Bildirishnoma kabi SHAXSIY: Owner → req.client._id / "client",
// Staff → req.staff._id / "staff" (notification.controller.js bilan bir xil;
// tenantAuth Staff uchun req.client'ni { _id: staff.client } qiladi, shuning
// uchun avval req.staff tekshiriladi).
const readerOf = (req) =>
  req.staff?._id
    ? { id: String(req.staff._id), kind: "staff" }
    : { id: String(req.client._id), kind: "client" };

module.exports = {
  // ================= Admin (/admin/news) =================

  adminList: async (req, res, next) => {
    try {
      const { page, limit, search, status } = req.query;
      const { data, meta } = await newsService.adminList({ page, limit, search, status });
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  adminGetOne: async (req, res, next) => {
    try {
      const data = await newsService.adminGetOne(req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const payload = validatePayload(req.body);
      const publish = req.body?.publish === true;
      const data = await newsService.create(payload, { publish }, buildActor(req));
      return res.send({ ok: true, data, msg: publish ? "news.published" : "news.created" });
    } catch (error) {
      next(error);
    }
  },

  update: async (req, res, next) => {
    try {
      const payload = validatePayload(req.body, { partial: true });
      const data = await newsService.update(req.params.id, payload, buildActor(req));
      return res.send({ ok: true, data, msg: "news.updated" });
    } catch (error) {
      next(error);
    }
  },

  publish: async (req, res, next) => {
    try {
      const data = await newsService.publish(req.params.id, buildActor(req));
      return res.send({ ok: true, data, msg: "news.published" });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      const data = await newsService.remove(req.params.id, buildActor(req));
      return res.send({ ok: true, data, msg: "news.deleted" });
    } catch (error) {
      next(error);
    }
  },

  uploadMedia: async (req, res, next) => {
    try {
      const data = await newsService.uploadMedia(req.files?.file);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  // ================= Client (/news) =================

  list: async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      const { data, meta } = await newsService.list(readerOf(req), { page, limit });
      return res.send({ ok: true, data, meta });
    } catch (error) {
      next(error);
    }
  },

  unread: async (req, res, next) => {
    try {
      const data = await newsService.unread(readerOf(req));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  unreadCount: async (req, res, next) => {
    try {
      const unread = await newsService.unreadCount(readerOf(req));
      return res.send({ ok: true, data: { unread } });
    } catch (error) {
      next(error);
    }
  },

  markRead: async (req, res, next) => {
    try {
      const data = await newsService.markRead(readerOf(req), req.params.id);
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  markAllRead: async (req, res, next) => {
    try {
      const data = await newsService.markAllRead(readerOf(req));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },
};
