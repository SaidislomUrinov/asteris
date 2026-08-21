import { useSelector } from "react-redux";

// Permission tekshiruvi (CLAUDE.md "Permission tizimi"): Client Owner va Center
// Manager hamma narsani ko'radi, boshqa staff (reception/teacher) faqat o'ziga
// berilgan permissionlar doirasida. Permission bo'lmasa menu/tugma ko'rinmaydi.
export default function useCan() {
  const { authType, permissions } = useSelector((e) => e.user);

  return (permission) => {
    // To'liq huquq endi ROL emas, RUXSAT orqali (`["all"]`) — "manager"
    // roli olib tashlandi (API_CONTRACT_assistant_and_grades.md).
    if (authType === "owner") return true;
    return permissions?.includes("all") || permissions?.includes(permission);
  };
}
