const { Types } = require("mongoose");
const Expense = require("../models/Expense");
const Center = require("../models/Center");
const emit = require("../utils/emitter.util");
const { getNow, currentMonthString } = require("../utils/date.util");
const audit = require("../utils/audit.util");
const { parseAmount } = require("../utils/amount.util");

const isText = (v) => typeof v === "string";

const PAGE_SIZE = 50;

const DTO = (data) => ({
  _id: data?._id,
  client: data?.client,
  center: data?.center,
  title: data?.title,
  category: data?.category,
  amount: data?.amount,
  note: data?.note,
  month: data?.month,
  status: data?.status,
  date: data?.date,
});

module.exports = {
  DTO,

  // Har o'zgarish audit jurnaliga tushadi (CLAUDE.md "Audit Log"); `actor` —
  // controller'dagi buildActor(req).
  create: async (clientId, body, actor = null) => {
    const { centerId, title, category, note, month } = body || {};
    if (!centerId || !title || body.amount == null) throw new Error("expense.fillTheRows");
    if (!isText(title) || (note != null && !isText(note))) throw new Error("expense.invalidValue");
    const amount = parseAmount(body.amount);
    if (!amount) throw new Error("expense.invalidValue");
    if (category && !Expense.CATEGORIES.includes(category)) {
      throw new Error("expense.invalidCategory");
    }

    const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false });
    if (!center) throw new Error("center.notFound");

    const expense = await Expense.create({
      client: clientId,
      center: center._id,
      title: title.trim(),
      category: category || "other",
      amount,
      note: note?.trim() || "",
      month: month || currentMonthString(),
    });

    emit(`client:${clientId}`, "expense:created", DTO(expense));
    void audit.log({
      actor,
      client: clientId,
      center: expense.center,
      action: "expense:create",
      entity: { type: "expense", id: expense._id, label: expense.title },
      meta: { amount: expense.amount, category: expense.category, month: expense.month },
    });

    return DTO(expense);
  },

  list: async (clientId, { page = 1, search = "", center = "", month = "", category = "" }) => {
    const baseFilter = { client: clientId };
    if (center) baseFilter.center = center;
    if (month) baseFilter.month = month;
    if (category) baseFilter.category = category;

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      baseFilter.$or = [{ title: regex }, { note: regex }];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    const [data, total, totals] = await Promise.all([
      Expense.find(baseFilter).sort({ createdAt: -1 }).skip(skip).limit(PAGE_SIZE),
      Expense.countDocuments(baseFilter),
      Expense.aggregate([
        // aggregate Mongoose kabi avtomatik cast qilmaydi — ObjectId qo'lda
        {
          $match: {
            ...baseFilter,
            client: new Types.ObjectId(String(clientId)),
            ...(center ? { center: new Types.ObjectId(String(center)) } : {}),
            status: "active",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    return {
      data: data.map(DTO),
      totalAmount: totals[0]?.total || 0,
      meta: {
        page: pageNum,
        limit: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE) || 1,
      },
    };
  },

  // Kategoriya bo'yicha yig'indi — Center Detail'dagi xarajat donut chart
  // uchun (faqat "active" xarajatlar, cancelled hisobga kirmaydi).
  byCategory: async (clientId, { center = "", month = "" }) => {
    const rows = await Expense.aggregate([
      {
        $match: {
          client: new Types.ObjectId(String(clientId)),
          ...(center ? { center: new Types.ObjectId(String(center)) } : {}),
          ...(month ? { month } : {}),
          status: "active",
        },
      },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
    ]);

    return rows.map((r) => ({ category: r._id, total: r.total }));
  },

  // Excel export — list() bilan bir xil filtr, sahifalashsiz, Filial nomi
  // hal qilingan holda.
  exportList: async (clientId, { search = "", center = "", month = "", category = "" }) => {
    const baseFilter = { client: clientId };
    if (center) baseFilter.center = center;
    if (month) baseFilter.month = month;
    if (category) baseFilter.category = category;

    const trimmedSearch = search?.trim();
    if (trimmedSearch) {
      const regex = new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      baseFilter.$or = [{ title: regex }, { note: regex }];
    }

    const expenses = await Expense.find(baseFilter).sort({ createdAt: -1 });
    const centerIds = [...new Set(expenses.map((e) => String(e.center)))];
    const centers = await Center.find({ _id: { $in: centerIds } }, { name: 1 });
    const centerMap = Object.fromEntries(centers.map((c) => [String(c._id), c.name]));

    return expenses.map((e) => ({
      title: e.title,
      category: e.category,
      centerName: centerMap[String(e.center)] || "—",
      amount: e.amount,
      date: e.date,
      status: e.status,
    }));
  },

  update: async (clientId, id, body, actor = null) => {
    const expense = await Expense.findOne({ _id: id, client: clientId });
    if (!expense) throw new Error("expense.notFound");
    if (expense.status === "cancelled") throw new Error("expense.cancelled");
    if ((body.title != null && !isText(body.title)) || (body.note != null && !isText(body.note))) {
      throw new Error("expense.invalidValue");
    }
    const before = { title: expense.title, note: expense.note, category: expense.category, amount: expense.amount };

    if (body.title) expense.title = body.title.trim();
    if (body.note !== undefined) expense.note = body.note?.trim() || "";
    if (body.category) {
      if (!Expense.CATEGORIES.includes(body.category)) throw new Error("expense.invalidCategory");
      expense.category = body.category;
    }
    if (body.amount != null) {
      const amount = parseAmount(body.amount);
      if (!amount) throw new Error("expense.invalidValue");
      expense.amount = amount;
    }

    await expense.save();

    emit(`client:${clientId}`, "expense:updated", DTO(expense));
    // Summa joyida o'zgaradi — eski qiymat shu yozuvda (from → to) saqlanadi,
    // ya'ni moliyaviy tarix yo'qolmaydi.
    const changes = audit.diff(before, {
      title: expense.title,
      note: expense.note,
      category: expense.category,
      amount: expense.amount,
    });
    if (changes.length) {
      void audit.log({
        actor,
        client: clientId,
        center: expense.center,
        action: "expense:update",
        entity: { type: "expense", id: expense._id, label: expense.title },
        changes,
      });
    }

    return DTO(expense);
  },

  // Moliyaviy yozuv o'chirilmaydi — faqat bekor qilinadi
  cancel: async (clientId, id, actor = null) => {
    const expense = await Expense.findOne({ _id: id, client: clientId });
    if (!expense) throw new Error("expense.notFound");
    if (expense.status === "cancelled") throw new Error("expense.alreadyCancelled");

    expense.status = "cancelled";
    expense.cancelledAt = getNow();
    await expense.save();

    emit(`client:${clientId}`, "expense:updated", DTO(expense));
    void audit.log({
      actor,
      client: clientId,
      center: expense.center,
      action: "expense:cancel",
      entity: { type: "expense", id: expense._id, label: expense.title },
      meta: { amount: expense.amount },
    });

    return DTO(expense);
  },
};
