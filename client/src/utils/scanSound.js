// QR skaner natijasi uchun ovozli signal — operator ekranga qaramasdan ham
// skaner o'tdi/o'tmadi ekanini bilishi uchun. Fayl yo'q: ohanglar Web Audio
// API bilan chiziladi. Brauzer ovozni faqat foydalanuvchi harakatidan keyin
// ruxsat beradi — birinchi bosish/tugma bosishda kontekst "ochiladi" (USB
// skaner klaviatura sifatida ishlagani uchun uning o'zi ham shu shartni
// bajaradi). Ovoz o'chiq/qo'llab-quvvatlanmasa jimgina hech narsa qilmaydi.
// parent/src/lib/scanSound.js — xuddi shu fayl (WebApp), o'zgarsa ikkalasi ham.

let ctx = null;

const audio = () => {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
};

// Birinchi foydalanuvchi harakatida kontekstni ochib qo'yish.
if (typeof window !== "undefined") {
  const unlock = () => {
    audio();
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  };
  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

// [chastota Hz, davomiylik ms, to'lqin] ketma-ketligi, oralig'i 40ms.
const play = (notes, volume = 0.22) => {
  const ac = audio();
  if (!ac) return;
  let t = ac.currentTime + 0.01;
  for (const [freq, ms, type = "sine"] of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const end = t + ms / 1000;
    // Qisqa kirish/chiqish — "chiq" ovozisiz toza bip.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(end + 0.02);
    t = end + 0.04;
  }
};

export const scanSound = {
  // Keldi — bitta yorqin bip.
  success: () => play([[1318, 140]]),
  // Kechikdi — belgilandi, lekin pasayuvchi ikkinchi ohang bilan.
  late: () => play([[1318, 110], [880, 160]]),
  // Allaqachon belgilangan — ikki qisqa o'rta bip.
  duplicate: () => play([[740, 80], [740, 80]]),
  // Xato — past "buzz".
  error: () => play([[196, 320, "square"]], 0.12),
  // Guruh tanlash kerak — e'tibor tortuvchi ohang.
  attention: () => play([[988, 90], [1318, 90]]),
};
