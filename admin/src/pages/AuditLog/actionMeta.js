// Audit amal turini rangga moslash — `{modul}:{amal}` formatidagi action'ning
// oxirgi qismi (amal) bo'yicha aniqlanadi.
const VERB_COLOR = {
  create: "emerald",
  activate: "emerald",
  unblocked: "emerald",
  signin: "emerald",
  update: "yellow",
  permissions: "yellow",
  transfer: "yellow",
  downgrade: "orange",
  advance: "blue",
  withdraw: "blue",
  bonus: "blue",
  penalty: "orange",
  pay: "emerald",
  refund: "orange",
  cancel: "orange",
  signout: "slate",
  delete: "red",
  blocked: "red",
  failed: "red",
  leftGroup: "orange",
};

export const actionVerb = (action = "") => action.split(":")[1] || action;

export const actionColor = (action = "") => VERB_COLOR[actionVerb(action)] || "slate";

// Actor turiga qarab rang (admin / client / staff)
export const ACTOR_KIND_COLOR = {
  admin: "black",
  client: "blue",
  staff: "slate",
};

export const ACTOR_KINDS = ["admin", "client", "staff"];
