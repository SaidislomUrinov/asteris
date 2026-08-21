const { Types } = require("mongoose");
const Expense = require("../models/Expense");
const Center = require("../models/Center");
const emit = require("../utils/emitter.util");
const { getNow, currentMonthString } = require("../utils/date.util");

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

  create: async (clientId, body) => {
    const { centerId, title, category, amount, note, month } = body;
    if (!centerId || !title || !amount) throw new Error("expense.fillTheRows");
    if (amount < 1) throw new Error("expense.invalidValue");
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

  update: async (clientId, id, body) => {
    const expense = await Expense.findOne({ _id: id, client: clientId });
    if (!expense) throw new Error("expense.notFound");
    if (expense.status === "cancelled") throw new Error("expense.cancelled");

    if (body.title) expense.title = body.title.trim();
    if (body.note !== undefined) expense.note = body.note?.trim() || "";
    if (body.category) {
      if (!Expense.CATEGORIES.includes(body.category)) throw new Error("expense.invalidCategory");
      expense.category = body.category;
    }
    if (body.amount != null) {
      if (body.amount < 1) throw new Error("expense.invalidValue");
      expense.amount = body.amount;
    }

    await expense.save();

    emit(`client:${clientId}`, "expense:updated", DTO(expense));

    return DTO(expense);
  },

  // Moliyaviy yozuv o'chirilmaydi — faqat bekor qilinadi
  cancel: async (clientId, id) => {
    const expense = await Expense.findOne({ _id: id, client: clientId });
    if (!expense) throw new Error("expense.notFound");
    if (expense.status === "cancelled") throw new Error("expense.alreadyCancelled");

    expense.status = "cancelled";
    expense.cancelledAt = getNow();
    await expense.save();

    emit(`client:${clientId}`, "expense:updated", DTO(expense));

    return DTO(expense);
  },
};
