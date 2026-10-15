import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * `?create=1` bilan ochilgan sahifada qo'shish oynasini o'zi ochadi
 * (hooks/usePrerequisite.jsx havolasi shu yerga olib keladi). Parametr
 * darhol URL'dan olib tashlanadi — orqaga qaytilganda yoki yangilanganda
 * oyna qayta ochilmaydi.
 *
 * @param {() => void} openCreate — sahifaning odatiy "Qo'shish" amali
 * @param {boolean} ready — oynaga kerakli ro'yxatlar (filiallar, fanlar...) yuklandimi
 */
export default function useCreateFromQuery(openCreate, ready = true) {
  const [params, setParams] = useSearchParams();
  const wanted = params.get("create") === "1";
  const doneRef = useRef(false);
  const openRef = useRef(openCreate);

  useEffect(() => {
    openRef.current = openCreate;
  });

  useEffect(() => {
    if (!wanted || !ready || doneRef.current) return;
    doneRef.current = true;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("create");
        return next;
      },
      { replace: true },
    );
    // Effekt ichida setState chaqirmaslik uchun — keyingi tick'da.
    setTimeout(() => openRef.current(), 0);
  }, [wanted, ready, setParams]);
}
