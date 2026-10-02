import { useSelector } from "react-redux";

// Tarif feature flagi tekshiruvi (CLAUDE.md "Permission tizimi va Tariflar").
// `useCan` dan FARQ QILADI: useCan — foydalanuvchining RBAC permissioni
// (`attendance:create`), bu esa obuna tarifi shu premium imkoniyatni
// ochganmi (`attendance.qr`). Ikkalasi mustaqil — QR tugmasi ko'rinishi
// uchun HAM permission, HAM tarif flagi kerak. Yakuniy haqiqat manbai
// baribir backend (`requireTariffFeature`).
// Ro'yxat ikki xil joydan keladi, chunki Owner va Staff mustaqil auth
// zanjiri (server/CLAUDE.md): Owner payloadida to'liq `subscription` bor,
// hodimga esa faqat flaglar ro'yxati beriladi (`tariffFeatures`) — unga
// obunaning narx/limit tafsilotlari kerak emas
// (docs/API_CONTRACT_qr_attendance_staff.md).
// Vaqtincha production'da o'chirilgan flaglar — tarifda yoqilgan bo'lsa ham
// har doim yopiq ko'rsatiladi. Qayta ochish uchun shunchaki shu ro'yxatdan
// olib tashlash kifoya.
// Subscription/TariffsTab.jsx "Tarif imkoniyatlari" ro'yxatida ham shu
// flaglar reklama qilinmasligi uchun eksport qilinadi.
export const FORCE_DISABLED = ["ai.report", "ai.advice"];

export default function useFeature() {
  const allowed = useSelector(
    (e) => e.user.subscription?.tariffSnapshot?.allowedPermissions || e.user.tariffFeatures,
  );

  return (feature) => !FORCE_DISABLED.includes(feature) && (allowed || []).includes(feature);
}
