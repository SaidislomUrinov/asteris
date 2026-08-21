import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiClock, HiHome, HiUsers } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Select from "../../ui/Select";
import TimeInput from "../../ui/TimeInput";
import Button from "../../ui/Button";
import Loading from "../../ui/Loading";
import WeeklyRoomSchedule from "../Rooms/WeeklyRoomSchedule";
import { toHHMM, toMinutes } from "../../utils/schedule";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DEFAULT_DURATION = 90;

// Allaqachon FAOL guruhning kun/xona/o'qituvchi/soatini qayta belgilash —
// GroupActivateDialog'dagi kabi maydonlar, lekin qo'shimcha ravishda
// tanlangan xonaning haftalik jadvali JONLI ko'rsatiladi: bo'sh joyga
// bosilsa shu kun+vaqt avtomatik tanlanadi (davomiylik saqlanadi), band
// joylar esa (o'zining joriy o'rni alohida rangda) ko'rinib turadi.
function GroupScheduleDialog({
  open,
  onClose,
  group,
  teachers = [],
  assistants = [],
  rooms = [],
  onSaved,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    teacher: group?.teacher || "",
    assistant: group?.assistant || "",
    room: group?.room || "",
    days: group?.days || [],
    startTime: group?.startTime || "",
    endTime: group?.endTime || "",
  }));
  const [disabled, setDisabled] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const centerTeachers = teachers.filter((s) => s.center === group?.center);
  const centerAssistants = assistants.filter((s) => s.center === group?.center);
  const centerRooms = rooms.filter((r) => r.center === group?.center);

  const fetchSchedule = useCallback(async () => {
    if (!form.room) {
      setSchedule(null);
      return;
    }
    try {
      setScheduleLoading(true);
      const res = await api.get(`/rooms/${form.room}/schedule`);
      const { ok, data } = res.data;
      if (ok) setSchedule(data);
    } catch {
      // faqat qo'shimcha vizual yordam, xato bo'lsa jim o'tkazamiz
    } finally {
      setScheduleLoading(false);
    }
  }, [form.room]);

  useEffect(() => {
    if (open) fetchSchedule();
  }, [open, fetchSchedule]);

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }));
  };

  // Bo'sh joy bosilsa — shu kun yoqiladi va joriy davomiylik saqlangan
  // holda vaqt shu joyga ko'chadi (bo'sh oraliqdan oshib ketmaydi).
  const handleFreeSlotClick = (day, slot) => {
    const duration =
      form.startTime && form.endTime
        ? Math.max(15, toMinutes(form.endTime) - toMinutes(form.startTime))
        : DEFAULT_DURATION;
    const newStart = slot.start;
    const newEnd = Math.min(slot.end, newStart + duration);
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days : [...prev.days, day],
      startTime: toHHMM(newStart),
      endTime: toHHMM(newEnd),
    }));
  };

  const submit = async () => {
    try {
      if (!form.teacher || !form.room || !form.days.length || !form.startTime || !form.endTime)
        throw new Error("group.activationIncomplete");
      setDisabled(true);

      const res = await api.patch(`/groups/${group._id}/schedule`, {
        teacherId: form.teacher,
        assistantId: form.assistant,
        roomId: form.room,
        days: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
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
      title={t("group.scheduleTitle")}
      className="md:!w-[860px] max-w-[95vw]"
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button color="blue" loading={disabled} onClick={submit}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 w-full">
        <p className="text-sm text-slate-500">{t("group.scheduleHint")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        </div>

        {/* Yordamchi o'qituvchi — ixtiyoriy, bo'sh qoldirilsa biriktirish olinadi */}
        <Select
          label={t("group.assistant")}
          placeholder={t("group.assistantEmpty")}
          icon={<HiUsers />}
          value={form.assistant}
          onChange={(v) => setForm((prev) => ({ ...prev, assistant: v }))}
          options={[
            { value: "", label: t("group.assistantEmpty") },
            ...centerAssistants.map((s) => ({ value: s._id, label: s.name })),
          ]}
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

        {form.room && (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <p className="text-sm font-semibold text-slate-700">{t("room.weeklyScheduleTitle")}</p>
            {scheduleLoading || !schedule ? (
              <Loading height="15vh" />
            ) : (
              <WeeklyRoomSchedule
                groups={schedule.groups}
                currentGroupId={group?._id}
                onFreeSlotClick={handleFreeSlotClick}
                compact
              />
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default GroupScheduleDialog;
