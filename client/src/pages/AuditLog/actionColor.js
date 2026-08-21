// Audit action formati `{modul}:{amal}` (docs/API_CONTRACT.md §1.1).
// Rang AMALGA qarab beriladi, modulga emas — foydalanuvchi ro'yxatga
// qaraganda "nima qilingan"ni rangdan darrov ajratadi.
export const verbOf = (action = "") => String(action).split(":")[1] || "";

export const ACTION_COLOR = {
  create: "emerald",
  activate: "emerald",
  unblocked: "emerald",
  signin: "emerald",

  update: "yellow",
  permissions: "yellow",
  transfer: "yellow",
  advance: "yellow",
  withdraw: "yellow",
  bonus: "yellow",
  pay: "yellow",
  downgrade: "yellow",

  delete: "red",
  cancel: "red",
  refund: "red",
  penalty: "red",
  blocked: "red",
  leftGroup: "red",
  failed: "red",
  signout: "slate",
};
