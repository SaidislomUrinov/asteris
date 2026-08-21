const reportService = require("../services/report.service");
const { sendExcel, THEME } = require("../utils/excel.util");

// Barcha hisobot endpointlari bir xil query to'plamini oladi — bitta
// joyda yig'iladi, aks holda har controllerda takrorlanardi.
const params = (query) => ({
  period: query.period,
  from: query.from,
  to: query.to,
  center: query.center,
  groupBy: query.groupBy,
  page: query.page,
  limit: query.limit,
  search: query.search,
});

module.exports = {
  summary: async (req, res, next) => {
    try {
      const data = await reportService.summary(req.client._id, params(req.query));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  timeline: async (req, res, next) => {
    try {
      const data = await reportService.timeline(req.client._id, params(req.query));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  byCenter: async (req, res, next) => {
    try {
      const data = await reportService.byCenter(req.client._id, params(req.query));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  byTeacher: async (req, res, next) => {
    try {
      const data = await reportService.byTeacher(req.client._id, params(req.query));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  byCollector: async (req, res, next) => {
    try {
      const data = await reportService.byCollector(req.client._id, params(req.query));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  byGroup: async (req, res, next) => {
    try {
      const data = await reportService.byGroup(req.client._id, params(req.query));
      return res.send({ ok: true, data });
    } catch (error) {
      next(error);
    }
  },

  debtors: async (req, res, next) => {
    try {
      const { data, meta, totalDebt } = await reportService.debtors(
        req.client._id,
        params(req.query),
      );
      return res.send({ ok: true, data, meta, totalDebt });
    } catch (error) {
      next(error);
    }
  },

  // Bitta faylda 5 varaq: Umumiy, Filiallar, O'qituvchilar, Guruhlar,
  // Qarzdorlar — barchasi AYNAN bir xil davr/filial filtri bilan.
  exportAll: async (req, res, next) => {
    try {
      const clientId = req.client._id;
      const query = params(req.query);

      const [summary, byCenter, byTeacher, byGroup, debtors] = await Promise.all([
        reportService.summary(clientId, query),
        reportService.byCenter(clientId, query),
        reportService.byTeacher(clientId, query),
        reportService.byGroup(clientId, query),
        reportService.debtors(clientId, { ...query, page: 1, limit: 200 }),
      ]);

      const money = { width: 18, align: "right", numFmt: "#,##0" };
      const summaryRows = [
        { label: "Tushum", value: summary.revenue },
        { label: "Xarajat", value: summary.expense },
        { label: "Tarqatilgan ish haqi", value: summary.salaryPaid },
        { label: "Sof foyda", value: summary.profit },
        { label: "Qarzdorlik", value: summary.debt },
        { label: "Faol o'quvchilar", value: summary.activeStudents },
        { label: "Yangi o'quvchilar", value: summary.newStudents },
        { label: "Chiqib ketganlar", value: summary.leftStudents },
        { label: "Faol guruhlar", value: summary.activeGroups },
        { label: "Davomat (%)", value: summary.attendanceRate },
      ];

      await sendExcel(res, "hisobot", [
        {
          sheetName: "Umumiy",
          color: THEME.report,
          title: "Umumiy hisobot",
          subtitle: `Davr: ${summary.from} — ${summary.to}`,
          columns: [
            { header: "Ko'rsatkich", width: 28, value: (r) => r.label },
            { header: "Qiymat", ...money, value: (r) => r.value },
          ],
          rows: summaryRows,
        },
        {
          sheetName: "Filiallar",
          color: THEME.report,
          title: "Filiallar kesimi",
          columns: [
            { header: "Filial", width: 24, value: (r) => r.center.name },
            { header: "Tushum", ...money, value: (r) => r.revenue },
            { header: "Xarajat", ...money, value: (r) => r.expense },
            { header: "Foyda", ...money, value: (r) => r.profit },
            { header: "Qarz", ...money, value: (r) => r.debt },
            { header: "O'quvchi", width: 12, align: "right", value: (r) => r.students },
            { header: "Guruh", width: 12, align: "right", value: (r) => r.groups },
            { header: "Davomat (%)", width: 14, align: "right", value: (r) => r.attendanceRate },
          ],
          rows: byCenter,
        },
        {
          sheetName: "O'qituvchilar",
          color: THEME.report,
          title: "O'qituvchilar kesimi",
          columns: [
            { header: "O'qituvchi", width: 24, value: (r) => r.staff.fullName },
            { header: "Guruh", width: 12, align: "right", value: (r) => r.groups },
            { header: "O'quvchi", width: 12, align: "right", value: (r) => r.students },
            { header: "Darslar", width: 12, align: "right", value: (r) => r.lessonsHeld },
            { header: "Davomat (%)", width: 14, align: "right", value: (r) => r.attendanceRate },
            { header: "Tushum", ...money, value: (r) => r.revenueGenerated },
            { header: "Oylik", ...money, value: (r) => r.salaryEarned },
          ],
          rows: byTeacher,
        },
        {
          sheetName: "Guruhlar",
          color: THEME.report,
          title: "Guruhlar kesimi",
          columns: [
            { header: "Guruh", width: 24, value: (r) => r.group.name },
            { header: "O'qituvchi", width: 22, value: (r) => r.teacher },
            { header: "O'quvchi", width: 12, align: "right", value: (r) => r.students },
            { header: "Tushum", ...money, value: (r) => r.revenue },
            { header: "Qarz", ...money, value: (r) => r.debt },
            { header: "Davomat (%)", width: 14, align: "right", value: (r) => r.attendanceRate },
            { header: "Dastur (%)", width: 14, align: "right", value: (r) => r.syllabusProgress },
          ],
          rows: byGroup,
        },
        {
          sheetName: "Qarzdorlar",
          color: THEME.report,
          title: "Qarzdorlar",
          subtitle: `Jami qarz: ${debtors.totalDebt}`,
          columns: [
            { header: "O'quvchi", width: 26, value: (r) => r.student.fullName },
            { header: "Telefon", width: 18, value: (r) => r.phone },
            { header: "Guruh", width: 22, value: (r) => r.group.name },
            { header: "Oylar", width: 26, value: (r) => (r.months || []).join(", ") || "—" },
            { header: "Qarz", ...money, value: (r) => r.amount },
          ],
          rows: debtors.data,
        },
      ]);
    } catch (error) {
      next(error);
    }
  },
};
