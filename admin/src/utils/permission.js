// Admin ruxsatlarini tekshirish — `Admin.permissions` massiv (`["all"]` yoki
// `["news:manage", ...]`), lekin boshlang'ich holatda (store'da) bo'sh satr
// bo'lib turadi, shuning uchun ikkala ko'rinish ham qabul qilinadi.
export const hasPermission = (permissions, permission) => {
  const list = Array.isArray(permissions)
    ? permissions
    : String(permissions || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
  return list.includes("all") || list.includes(permission);
};
