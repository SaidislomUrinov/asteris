// Boshlang'ich (ko'chirishdan oldingi) qarz — OpeningDebtsEditor, StudentDialog
// va OpeningDebtsDialog uchun umumiy yordamchilar (API_CONTRACT_opening_debts.md §1).

export const OPENING_MAX_ROWS = 36;
export const OPENING_MAX_AMOUNT = 1_000_000_000;
// Oy tanlovida ko'rsatiladigan oylar soni (joriy oydan orqaga).
const MONTH_OPTION_COUNT = 60;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const EMPTY_OPENING = { openingDebts: [], openingBalance: "" };

// Asia/Tashkent bo'yicha joriy oy — "YYYY-MM" (server ham shu zona bilan tekshiradi).
export function currentTashkentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

// Joriy oydan orqaga qarab oylar ro'yxati (eng yangisi birinchi).
export function recentMonths(count = MONTH_OPTION_COUNT) {
  const [y, m] = currentTashkentMonth().split("-").map(Number);
  const list = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    list.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return list;
}

export function formatMonthName(month, monthNames) {
  if (!month) return "";
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return month;
  return `${monthNames?.[m - 1] || ""} ${year}`;
}

// Summa matnidan faqat raqamlar — "1 200 000" -> 1200000, bo'sh -> "".
export function parseAmount(text) {
  const digits = String(text ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : "";
}

export function formatAmount(value) {
  return value === "" || value === null || value === undefined
    ? ""
    : Number(value).toLocaleString("uz-UZ");
}

export function openingTotal(openingDebts = []) {
  return openingDebts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

// Qatorlar bo'yicha xatolar: { [index]: { month?: key, amount?: key } }.
// Bo'sh qatorlar (summa kiritilmagan va oy tanlanmagan) e'tiborsiz qoldiriladi.
export function validateOpeningRows(openingDebts = []) {
  const errors = {};
  const nowMonth = currentTashkentMonth();
  const seen = new Map();
  openingDebts.forEach((row, i) => {
    const month = row.month || null;
    const amountEmpty = row.amount === "" || row.amount === null || row.amount === undefined;
    if (!month && amountEmpty) return;
    const rowErr = {};
    if (month && !MONTH_RE.test(month)) rowErr.month = "student.openingMonthInvalid";
    else if (month && month > nowMonth) rowErr.month = "student.openingMonthFuture";
    const key = month ?? "__null__";
    if (seen.has(key)) rowErr.month = rowErr.month || "student.openingMonthDuplicate";
    else seen.set(key, i);
    const amount = Number(row.amount);
    if (amountEmpty || !Number.isInteger(amount) || amount < 1 || amount > OPENING_MAX_AMOUNT)
      rowErr.amount = "student.invalidAmount";
    if (Object.keys(rowErr).length) errors[i] = rowErr;
  });
  return errors;
}

// Server body'si uchun tozalash: bo'sh qatorlar tashlanadi, summa son bo'ladi.
// Xato bo'lsa birinchi xato kaliti bilan Error otiladi.
export function buildOpeningPayload(value = EMPTY_OPENING) {
  const rows = (value.openingDebts || []).filter(
    (r) => r.month || (r.amount !== "" && r.amount !== null && r.amount !== undefined),
  );
  if (rows.length > OPENING_MAX_ROWS) throw new Error("student.openingTooMany");
  const errors = validateOpeningRows(rows);
  const first = Object.values(errors)[0];
  if (first) throw new Error(first.month || first.amount);

  const balanceRaw = value.openingBalance;
  const openingBalance = balanceRaw === "" || balanceRaw === null || balanceRaw === undefined ? 0 : Number(balanceRaw);
  if (!Number.isInteger(openingBalance) || openingBalance < 0 || openingBalance > OPENING_MAX_AMOUNT)
    throw new Error("student.invalidAmount");

  return {
    openingDebts: rows.map((r) => ({
      month: r.month || null,
      amount: Number(r.amount),
      note: (r.note || "").trim(),
    })),
    openingBalance,
  };
}

// Server a'zolik DTO'sidan editor qiymatiga.
export function openingValueFromEntry(entry) {
  return {
    openingDebts: (entry?.openingDebts || []).map((r) => ({
      month: r.month || null,
      amount: r.amount ?? "",
      note: r.note || "",
    })),
    openingBalance: entry?.openingBalance > 0 ? entry.openingBalance : "",
  };
}
