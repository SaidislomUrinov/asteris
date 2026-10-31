export const TOPICS = ["debt", "absent", "payment", "lesson", "info"];
export const VARIABLES = ["center", "student", "group", "price", "debt", "month", "date"];
export const TOPIC_COLOR = { debt: "red", absent: "orange", payment: "emerald", lesson: "blue", info: "slate" };
export const STATUS_COLOR = {
  queued: "slate",
  sent: "blue",
  delivered: "emerald",
  failed: "red",
  skipped: "orange",
  sending: "blue",
  done: "emerald",
};

export const fmtUnix = (unix) =>
  unix
    ? new Date(unix * 1000)
        .toLocaleString("sv-SE", { timeZone: "Asia/Tashkent", dateStyle: "short", timeStyle: "short" })
        .replace("T", " ")
    : "—";

export const fmtNum = (n) => Number(n || 0).toLocaleString("uz-UZ");
