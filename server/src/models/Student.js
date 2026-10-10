const { Schema, model } = require("mongoose");
const { normalizePhone, normalizeTelegramPhone, setTelegramPhone } = require("../utils/phone.util");
const { formatDate, getNow } = require("../utils/date.util");

// O'quvchi telefon raqam asosida yagona hujjat (CLAUDE.md "Ma'lumotlar
// modeli") — `client` maydoni hujjat darajasida YO'Q, bir kishi ko'p
// Client/Center/Group'ga `groups[]` orqali bog'lanadi. Har bir `groups[]`
// elementi bitta guruhga yozilishni, shu guruh uchun kelishilgan narxni va
// bo'lib-bo'lib to'lovlar tarixini (`payments[]`) alohida saqlaydi — CLAUDE.md
// "To'lov (Payment)": moliyaviy yozuvlar hech qachon o'chirilmaydi, faqat
// status o'zgaradi (cancelled/refunded), refund yangi yozuv sifatida qo'shiladi.
const paymentSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 1 },
    type: { type: String, enum: ["cash", "card", "mixed", "previousMonth"], default: "cash" },
    status: { type: String, enum: ["paid", "cancelled", "refunded"], default: "paid" },
    note: { type: String, default: "", trim: true },
    forMonth: { type: String, default: "", trim: true }, // "YYYY-MM" — chek uchun "qaysi oy uchun"
    // To'lovni KIM qabul qilgani ("Tushumlar" sahifasi shu maydonga tayanadi).
    // `refPath` emas, aniq `kind` — chunki qabul qiluvchi ikki xil, mustaqil
    // modeldan bo'lishi mumkin: Client Owner (`Client`) yoki hodim (`Staff`).
    // ESKI to'lovlarda bu maydon YO'Q (null) — moliyaviy yozuvlar qayta
    // yozilmaydi (CLAUDE.md), shuning uchun UI'da "noma'lum" deb ko'rsatiladi.
    collectedBy: { type: Schema.Types.ObjectId, default: null },
    collectedByKind: { type: String, enum: ["owner", "staff", null], default: null },
    // Bekor qilinganda kim va qachon (eski to'lovlarda yo'q — null).
    cancelledAt: { type: Number, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, default: null },
    cancelledByKind: { type: String, enum: ["owner", "staff", "admin", null], default: null },
    date: { type: Number, default: getNow },
    // Qisqa, ochiq (public) tekshirish kodi — chek QR/link shunga ishora
    // qiladi (paymentVerify.service.js). ESKI to'lovlarda YO'Q (null) —
    // ular hamon o'zining Mongo `_id`si orqali tekshiriladi (backward
    // compat, paymentVerify.service.js ikkalasini ham sinaydi).
    code: { type: String, default: null },
    // "Qaysi oy uchun" belgisini o'tkazishlar tarixi
    // (API_CONTRACT_payment_move_month.md). `from` eski qiymat — eski
    // to'lovda `""` bo'lishi mumkin (sana oyi deb talqin qilinadi).
    forMonthHistory: {
      type: [
        {
          from: { type: String, default: "" },
          to: { type: String, default: "" },
          at: { type: Number, default: getNow },
          byId: { type: Schema.Types.ObjectId, default: null },
          byKind: { type: String, enum: ["owner", "staff", null], default: null },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { _id: true },
);

// To'lov krediti — "shu bitta dars kuni uchun bu o'quvchidan pul olinmaydi"
// belgisi (faqat sana, summasi YO'Q — computeBilling summani JORIY narx va
// JORIY dars-kunlari soniga qarab har safar jonli hisoblaydi, shunda
// qarzdorlik va "to'lash kerak bo'lgan summa" doim bir-biriga mos keladi).
// Ikki manbadan keladi: (1) davomat orqali "sababli"/"sababsiz kelmagan kun
// uchun to'lov o'tkaziladi" sozlamasi yoqilgan bo'lsa (attendance.service.js
// "applyCredit"), yoki (2) yangi o'quvchi sikl o'rtasida qo'shilganda, shu
// sikldan hozirgacha allaqachon o'tgan har bir dars kuni uchun (student.
// service.js "create" proration — har o'tkazib yuborilgan kun uchun bitta
// yozuv).
const creditSchema = new Schema(
  {
    date: { type: String, required: true }, // "YYYY-MM-DD"
  },
  { _id: false },
);

// Narx o'zgarish tarixi — o'quvchining kelishilgan narxi (`price`) keyinroq
// tahrirlansa, computeBilling O'TGAN sikllarni YANGI narx bilan qayta
// hisoblab yubormasligi kerak (aks holda qarzdorlik kutilmaganda sakraydi).
// Har bir yozuv "shu sanadan boshlab shu narx amal qildi" degani —
// resolveCycle har bir sikl uchun o'sha siklga mos narxni shu tarixdan
// tanlab oladi.
const priceHistorySchema = new Schema(
  {
    price: { type: Number, required: true, min: 0 },
    from: { type: Number, required: true },
  },
  { _id: false },
);

// Ko'chirishdan (WENET'ga o'tishdan) OLDINGI qarz — oylar kesimida
// (API_CONTRACT_opening_debts.md §1). `month` = "YYYY-MM" yoki null (oyi
// noma'lum — faqat import/eski data). Moliyaviy yozuv EMAS (tahrirlanadi va
// o'chiriladi), lekin har o'zgarish Audit Log'ga yoziladi.
const openingDebtSchema = new Schema(
  {
    month: { type: String, default: null },
    amount: { type: Number, required: true, min: 1 },
    note: { type: String, default: "", trim: true },
  },
  { _id: true },
);

const archivedPeriodSchema = new Schema(
  {
    from: { type: Number, required: true },
    to: { type: Number, required: true },
  },
  { _id: false },
);

const groupEntrySchema = new Schema(
  {
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    center: { type: Schema.Types.ObjectId, ref: "Center", required: true },
    client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    price: { type: Number, default: 0, min: 0 }, // shu guruh uchun kelishilgan JORIY narx
    priceHistory: { type: [priceHistorySchema], default: [] },
    // "archived" — API_CONTRACT_archive.md. Arxiv birligi O'QUVCHI HUJJATI
    // emas, aynan SHU a'zolik: o'quvchi X guruhda arxivlangan bo'lib, N
    // guruhda faol qolaveradi. Butun loyihada qarzdorlik/statistika
    // `status === "active"` bo'yicha hisoblangani uchun arxivlangan a'zolik
    // avtomatik ravishda barcha hisob-kitobdan chiqadi (yangi filtr shart emas).
    status: { type: String, enum: ["active", "left", "archived"], default: "active" },
    // Arxivlash PAYTIDAGI holat — qaytarishda aynan shu holat tiklanadi
    // (guruhdan chiqarilgan o'quvchi "active" bo'lib qaytib qolmasligi uchun).
    statusBeforeArchive: { type: String, enum: ["active", "left", null], default: null },
    archivedAt: { type: Number, default: null },
    // Guruh arxivlangani uchun KASKAD bilan arxivlanganmi (true), yoki aynan
    // shu a'zolik QO'LDA arxivlanganmi (false). Guruh arxivdan qaytarilganda
    // faqat kaskad bilan arxivlanganlari tiklanadi — qo'lda arxivlangani
    // arxivda qolishi kerak.
    archivedWithGroup: { type: Boolean, default: false },
    // Arxivda TURGAN davrlar — faol holatda arxivlanib keyin qaytarilgan
    // a'zolik uchun [from, to). computeBilling (buildCycles) shu oraliqdagi
    // dars kunlarini hisoblamaydi: aks holda qaytarilgan o'quvchiga arxivda
    // turgan oylar uchun ham qarz yozilardi.
    archivedPeriods: { type: [archivedPeriodSchema], default: [] },
    joinedAt: { type: Number, default: getNow },
    leftAt: { type: Number, default: null },
    payments: { type: [paymentSchema], default: [] },
    credits: { type: [creditSchema], default: [] },
    // "3 kun ketma-ket kelmadi → keyingi oyga o'tkazish" (utils/rollover.util.js).
    // Moliyaviy ta'sirli yozuv — o'chirilmaydi, faqat `status: "cancelled"`.
    rollovers: {
      type: [
        {
          dates: { type: [String], default: [] }, // "YYYY-MM-DD"
          amount: { type: Number, required: true, min: 0 },
          fromMonth: { type: String, required: true }, // shu oy tushum/percentidan ayiriladi
          toMonth: { type: String, required: true }, // shu oyga qo'shiladi
          applyAt: { type: Number, required: true }, // chegirma qo'llanadigan sikl ichidagi unix
          status: { type: String, enum: ["active", "cancelled"], default: "active" },
          createdAt: { type: Number, default: getNow },
          cancelledAt: { type: Number, default: null },
        },
      ],
      default: [],
    },
    // Ko'chirishdan oldingi AVANS (oldindan to'langan summa, ≥ 0). Eski
    // hujjatlarda MANFIY qiymat (= eski qarz) qolgan bo'lishi mumkin — u
    // migratsiyasiz o'qishda normallashtiriladi (student.service.js
    // `openingItemsOf`: manfiy → `{ month: null, amount }` qarz qatori), PUT
    // .../opening saqlashida esa `openingDebts`ga ko'chiriladi.
    // Bu MOLIYAVIY YOZUV EMAS (payments[] emas) — shuning uchun tahrirlanadi va
    // o'chiriladi. Soxta `payments[]` yozuvi yaratilmaydi, chunki moliyaviy
    // yozuv hech qachon o'chirilmaydi (CLAUDE.md).
    openingBalance: { type: Number, default: 0 },
    openingDebts: { type: [openingDebtSchema], default: [] },
    // "Alohida foiz" (API_CONTRACT_entry_teacher_percent.md §1): SHU a'zolik
    // to'lovlarining shu %i guruhning joriy o'qituvchisi oyligiga ALOHIDA
    // qo'shiladi va oddiy guruh/Reception/Yordamchi foiz havzalaridan
    // chiqariladi. `null` — oddiy holat. Eski hujjatlarda maydon yo'q → null.
    teacherPercent: { type: Number, default: null, min: 0, max: 100 },
    // Shu A'ZOLIKNI import qo'shgan bo'lsa (yangi yoki mavjud hujjatga
    // yangi guruh) — batch id. Bekor qilishda (`undoImportBatch`)
    // `$pull` orqali izlanadi (API_CONTRACT_import_undo.md §1).
    importBatch: { type: Schema.Types.ObjectId, ref: "ImportBatch", default: null },
    // Guruhdan guruhga o'tkazish (API_CONTRACT_student_transfer.md §2).
    // `transferredFrom` — shu a'zolikdan OLDINGI a'zoliklar zanjiri (A→B→C
    // bo'lsa C'da A va B). Baho/davomat/to'lov KO'CHIRILMAYDI — ular manba
    // guruhda o'z sanasi bilan qoladi, yangi guruh ko'rinishlari shu zanjir
    // orqali ularni qo'shib ko'rsatadi.
    transferredFrom: {
      type: [
        {
          group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
          entry: { type: Schema.Types.ObjectId, required: true },
          center: { type: Schema.Types.ObjectId, ref: "Center", default: null },
          from: { type: Number, default: 0 },
          until: { type: Number, required: true },
          _id: false,
        },
      ],
      default: [],
    },
    // Shu a'zolik boshqa guruhga O'TKAZILGAN — hisob-kitobi yopilgan
    // (balans yangi a'zolikka ko'chgan, computeBilling `debt: 0` beradi).
    transferredTo: {
      type: new Schema(
        {
          group: { type: Schema.Types.ObjectId, ref: "Group", required: true },
          entry: { type: Schema.Types.ObjectId, required: true },
          at: { type: Number, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { _id: true },
);

const schema = new Schema({
  // Bitta o'quvchi bir nechta farzand uchun bitta ota-ona telefon raqamidan
  // foydalanishi mumkin (API_CONTRACT.md §2) — endi UNIQUE emas, faqat
  // qidiruv tezligi uchun oddiy index. Eski unique index Mongo'da hali
  // qolgan bo'lsa startup'da avtomatik tashlanadi (pastga qarang).
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  // O'quvchi rasmi o'quv markaz (Client) darajasida
  // (API_CONTRACT_student_photo_per_client.md): har client uchun ko'pi bilan
  // bitta element. Bir xil `path` bir nechta element/hujjatda bo'lishi mumkin
  // (qo'shishda nusxa) — fayl ref-count bo'yicha o'chiriladi. Eski `photo`
  // maydoni scripts/migrate-student-photos.js orqali ko'chirilgan.
  photos: {
    type: [
      new Schema(
        {
          client: { type: Schema.Types.ObjectId, ref: "Client", required: true },
          path: { type: String, default: "" },
          updatedAt: { type: Number, default: 0 },
        },
        { _id: false },
      ),
    ],
    default: [],
  },
  // Ota-ona raqami — Telegram botda `request_contact` raqami bilan AYNAN
  // taqqoslanadi, shuning uchun yozishda normalizatsiya (`+998XXXXXXXXX`)
  // va indeks (`{ parentPhone: 1 }`, pastda). Bir raqam bir nechta bolada
  // bo'lishi normal (aka-uka) — unique EMAS.
  parentPhone: {
    type: String,
    default: "",
    trim: true,
    set: (v) => normalizePhone(v),
  },
  // TELEGRAM raqamlari (API_CONTRACT_telegram_phone.md §1). Bot va barcha
  // Telegram mosliklari FAQAT shu maydonlar bo'yicha ishlaydi. Invariant:
  // `*TelegramPhone` doim SAMARALI qiymat — `*Same === true` bo'lsa telefondan
  // hisoblangan, aks holda foydalanuvchi kiritgan (bo'sh = botga ulanmaydi).
  // Faqat `utils/telegramPhone.util.applyTelegramFields` orqali yoziladi.
  telegramSame: { type: Boolean, default: true },
  telegramPhone: { type: String, default: "", trim: true, set: setTelegramPhone },
  parentTelegramSame: { type: Boolean, default: true },
  parentTelegramPhone: { type: String, default: "", trim: true, set: setTelegramPhone },
  // QR davomat uchun doimiy maxfiy token (`attendance.qr` tarif flagi ostida).
  // O'quvchi hujjatiga bir marta beriladi va o'zgarmaydi — chop etilgan karta
  // yoki telefondagi rasm uzoq muddat ishlashi kerak. Tanlangan bo'lsa, qo'lda
  // reset qilinadi (yangi token eskisini bekor qiladi). `sparse` — eski
  // hujjatlarda token yo'q (null), unique index ularni to'qnashtirmasligi uchun.
  // `sparse` EMAS, `partialFilterExpression` — sparse faqat maydon
  // UMUMAN YO'Q hujjatlarni chetlab o'tadi, `default: null` esa maydonni
  // aniq `null` qiymat bilan yozadi, natijada ikkinchi o'quvchi
  // yaratilganda "duplicate key: qrToken: null" xatosi chiqardi.
  // Partial index faqat STRING qiymatlarni indekslaydi, tokensiz
  // o'quvchilar qancha bo'lsa ham to'qnashmaydi (Client.phone bilan
  // bir xil naqsh).
  qrToken: {
    type: String,
    default: null,
    index: {
      unique: true,
      partialFilterExpression: { qrToken: { $type: "string" } },
    },
  },
  groups: {
    type: [groupEntrySchema],
    default: [],
  },
  // HUJJAT darajasi — FAQAT shu import YARATGAN hujjatda to'ladi (mavjud
  // o'quvchi yangi guruhga import orqali qo'shilsa bu maydon TEGILMAYDI,
  // faqat groupEntrySchema.importBatch to'ladi). Bekor qilishda batch
  // qo'shgan a'zolik(lar) `$pull` qilingandan keyin, shu maydon bo'yicha
  // "endi guruhi bo'shab qolgan" hujjatlar topilib arxivlanadi.
  importBatch: { type: Schema.Types.ObjectId, ref: "ImportBatch", default: null, index: true },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Number,
    default: null,
  },
  createdAt: {
    type: Number,
    default: getNow,
  },
  updatedAt: {
    type: Number,
    default: getNow,
  },
});

schema.pre("save", async function () {
  this.updatedAt = getNow();
  // Xavfsizlik to'ri: invariant asosan `applyTelegramFields` orqali yoziladi,
  // lekin seed/skript kabi boshqa yo'llarda ham `*Same === true` bo'lsa
  // Telegram raqami telefon bilan sinxron qoladi (API_CONTRACT_telegram_phone.md §1).
  if (this.telegramSame !== false) this.telegramPhone = normalizeTelegramPhone(this.phone) || "";
  if (this.parentTelegramSame !== false) {
    this.parentTelegramPhone = normalizeTelegramPhone(this.parentPhone) || "";
  }
});

schema.virtual("date").get(function () {
  return formatDate(this.createdAt);
});

schema.virtual("lastUpdate").get(function () {
  return formatDate(this.updatedAt);
});

// Tenant izolyatsiyasi indekslari. Shared Database'da INDEKSSIZ har so'rov
// COLLSCAN bo'ladi — ya'ni bir markazning so'rovi qolgan BARCHA markazlarning
// hujjatlarini ham skanerlaydi va sekinlashuv butun platforma hajmiga
// bog'lanadi (API_CONTRACT_performance.md §1).
schema.index({ "groups.client": 1, "groups.center": 1 });
schema.index({ "groups.group": 1, "groups.status": 1 });
schema.index({ isDeleted: 1 });
// Rasm fayli ref-count so'rovi (`Student.exists({ "photos.path": p })`).
schema.index({ "photos.path": 1 });
// Ota-ona botda raqam bo'yicha farzandlarini topadi (bo'sh satr ko'p — partial).
schema.index({ parentPhone: 1 }, { partialFilterExpression: { parentPhone: { $gt: "" } } });
// Telegram mosligi (bot, bildirishnomalar, badge) — shu ikki maydon bo'yicha.
schema.index({ telegramPhone: 1 }, { partialFilterExpression: { telegramPhone: { $gt: "" } } });
schema.index({ parentTelegramPhone: 1 }, { partialFilterExpression: { parentTelegramPhone: { $gt: "" } } });
// To'lov tekshirish kodi bo'yicha tez qidiruv. UNIQUE EMAS: massiv maydonda
// partialFilterExpression butun HUJJATga qo'llanadi — o'quvchida bitta kodli
// to'lov bo'lsa, uning kodsiz eski to'lovlari (`code: null`) ham indekslanadi
// va ikkinchi shunday o'quvchida "E11000 dup key: { code: null }" beradi
// (prod'da indeks build yiqildi). Unikallik `generateUniqueShortCode` ichidagi
// `Student.exists` tekshiruvi bilan ta'minlanadi.
schema.index({ "groups.payments.code": 1 });

const StudentModel = model("Student", schema);

// Bir marta ishga tushirilishi kerak bo'lgan migratsiya: eski unique `phone_1`
// indeksi Mongo'da hali qolgan bo'lishi mumkin (bu deploy'gacha `unique: true`
// bo'lgan). Mongoose `autoIndex` odatda yangi indekslarni qo'shadi, lekin
// ESKI unique indeksni o'zi olib tashlamaydi — shu sabab bu yerda startup'da
// bir marta tekshirib, topilsa, tashlab yuboriladi. Xatolik (masalan indeks
// allaqachon yo'q) e'tiborsiz qoldiriladi — server ishga tushishini to'xtatmaydi.
StudentModel.on("index", async () => {
  try {
    const indexes = await StudentModel.collection.indexes();
    const staleUniquePhoneIndex = indexes.find((idx) => idx.key?.phone === 1 && idx.unique);
    if (staleUniquePhoneIndex) {
      await StudentModel.collection.dropIndex(staleUniquePhoneIndex.name);
    }
  } catch {
    // Indeks topilmadi yoki collection hali yaratilmagan — muammo emas.
  }
});

module.exports = StudentModel;
