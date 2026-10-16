// Filial oynalari (qo'shish, qayta yoqish) — App darajasidagi YAGONA joyda
// (components/center/CenterActionsHost.jsx). Top menyu, mobil menyu va
// "Avval filial qo'shing" xabari shu hodisalar orqali ochadi — har biri o'z
// nusxasini saqlamaydi.
export const CENTER_CREATE_EVENT = "wenet:center-create";
export const CENTER_UNBLOCK_EVENT = "wenet:center-unblock";

export const openCenterCreate = () => window.dispatchEvent(new Event(CENTER_CREATE_EVENT));

/** @param {{ _id: string, name: string }} center */
export const openCenterUnblock = (center) =>
  window.dispatchEvent(new CustomEvent(CENTER_UNBLOCK_EVENT, { detail: center }));
