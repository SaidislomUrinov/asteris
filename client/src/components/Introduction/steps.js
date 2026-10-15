// Interactive Introduction — step ro'yxati (docs/API_CONTRACT_floating_video_lessons.md § 4.2).
// `target` funksiya — chaqirilgan paytdagi viewport holatiga qarab (masalan
// mobil/desktop) to'g'ri CSS selectorni qaytaradi.
// `preview` — tooltip ichida "?" menyusining kichik namunasi va shu bosqichga
// tegishli band ajratib ko'rsatiladi (Video va Chat menyu ICHIDA — haqiqiy
// menyuni tur paytida ochib bo'lmaydi, overlay uni yopib qo'yadi).
// Telefonda (<640px) "?" menyusi yo'q — Video va Chat Top'dagi 4 kvadratli
// menyu ichida (components/TopMobileMenu.jsx). Top.jsx bilan bir xil chegara.
export const isPhoneIntro = () => window.innerWidth < 640;
const helpTarget = () => (isPhoneIntro() ? '[data-intro="top-menu"]' : '[data-intro="help"]');

export const INTRO_STEPS = [
  {
    id: "navbar",
    // Mobilda sidebar yopiq (drawer) — to'g'ridan-to'g'ri ko'rsatib
    // bo'lmaydi, shuning uchun hamburger tugmasi nishonlanadi.
    target: () => (window.innerWidth < 1024 ? '[data-intro="navbar-toggle"]' : '[data-intro="navbar"]'),
    titleKey: "introduction.navbar.title",
    descriptionKey: "introduction.navbar.description",
  },
  {
    id: "video",
    target: helpTarget,
    titleKey: "introduction.video.title",
    descriptionKey: () => (isPhoneIntro() ? "introduction.video.descriptionMobile" : "introduction.video.description"),
    preview: "video",
  },
  {
    id: "chat",
    target: helpTarget,
    titleKey: "introduction.chat.title",
    descriptionKey: () => (isPhoneIntro() ? "introduction.chat.descriptionMobile" : "introduction.chat.description"),
    preview: "chat",
  },
];

// Tur dizayn o'zgarganda qayta ko'rsatiladi: server `introSeen` bayrog'i
// eski turni ko'rganlarda ham `true`, shuning uchun versiya shu brauzerda
// alohida saqlanadi (2 — 2026-10-08 menyu soddalashtirilgan dizayn).
// 3 — 2026-10-10: "Sahifa qo'llanmasi" olib tashlandi, "Joriy sahifa videosi"
// + "Video qo'llanmalar" sahifasi qo'shildi.
// 4 — 2026-10-16: mobil Top'da "?" o'rniga 4 kvadratli menyu (Video/Chat shu yerda).
export const INTRO_VERSION = 4;
export const INTRO_VERSION_KEY = "wenet:introVersion";

export const readIntroVersion = () => {
  try {
    return Number(localStorage.getItem(INTRO_VERSION_KEY)) || 0;
  } catch {
    return INTRO_VERSION; // saqlab bo'lmasa — qayta-qayta ko'rsatmaymiz
  }
};

export const markIntroVersionSeen = () => {
  try {
    localStorage.setItem(INTRO_VERSION_KEY, String(INTRO_VERSION));
  } catch {
    // private rejim — keyingi sessiyada yana ko'rinishi mumkin, zararsiz
  }
};
