// O'qituvchi va yordamchi o'qituvchi MOLIYAVIY ma'lumotni ko'rmaydi (narx, to'lovlar, qarz) —
// bu qabulxona/boshliq ishi va o'qituvchi-o'quvchi munosabatiga aloqasi yo'q
// (docs/teacher-panel.md "Nimani ko'rmasligi kerak").
//
// Filtrlash SERVER tomonda, DTO yuborilishidan oldin bajariladi — frontendda
// ustunni berkitish yetarli emas, ma'lumot javobda umuman bo'lmasligi kerak.
const FINANCIAL_FIELDS = [
  "price",
  "payments",
  "paidAmount",
  "debt",
  "currentMonthDue",
  "currentCyclePrice",
  "paidForCurrentCycle",
  "debtBreakdown",
  "credits",
  "nextDueDate",
  "courseStartMonth",
  "currentCycleMonth",
  "priceHistory",
  // Sikllar bo'yicha narx/qarz (API_CONTRACT_past_cycle_price.md)
  "priceCycles",
  // Oy kesimida due/paid/debt (API_CONTRACT_group_month_filter_and_start_date.md §A.1)
  "billingMonths",
  // Ko'chirishdan oldingi qarz/avans (API_CONTRACT_opening_debts.md)
  "openingBalance",
  "openingDebts",
  "openingDebtTotal",
  "openingDebtRemaining",
  "earliestPayableMonth",
  // To'lov oyini o'tkazish tarixi (API_CONTRACT_payment_move_month.md) —
  // `payments` bilan birga allaqachon ketmaydi, bu himoya qatlami.
  "forMonthHistory",
];

const stripEntry = (entry) => {
  const clean = { ...entry };
  for (const field of FINANCIAL_FIELDS) delete clean[field];
  // "Alohida foiz" — moliyaviy, lekin maydon shakli saqlanadi: `null`
  // (API_CONTRACT_entry_teacher_percent.md §1).
  if ("teacherPercent" in clean) clean.teacherPercent = null;
  return clean;
};

const stripStudent = (student) => {
  if (!student) return student;
  const dto = typeof student.toObject === "function" ? student.toObject() : { ...student };
  if (Array.isArray(dto.groups)) dto.groups = dto.groups.map(stripEntry);
  return dto;
};

module.exports = {
  // O'qituvchi ham, YORDAMCHI o'qituvchi ham moliyaviy ma'lumot ko'rmaydi.
  isTeacher: (req) => ["teacher", "assistant"].includes(req.staff?.role),
  stripStudent,
  stripStudents: (list) => (Array.isArray(list) ? list.map(stripStudent) : list),
  FINANCIAL_FIELDS,
};
