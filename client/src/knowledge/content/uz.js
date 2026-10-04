// Bilimlar bazasi — O'zbekcha (lotin). Format: knowledge/index.js.
// Boshqa tillar (uzc/ru/en) shu fayl tuzilishini aynan takrorlaydi.
export default {
  dashboard: {
    summary: "Markazning oylik holati bir qarashda: tushum, xarajat, oyliklar, qarzdorlik va bugungi darslar.",
    blocks: [
      { type: "h", text: "Asosiy kartalar" },
      {
        type: "ul",
        items: [
          "**Oylik tushum** va **Oylik xarajat** — tanlangan oy bo'yicha.",
          "**O'qituvchi oyliklari** — shu oy uchun hisoblangan jami oylik.",
          "**Qarzdorlik** — faqat joriy to'lov sikli bo'yicha qarz. To'liq qarz tarixini [[Hisobotlar]] → Qarzdorlar tabida ko'ring.",
          "Kichik hisoblagichlar: faol o'quvchilar, faol va yig'ilayotgan guruhlar, hodimlar, xonalar, fanlar.",
        ],
      },
      {
        type: "p",
        text: "Yuqorida oyni va (bir nechta filial bo'lsa) filialni tanlang. Grafiklar to'lov holati, so'nggi 30 kunlik tushum dinamikasi va xarajatlar tarkibini ko'rsatadi. **Tushumlar — kim qabul qildi** blokidagi [[Hammasi]] havolasi Tushumlar sahifasini ochadi.",
      },
      {
        type: "p",
        text: "**Bugungi darslar** tasmasida har dars holati bilan ko'rinadi: Bo'lyapti, Tugagan yoki Kutilmoqda. Kartani bossangiz, guruh sahifasi ochiladi.",
      },
      {
        type: "tip",
        text: "Mijoz yoningizda o'tirgan bo'lsa yoki ekran proyektorda bo'lsa, ko'z belgili tugma bilan barcha summalarni yashiring — tanlov shu brauzerda eslab qolinadi.",
      },
      {
        type: "p",
        text: "Ma'lumotlar to'lov, xarajat, davomat yoki arxivlashdan so'ng bir necha soniyada o'zi yangilanadi — sahifani yangilash shart emas.",
      },
    ],
  },

  "dashboard.teacher": {
    summary: "Bugungi darslaringiz, guruhlaringiz va oyligingiz bitta sahifada.",
    blocks: [
      { type: "h", text: "Yuqoridagi kartalar" },
      {
        type: "ul",
        items: [
          "**Qolgan oylik** — shu oy uchun sizga hali beriladigan summa.",
          "**Bugungi darslar** — hozir dars bo'layotgani yoki keyingisi qachonligi.",
          "**Faol guruhlar**, **O'quvchilarim** va **Xonalarim**.",
        ],
      },
      {
        type: "p",
        text: "**Bugungi darslar** ro'yxatidan darsni bossangiz, guruh sahifasi ochiladi. **Mening guruhlarim** blokida [[Barchasini ko'rish]] bilan barcha guruhlaringizni oching.",
      },
      {
        type: "p",
        text: "**Ish haqi** panelida oyni tanlab hisoblangan oylik, bonus, avans, oldindan olingan va jarimani ko'rasiz. Pastda — tranzaksiyalar tarixi.",
      },
      {
        type: "tip",
        text: "Dars boshlanganda chap menyudagi [[Dars]] bo'limi o'sha darsni avtomatik ochadi — davomat va baholarni shu yerdan qo'ying.",
      },
      {
        type: "p",
        text: "**O'quvchilar boti** havolasini bir bosishda nusxalab, o'quvchilaringizga yuboring.",
      },
    ],
  },

  "dashboard.reception": {
    summary: "Kunlik ish uchun: bugungi darslar, qarzdor o'quvchilar va tezkor amallar.",
    blocks: [
      {
        type: "ul",
        items: [
          "Kartalar: **Faol o'quvchilar**, **Bugungi darslar**, **Qarzdor o'quvchilar** va **Oylik tushum**.",
          "**Bugungi darslar** — fan, o'qituvchi, xona, vaqt va holat. Qatorni bossangiz, guruh ochiladi.",
          "**Qarzdor o'quvchilar** — eng ko'p qarzi bor 5 kishi. [[Hammasini ko'rish]] O'quvchilar sahifasini qarzdorlar filtri bilan ochadi.",
          "**Tezkor amallar** — O'quvchilar, Guruhlar va Davomatga bir bosishda o'tish.",
        ],
      },
      {
        type: "tip",
        text: "Kun davomida qarzdorlar ro'yxatidan qo'ng'iroq qilish uchun foydalaning: o'quvchini bosing va uning sahifasidan to'lovni qabul qiling.",
      },
      {
        type: "p",
        text: "Biror blokda **Ko'rish uchun ruxsatingiz yo'q** yozuvi chiqsa, rahbariyatdan kerakli ruxsatni so'rang.",
      },
    ],
  },

  centers: {
    summary: "Filiallaringiz ro'yxati, har bir filial statistikasi va sozlamalari.",
    blocks: [
      { type: "h", text: "Filial qo'shish" },
      {
        type: "steps",
        items: [
          "[[Filial qo'shish]] tugmasini bosing.",
          "**Filial nomi**ni kiriting (majburiy), kerak bo'lsa shior va logotip qo'shing.",
          "Saqlang. Tarifingizdagi filial limiti tugagan bo'lsa, yangi filial qo'shib bo'lmaydi.",
        ],
      },
      { type: "h", text: "Filial sahifasi" },
      {
        type: "p",
        text: "Kartadagi [[Batafsil]] filial sahifasini ochadi: xonalar, fanlar, faol o'quvchilar, hodimlar, oylik tushum/xarajat, grafiklar va so'nggi to'lovlar.",
      },
      { type: "h", text: "Filial sozlamalari (⚙️)" },
      {
        type: "ul",
        items: [
          "**Guruh to'lov sikli** — **Sanadan-sanaga** (guruh boshlangan sanadan har oy) yoki **Oy boshidan oy boshiga** (har oyning 1-sanasi, birinchi oy qisman hisoblanadi).",
          "**Davomat sozlamalari** — o'quvchi kelmagan kun to'lovini keyingi oyga o'tkazish (sababli / sababsiz / 3 ta ketma-ket kelmaganda).",
          "**O'qituvchi maoshi** — o'quvchi kelmagan kun uchun o'qituvchi oyligidan ushlab qolish.",
          "**Kechikish (daqiqa)** — QR davomatda dars boshlanganidan necha daqiqadan keyin kechikkan hisoblanishi (0 — o'chiq).",
          "**Ota-ona xabarlari** — davomat, dars tugashi, to'lov va qarzdorlik eslatmalari Telegramga; tinch soatlarni ham belgilang.",
        ],
      },
      {
        type: "warn",
        text: "Filialni o'chirish **arxivga tushmaydi** va orqaga qaytarib bo'lmaydi. Tarif limiti sababli bloklangan filial ma'lumotlari saqlanadi — tarif ruxsat bersa [[Qayta yoqish]] bilan faollashtiring.",
      },
    ],
  },

  staff: {
    summary: "Resepshin, o'qituvchi va yordamchi o'qituvchilarni qo'shish, ruxsat va oylik belgilash.",
    blocks: [
      { type: "h", text: "Hodim qo'shish" },
      {
        type: "steps",
        items: [
          "[[Hodim qo'shish]] tugmasini bosing.",
          "**F.I.Sh.**, **Login**, **Parol**, **Filial** va **Lavozim**ni kiriting (Resepshin / O'qituvchi / Yordamchi o'qituvchi).",
          "O'qituvchi uchun u dars beradigan **Fanlar**ni belgilang — u faqat shu fanlar guruhlariga biriktiriladi.",
          "**Oylik hisoblash turi**ni tanlang: **Foizli** (o'quvchi to'lovlaridan %) yoki **Qat'iy** (belgilangan summa).",
          "**Ruxsatlar** bo'limida hodim nimalarni ko'ra va qila olishini belgilang, so'ng saqlang.",
        ],
      },
      {
        type: "tip",
        text: "Saqlangandan so'ng kirish ma'lumotlari PDF bo'lib avtomatik yuklab olinadi va [[Nusxalash]] tugmasi bilan ham olish mumkin — hodimga shu ma'lumotni bering.",
      },
      {
        type: "ul",
        items: [
          "Resepshinga **Cheksiz** ruxsat berish mumkin. O'qituvchiga faqat dars bilan bog'liq ruxsatlar beriladi — to'lov, oylik va xarajat ruxsatlari yo'q.",
          "Tahrirlashda parolni bo'sh qoldirsangiz, u o'zgarmaydi.",
          "[[Bloklash]] — hodim vaqtincha tizimga kira olmaydi; [[Blokdan chiqarish]] bilan qaytariladi.",
        ],
      },
      { type: "h", text: "Hodim sahifasi" },
      {
        type: "p",
        text: "[[Batafsil]] ochilganda hodimning guruhlari, oylik hisobi (hisoblangan, avans, oldindan olingan, bonus, jarima, qolgan) va o'qituvchi bo'lsa — samaradorligi ko'rinadi. [[To'lov/Jarima]] bilan shu yerdan pul berish mumkin.",
      },
      {
        type: "warn",
        text: "[[Arxivlash]] qilingan hodim tizimga kira olmaydi, lekin ish haqi tarixi saqlanadi va uni Arxiv bo'limidan qaytarish mumkin.",
      },
    ],
  },

  subjects: {
    summary: "Markazda o'tiladigan fanlar, ularning standart narxi va davomiyligi.",
    blocks: [
      { type: "h", text: "Fan qo'shish" },
      {
        type: "steps",
        items: [
          "[[Fan qo'shish]] tugmasini bosing.",
          "**Fan nomi**, **Standart narx** (oylik) va **Davomiyligi (oy)** ni kiriting. Bir nechta filial bo'lsa filialni ham tanlang.",
          "Saqlang.",
        ],
      },
      {
        type: "p",
        text: "**Standart narx** shu fandagi guruhning oylik to'lovi va o'quvchi qo'shilganda avtomatik narx bo'ladi. Kerak bo'lsa, narxni har bir o'quvchi uchun alohida o'zgartirish mumkin.",
      },
      {
        type: "tip",
        text: "[[Nusxalash]] o'xshash fanni tez yaratish uchun to'ldirilgan nusxani ochadi. O'qituvchilar faqat o'z profilida belgilangan fanlar guruhlariga tanlanadi.",
      },
      {
        type: "p",
        text: "[[Arxivlash]] qilingan fan mavjud guruhlarga ta'sir qilmaydi va Arxiv bo'limidan qaytariladi.",
      },
    ],
  },

  rooms: {
    summary: "Xonalar bandligi jonli ko'rinishda va har xonaning haftalik jadvali.",
    blocks: [
      {
        type: "p",
        text: "Har xona kartasida holat ko'rinadi: **Dars ketyapti**, **Yaqin orada** (60 daqiqa ichida dars bor), **Bo'sh** yoki **Nofaol**. Band xonalar tepada turadi.",
      },
      {
        type: "p",
        text: "[[Xona qo'shish]] — filial va **Xona nomi** majburiy, **Sig'imi** ixtiyoriy.",
      },
      { type: "h", text: "Xona sahifasi va jadval" },
      {
        type: "ul",
        items: [
          "**Haftalik jadval**: ustunlar — kunlar, qatorlar — soatlar. Blokni bossangiz, guruh ochiladi.",
          "Blokni tepaga-pastga sursangiz vaqt, yon tomonga sursangiz kun o'zgaradi; chetidan cho'zib davomiylikni o'zgartiring. O'zgarish darhol saqlanadi.",
          "Vaqt boshqa guruh bilan to'qnashsa, xabar chiqadi va o'zgarish bekor qilinadi.",
          "**Jadval belgilanmagan guruhlar** — kun yoki vaqti yo'q guruhlar; ular jadvalda ko'rinmaydi.",
          "[[Guruh qo'shish]] shu xona tanlangan holda yangi guruh ochadi.",
        ],
      },
      {
        type: "tip",
        text: "Bir nechta xonani birga rejalashtirish uchun [[Jadvalni tahrirlash]] tugmasi bilan Jadval sahifasiga o'ting.",
      },
    ],
  },

  groups: {
    summary: "Guruhlarni ochish, faollashtirish, o'quvchilar, davomat, baho, uyga vazifa va kurs dasturi.",
    blocks: [
      { type: "h", text: "Guruh hayoti" },
      {
        type: "steps",
        items: [
          "[[Guruh qo'shish]] — filial va fan majburiy. Yangi guruh **Yig'ilmoqda** holatida bo'ladi: o'quvchi yig'asiz, lekin to'lov hali hisoblanmaydi.",
          "Yetarli o'quvchi yig'ilgach, [[Faollashtirish]] ni bosing: o'qituvchi, xona, kunlar, vaqt va **Boshlanish sanasi** majburiy. Darslar va oylik to'lov shu sanadan hisoblanadi.",
          "Kurs tugaganda [[Guruhni yakunlash]] — guruh **Tugagan** bo'ladi, jadvali o'zgarmaydi.",
        ],
      },
      { type: "h", text: "Guruh sahifasi" },
      {
        type: "ul",
        items: [
          "**Statistika** — tushum, to'lov holati, dars kunlari kalendari va umumiy davomat.",
          "**Umumiy** — o'quvchilar ro'yxati, to'lov holati va davomat. Qator menyusidan to'lov qo'shish, qo'ng'iroq, boshqa guruhga o'tkazish, guruhdan chiqarish, arxivlash yoki o'quvchining **Yutuqlar**ini (nishon va medallar) ko'rish.",
          "**Davomat** — oylik jadval: katakchani bosib **Keldi / Kelmadi / Sababli** belgilang.",
          "**Baholar** — 1 dan 10 gacha baho; kelmagan o'quvchiga va kelajak sanaga baho qo'yilmaydi.",
          "**Uyga vazifa** — har dars kuni uchun vazifa; [[Dasturdan olish]] bilan kurs dasturidan to'ldiring.",
          "**Reja** — kurs dasturi (modul va mavzular). Progress faqat davomati belgilangan kunlar bo'yicha hisoblanadi.",
        ],
      },
      {
        type: "p",
        text: "Dars kunlari kalendarida kunni bosib **Dam olish kuni** belgilash mumkin: to'lov olinmasa, kun hisobdan chiqadi va narx qolgan kunlarga taqsimlanadi.",
      },
      {
        type: "tip",
        text: "[[Excel'dan import]] bilan o'quvchilarni jadvaldan nusxalab yoki .xlsx fayldan bir martada qo'shing (300 tagacha). Xato bo'lsa, 24 soat ichida [[Importni bekor qilish]] mumkin — agar hali to'lov yoki davomat kiritilmagan bo'lsa.",
      },
      {
        type: "warn",
        text: "O'qituvchi davomatni faqat bugun va kecha uchun belgilay oladi. Guruh arxivlansa, uning o'quvchilari ham birga arxivlanadi va qarzi umumiy qarzdorlikdan chiqadi.",
      },
    ],
  },

  schedule: {
    summary: "Barcha guruhlarni xonalar va vaqtlar bo'yicha haftalik jadvalga joylashtirish.",
    blocks: [
      { type: "h", text: "Guruhni joylashtirish" },
      {
        type: "steps",
        items: [
          "Chap paneldan xonani tanlang.",
          "**Joylashtirilmagan** ro'yxatidan guruhni tanlang.",
          "Jadvaldagi bo'sh joyni bosing — kunlar avtomatik to'ldiriladi (Du·Cho·Ju yoki Se·Pa·Sha).",
        ],
      },
      {
        type: "ul",
        items: [
          "Darsni jadval ichida sudrab vaqtini, boshqa xona kartasiga sudrab xonasini o'zgartiring.",
          "Qalam belgisi — kunlar va soatni tahrirlash. Savat — faqat bitta kunni olib tashlash.",
          "[[Jadvaldan olib tashlash]] — guruh butunlay **Joylashtirilmagan** ro'yxatiga qaytadi.",
          "Guruh tanlangan holda boshqa darsni bossangiz, [[Darsni almashtirish]] taklif qilinadi.",
        ],
      },
      {
        type: "tip",
        text: "Saqlash tugmasi yo'q — har o'zgarish avtomatik saqlanadi. Xato bo'lsa, [[Ortga qaytarish (Ctrl+Z)]] bilan oxirgi amalni bekor qiling.",
      },
      {
        type: "warn",
        text: "[[Qayta tartiblash]] joriy filialdagi **barcha** guruhlarning kun, vaqt va xonasini tozalaydi va darhol saqlanadi. Faqat jadvalni noldan tuzmoqchi bo'lsangiz ishlating.",
      },
      {
        type: "p",
        text: "Telefon va planshetda jadval faqat ko'rish uchun — tahrirlash kompyuterda qilinadi.",
      },
    ],
  },

  calendar: {
    summary: "Filial bo'yicha oylik dars kalendari va dam olish kunlarini belgilash.",
    blocks: [
      {
        type: "p",
        text: "Har kunda o'sha kungi darslar soni ko'rinadi. Dam olish kunlari alohida belgilanadi. O'ng tomonda oy bo'yicha xulosa: rejadagi darslar, darsli kunlar, dam olish kunlari va bekor bo'lgan darslar.",
      },
      { type: "h", text: "Dam olish kunini belgilash" },
      {
        type: "steps",
        items: [
          "Kunni bosing. Bir necha kun uchun **Shift** bosib turib oraliqni tanlang.",
          "[[Dam olish qilish]] tugmasini bosing va kerak bo'lsa sababini yozing (masalan, bayram).",
          "Tasdiqlang.",
        ],
      },
      {
        type: "warn",
        text: "Dam olish kuni filialdagi **barcha guruhlar** uchun amal qiladi: o'sha kuni dars, davomat va reja bloklanadi, kun to'lovdan chiqariladi (o'quvchilarga avtomatik chegirma).",
      },
      {
        type: "p",
        text: "Xato belgilangan kunni ro'yxatdan olib tashlang yoki bir nechtasini tanlab [[Tanlanganlarni olib tashlash]] ni bosing. Bitta guruh uchun dam olish kuni esa guruh sahifasidagi kalendardan belgilanadi.",
      },
    ],
  },

  lesson: {
    summary: "Hozir bo'layotgan darsingiz — davomat, baho va uyga vazifa bir joyda.",
    blocks: [
      {
        type: "p",
        text: "Dars boshlanishi bilan shu sahifa o'sha guruhni avtomatik ko'rsatadi. Dars bo'lmasa, **Hozirda dars bo'lmayabdi** yozuvi chiqadi.",
      },
      { type: "h", text: "Dars davomida" },
      {
        type: "steps",
        items: [
          "**Davomat** tabida har o'quvchi uchun **Keldi**, **Kelmadi** yoki **Sababli** ni belgilang.",
          "**Baholar** tabida kelgan o'quvchilarga 1–10 baho qo'ying.",
          "**Uyga vazifa** tabida vazifani yozing yoki [[Dasturdan olish]] ni bosing.",
        ],
      },
      {
        type: "p",
        text: "Yuqoridagi **Bugungi dars** kartasi kurs dasturidagi bugungi mavzuni ko'rsatadi. **Reja** tabini bu yerda faqat ko'rish mumkin.",
      },
      {
        type: "warn",
        text: "Davomatni faqat bugun va kecha uchun belgilash mumkin — darsdan keyin kechiktirmang, chunki o'quvchi to'lovi va oylik hisobi davomatga bog'liq.",
      },
    ],
  },

  "my-plans": {
    summary: "O'zingizning shablon dars rejalaringiz — bir marta tuzing, so'ng istalgan guruhingizga nusxa qilib oling.",
    blocks: [
      {
        type: "h",
        text: "Reja tuzish"
      },
      {
        type: "steps",
        items: [
          "[[Yangi reja]] tugmasini bosing: **Reja nomi** (masalan, Beginner yoki IELTS) va **Fan**ni tanlang — ro'yxatda faqat sizga biriktirilgan fanlar chiqadi.",
          "Reja sahifasida [[Modul]] qo'shing, so'ng har modulga [[Mavzu qo'shish]] bilan darslarni kiriting. Kerak bo'lsa **Uy vazifasi**ni ham yozing.",
          "Mavzularni yuqoriga/pastga surib tartiblang. Saqlash tugmasi yo'q — har o'zgarish darhol saqlanadi."
        ]
      },
      {
        type: "h",
        text: "Guruhga olish"
      },
      {
        type: "p",
        text: "Guruh sahifasidagi **Reja** tabida [[Import (nusxa)]] ni bosing, **O'qituvchilar rejalari** dan rejani tanlang va **Hozir qaysi darsdamiz?** savoliga javob bering. Guruhga rejaning **nusxasi** tushadi — keyin rejani tahrirlasangiz, guruh dasturi o'zgarmaydi."
      },
      {
        type: "tip",
        text: "[[Nusxa olish]] o'xshash rejani (masalan, boshqa daraja uchun) tez tuzishga yordam beradi. Bitta fan bo'yicha bir nechta reja bo'lishi mumkin."
      },
      {
        type: "warn",
        text: "[[Rejani arxivlash]] guruhlarga avval import qilingan dasturlarga ta'sir qilmaydi. Arxivlangan rejani boshliq Arxiv bo'limidan qaytara oladi."
      }
    ]
  },

  students: {
    summary: "Barcha o'quvchilar, ularning guruhlari, to'lovlari va qarzdorligi.",
    blocks: [
      { type: "h", text: "O'quvchi qo'shish" },
      {
        type: "steps",
        items: [
          "[[O'quvchi qo'shish]] tugmasini bosing.",
          "Filial, guruh va **Telefon raqami**ni kiriting (majburiy), so'ng ism va ota-ona raqamini.",
          "Raqam tizimda allaqachon bo'lsa, forma o'sha o'quvchini taklif qiladi — yangisini ochmang, mavjudini tanlang.",
          "**Narxi** fan narxidan olinadi, kerak bo'lsa o'zgartiring. Oldingi qarzi yoki avansi bo'lsa, **Oldingi qarzdorlik** bo'limida oylar bo'yicha kiriting.",
        ],
      },
      { type: "h", text: "To'lov qabul qilish" },
      {
        type: "steps",
        items: [
          "Qatordagi 💵 tugmasini bosing (bir nechta guruh bo'lsa, guruhni tanlang).",
          "Summa avtomatik qarz bilan to'ldiriladi. To'lov turini (Naqd / Karta / Aralash) va **Qaysi oy uchun**ni tanlang.",
          "Saqlang va kerak bo'lsa [[Chekni yuklash]] bilan QR kodli chekni oling.",
        ],
      },
      {
        type: "ul",
        items: [
          "Qarzdorlik, filial, guruh va holat bo'yicha filtrlang. Qidiruvga matn yozilsa, boshqa filtrlar e'tiborga olinmaydi.",
          "Telefon yonidagi belgilar o'quvchi va ota-onaning Telegram botga ulangan-ulanmaganini ko'rsatadi.",
          "Qarz = o'tgan barcha to'lanmagan oylar + joriy oy. Yig'ilayotgan guruhda qarz hisoblanmaydi.",
        ],
      },
      { type: "h", text: "O'quvchi sahifasi" },
      {
        type: "p",
        text: "Har guruh a'zoligi alohida kartada: shu oy to'lovi, umumiy qarz (oylar kesimida), baholar. [[To'lovlarni ko'rish]] da chekni yuklash, to'lov oyini o'zgartirish yoki to'lovni bekor qilish mumkin.",
      },
      {
        type: "warn",
        text: "[[Arxivlash]] faqat bitta guruhdagi a'zolikka tegishli — o'quvchi boshqa guruhlarida o'qishda davom etadi. To'lovlar o'chirilmaydi: bekor qilingan to'lov tarixda qoladi va summa qarzga qaytadi.",
      },
      {
        type: "tip",
        text: "QR karta yo'qolsa, [[QR karta]] → [[Yangilash]] bilan yangisini chiqaring. Excel'dan import esa guruh sahifasida.",
      },
    ],
  },

  leads: {
    summary: "Kursga qiziqqan potentsial o'quvchilar va ularni guruhga qo'shish.",
    blocks: [
      { type: "h", text: "Lid qo'shish" },
      {
        type: "p",
        text: "[[Lid qo'shish]] — **Ism familiya**, **Telefon**, **Filial** va **Fan** majburiy. Qulay kunlar va vaqt, daraja/yosh, qayerdan eshitgani va izohni ham yozing — bu keyin guruh tuzishda yordam beradi.",
      },
      {
        type: "p",
        text: "Yuqoridagi chiplar har fan bo'yicha nechta lid kutayotganini ko'rsatadi — chipni bossangiz, shu fan bo'yicha filtrlanadi.",
      },
      { type: "h", text: "Holatlar" },
      {
        type: "ul",
        items: [
          "**Yangi** → **Bog'lanildi** (qo'ng'iroq qilingach) → **Guruhga qo'shildi** yoki **Rad etdi**.",
          "Standart filtr **Kutayotganlar** — hali guruhga qo'shilmagan va rad etmaganlar.",
          "Rad etgan lidni [[Qayta ochish]] bilan qaytarish mumkin.",
        ],
      },
      { type: "h", text: "Guruhga qo'shish" },
      {
        type: "steps",
        items: [
          "Bir fan va bir filialdagi lidlarni belgilang.",
          "**Yangi guruh** (o'qituvchi, xona, vaqt va boshlanish sanasi — guruh darhol faollashadi) yoki **Mavjud guruhga** ni tanlang.",
          "Tasdiqlang — lidlar o'quvchiga aylanadi va guruh sahifasi ochiladi.",
        ],
      },
      {
        type: "tip",
        text: "Yangi guruh kunlari lidlarning qulay kunlaridan avtomatik to'ldiriladi. Guruhga qo'shilgan lidni boshqa tahrirlab bo'lmaydi.",
      },
    ],
  },

  "qr-attendance": {
    summary:
      "O'quvchi o'zining doimiy QR kartasini ko'rsatadi — davomat avtomatik belgilanadi.",
    blocks: [
      { type: "h", text: "Qanday ishlaydi" },
      {
        type: "steps",
        items: [
          "[[Skanerni yoqish]] tugmasini bosing va brauzerga kameradan foydalanishga ruxsat bering.",
          "O'quvchi QR kartasini kameraga yaqinlashtiradi.",
          "Ekranda natija chiqadi: **Davomat belgilandi**, **Kelgan (kechikkan)** yoki **Allaqachon belgilangan**.",
          "O'quvchining bugun bir nechta guruhda darsi bo'lsa, [[Guruhni tanlang]] oynasida kerakli guruhni tanlang.",
        ],
      },
      { type: "h", text: "Ekrandagi ma'lumotlar" },
      {
        type: "ul",
        items: [
          "Yuqoridagi kartalar — shu seansdagi skanlar: **Jami skan**, **Kelgan**, **Kechikkan**, **Xato**.",
          "[[Bugungi skanlar]] tasmasida oxirgi 20 ta skan: ism, fan, vaqt va usul (Kamera yoki Skayner).",
          "Kechikish, dars kuni va guruh a'zoligini tizim o'zi tekshiradi.",
        ],
      },
      {
        type: "tip",
        text: "USB yoki Bluetooth **barcode skaner** istalgan sahifada ishlaydi — bu sahifani ochiq tutish shart emas. Natija ekran burchagida xabar bo'lib chiqadi.",
      },
      {
        type: "warn",
        text: "Karta yo'qolsa, o'quvchi yoki guruh sahifasida [[QR karta]] → [[Yangilash]] orqali yangi QR yarating. Eski chop etilgan karta shu zahoti ishlamay qoladi.",
      },
      {
        type: "p",
        text: "Bir kartani 3 soniya ichida qayta o'qitsangiz, takroriy skan hisobga olinmaydi.",
      },
    ],
  },

  salary: {
    summary:
      "Hodimlarning oylik hisobi real vaqtda: hisoblangan summa, berilganlar, bonus, jarima va qoldiq.",
    blocks: [
      { type: "h", text: "Jadvalni o'qish" },
      {
        type: "ul",
        items: [
          "**Turi** — belgilangan (qat'iy) oylik yoki foiz (masalan 10%).",
          "**Hisoblangan oylik** — joriy oy uchun hisoblangan summa. Foizli hodimda o'quvchi to'lovlariga qarab o'zgarib turadi.",
          "**Berilgan** — avans va oldindan olingan pullar yig'indisi.",
          "**Qolgan** = hisoblangan oylik − avans − oldindan olingan + bonus − jarima. Manfiy bo'lsa qizil ko'rinadi.",
        ],
      },
      {
        type: "p",
        text: "Yuqorida oyni va (bir nechta filial bo'lsa) filialni tanlang. Kelajak oyni tanlab bo'lmaydi.",
      },
      { type: "h", text: "Pul berish yoki jarima yozish" },
      {
        type: "steps",
        items: [
          "Hodim qatoridagi menyudan [[To'lov/Jarima]] ni tanlang.",
          "Tranzaksiya turini tanlang: **Avans**, **Oldindan olish**, **Bonus** yoki **Jarima**.",
          "Summani va kerak bo'lsa izohni kiriting, [[Qo'shish]] ni bosing.",
        ],
      },
      {
        type: "p",
        text: "[[Tranzaksiyalar]] menyusi hodimning shu oydagi barcha yozuvlarini ko'rsatadi. Xato yozuvni u yerdan bekor qilish mumkin.",
      },
      {
        type: "warn",
        text: "Tranzaksiyalar o'chirilmaydi — faqat bekor qilinadi va tarixda chizilgan holda qoladi. **Berilgan avansni bekor qilib bo'lmaydi**, chunki pul qo'lga berib bo'lingan.",
      },
      {
        type: "tip",
        text: "Foizli resepshin o'z filialidagi barcha to'lovlardan foiz oladi, o'qituvchi va yordamchi o'qituvchi esa faqat o'z guruhlaridan. Avans va Bonus turlari tarifingizda bo'lsa ko'rinadi.",
      },
    ],
  },

  expenses: {
    summary: "Markazning har oylik xarajatlari: ijara, kommunal, jihoz, marketing va boshqalar.",
    blocks: [
      { type: "h", text: "Xarajat qo'shish" },
      {
        type: "steps",
        items: [
          "[[Xarajat qo'shish]] tugmasini bosing.",
          "Bir nechta filial bo'lsa filialni tanlang (bitta bo'lsa avtomatik qo'yiladi).",
          "**Nomi** va **Summa**ni kiriting, kategoriyani tanlang (standart — Boshqa).",
          "[[Yaratish]] ni bosing.",
        ],
      },
      { type: "h", text: "Ko'rish va filtrlash" },
      {
        type: "ul",
        items: [
          "Oy navigatori bilan oylar orasida o'ting — standart joriy oy ko'rinadi.",
          "Qidiruv, filial va kategoriya bo'yicha filtrlang. **Jami** kartasi filtr natijasining umumiy summasini ko'rsatadi.",
          "Ro'yxatni Excel'ga yuklab olish mumkin.",
        ],
      },
      {
        type: "warn",
        text: "Xarajat o'chirilmaydi, faqat [[Bekor qilish]] mumkin. Bekor qilingan yozuv ro'yxatda chizilgan holda qoladi va uni boshqa tahrirlab bo'lmaydi.",
      },
      {
        type: "p",
        text: "Tahrirlashda filialni o'zgartirib bo'lmaydi — xato filial tanlangan bo'lsa, yozuvni bekor qilib, yangisini kiriting.",
      },
    ],
  },

  revenue: {
    summary: "Barcha qabul qilingan o'quvchi to'lovlari va har birini kim qabul qilgani.",
    blocks: [
      {
        type: "p",
        text: "Bu sahifa faqat **boshliq** uchun. Kassada to'lov qabul qilinishi bilan ro'yxat o'zi yangilanadi.",
      },
      { type: "h", text: "Nimalarni ko'rasiz" },
      {
        type: "ul",
        items: [
          "Yuqorida: **Umumiy tushum**, **Tranzaksiyalar** soni va **O'rtacha to'lov** — filtr natijasi bo'yicha.",
          "Har to'lovda: o'quvchi, filial, summa, to'lov turi, qaysi oy uchun, kim qabul qilgani va sana.",
          "O'quvchi nomini bossangiz, uning sahifasi ochiladi.",
        ],
      },
      {
        type: "p",
        text: "Sana oralig'i, filial, to'lov turi (Naqd / Karta / Aralash) va **Kim qabul qildi** bo'yicha filtrlang — masalan, kun oxirida har bir resepshin kassasini solishtirish uchun.",
      },
      {
        type: "warn",
        text: "Tushumga faqat **To'langan** holatdagi yozuvlar qo'shiladi. Bekor qilingan va qaytarilgan to'lovlar ro'yxatda chizilgan holda qoladi, lekin jamiga kirmaydi.",
      },
      {
        type: "p",
        text: "Eski to'lovlarda qabul qiluvchi ma'lumoti bo'lmasa, **Noma'lum** deb ko'rsatiladi.",
      },
    ],
  },

  reports: {
    summary:
      "Markaz moliyasi, o'quvchilar, o'qituvchilar va davomat bo'yicha tanlangan davr hisobotlari.",
    blocks: [
      { type: "h", text: "Davrni tanlash" },
      {
        type: "p",
        text: "[[Bugun]], [[Hafta]], [[Oy]] yoki [[Oraliq]] ni tanlang. Oraliqda sana oralig'ini belgilang. Filial va guruhlash (Kunlik / Haftalik / Oylik) ham tanlanadi.",
      },
      { type: "h", text: "Asosiy ko'rsatkichlar" },
      {
        type: "ul",
        items: [
          "**Tushum**, **Xarajat**, **Sof foyda** — oldingi davrga nisbatan foiz o'zgarishi bilan.",
          "**Qarzdorlik** — davrga bog'liq emas, har doim joriy holat.",
          "Yangi va chiqib ketgan o'quvchilar, faol guruhlar, davomat va tarqatilgan ish haqi.",
          "**Dinamika** grafigida tushum, xarajat va foyda chiziqlarini alohida yoqib-o'chirish mumkin.",
        ],
      },
      { type: "h", text: "Tablar" },
      {
        type: "ul",
        items: [
          "**Filiallar** — har filial bo'yicha o'quvchi, tushum, xarajat, foyda va qarz.",
          "**O'qituvchilar** — darslar, davomat, tushum va ish haqi.",
          "**Qabul qiluvchilar** — kim qancha pul yig'gani (naqd/karta). Kassa yopishda qulay.",
          "**Guruhlar** — tushum, qarz, davomat va dastur bajarilishi.",
          "**Qarzdorlar** — kim, qaysi oylar uchun va qancha qarz.",
          "**Davomat** — kelgan/kelmagan/sababli ulushlari, davomati past guruhlar va ko'p qoldiruvchilar.",
        ],
      },
      {
        type: "tip",
        text: "Har tabni Excel'ga yuklab olish mumkin. Ba'zi tablar tarifingizga qarab ko'rinadi.",
      },
    ],
  },

  "reports/teacher-performance": {
    summary: "O'qituvchilar ish unumdorligi: guruhlar, darslar, davomat, tushum va ish haqi.",
    blocks: [
      {
        type: "p",
        text: "Davrni ([[Bugun]] / [[Hafta]] / [[Oy]] / [[Oraliq]]) va filialni tanlang — jadval har bir o'qituvchi bo'yicha natijani ko'rsatadi.",
      },
      {
        type: "ul",
        items: [
          "**Guruhlar** va **O'quvchilar** — o'qituvchiga biriktirilganlar soni.",
          "**O'tilgan darslar** — davrda davomati belgilangan darslar.",
          "**Davomat** — o'quvchilar qatnashish foizi.",
          "**Tushum** va **Ish haqi** — o'qituvchi guruhlari keltirgan pul va unga hisoblangan oylik.",
        ],
      },
      {
        type: "tip",
        text: "Davomati past yoki darslari kam o'qituvchini tezda aniqlash uchun ustunlarni solishtiring. Sahifa tarifdagi **Ish unumdorligi** imkoniyati bilan ochiladi.",
      },
    ],
  },

  "audit-log": {
    summary: "Kim, qachon va nima qildi — markazdagi barcha o'zgarishlar tarixi.",
    blocks: [
      {
        type: "p",
        text: "Audit jurnali faqat **boshliq** uchun — bu ruxsatni hodimga berib bo'lmaydi. Yozuvlarni tahrirlash yoki o'chirish mumkin emas.",
      },
      { type: "h", text: "Qidirish" },
      {
        type: "ul",
        items: [
          "Filial, **Kim** (hodim), **Amal** turi (masalan, O'quvchi arxivlandi, Tarif pasaytirildi) va sana oralig'i bo'yicha filtrlang.",
          "Har qatorda: kim (Boshliq / Hodim / Admin / Tizim), amal, obyekt, filial va sana.",
        ],
      },
      { type: "h", text: "Tafsilotlar" },
      {
        type: "p",
        text: "Qatordagi tafsilot tugmasi **O'zgarish tafsiloti** oynasini ochadi: har bir maydon uchun **Oldin** va **Keyin** qiymatlari ko'rsatiladi.",
      },
      {
        type: "tip",
        text: "Yangi yozuvlar real vaqtda ro'yxat boshiga tushadi — 1-sahifada va filtrsiz holatda.",
      },
    ],
  },

  subscription: {
    summary: "Tarifingiz, qolgan kunlar, tarif imkoniyatlari va obunani uzaytirish.",
    blocks: [
      {
        type: "p",
        text: "Yuqoridagi bannerda joriy tarif, **qolgan kunlar** va tugash sanasi ko'rinadi. 2 kun yoki kamroq qolganda ogohlantirish chiqadi.",
      },
      { type: "h", text: "Obuna bo'lish yoki uzaytirish" },
      {
        type: "steps",
        items: [
          "Kerakli tarif kartasida [[Obuna bo'lish]] (joriy tarifda — [[Uzaytirish]]) tugmasini bosing.",
          "Muddatni tanlang: 1, 3, 6, 9 oy yoki 1 yil — uzoq muddatga chegirma beriladi.",
          "[[To'lovga o'tish]] ni bosing va to'lov sahifasida to'lang.",
          "Qaytganingizdan so'ng natija avtomatik tekshiriladi va tarif faollashadi.",
        ],
      },
      {
        type: "p",
        text: "Har tarif kartasida limitlar (filiallar, o'qituvchilar, resepshinlar, o'quvchilar) va **Imkoniyatlar** ro'yxati bor. Tekin sinov bo'lsa, u faqat bir marta beriladi.",
      },
      {
        type: "warn",
        text: "Obuna muddati tugasa, tizim **faqat o'qish** rejimiga o'tadi: ma'lumotlarni ko'rish mumkin, lekin qo'shish, tahrirlash va o'chirish bloklanadi. To'lovdan so'ng hammasi darhol qaytadi.",
      },
      { type: "h", text: "Tarifni pasaytirish" },
      {
        type: "p",
        text: "Yangi tarifda filial limiti kam bo'lsa, qaysi filiallar faol qolishini tanlash oynasi chiqadi. Qolganlari **bloklanadi, lekin o'chirilmaydi** — tarifni oshirsangiz qayta faollashadi.",
      },
    ],
  },

  notifications: {
    summary: "Tizim bildirishnomalari, platforma yangiliklari va Telegram orqali xabarnomalar.",
    blocks: [
      { type: "h", text: "Tablar" },
      {
        type: "ul",
        items: [
          "**Bildirishnomalar** — dars eslatmalari, obuna tugashi haqidagi ogohlantirishlar. Bosilganda o'qilgan bo'ladi; guruhga tegishlisi guruh sahifasini ochadi.",
          "**Yangiliklar** — platformadagi yangi imkoniyatlar va muhim e'lonlar.",
          "[[O'qilmagan]] filtri va [[Hammasini o'qildi]] tugmasi ro'yxatni tartibga soladi.",
        ],
      },
      { type: "h", text: "Telegramni ulash" },
      {
        type: "steps",
        items: [
          "[[Telegramni ulash]] tugmasini bosing — bot ochiladi.",
          "Telegramda **Start** ni bosing.",
          "Sahifaga qayting: holat **Ulangan** bo'ladi. Kerak bo'lsa **Xabarlar tili**ni tanlang.",
        ],
      },
      {
        type: "p",
        text: "Boshliq har kuni ertalab bugungi darslar ro'yxatini, darslardan keyin davomat va tushum hisobotini oladi. Resepshin — moliyaviy ma'lumotsiz shu hisobotni, o'qituvchi — o'z darslari va har dars boshlanishiga 1 soat qolganda eslatmani oladi.",
      },
      {
        type: "tip",
        text: "Telegram kartasi tarifingizda **Telegram xabarnomalari** bo'lsa ko'rinadi. [[Uzish]] tugmasi bilan xabarlarni to'xtatishingiz mumkin.",
      },
    ],
  },

  profile: {
    summary: "Shaxsiy ma'lumotlaringiz va parolni o'zgartirish.",
    blocks: [
      {
        type: "p",
        text: "**Shaxsiy ma'lumotlar** bo'limida ismingizni tahrirlang va [[Saqlash]] ni bosing.",
      },
      { type: "h", text: "Parolni o'zgartirish" },
      {
        type: "steps",
        items: [
          "**Joriy parol**ni kiriting.",
          "**Yangi parol**ni kiriting.",
          "[[Saqlash]] ni bosing — keyingi kirishda yangi parol ishlatiladi.",
        ],
      },
      {
        type: "warn",
        text: "Parolni almashtirish uchun ikkala maydon ham to'ldirilishi shart. Joriy parolni unutgan bo'lsangiz, qo'llab-quvvatlash chatiga yozing.",
      },
    ],
  },

  "profile.staff": {
    summary: "Shaxsiy ma'lumotlar, parol, Telegram ulash va interfeys tili.",
    blocks: [
      {
        type: "ul",
        items: [
          "**Shaxsiy ma'lumotlar** — ism va parolni o'zgartirish, so'ng [[Saqlash]].",
          "**Telegram** kartasi — botni ulash yoki uzish, xabarlar tilini tanlash (tarif ruxsat bersa).",
          "**Interfeys tili** — ilova qaysi tilda ko'rinishini tanlang.",
        ],
      },
      {
        type: "p",
        text: "Parolni almashtirish uchun joriy va yangi parolni birga kiriting.",
      },
      {
        type: "tip",
        text: "Oyligingiz va tranzaksiyalar tarixi alohida [[Moliya]] bo'limida.",
      },
    ],
  },

  finance: {
    summary: "Oyligingiz va tranzaksiyalar tarixi — faqat ko'rish uchun.",
    blocks: [
      { type: "h", text: "Oyligim" },
      {
        type: "ul",
        items: [
          "Oy navigatori bilan kerakli oyni tanlang.",
          "**Hisoblangan oylik** — shu oy uchun hisoblangan summa. Foizli bo'lsangiz, o'quvchi to'lovlari bilan real vaqtda o'zgaradi.",
          "**Bonus**, **Avans**, **Oldindan olingan** va **Jarima** alohida ko'rsatiladi.",
          "**Qolgan** — sizga hali beriladigan summa.",
        ],
      },
      { type: "h", text: "Tranzaksiyalarim" },
      {
        type: "p",
        text: "Tanlangan oydagi har bir avans, oldindan olish, bonus va jarima — summa va sanasi bilan. Bekor qilinganlari xira va chizilgan ko'rinadi.",
      },
      {
        type: "tip",
        text: "Summalarni boshqalardan yashirish uchun bosh sahifadagi ko'z belgili tugmani bosing.",
      },
      {
        type: "p",
        text: "Xato ko'rsangiz, rahbariyatga murojaat qiling — bu sahifada hech narsani o'zgartirib bo'lmaydi.",
      },
    ],
  },

  certificates: {
    summary: "Sertifikat shablonlarini yaratish va o'quvchilarga QR bilan tekshiriladigan sertifikat berish.",
    blocks: [
      { type: "h", text: "Shablon yaratish" },
      {
        type: "steps",
        items: [
          "[[Shablon yaratish]] tugmasini bosing.",
          "**Shablon nomi**ni yozing (masalan, Matematika kursi diplomi) va fon rasmini (PNG/JPG, A4 nisbatida) yuklang.",
          "[[Element qo'shish]] orqali **O'quvchi ismi**, **Fan nomi**, **Guruh nomi**, **Berilgan sana**, **QR kod** va erkin **Matn** qo'shing.",
          "Elementlarni sudrab joylashtiring, burchagidan tortib kattalashtiring; o'lcham, rang, shrift va tekislashni o'ng paneldan sozlang.",
          "Saqlang.",
        ],
      },
      {
        type: "p",
        text: "[[Ko'rib chiqish]] rejimida sertifikat qanday chiqishini tekshiring. Har filialga ko'pi bilan **10 ta** shablon yaratish mumkin.",
      },
      { type: "h", text: "Sertifikat berish" },
      {
        type: "p",
        text: "Sertifikat bu sahifada emas, **o'quvchi** yoki **guruh** sahifasida [[Sertifikat berish]] tugmasi orqali beriladi. Shablon va guruhni tanlang — PDF avtomatik yuklab olinadi. Guruhga berilsa, har bir faol o'quvchiga beriladi.",
      },
      {
        type: "tip",
        text: "Sertifikatdagi QR kodni istalgan kishi telefonida skanerlab, uning haqiqiyligini tekshira oladi — login talab qilinmaydi.",
      },
    ],
  },

  archive: {
    summary: "Arxivlangan guruhlar, o'quvchilar, hodimlar, xonalar, fanlar va dars rejalari — ko'rish va qaytarish.",
    blocks: [
      {
        type: "p",
        text: "Tizimda **o'chirish = arxivlash**: hech narsa butunlay yo'qolmaydi. Arxivlangan yozuvlar shu yerda saqlanadi va [[Qaytarish]] tugmasi bilan joyiga qaytariladi.",
      },
      { type: "h", text: "O'quvchilar qanday arxivlanadi" },
      {
        type: "ul",
        items: [
          "O'quvchi butunlay emas, **faqat bitta guruhdagi a'zoligi** arxivlanadi — boshqa guruhlarda o'qishda davom etadi.",
          "Guruh arxivlansa, uning o'quvchilari **Guruh bilan** belgisi bilan arxivga o'tadi va guruh qaytganda birga qaytadi.",
          "Qo'lda arxivlangan (**Alohida**) o'quvchilar guruh qaytganda arxivda qoladi.",
        ],
      },
      {
        type: "warn",
        text: "Guruh hali arxivda bo'lsa, undagi o'quvchini qaytarib bo'lmaydi — avval guruhni qaytaring. Guruhning eski xona yoki vaqti band bo'lib qolgan bo'lsa, yangi jadval tanlash oynasi ochiladi.",
      },
      { type: "h", text: "Qarzdorlik" },
      {
        type: "p",
        text: "**Arxivdagi qarzdorlik** kartasi arxivlangan a'zoliklar qarzini ko'rsatadi. Bu summa Dashboard va hisobotlardagi umumiy qarzdorlikka **kirmaydi**. Qabul qilingan to'lovlar esa tushumlarda o'zgarmay qoladi.",
      },
      {
        type: "tip",
        text: "Arxivlangan hodim tizimga kira olmaydi, lekin uning ish haqi tarixi saqlanadi. Hodimlar tabini faqat boshliq ko'radi.",
      },
    ],
  },
};
