export const DURATION_OPTIONS = [
  { months: 1, label: "1 oy", discount: 0 },
  { months: 3, label: "3 oy", discount: 0.05 },
  { months: 6, label: "6 oy", discount: 0.07 },
  { months: 9, label: "9 oy", discount: 0.10 },
  { months: 12, label: "1 yil", discount: 0.12 },
];

export const calcAmount = (monthlyPrice, months, discount) =>
  Math.round(monthlyPrice * months * (1 - discount));
