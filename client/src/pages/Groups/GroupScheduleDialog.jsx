import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiClock, HiHome, HiPencilSquare, HiUsers } from "react-icons/hi2";
// FaTelegram — hi/hi2 qoidasidan foydalanuvchi aniq so'ragan istisno (ui/TelegramBotLink.jsx).
import { FaTelegram } from "react-icons/fa";
import Dialog from "../../ui/Dialog";
import Select from "../../ui/Select";
import Input from "../../ui/Input";
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
  currentLabel,
  teachers = [],
  assistants = [],
  rooms = [],
  // Jadval maydonlarini (o'qituvchi/xona/kun/vaqt) qulflab, faqat yordamchi
  // o'qituvchini tanlashga ruxsat beruvchi rejim — HOZIR hech qanday
  // chaqiruvchidan berilmaydi (o'qituvchi guruhni tahrirlaganda bu oynada
  // FAQAT nom maydoni ko'rinadi, `canEditSchedule=false` orqali — GroupDetail.jsx).
  // Kelajakda kerak bo'lsa shu prop qayta ishlatilishi mumkin.
  assistantOnly = false,
  // Guruh nomini shu oynadan tahrirlash — Yordamchi o'qituvchidan boshqa
  // hamma uchun yoqiq (GroupDetail.jsx'dagi `canRenameGroup`), `assistantOnly`
  // qulfidan MUSTAQIL — chunki nomlash ruxsati jadval ruxsatidan boshqa.
  canRenameName = false,
  // Jadval qismi faqat guruh FAOL bo'lganda tahrirlanadi (backend
  // group.service.js#reschedule "group.notActive" qaytaradi) — pending
  // guruhda bu oyna faqat nomni o'zgartirish uchun ochiladi, jadval bo'limi
  // butunlay yashiriladi (Faollashtirish o'zi alohida oynada joylashtiradi).
  canEditSchedule = true,
  // Arxivdan qaytarishda o'qituvchi/yordamchi o'zgarmaydi (faqat xona/kun/
  // vaqt band chiqsa tuzatiladi) — shu ikki maydon faqat KO'RSATISH uchun
  // qulflanadi, validatsiyadan ham chiqariladi (Archive/index.jsx).
  lockAssignment = false,
  // Individual guruh (docs/API_CONTRACT_individual_students.md §2): jadval
  // ixtiyoriy (kun/vaqt/xona majburiy emas), yordamchi o'qituvchi yo'q.
  individual = false,
  // Berilsa, standart `PATCH /groups/:id/schedule` o'rniga shu funksiya
  // chaqiriladi (masalan arxivdan qaytarish + yangi jadval bitta so'rovda —
  // Archive/index.jsx) — natija bir xil shaklda qaytarilishi kutiladi:
  // `{ ok, data, msg, conflict }`.
  onSubmit,
  onSaved,
}) {
  const { t } = useTranslation();
  // Nom maydoni AVTOMATIK nom bilan to'ldirilgan holda ochiladi. Guruhning
  // o'z nomi bo'lmasa (`name: null` — odatiy holat) `currentLabel` "Fan - N"
  // ko'rinishidagi avtomatik nomni beradi, shu sabab foydalanuvchi endi
  // nomni qo'lda yozishga majbur emas.
  const [name, setName] = useState(group?.name || currentLabel || "");
  // Telegram guruh manzili nom bilan bir xil ruxsat doirasida (`canRenameName`)
  // tahrirlanadi — alohida `PATCH /groups/:id/telegram` bilan saqlanadi.
  const [telegramLink, setTelegramLink] = useState(group?.telegramLink || "");
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
    if (!open) return;
    const t = setTimeout(fetchSchedule, 0);
    return () => clearTimeout(t);
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
      const missingCore = !form.room || !form.days.length || !form.startTime || !form.endTime;
      const missingTeacher = !assistantOnly && !lockAssignment && !form.teacher;
      if (canEditSchedule && ((missingCore && !individual) || missingTeacher))
        throw new Error("group.activationIncomplete");
      if (canRenameName && !name.trim()) throw new Error("group.invalidName");
      setDisabled(true);

      // Faqat foydalanuvchi ko'rsatilgan nomni HAQIQATAN o'zgartirgan bo'lsa
      // rename yuboriladi. Avtomatik nom o'z holicha qoldirilsa `name` bazada
      // `null` bo'lib qolaveradi — shunda guruh faollashganda raqam
      // (pendingId → activeId) almashsa, nom o'zi yangilanadi.
      const shownName = (group?.name || currentLabel || "").trim();
      if (canRenameName && name.trim() !== shownName) {
        const renameRes = await api.patch(`/groups/${group._id}/rename`, { name: name.trim() });
        if (!renameRes.data.ok) throw new Error(renameRes.data.msg);
      }

      if (canRenameName && telegramLink.trim() !== (group?.telegramLink || "")) {
        const tgRes = await api.patch(`/groups/${group._id}/telegram`, {
          telegramLink: telegramLink.trim() || null,
        });
        if (!tgRes.data.ok) throw new Error(tgRes.data.msg);
      }

      if (canEditSchedule) {
        const resData = onSubmit
          ? await onSubmit(form)
          : (
              await api.patch(`/groups/${group._id}/schedule`, {
                teacherId: form.teacher,
                assistantId: form.assistant,
                roomId: form.room,
                days: form.days,
                startTime: form.startTime,
                endTime: form.endTime,
              })
            ).data;
        const { ok, data, msg, conflict } = resData;
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
      } else {
        successMsg("group.updated");
        onSaved?.();
      }

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
      title={t("group.editTitle")}
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
        {canEditSchedule && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {assistantOnly ? t("group.scheduleAssistantOnlyHint") : t("group.scheduleHint")}
          </p>
        )}

        {canRenameName && (
          <Input
            label={t("group.name")}
            placeholder={currentLabel}
            icon={<HiPencilSquare />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!canEditSchedule}
          />
        )}

        {canRenameName && (
          <Input
            label={t("group.telegramLink")}
            placeholder="https://t.me/+AbCdEf..."
            icon={<FaTelegram />}
            value={telegramLink}
            onChange={(e) => setTelegramLink(e.target.value)}
            hint={t("group.telegramLinkHint")}
          />
        )}

        {canEditSchedule && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label={t("group.teacher")}
                placeholder={t("group.teacher")}
                required={!lockAssignment}
                disabled={assistantOnly || lockAssignment}
                icon={<HiUsers />}
                value={form.teacher}
                onChange={(v) => setForm((prev) => ({ ...prev, teacher: v }))}
                options={centerTeachers.map((s) => ({ value: s._id, label: s.name }))}
              />
              <Select
                label={t("group.room")}
                placeholder={t("group.room")}
                required={!individual}
                disabled={assistantOnly}
                icon={<HiHome />}
                value={form.room}
                onChange={(v) => setForm((prev) => ({ ...prev, room: v }))}
                options={centerRooms.map((r) => ({ value: r._id, label: r.name }))}
              />
            </div>

            {/* Yordamchi o'qituvchi — ixtiyoriy, bo'sh qoldirilsa biriktirish olinadi.
                Bu maydon `assistantOnly` bo'lsa ham HAR DOIM ochiq qoladi. */}
            {!individual && (
            <Select
              label={t("group.assistant")}
              placeholder={t("group.assistantEmpty")}
              disabled={lockAssignment}
              icon={<HiUsers />}
              value={form.assistant}
              onChange={(v) => setForm((prev) => ({ ...prev, assistant: v }))}
              options={[
                { value: "", label: t("group.assistantEmpty") },
                ...centerAssistants.map((s) => ({ value: s._id, label: s.name })),
              ]}
            />
            )}

            <div className="flex flex-col gap-1.5">
              <span className="pl-2 text-sm text-slate-800 dark:text-slate-100">
                {t("group.days")}
                {!individual && <span className="text-red-500">*</span>}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day) => {
                  const selected = form.days.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      disabled={assistantOnly}
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold duration-150 border ${
                        assistantOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                      } ${
                        selected
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700 text-slate-500 dark:text-slate-400 hover:border-blue-300"
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
                required={!individual}
                disabled={assistantOnly}
                icon={<HiClock />}
                value={form.startTime}
                onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
              />
              <TimeInput
                label={t("group.endTime")}
                required={!individual}
                disabled={assistantOnly}
                icon={<HiClock />}
                value={form.endTime}
                onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
              />
            </div>

            {!assistantOnly && form.room && (
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-night-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {t("room.weeklyScheduleTitle")}
                </p>
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
          </>
        )}
      </div>
    </Dialog>
  );
}

export default GroupScheduleDialog;
