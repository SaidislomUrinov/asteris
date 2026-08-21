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
function SettingSwitch({ color, label, checked, onChange }) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-slate-200 bg-white">
      <Switch color={color} checked={checked} onChange={onChange} />
      <span className="text-sm text-slate-700">{label}</span>
    </div>
  );
}

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

  useEffect(() => {
    if (!open || !centerId) return;
    (async () => {
      try {
        setLoading(true);
        const [billingRes, attendanceRes] = await Promise.all([
          api.get(`/billing-settings/${centerId}`),
          api.get(`/attendance/settings/${centerId}`),
        ]);
        if (billingRes.data.ok) setCycleMode(billingRes.data.data.cycleMode);
        if (attendanceRes.data.ok) setAttendance(attendanceRes.data.data);
      } catch (error) {
        errorMsg(error.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, centerId]);

  const toggleAttendance = (key) => setAttendance((prev) => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    try {
      setSaving(true);
      const res = await Promise.all([
        api.patch(`/billing-settings/${centerId}`, { cycleMode }),
        api.patch(`/attendance/settings/${centerId}`, attendance),
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
            <p className="font-semibold text-slate-800">{t("settings.billingCycleTitle")}</p>
            <p className="text-xs text-slate-500 -mt-1.5">{t("settings.billingCycleHint")}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CYCLE_MODES.map((mode) => {
                const selected = cycleMode === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setCycleMode(mode.value)}
                    className={`relative flex flex-col items-start gap-1 p-3.5 rounded-lg border text-left cursor-pointer transition-colors ${
                      selected ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    {selected && (
                      <HiCheckCircle className="absolute top-2.5 right-2.5 text-blue-500 text-lg" />
                    )}
                    <span className={`font-semibold text-sm pr-5 ${selected ? "text-blue-700" : "text-slate-800"}`}>
                      {t(mode.labelKey)}
                    </span>
                    <span className="text-xs text-slate-500">{t(mode.descKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100">
            <p className="font-semibold text-slate-800">{t("group.attendanceSettingsTitle")}</p>
            <p className="text-xs text-slate-500 -mt-1.5">{t("group.attendanceSettingsHint")}</p>

            <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-slate-50">
              <p className="text-[11px] font-semibold uppercase text-slate-400">
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
            </div>

            <div className="flex flex-col gap-2.5 p-3 rounded-lg bg-slate-50">
              <p className="text-[11px] font-semibold uppercase text-slate-400">
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
              <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-50">
                <label className="text-sm text-slate-700">{t("settings.lateAfterMinutes")}</label>
                <input
                  type="number"
                  min={0}
                  value={attendance.lateAfterMinutes ?? 0}
                  onChange={(e) =>
                    setAttendance((prev) => ({ ...prev, lateAfterMinutes: Number(e.target.value) }))
                  }
                  className="w-32 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-blue-500 duration-200"
                />
                <p className="text-xs text-slate-500">{t("settings.lateAfterMinutesHint")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default CenterSettingsDialog;
