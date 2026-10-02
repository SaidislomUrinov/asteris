const DAY_KEYS = ["", "mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// days: [1..7] (Du=1) yoki ["mon",...] → "Du Ch Ju"
export const daysLabel = (days, t) =>
  (days || [])
    .map((d) =>
      typeof d === "number"
        ? t(`days.${DAY_KEYS[d] || ""}`, { defaultValue: "" })
        : t(`days.${String(d).slice(0, 3).toLowerCase()}`, { defaultValue: d }),
    )
    .filter(Boolean)
    .join(" ");
