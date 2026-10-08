import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheckCircle } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Switch from "../../ui/Switch";
import Button from "../../ui/Button";
import Loading from "../../ui/Loading";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import useFeature from "../../hooks/useFeature";

const CYCLE_MODES = [
  { value: "anchor", labelKey: "settings.cycleModeAnchor", descKey: "settings.cycleModeAnchorDesc" },
  {
    value: "calendarMonth",
    labelKey: "settings.cycleModeCalendarMonth",
    descKey: "settings.cycleModeCalendarMonthDesc",
  },
];

// Har bitta toggle+matn alohida konteynerga o'ralgan — uzun matn Switch'ning
// o'zidan pastga tushadi (2 qator: tepada Switch, pastida label), yonma-yon
// siqilib ketmaydi.
function SettingSwitch({ color, label, checked, onChange, disabled = false }) {
  return (
    <div
      className={`flex flex-col gap-2 p-3 rounded-lg border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <Switch color={color} checked={checked} onChange={onChange} disabled={disabled} />
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
    </div>
  );
}

// Qarz eslatmasi — muddatdan keyin qaysi kunlarda (docs/API_CONTRACT_parent.md §2).
const DEBT_DAYS_AFTER_OPTIONS = [0, 3, 7, 14, 21, 30];

const DEFAULT_PARENT_NOTIF = {
  enabled: true,
  attendance: { enabled: true },
  lessonFinished: { enabled: true, includeGrade: true },
  payment: { enabled: true },
  badge: { enabled: true },
  debt: { enabled: true, daysBefore: 3, daysAfter: [0, 3, 7, 14] },
  showGrades: true,
  quietHours: { from: "21:00", to: "08:00" },
};

// Backend qisman obyekt qaytarsa ham UI'da barcha maydonlar bo'lsin.
const mergeParentNotif = (raw = {}) => ({
  ...DEFAULT_PARENT_NOTIF,
  ...raw,
  attendance: { ...DEFAULT_PARENT_NOTIF.attendance, ...raw.attendance },
  lessonFinished: { ...DEFAULT_PARENT_NOTIF.lessonFinished, ...raw.lessonFinished },
  payment: { ...DEFAULT_PARENT_NOTIF.payment, ...raw.payment },
  badge: { ...DEFAULT_PARENT_NOTIF.badge, ...raw.badge },
  debt: { ...DEFAULT_PARENT_NOTIF.debt, ...raw.debt },
  quietHours: { ...DEFAULT_PARENT_NOTIF.quietHours, ...raw.quietHours },
});

const INPUT_CLS =
  "px-3 py-2 rounded-lg border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 text-sm outline-none focus:border-blue-500 duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

// Filial (Center) darajasidagi sozlamalar — bitta modal ichida, "Saqlash"
// bosilgandagina ikkalasi (to'lov sikli + davomat) birga saqlanadi. Har
// filial o'z qoidasini tanlaydi (CenterDetail sahifasidagi ⚙️ tugmasi).
function CenterSettingsDialog({ open, onClose, centerId }) {
  const { t } = useTranslation();
  const hasFeature = useFeature();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cycleMode, setCycleMode] = useState("anchor");
  const [attendance, setAttendance] = useState(null);
  // Ota-ona xabarlari TARIFGA BOG'LIQ EMAS — har bir filial uchun doim ochiq.
  const [parentNotif, setParentNotif] = useState(DEFAULT_PARENT_NOTIF);

  useEffect(() => {
    if (!open || !centerId) return;
    (async () => {
      try {
        setLoading(true);
        const [billingRes, attendanceRes, centerRes] = await Promise.all([
          api.get(`/billing-settings/${centerId}`),
          api.get(`/attendance/settings/${centerId}`),
          api.get(`/centers/${centerId}`),
        ]);
        if (billingRes.data.ok) setCycleMode(billingRes.data.data.cycleMode);
        if (attendanceRes.data.ok) setAttendance(attendanceRes.data.data);
        if (centerRes?.data.ok) setParentNotif(mergeParentNotif(centerRes.data.data.parentNotifications));
      } catch (error) {
        errorMsg(error.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, centerId]);

  const toggleAttendance = (key) => setAttendance((prev) => ({ ...prev, [key]: !prev[key] }));

  const setPN = (patch) => setParentNotif((prev) => ({ ...prev, ...patch }));
  const setPNSub = (key, patch) => setParentNotif((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  const toggleDaysAfter = (day) =>
    setPNSub("debt", {
      daysAfter: parentNotif.debt.daysAfter.includes(day)
        ? parentNotif.debt.daysAfter.filter((d) => d !== day)
        : [...parentNotif.debt.daysAfter, day].sort((a, b) => a - b),
    });

  const save = async () => {
    try {
      setSaving(true);
      const res = await Promise.all([
        api.patch(`/billing-settings/${centerId}`, { cycleMode }),
        api.patch(`/attendance/settings/${centerId}`, attendance),
        api.patch(`/centers/${centerId}`, { parentNotifications: parentNotif }),
      ]);
      const failed = res.find((r) => !r.data.ok);
      if (failed) throw new Error(failed.data.msg);

      successMsg(res[0].data.msg);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const pnOff = !parentNotif.enabled;
  const debtOff = pnOff || !parentNotif.debt.enabled;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("settings.centerSectionTitle")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button color="blue" loading={saving} disabled={loading} onClick={save}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      {loading || !attendance ? (
        <Loading height="30vh" />
      ) : (
        <div className="flex flex-col gap-4 w-full">
          <div className="flex flex-col gap-2.5">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{t("settings.billingCycleTitle")}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1.5">{t("settings.billingCycleHint")}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CYCLE_MODES.map((mode) => {
                const selected = cycleMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setCycleMode(mode.value)}
                    className={`relative flex flex-col items-start gap-1 p-3.5 rounded-lg border text-left cursor-pointer transition-colors ${
                      selected ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15" : "border-slate-200 dark:border-night-700 hover:border-blue-300"
                    }`}
                  >
                    {selected && (
                      <HiCheckCircle className="absolute top-2.5 right-2.5 text-blue-500 text-lg" />
                    )}
                    <span className={`font-semibold text-sm pr-5 ${selected ? "text-blue-700 dark:text-blue-400" : "text-slate-800 dark:text-slate-100"}`}>
                      {t(mode.labelKey)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t(mode.descKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 dark:border-night-700">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{t("group.attendanceSettingsTitle")}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1.5">{t("group.attendanceSettingsHint")}</p>

            <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
              <p className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                {t("group.attendanceSettingsStudentGroup")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <SettingSwitch
                  color="emerald"
                  label={t("group.excusedRollsOverStudentFee")}
                  checked={attendance.excusedRollsOverStudentFee}
                  onChange={() => toggleAttendance("excusedRollsOverStudentFee")}
                />
                <SettingSwitch
                  color="emerald"
                  label={t("group.unexcusedRollsOverStudentFee")}
                  checked={attendance.unexcusedRollsOverStudentFee}
                  onChange={() => toggleAttendance("unexcusedRollsOverStudentFee")}
                />
              </div>
              {/* Rejim: har kelmagan kun uchun darhol kredit YOKI faqat
                  ketma-ket 3 ta darsga kelmaganda keyingi oyga o'tkazish
                  (o'qituvchi percent oyligi ham qayta hisoblanadi). */}
              <div className="flex flex-col gap-1 pt-2 border-t border-slate-200/70 dark:border-night-700/70">
                <SettingSwitch
                  color="emerald"
                  label={t("group.rolloverOnConsecutiveAbsence")}
                  checked={!!attendance.rolloverOnConsecutiveAbsence}
                  onChange={() => toggleAttendance("rolloverOnConsecutiveAbsence")}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 px-1">{t("group.rolloverOnConsecutiveAbsenceHint")}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
              <p className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                {t("group.attendanceSettingsTeacherGroup")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <SettingSwitch
                  color="blue"
                  label={t("group.excusedTeacherSalaryWithheld")}
                  checked={attendance.excusedTeacherSalaryWithheld}
                  onChange={() => toggleAttendance("excusedTeacherSalaryWithheld")}
                />
                <SettingSwitch
                  color="blue"
                  label={t("group.unexcusedTeacherSalaryWithheld")}
                  checked={attendance.unexcusedTeacherSalaryWithheld}
                  onChange={() => toggleAttendance("unexcusedTeacherSalaryWithheld")}
                />
              </div>
            </div>

            {/* Kechikish oynasi — faqat QR skan oqimiga ta'sir qiladi
                (qo'lda belgilashda kelgan vaqt ma'lum emas). */}
            {hasFeature("attendance.qr") && (
              <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
                <label className="text-sm text-slate-700 dark:text-slate-300">{t("settings.lateAfterMinutes")}</label>
                <input
                  type="number"
                  min={0}
                  value={attendance.lateAfterMinutes ?? 0}
                  onChange={(e) =>
                    setAttendance((prev) => ({ ...prev, lateAfterMinutes: Number(e.target.value) }))
                  }
                  className="w-32 px-3 py-2 rounded-lg border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 text-sm outline-none focus:border-blue-500 duration-200"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("settings.lateAfterMinutesHint")}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 dark:border-night-700">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{t("center.parentNotif.title")}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1.5">{t("center.parentNotif.hint")}</p>

            <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-50 dark:bg-night-800">
              <SettingSwitch
                color="emerald"
                label={t("center.parentNotif.enabled")}
                checked={parentNotif.enabled}
                onChange={() => setPN({ enabled: !parentNotif.enabled })}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 px-1">{t("center.parentNotif.enabledHint")}</p>
            </div>

            <div className={`flex flex-col gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-night-800 ${pnOff ? "opacity-60" : ""}`}>
              <p className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                {t("center.parentNotif.types")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <SettingSwitch
                  color="blue"
                  disabled={pnOff}
                  label={t("center.parentNotif.attendance")}
                  checked={parentNotif.attendance.enabled}
                  onChange={() => setPNSub("attendance", { enabled: !parentNotif.attendance.enabled })}
                />
                <SettingSwitch
                  color="blue"
                  disabled={pnOff}
                  label={t("center.parentNotif.payment")}
                  checked={parentNotif.payment.enabled}
                  onChange={() => setPNSub("payment", { enabled: !parentNotif.payment.enabled })}
                />
                {hasFeature("gamification.badges") && (
                  <SettingSwitch
                    color="blue"
                    disabled={pnOff}
                    label={t("center.parentNotif.badge")}
                    checked={parentNotif.badge.enabled}
                    onChange={() => setPNSub("badge", { enabled: !parentNotif.badge.enabled })}
                  />
                )}
              </div>

              <div className="flex flex-col gap-2 p-3 rounded-lg border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">
                <Switch
                  color="blue"
                  disabled={pnOff}
                  checked={parentNotif.lessonFinished.enabled}
                  onChange={() =>
                    setPNSub("lessonFinished", { enabled: !parentNotif.lessonFinished.enabled })
                  }
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">{t("center.parentNotif.lessonFinished")}</span>
                <label className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-night-700">
                  <Switch
                    color="slate"
                    disabled={pnOff || !parentNotif.lessonFinished.enabled}
                    checked={parentNotif.lessonFinished.includeGrade}
                    onChange={() =>
                      setPNSub("lessonFinished", { includeGrade: !parentNotif.lessonFinished.includeGrade })
                    }
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-300">{t("center.parentNotif.includeGrade")}</span>
                </label>
              </div>

              <div className="flex flex-col gap-2 p-3 rounded-lg border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">
                <Switch
                  color="blue"
                  disabled={pnOff}
                  checked={parentNotif.debt.enabled}
                  onChange={() => setPNSub("debt", { enabled: !parentNotif.debt.enabled })}
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">{t("center.parentNotif.debt")}</span>
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 pt-1 border-t border-slate-100 dark:border-night-700">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400">{t("center.parentNotif.daysBefore")}</label>
                    <input
                      type="number"
                      min={0}
                      max={14}
                      disabled={debtOff}
                      value={parentNotif.debt.daysBefore}
                      onChange={(e) =>
                        setPNSub("debt", {
                          daysBefore: Math.min(14, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                      className={`w-24 ${INPUT_CLS}`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400">{t("center.parentNotif.daysAfter")}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DEBT_DAYS_AFTER_OPTIONS.map((day) => {
                        const on = parentNotif.debt.daysAfter.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={debtOff}
                            onClick={() => toggleDaysAfter(day)}
                            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                              on
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                : "border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 text-slate-600 dark:text-slate-300 hover:border-blue-300"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{t("center.parentNotif.daysAfterHint")}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex flex-col gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-night-800 ${pnOff ? "opacity-60" : ""}`}>
              <p className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">
                {t("center.parentNotif.webapp")}
              </p>
              <div className="flex flex-col gap-1">
                <SettingSwitch
                  color="blue"
                  disabled={pnOff}
                  label={t("center.parentNotif.showGrades")}
                  checked={parentNotif.showGrades}
                  onChange={() => setPN({ showGrades: !parentNotif.showGrades })}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 px-1">{t("center.parentNotif.showGradesHint")}</p>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/70 dark:border-night-700/70">
                <span className="text-sm text-slate-700 dark:text-slate-300">{t("center.parentNotif.quietHours")}</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400">{t("center.parentNotif.quietFrom")}</label>
                    <input
                      type="time"
                      disabled={pnOff}
                      value={parentNotif.quietHours.from}
                      onChange={(e) => setPNSub("quietHours", { from: e.target.value })}
                      className={`w-full min-w-0 !px-2 text-[13px] ${INPUT_CLS}`}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <label className="text-xs text-slate-500 dark:text-slate-400">{t("center.parentNotif.quietTo")}</label>
                    <input
                      type="time"
                      disabled={pnOff}
                      value={parentNotif.quietHours.to}
                      onChange={(e) => setPNSub("quietHours", { to: e.target.value })}
                      className={`w-full min-w-0 !px-2 text-[13px] ${INPUT_CLS}`}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("center.parentNotif.quietHoursHint")}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default CenterSettingsDialog;
