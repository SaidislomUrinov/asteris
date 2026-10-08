import { useEffect, useState } from "react";
import { offTgEvent, onTgEvent } from "../../lib/telegram";

// Ko'rinadigan oyna (klaviatura chiqqanda kichrayadi). Telegram iOS'da
// WebView o'lchami o'zgarmaydi — faqat `visualViewport` kichrayadi va sahifa
// suriladi; shuning uchun to'liq ekranli konteyner `top`/`height` ni shundan
// oladi va yozish maydoni klaviatura ustida qoladi.
const read = () => {
  const vv = window.visualViewport;
  const full = window.innerHeight;
  const height = vv ? vv.height : full;
  return {
    top: vv ? vv.offsetTop : 0,
    height,
    // ~120px dan ko'p kichraygan bo'lsa — klaviatura ochiq (pastki xavfsiz
    // zona chizig'i shunda kerak emas).
    keyboard: full - height > 120,
  };
};

export const useViewportBox = () => {
  const [box, setBox] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = read();
        setBox((p) => (p.top === next.top && p.height === next.height && p.keyboard === next.keyboard ? p : next));
      });
    };
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    onTgEvent("viewportChanged", update);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      offTgEvent("viewportChanged", update);
    };
  }, []);
  return box;
};
