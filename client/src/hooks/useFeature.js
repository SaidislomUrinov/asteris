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
export default function useFeature() {
  const allowed = useSelector(
    (e) => e.user.subscription?.tariffSnapshot?.allowedPermissions || e.user.tariffFeatures,
  );

  return (feature) => (allowed || []).includes(feature);
}
