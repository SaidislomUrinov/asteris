// Interactive Introduction — step ro'yxati (docs/API_CONTRACT_floating_video_lessons.md § 4.2).
// `target` funksiya — chaqirilgan paytdagi viewport holatiga qarab (masalan
// mobil/desktop) to'g'ri CSS selectorni qaytaradi.
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
    id: "notifications",
    target: () => '[data-intro="notifications"]',
    titleKey: "introduction.notifications.title",
    descriptionKey: "introduction.notifications.description",
  },
  {
    id: "help",
    target: () => '[data-intro="help"]',
    titleKey: "introduction.help.title",
    descriptionKey: "introduction.help.description",
  },
];
