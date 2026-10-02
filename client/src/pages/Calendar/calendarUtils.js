export const WEEK_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const JS_DAY_TO_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
