const salaryService = require("../services/salary.service");
const { buildActor } = require("../utils/audit.util");
const { sendExcel, THEME } = require("../utils/excel.util");

const SALARY_TYPE_LABELS = {
  fixed: "Belgilangan",
  percentage: "Foizli",
};
const ROLE_LABELS = { manager: "Menejer", reception: "Resepshin", teacher: "O'qituvchi" };
const TX_TYPE_LABELS = { advance: "Avans", withdrawal: "Oldindan olish", bonus: "Bonus", penalty: "Jarima" };

// Hodim so'rasa — faqat o'z filiali hodimlari (Owner uchun null = cheklovsiz).
const staffCenter = (req) => (req.staff ? req.staff.center : null);

// Hodim boshqa hodimning hisobini ko'ra olmaydi. Istisno — `salary:view`
// ruxsatiga ega hodim (masalan to'liq huquqli `["all"]`): u o'z filiali
// hodimlarining ish haqini ko'radi.
const assertCanViewSalary = (req) => {
  const canViewOthers =
    req.staff?.permissions?.includes("all") || req.staff?.permissions?.includes("salary:view");
  if (req.staff && !canViewOthers && String(req.staff._id) !== req.params.staffId) {
    throw new Error("auth.forbidden");
  }
};

module.exports = {
  summary: async (req, res, next) => {
    try {
      const { month, center } = req.query;
      const data = await salaryService.summary(req.client._id, { month, center });
      return res.send({ ok: true, ...data });
    } catch (error) {
      next(error);
    }
  },

  exportSummary: async (req, res, next) => {
    try {
      const { month, center } = req.query;
      const { month: m, data } = await salaryService.summary(req.client._id, { month, center });
      await sendExcel(res, `ish_haqi_${m}`, [
        {
          sheetName: "Ish haqi",
          color: THEME.salary,
          title: `Ish haqi — ${m}`,
          subtitle: `Jami: ${data.length} ta hodim`,
          columns: [
            { header: "Hodim", width: 22, value: (r) => r.staff.name },
            { header: "Lavozim", width: 16, value: (r) => ROLE_LABELS[r.staff.role] || r.staff.role },
            {
              header: "Turi",
              width: 18,
              value: (r) => SALARY_TYPE_LABELS[r.salaryType] || "—",
            },
            { header: "Hisoblangan (so'm)", width: 18, align: "right", numFmt: "#,##0", value: (r) => r.base },
            {
              header: "Berilgan (so'm)",
              width: 18,
              align: "right",
              numFmt: "#,##0",
              value: (r) => r.advance + r.withdrawal,
            },
            { header: "Jarima (so'm)", width: 16, align: "right", numFmt: "#,##0", value: (r) => -r.penalty },
            { header: "Bonus (so'm)", width: 16, align: "right", numFmt: "#,##0", value: (r) => r.bonus },
            { header: "Qolgan (so'm)", width: 18, align: "right", numFmt: "#,##0", value: (r) => r.final },
          ],
          rows: data,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },

  exportOne: async (req, res, next) => {
    try {
      // `detail` bilan bir xil cheklov — avval eksportda yo'q edi va istalgan
      // hodim istalgan hodimning (boshqa filialniki ham) oyligini yuklab olardi.
      assertCanViewSalary(req);
      const data = await salaryService.detail(req.client._id, req.params.staffId, req.query, staffCenter(req));
      await sendExcel(res, `ish_haqi_${data.staff.name}_${data.month}`, [
        {
          sheetName: "Statistika",
          color: THEME.salary,
          title: `${data.staff.name} — ${data.month}`,
          subtitle: ROLE_LABELS[data.staff.role] || data.staff.role,
          columns: [
            { header: "Ko'rsatkich", width: 26, value: (r) => r.label },
            { header: "Summa (so'm)", width: 18, align: "right", numFmt: "#,##0", value: (r) => r.value },
          ],
          rows: [
            { label: "Hisoblangan oylik", value: data.base },
            { label: "Avans", value: data.advance },
            { label: "Oldindan olingan", value: data.withdrawal },
            { label: "Bonus", value: data.bonus },
            { label: "Jarima", value: -data.penalty },
            { label: "Qolgan", value: data.final },
          ],
        },
        {
          sheetName: "Tranzaksiyalar",
          color: THEME.salary,
          title: `${data.staff.name} — tranzaksiyalar tarixi`,
          columns: [
            { header: "Turi", width: 16, value: (r) => TX_TYPE_LABELS[r.type] || r.type },
            {
              header: "Summa (so'm)",
              width: 16,
              align: "right",
              numFmt: "#,##0",
              value: (r) => (r.type === "penalty" ? -r.amount : r.amount),
            },
            { header: "Izoh", width: 24, value: (r) => r.note || "—" },
            { header: "Sana", width: 18, value: (r) => r.date },
            { header: "Holat", width: 16, value: (r) => (r.status === "cancelled" ? "Bekor qilingan" : "Faol") },
          ],
          rows: data.transactions,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },

  detail: async (req, res, next) => {
    try {
      assertCanViewSalary(req);
      const data = await salaryService.detail(req.client._id, req.params.staffId, req.query, staffCenter(req));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  addTransaction: async (req, res, next) => {
    try {
      const data = await salaryService.addTransaction(req.client._id, req.params.staffId, req.body, staffCenter(req), buildActor(req));
      return res.send({ ok: true, data, msg: "salary.txCreated" });
    } catch (error) {
      next(error);
    }
  },

  cancelTransaction: async (req, res, next) => {
    try {
      const data = await salaryService.cancelTransaction(req.client._id, req.params.txId, staffCenter(req), buildActor(req));
      return res.send({ ok: true, data, msg: "salary.txCancelled" });
    } catch (error) {
      next(error);
    }
  },
};
