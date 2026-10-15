// Telegram WebApp bilan ishlash — boot, tema, BackButton, tashqi havola.
// Brauzerda (Telegram bo'lmasa) hamma funksiya xavfsiz "no-op".

export const tg = () => window.Telegram?.WebApp || null;

const hexOk = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

export const applyTheme = () => {
  const app = tg();
  const root = document.documentElement;
  const p = app?.themeParams || {};
  const map = {
    "--tg-bg": p.secondary_bg_color || p.bg_color,
    "--tg-secondary-bg": p.secondary_bg_color ? p.bg_color : p.section_bg_color,
    "--tg-text": p.text_color,
    "--tg-hint": p.hint_color,
    "--tg-link": p.link_color,
    "--tg-button": p.button_color,
    "--tg-button-text": p.button_text_color,
    "--tg-section-sep": p.section_separator_color,
  };
  Object.entries(map).forEach(([k, v]) => {
    if (hexOk(v)) root.style.setProperty(k, v);
  });
  const dark = app?.colorScheme === "dark";
  root.setAttribute("data-theme", dark ? "dark" : "light");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", getComputedStyle(root).getPropertyValue("--tg-bg").trim());
  try {
    app?.setHeaderColor?.(dark ? "secondary_bg_color" : "bg_color");
    app?.setBackgroundColor?.(getComputedStyle(root).getPropertyValue("--tg-bg").trim());
  } catch {
    /* eski Telegram versiyalari */
  }
};

export const bootTelegram = () => {
  const app = tg();
  applyTheme();
  if (!app) return;
  try {
    app.ready();
    app.expand();
    app.onEvent?.("themeChanged", applyTheme);
    app.disableVerticalSwipes?.();
  } catch {
    /* no-op */
  }
};

export const getInitData = () => tg()?.initData || "";

// Telegram CloudStorage (Bot API 6.9+) — foydalanuvchining Telegram hisobiga
// bog'langan xotira: WebApp yopilsa ham, boshqa qurilmada ochilsa ham saqlanadi.
// Brauzerda yoki eski Telegram'da javob kelmasligi mumkin — shuning uchun
// muddat bilan: ilova hech qachon kutib osilib qolmaydi.
const cloud = () => {
  const app = tg();
  if (!app?.CloudStorage) return null;
  try {
    if (app.isVersionAtLeast && !app.isVersionAtLeast("6.9")) return null;
  } catch {
    return null;
  }
  return app.CloudStorage;
};

const withTimeout = (run, fallback, ms) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    try {
      run((value) => {
        clearTimeout(timer);
        resolve(value);
      });
    } catch {
      clearTimeout(timer);
      resolve(fallback);
    }
  });

/** @returns {Promise<string|null>} */
export const cloudGet = (key, ms = 1500) => {
  const cs = cloud();
  if (!cs) return Promise.resolve(null);
  return withTimeout((done) => cs.getItem(key, (err, value) => done(err ? null : value || null)), null, ms);
};

/** @returns {Promise<boolean>} saqlandimi */
export const cloudSet = (key, value, ms = 1500) => {
  const cs = cloud();
  if (!cs) return Promise.resolve(false);
  return withTimeout((done) => cs.setItem(key, value || "", (err, ok) => done(!err && !!ok)), false, ms);
};

let backHandler = null;
export const setBackButton = (visible, onClick) => {
  const bb = tg()?.BackButton;
  if (!bb) return;
  if (backHandler) bb.offClick(backHandler);
  backHandler = onClick || null;
  if (visible && onClick) {
    bb.onClick(onClick);
    bb.show();
  } else {
    bb.hide();
  }
};

// Hozirgi BackButton amali — ustma-ust ochiladigan ekran (masalan QR karta)
// yopilgach sahifaning o'z "orqaga" amalini qaytarish uchun.
export const getBackButtonHandler = () => backHandler;

// QR karta kabi yuqori kontrastli ekran uchun Telegram sarlavha/fonini oq
// qiladi; `applyTheme()` asl temani qaytaradi.
export const setWhiteChrome = () => {
  try {
    const app = tg();
    app?.setHeaderColor?.("#ffffff");
    app?.setBackgroundColor?.("#ffffff");
  } catch {
    /* eski Telegram versiyalari */
  }
};

export const openLink = (url) => {
  const app = tg();
  if (app?.openLink) app.openLink(url);
  else window.open(url, "_blank", "noopener");
};
export const openTelegramLink = (url) => {
  const app = tg();
  if (app?.openTelegramLink) app.openTelegramLink(url);
  else window.open(url, "_blank", "noopener");
};

export const haptic = (type = "light") => {
  try {
    const h = tg()?.HapticFeedback;
    if (!h) return;
    if (["success", "error", "warning"].includes(type)) h.notificationOccurred(type);
    else h.impactOccurred(type);
  } catch {
    /* no-op */
  }
};

export const closeApp = () => tg()?.close?.();

// ── QR skaner (WebApp API 6.4+) ──────────────────────────────────────────
// "ok" | "noTelegram" (oddiy brauzer — skript bo'lsa ham platforma
// "unknown") | "oldVersion" (Telegram ilovasi eski).
export const qrScanSupport = () => {
  const app = tg();
  if (!app || !app.platform || app.platform === "unknown") return "noTelegram";
  try {
    if (!app.isVersionAtLeast?.("6.4") || typeof app.showScanQrPopup !== "function") return "oldVersion";
  } catch {
    return "oldVersion";
  }
  return "ok";
};

// Callback `true` qaytarsa popup yopiladi, `false` — ochiq qoladi.
export const showScanQr = (text, onText) => {
  try {
    tg()?.showScanQrPopup?.({ text }, onText);
    return true;
  } catch {
    // Masalan popup allaqachon ochiq (WebAppScanQrPopupOpened).
    return false;
  }
};

export const closeScanQr = () => {
  try {
    tg()?.closeScanQrPopup?.();
  } catch {
    /* no-op */
  }
};

export const onTgEvent = (name, fn) => {
  try {
    tg()?.onEvent?.(name, fn);
  } catch {
    /* no-op */
  }
};
export const offTgEvent = (name, fn) => {
  try {
    tg()?.offEvent?.(name, fn);
  } catch {
    /* no-op */
  }
};
