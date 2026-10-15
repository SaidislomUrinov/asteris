// FILIAL DO'KONI (API_CONTRACT_wecoin.md §3–§4) — mahsulotlar (WECOIN narxda),
// xarid, like va buyurtmalarni topshirish/qaytarish. Balans — CoinWallet.
const sharp = require("sharp");
// "Dekompressiya bombasi"dan himoya: 10MB'li siqilgan PNG ichida 16k×16k
// piksel bo'lishi mumkin (~1GB RAM). 40 megapiksel — har qanday telefon
// kamerasi uchun yetarli (sharp default'i 268M edi).
const MAX_INPUT_PIXELS = 40_000_000;
const { isValidObjectId, Types } = require("mongoose");
const ShopProduct = require("../models/ShopProduct");
const ShopOrder = require("../models/ShopOrder");
const ShopLike = require("../models/ShopLike");
const CoinWallet = require("../models/CoinWallet");
const CoinTransaction = require("../models/CoinTransaction");
const Center = require("../models/Center");
const Student = require("../models/Student");
const Staff = require("../models/Staff");
const Client = require("../models/Client");
const notificationService = require("./notification.service");
const emit = require("../utils/emitter.util");
const fileUtil = require("../utils/file.util");
const { FOLDERS } = require("../configs/folder.config");
const { log: auditLog } = require("../utils/audit.util");
const { getNow } = require("../utils/date.util");
const { photoFor } = require("../utils/studentPhoto.util");

const PHOTO_SIZE = 512;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PAGE_SIZE = 30;
const STATUSES = ["pending", "delivered", "refunded"];

const assertCenter = async (clientId, centerId) => {
  if (!isValidObjectId(centerId)) throw new Error("center.notFound");
  const center = await Center.findOne({ _id: centerId, client: clientId, isDeleted: false }).select("name").lean();
  if (!center) throw new Error("center.notFound");
  return center;
};

// ---------------------------------------------------------------------------
// MAHSULOTLAR
// ---------------------------------------------------------------------------

const productDTO = (p, extra = {}) => ({
  _id: String(p._id),
  name: p.name,
  price: p.price,
  photo: p.photo || null,
  stock: p.stock ?? null,
  isActive: p.isActive !== false,
  likes: p.likes || 0,
  createdAt: p.createdAt,
  ...extra,
});

// multipart maydonlari satr bo'lib keladi — tekshiruv va normallashtirish.
const parseProduct = (body, partial = false) => {
  const out = {};
  if (!partial || body?.name !== undefined) {
    const name = String(body?.name || "").trim();
    if (!name || name.length > 80) throw new Error("shop.invalidName");
    out.name = name;
  }
  if (!partial || body?.price !== undefined) {
    const price = Number(body?.price);
    if (!Number.isInteger(price) || price < 1 || price > 100000) throw new Error("shop.invalidPrice");
    out.price = price;
  }
  if (body?.stock !== undefined) {
    if (body.stock === "" || body.stock === null || body.stock === "null") out.stock = null;
    else {
      const stock = Number(body.stock);
      if (!Number.isInteger(stock) || stock < 0 || stock > 100000) throw new Error("shop.invalidStock");
      out.stock = stock;
    }
  }
  if (body?.isActive !== undefined) out.isActive = body.isActive === true || body.isActive === "true" || body.isActive === "1";
  return out;
};

// Kvadrat webp (sharp) — kengaytmaga ishonilmaydi, haqiqiy dekodlash.
const savePhoto = async (file) => {
  if (!file?.data?.length) return null;
  if (file.data.length > MAX_PHOTO_BYTES) throw new Error("shop.photoTooLarge");
  let buffer;
  try {
    buffer = await sharp(file.data, { failOn: "none", limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 75, effort: 5 })
      .toBuffer();
  } catch {
    throw new Error("shop.photoInvalid");
  }
  return await fileUtil.saveBuffer(buffer, FOLDERS.SHOP, ".webp");
};

// Mahsulot rasmi buyurtma nusxalarida ham yashaydi — fayl faqat hech kim
// ishlatmasa o'chadi.
const removePhotoIfOrphan = async (path) => {
  if (!path) return;
  const used = await Promise.all([
    ShopProduct.exists({ photo: path }),
    ShopOrder.exists({ productPhoto: path }),
  ]);
  if (!used.some(Boolean)) await fileUtil.remove(path);
};

const listProducts = async (clientId, centerId) => {
  await assertCenter(clientId, centerId);
  const products = await ShopProduct.find({ client: clientId, center: centerId, isDeleted: false })
    .sort({ isActive: -1, createdAt: -1 })
    .lean();
  const sold = await ShopOrder.aggregate([
    { $match: { product: { $in: products.map((p) => p._id) }, status: { $ne: "refunded" } } },
    { $group: { _id: "$product", n: { $sum: 1 } } },
  ]);
  const soldOf = new Map(sold.map((s) => [String(s._id), s.n]));
  return products.map((p) => productDTO(p, { sold: soldOf.get(String(p._id)) || 0 }));
};

const createProduct = async (clientId, centerId, body, file, actor) => {
  await assertCenter(clientId, centerId);
  const data = parseProduct(body);
  const photo = await savePhoto(file);
  const doc = await ShopProduct.create({ client: clientId, center: centerId, ...data, photo });
  await auditLog({
    actor,
    client: clientId,
    center: centerId,
    action: "shop:productCreate",
    entity: { type: "ShopProduct", id: doc._id, label: doc.name },
    changes: [{ field: "price", from: null, to: doc.price }],
  });
  emit.toCenter(clientId, centerId, "shop:products", { centerId: String(centerId) });
  return productDTO(doc.toObject(), { sold: 0 });
};

const updateProduct = async (clientId, centerId, id, body, file, actor) => {
  await assertCenter(clientId, centerId);
  if (!isValidObjectId(id)) throw new Error("shop.productNotFound");
  const doc = await ShopProduct.findOne({ _id: id, client: clientId, center: centerId, isDeleted: false });
  if (!doc) throw new Error("shop.productNotFound");
  const data = parseProduct(body, true);
  const changes = Object.entries(data)
    .filter(([k, v]) => doc[k] !== v)
    .map(([k, v]) => ({ field: k, from: doc[k], to: v }));
  Object.assign(doc, data);

  const oldPhoto = doc.photo;
  const removePhoto = body?.removePhoto === "1" || body?.removePhoto === true || body?.removePhoto === "true";
  if (file) doc.photo = await savePhoto(file);
  else if (removePhoto) doc.photo = null;
  if (doc.photo !== oldPhoto) changes.push({ field: "photo", from: oldPhoto, to: doc.photo });

  await doc.save();
  if (oldPhoto && doc.photo !== oldPhoto) await removePhotoIfOrphan(oldPhoto);
  if (changes.length) {
    await auditLog({
      actor,
      client: clientId,
      center: centerId,
      action: "shop:productUpdate",
      entity: { type: "ShopProduct", id: doc._id, label: doc.name },
      changes,
    });
  }
  emit.toCenter(clientId, centerId, "shop:products", { centerId: String(centerId) });
  const sold = await ShopOrder.countDocuments({ product: doc._id, status: { $ne: "refunded" } });
  return productDTO(doc.toObject(), { sold });
};

const removeProduct = async (clientId, centerId, id, actor) => {
  await assertCenter(clientId, centerId);
  if (!isValidObjectId(id)) throw new Error("shop.productNotFound");
  const doc = await ShopProduct.findOneAndUpdate(
    { _id: id, client: clientId, center: centerId, isDeleted: false },
    { $set: { isDeleted: true, deletedAt: getNow(), updatedAt: getNow() } },
    { returnDocument: "after" },
  );
  if (!doc) throw new Error("shop.productNotFound");
  await auditLog({
    actor,
    client: clientId,
    center: centerId,
    action: "shop:productDelete",
    entity: { type: "ShopProduct", id: doc._id, label: doc.name },
    changes: [],
  });
  emit.toCenter(clientId, centerId, "shop:products", { centerId: String(centerId) });
  return { _id: String(doc._id) };
};

// ---------------------------------------------------------------------------
// BUYURTMALAR — xodim tomoni
// ---------------------------------------------------------------------------

const actorNames = async (orders) => {
  const ids = (kind) => [
    ...new Set(orders.filter((o) => o.handledBy?.kind === kind && o.handledBy?.id).map((o) => String(o.handledBy.id))),
  ];
  const [staffs, clients] = await Promise.all([
    ids("staff").length ? Staff.find({ _id: { $in: ids("staff") } }).select("name").lean() : [],
    ids("client").length ? Client.find({ _id: { $in: ids("client") } }).select("name").lean() : [],
  ]);
  return new Map([...staffs, ...clients].map((x) => [String(x._id), x.name || ""]));
};

const orderDTO = (o, { student = null, names = null, clientId = null } = {}) => ({
  _id: String(o._id),
  centerId: String(o.center),
  student: student
    ? { _id: String(student._id), fullName: student.fullName, photo: clientId ? photoFor(student, clientId) : null }
    : { _id: String(o.student) },
  productId: String(o.product),
  productName: o.productName,
  productPhoto: o.productPhoto || null,
  price: o.price,
  status: o.status,
  handledBy: o.handledBy?.id ? { kind: o.handledBy.kind, name: names?.get(String(o.handledBy.id)) || "" } : null,
  handledAt: o.handledAt || null,
  createdAt: o.createdAt,
});

const withStudents = async (orders, clientId) => {
  const [students, names] = await Promise.all([
    Student.find({ _id: { $in: [...new Set(orders.map((o) => String(o.student)))] } }).select("fullName photos").lean(),
    actorNames(orders),
  ]);
  const map = new Map(students.map((s) => [String(s._id), s]));
  return orders.map((o) => orderDTO(o, { student: map.get(String(o.student)), names, clientId }));
};

const listOrders = async (clientId, centerId, { status = "", page = 1 } = {}) => {
  await assertCenter(clientId, centerId);
  const base = { client: clientId, center: centerId };
  const filter = STATUSES.includes(status) ? { ...base, status } : base;
  const pageNum = Math.max(1, Number(page) || 1);
  const [orders, total, counts] = await Promise.all([
    ShopOrder.find(filter).sort({ createdAt: -1, _id: -1 }).skip((pageNum - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    ShopOrder.countDocuments(filter),
    // aggregate() satr id'ni ObjectId'ga o'girmaydi — qo'lda.
    ShopOrder.aggregate([
      { $match: { client: new Types.ObjectId(String(clientId)), center: new Types.ObjectId(String(centerId)) } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);
  return {
    data: await withStudents(orders, clientId),
    meta: { page: pageNum, limit: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
    counts: Object.fromEntries(STATUSES.map((s) => [s, counts.find((c) => c._id === s)?.n || 0])),
  };
};

// pending → delivered | refunded (atomar: faqat pending holatdan).
const handleOrder = async (clientId, centerId, id, nextStatus, actor) => {
  await assertCenter(clientId, centerId);
  if (!isValidObjectId(id)) throw new Error("shop.orderNotFound");
  const exists = await ShopOrder.findOne({ _id: id, client: clientId, center: centerId }).select("status").lean();
  if (!exists) throw new Error("shop.orderNotFound");
  const now = getNow();
  const order = await ShopOrder.findOneAndUpdate(
    { _id: id, client: clientId, center: centerId, status: "pending" },
    {
      $set: {
        status: nextStatus,
        handledAt: now,
        updatedAt: now,
        handledBy: { id: actor?.id || null, kind: actor?.kind === "staff" ? "staff" : "client" },
      },
    },
    { returnDocument: "after" },
  ).lean();
  if (!order) throw new Error("shop.orderNotPending");

  if (nextStatus === "refunded") {
    await CoinTransaction.create({
      client: clientId,
      center: centerId,
      student: order.student,
      type: "refund",
      amount: order.price,
      order: order._id,
    });
    await CoinWallet.updateOne(
      { student: order.student, center: centerId },
      { $inc: { balance: order.price, spent: -order.price }, $set: { updatedAt: now } },
    );
    await ShopProduct.updateOne({ _id: order.product, stock: { $ne: null } }, { $inc: { stock: 1 } });
  }

  await auditLog({
    actor,
    client: clientId,
    center: centerId,
    action: nextStatus === "refunded" ? "shop:orderRefund" : "shop:orderDeliver",
    entity: { type: "ShopOrder", id: order._id, label: order.productName },
    changes: [{ field: "status", from: "pending", to: nextStatus }],
    meta: { studentId: String(order.student), price: order.price },
  });

  const [dto] = await withStudents([order], clientId);
  emit.toCenter(clientId, centerId, "shop:orderUpdated", { order: dto });

  const student = await Student.findById(order.student);
  const entry =
    student?.groups?.find((g) => String(g.center) === String(centerId) && g.status === "active") ||
    student?.groups?.find((g) => String(g.center) === String(centerId));
  if (student && entry) {
    const parentNotification = require("./parentNotification.service");
    void parentNotification.onShopOrder({ student, entry, order });
  }
  return dto;
};

// Yangi buyurtma — Owner va shu filialning coin:manage'li faol xodimlariga.
const notifyStaff = async (order, student, centerName) => {
  const staffs = await Staff.find({
    client: order.client,
    centers: order.center,
    isDeleted: false,
    blocked: { $ne: true },
    $or: [{ permissions: "all" }, { permissions: "coin:manage" }],
  })
    .select("_id")
    .lean();
  const recipients = [{ id: order.client, kind: "client" }, ...staffs.map((s) => ({ id: s._id, kind: "staff" }))];
  for (const recipient of recipients) {
    await notificationService.create({
      clientId: order.client,
      centerId: order.center,
      recipient,
      type: "shop:order",
      title: order.productName,
      body: `${student.fullName} · ${order.price} WECOIN · ${centerName}`,
      data: { orderId: String(order._id), centerId: String(order.center) },
      dedupKey: `shop:order:${order._id}:${recipient.id}`,
    });
  }
};

// ---------------------------------------------------------------------------
// O'QUVCHI TOMONI — `pair` = coin.service.assertParentPair natijasi.
// ---------------------------------------------------------------------------

const shopFor = async ({ student, clientId }, centerId) => {
  const products = await ShopProduct.find({ client: clientId, center: centerId, isDeleted: false, isActive: true })
    .sort({ price: 1, createdAt: -1 })
    .lean();
  const liked = await ShopLike.find({ student: student._id, product: { $in: products.map((p) => p._id) } })
    .select("product")
    .lean();
  const likedSet = new Set(liked.map((l) => String(l.product)));
  return products.map((p) => ({
    _id: String(p._id),
    name: p.name,
    price: p.price,
    photo: p.photo || null,
    stock: p.stock ?? null,
    likes: p.likes || 0,
    liked: likedSet.has(String(p._id)),
  }));
};

const buy = async ({ student, clientId }, centerId, productId) => {
  if (!isValidObjectId(productId)) throw new Error("shop.productNotFound");
  const base = { _id: productId, client: clientId, center: centerId, isDeleted: false, isActive: true };
  const product = await ShopProduct.findOne(base).lean();
  if (!product) throw new Error("shop.productNotFound");

  // 1) Qoldiq (cheklangan bo'lsa) — atomar band qilish.
  if (product.stock !== null && product.stock !== undefined) {
    const reserved = await ShopProduct.updateOne({ ...base, stock: { $gt: 0 } }, { $inc: { stock: -1 } });
    if (!reserved.modifiedCount) throw new Error("shop.outOfStock");
  }
  const releaseStock = async () => {
    if (product.stock !== null && product.stock !== undefined) {
      await ShopProduct.updateOne({ _id: product._id }, { $inc: { stock: 1 } });
    }
  };

  // 2) Balans — faqat yetarli bo'lsa yechiladi.
  const now = getNow();
  const wallet = await CoinWallet.findOneAndUpdate(
    { student: student._id, center: centerId, balance: { $gte: product.price } },
    { $inc: { balance: -product.price, spent: product.price }, $set: { updatedAt: now } },
    { returnDocument: "after" },
  ).lean();
  if (!wallet) {
    await releaseStock();
    throw new Error("shop.notEnoughCoins");
  }

  let order;
  try {
    order = await ShopOrder.create({
      client: clientId,
      center: centerId,
      student: student._id,
      product: product._id,
      productName: product.name,
      productPhoto: product.photo || null,
      price: product.price,
    });
    await CoinTransaction.create({
      client: clientId,
      center: centerId,
      student: student._id,
      type: "spend",
      amount: -product.price,
      order: order._id,
    });
  } catch (error) {
    // Buyurtma yozilgan, faqat daftar yozuvi tushmadi — xarid bekor qilinmaydi
    // (balans allaqachon to'g'ri), xato faqat logga.
    if (order) console.error("shop buy ledger:", error?.message || error);
    else {
      // Buyurtma yozilmadi — tanga va qoldiq qaytadi.
      await CoinWallet.updateOne({ _id: wallet._id }, { $inc: { balance: product.price, spent: -product.price } });
      await releaseStock();
      throw error;
    }
  }

  const center = await Center.findById(centerId).select("name").lean();
  const plain = order.toObject();
  const [dto] = await withStudents([plain], clientId);
  emit.toCenter(clientId, centerId, "shop:order", { order: dto });
  void notifyStaff(plain, student, center?.name || "").catch((e) => console.error("shop notifyStaff:", e?.message));

  return { order: historyOrderDTO(plain), balance: wallet.balance };
};

const toggleLike = async ({ student }, centerId, productId) => {
  if (!isValidObjectId(productId)) throw new Error("shop.productNotFound");
  const product = await ShopProduct.findOne({ _id: productId, center: centerId, isDeleted: false }).select("_id").lean();
  if (!product) throw new Error("shop.productNotFound");
  const removed = await ShopLike.findOneAndDelete({ product: productId, student: student._id });
  let liked = false;
  if (removed) {
    await ShopProduct.updateOne({ _id: productId, likes: { $gt: 0 } }, { $inc: { likes: -1 } });
  } else {
    try {
      await ShopLike.create({ product: productId, student: student._id });
      await ShopProduct.updateOne({ _id: productId }, { $inc: { likes: 1 } });
      liked = true;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      liked = true; // parallel bosish — allaqachon yoqtirilgan
    }
  }
  const fresh = await ShopProduct.findById(productId).select("likes").lean();
  return { liked, likes: fresh?.likes || 0 };
};

const historyOrderDTO = (o) => ({
  _id: String(o._id),
  productName: o.productName,
  productPhoto: o.productPhoto || null,
  price: o.price,
  status: o.status,
  createdAt: o.createdAt,
  handledAt: o.handledAt || null,
});

const history = async ({ student }, centerId) => {
  const [orders, transactions] = await Promise.all([
    ShopOrder.find({ student: student._id, center: centerId }).sort({ createdAt: -1, _id: -1 }).limit(50).lean(),
    CoinTransaction.find({ student: student._id, center: centerId }).sort({ createdAt: -1, _id: -1 }).limit(50).lean(),
  ]);
  return {
    orders: orders.map(historyOrderDTO),
    transactions: transactions.map((tx) => ({
      _id: String(tx._id),
      type: tx.type,
      amount: tx.amount,
      month: tx.month || null,
      orderId: tx.order ? String(tx.order) : null,
      breakdown: tx.breakdown || null,
      createdAt: tx.createdAt,
    })),
  };
};

module.exports = {
  listProducts,
  createProduct,
  updateProduct,
  removeProduct,
  listOrders,
  deliverOrder: (clientId, centerId, id, actor) => handleOrder(clientId, centerId, id, "delivered", actor),
  refundOrder: (clientId, centerId, id, actor) => handleOrder(clientId, centerId, id, "refunded", actor),
  shopFor,
  buy,
  toggleLike,
  history,
};
