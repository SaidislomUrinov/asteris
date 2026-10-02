export const DURATION_OPTIONS = [
  { months: 1, labelKey: "subscription.durationLabels.m1", discount: 0 },
  { months: 3, labelKey: "subscription.durationLabels.m3", discount: 0.05 },
  { months: 6, labelKey: "subscription.durationLabels.m6", discount: 0.07 },
  { months: 9, labelKey: "subscription.durationLabels.m9", discount: 0.10 },
  { months: 12, labelKey: "subscription.durationLabels.m12", discount: 0.12 },
];

export const calcAmount = (monthlyPrice, months, discount) =>
  Math.round(monthlyPrice * months * (1 - discount));
