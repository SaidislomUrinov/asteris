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
