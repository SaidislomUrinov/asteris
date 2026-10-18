const Client = require("../models/Client");
const Staff = require("../models/Staff");
const clientService = require("./client.service");
const staffService = require("./staff.service");
const { normalizePhone } = require("../utils/phone.util");

// Kirish javobining to'liq shakli — `/client-auth/signin`, `/staff-auth/signin`
// va yagona `/auth/signin` uchun BITTA joyda (aks holda biri premium bo'lim
// flaglarini yoki filial kontekstini qaytarmay qolardi).
// `wantedCenter` — `x-center-id` header (oxirgi tanlangan filial).
const ownerSession = async (body, wantedCenter = null) => {
  const { data, access } = await clientService.signIn(body);
  const context = await clientService.sessionContext(data._id, { wanted: wantedCenter });
  return { data: { ...data, ...context }, access };
};

const staffSession = async (body, wantedCenter = null) => {
  const { data, access } = await staffService.signIn(body);
  // `verify` bilan bir xil payload — aks holda login'dan keyin premium
  // bo'limlar (QR davomat) faqat sahifa yangilangach paydo bo'lardi.
  const [{ active }, tariffFeatures, tariffName, context] = await Promise.all([
    clientService.getSubscriptionStatus(data.client),
    clientService.getTariffFeatures(data.client),
    clientService.getTariffName(data.client),
    clientService.sessionContext(data.client, {
      centerIds: data.centers,
      excludeBlocked: true,
      wanted: wantedCenter,
      primary: data.center,
    }),
  ]);
  return {
    data: { ...data, subscriptionActive: active, tariffFeatures, tariffName, ...context },
    access,
  };
};

module.exports = {
  ownerSession,
  staffSession,

  // Yagona kirish (API_CONTRACT_staff_phone.md §2): subdomen mijozni,
  // raqam esa shu mijoz ichida kimligini aniqlaydi — Owner yoki Hodim.
  // Auth zanjirlari o'zgarmaydi: topilgan rolning o'z signIn'i chaqiriladi.
  // Topilmasa xabar bir xil (`auth.notFound`) — raqam kimniki ekani oshkor bo'lmaydi.
  signIn: async (body, wantedCenter = null) => {
    const phone = normalizePhone(body?.phone);
    if (!phone || !body?.password) throw new Error("auth.fillTheRows");
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (!slug) throw new Error("auth.brandRequired");

    const client = await Client.findOne({ slug, isDeleted: false }).select("_id phone");
    if (!client) throw new Error("auth.notFound");

    if (normalizePhone(client.phone) === phone) {
      // Owner raqami bazada aynan qanday yozilgan bo'lsa, shunday uzatiladi.
      const session = await ownerSession({ slug, phone: client.phone, password: body.password }, wantedCenter);
      return { ...session, authType: "owner" };
    }

    const isStaff = await Staff.exists({ client: client._id, phone, isDeleted: false });
    if (!isStaff) throw new Error("auth.notFound");
    const session = await staffSession({ slug, phone, password: body.password }, wantedCenter);
    return { ...session, authType: "staff" };
  },
};
