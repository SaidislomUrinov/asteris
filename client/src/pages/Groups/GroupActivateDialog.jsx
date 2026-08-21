import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCalendarDays, HiClock, HiHome, HiUsers } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import TimeInput from "../../ui/TimeInput";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// Diqqat: Date#toISOString() UTC'ga o'tkazadi — local sanani noto'g'ri
// chiqarishi mumkin (memory: feedback_dev_workflow). Local qiymatlardan
// to'g'ridan-to'g'ri yig'amiz.
const todayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Pending guruhni activlashtirish uchun alohida dialog — API_CONTRACT.md §7.
// Mavjud teacher/room/days/vaqt bilan oldindan to'ldiriladi, endi barchasi
// majburiy (activate uchun to'liq bo'lishi shart). `startDate` — darslar
// aynan qachon boshlanishi (kalendar orqali tanlanadi, kelajakka ham
// qo'yish mumkin) — shu sana guruh.activatedAt bo'lib, oylik to'lov sikli
// va Kalendar komponentidagi "faqat shu sanadan boshlab" chegarasi uchun
// langar bo'ladi.
function GroupActivateDialog({ open, onClose, group, teachers = [], rooms = [], onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    teacher: group?.teacher || "",
    room: group?.room || "",
    days: group?.days || [],
    startTime: group?.startTime || "",
    endTime: group?.endTime || "",
    startDate: todayDateString(),
  }));
  const [disabled, setDisabled] = useState(false);

  const centerTeachers = teachers.filter((s) => s.center === group?.center);
  const centerRooms = rooms.filter((r) => r.center === group?.center);

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }));
  };

  const submit = async () => {
    try {
      if (!form.teacher || !form.room || !form.days.length || !form.startTime || !form.endTime)
        throw new Error("group.activationIncomplete");
      setDisabled(true);

      const res = await api.patch(`/groups/${group._id}/activate`, {
        teacherId: form.teacher,
        roomId: form.room,
        days: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
        startDate: form.startDate,
      });
      const { ok, data, msg, conflict } = res.data;
      if (!ok) {
        if (conflict) {
          errorMsg(msg, {
            room: conflict.room,
            day: t(`group.day.${conflict.day}`),
            start: conflict.startTime,
            end: conflict.endTime,
            label: conflict.label,
          });
          return;
        }
        throw new Error(msg);
      }

      successMsg(msg);
      onSaved?.(data);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDisabled(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("group.activateTitle")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button color="emerald" loading={disabled} onClick={submit}>
            {t("group.activate")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 w-full">
        <p className="text-sm text-slate-500">{t("group.activateHint")}</p>

        <Select
          label={t("group.teacher")}
          placeholder={t("group.teacher")}
          required
          icon={<HiUsers />}
          value={form.teacher}
          onChange={(v) => setForm((prev) => ({ ...prev, teacher: v }))}
          options={centerTeachers.map((s) => ({ value: s._id, label: s.name }))}
        />
        <Select
          label={t("group.room")}
          placeholder={t("group.room")}
          required
          icon={<HiHome />}
          value={form.room}
          onChange={(v) => setForm((prev) => ({ ...prev, room: v }))}
          options={centerRooms.map((r) => ({ value: r._id, label: r.name }))}
        />

        <div className="flex flex-col gap-1.5">
          <span className="pl-2 text-sm text-slate-800">
            {t("group.days")}
            <span className="text-red-500">*</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((day) => {
              const selected = form.days.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold duration-150 cursor-pointer border ${
                    selected
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-white border-slate-200 text-slate-500 hover:border-blue-300"
                  }`}
                >
                  {t(`group.dayShort.${day}`)}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          type="date"
          label={t("group.startDate")}
          required
          icon={<HiCalendarDays />}
          value={form.startDate}
          onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
        />
        <p className="pl-2 -mt-2 text-xs text-slate-400">{t("group.startDateHint")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TimeInput
            label={t("group.startTime")}
            required
            icon={<HiClock />}
            value={form.startTime}
            onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
          />
          <TimeInput
            label={t("group.endTime")}
            required
            icon={<HiClock />}
            value={form.endTime}
            onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
          />
        </div>
      </div>
    </Dialog>
  );
}

export default GroupActivateDialog;
