import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiBookOpen,
  HiBuildingOffice2,
  HiClock,
  HiHome,
  HiUsers,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import TimeInput from "../../ui/TimeInput";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const EMPTY_FORM = {
  center: "",
  subject: "",
  teacher: "",
  assistant: "",
  room: "",
  days: [],
  startTime: "",
  endTime: "",
  maxStudents: "",
};

// FAQAT create rejimi — tahrirlash keyingi bosqichda (API_CONTRACT.md §7).
// Markaz tanlanganda Fan/O'qituvchi/Xona ro'yxatlari shu markazga
// tegishlilari bilan filtrlanadi. Kunlar/vaqt/xona/o'qituvchi/maxStudents —
// barchasi ixtiyoriy, faqat "Faollashtirish"da majburiy bo'ladi.
//
// `fixedRoom` — RoomDetail sahifasidan "Guruh qo'shish" bosilganda beriladi:
// markaz va xona oldindan tanlangan va qulflangan holda ochiladi (foydalanuvchi
// allaqachon aynan shu xona uchun bo'sh slotni ko'rib turgani sabab qayta
// tanlashga majburlanmaydi).
function GroupDialog({
  open,
  onClose,
  centers = [],
  subjects = [],
  teachers = [],
  assistants = [],
  rooms = [],
  fixedRoom = null,
  onSaved,
}) {
  const { t } = useTranslation();
  // Hodim (Staff) bitta filialga biriktirilgan — maydon yashiriladi va qiymat
  // avtomatik qo'yiladi. Bu MUHIM: keyingi maydonlar `disabled={!form.center}`
  // bilan bog'langan, filial tanlanmasa ular ochilmaydi.
  const onlyCenter = centers.length === 1 ? centers[0]._id : "";
  const showCenterField = centers.length > 1;
  const [form, setForm] = useState(() =>
    fixedRoom
      ? { ...EMPTY_FORM, center: fixedRoom.center, room: fixedRoom._id }
      : { ...EMPTY_FORM, center: onlyCenter },
  );
  const [disabled, setDisabled] = useState(false);

  const centerSubjects = useMemo(
    () => subjects.filter((s) => s.center === form.center),
    [subjects, form.center],
  );
  // Fan tanlangan bo'lsa, faqat o'sha fanni o'qitadigan (StaffDialog'da
  // belgilangan `subjects`) hodimlar chiqadi — boshqa fan o'qituvchisi
  // guruhga tasodifan biriktirilmasin. Hali hech qanday fan biriktirilmagan
  // hodim (`subjects` bo'sh) — eski ma'lumot yoki hali sozlanmagan holat —
  // filtr yumshoq: ko'rinishda qoladi, aks holda ro'yxat kutilmaganda bo'shab
  // qoladi.
  const centerTeachers = useMemo(
    () =>
      teachers.filter(
        (s) =>
          s.center === form.center &&
          (!form.subject || !s.subjects?.length || s.subjects.includes(form.subject)),
      ),
    [teachers, form.center, form.subject],
  );
  // Yordamchi o'qituvchilar — shu filialdagilar (ixtiyoriy maydon), xuddi
  // teacher kabi fan bo'yicha yumshoq filtrlanadi.
  const centerAssistants = useMemo(
    () =>
      assistants.filter(
        (s) =>
          s.center === form.center &&
          (!form.subject || !s.subjects?.length || s.subjects.includes(form.subject)),
      ),
    [assistants, form.center, form.subject],
  );
  const centerRooms = useMemo(
    () => rooms.filter((r) => r.center === form.center),
    [rooms, form.center],
  );

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
      if (!form.center || !form.subject) throw new Error("group.fillTheRows");
      setDisabled(true);

      const body = {
        centerId: form.center,
        subjectId: form.subject,
        teacherId: form.teacher || undefined,
        assistantId: form.assistant || undefined,
        roomId: form.room || undefined,
        days: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
        maxStudents: form.maxStudents === "" ? null : Number(form.maxStudents),
      };

      const res = await api.post("/groups", body);
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
      title={t("group.create")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={disabled} onClick={submit}>
            {t("common.create")}
          </Button>
        </>
      }
    >
      <div
        onKeyDown={(k) => k.key === "Enter" && submit()}
        className="flex flex-col gap-3 w-full"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {showCenterField && (
            <Select
              label={t("group.center")}
              placeholder={t("group.center")}
              required
              disabled={!!fixedRoom}
              icon={<HiBuildingOffice2 />}
              value={form.center}
              onChange={(v) =>
                setForm((prev) => ({
                  ...prev,
                  center: v,
                  subject: "",
                  teacher: "",
                  assistant: "",
                  room: "",
                }))
              }
              options={centers.map((c) => ({ value: c._id, label: c.name }))}
            />
          )}
          <Select
            label={t("group.subject")}
            placeholder={t("group.subject")}
            required
            disabled={!form.center}
            icon={<HiBookOpen />}
            value={form.subject}
            onChange={(v) => setForm((prev) => ({ ...prev, subject: v }))}
            options={centerSubjects.map((s) => ({ value: s._id, label: s.name }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label={t("group.teacher")}
            placeholder={t("group.teacher")}
            disabled={!form.center}
            icon={<HiUsers />}
            value={form.teacher}
            onChange={(v) => setForm((prev) => ({ ...prev, teacher: v }))}
            options={centerTeachers.map((s) => ({ value: s._id, label: s.name }))}
          />
          <Select
            label={t("group.room")}
            placeholder={t("group.room")}
            disabled={!form.center || !!fixedRoom}
            icon={<HiHome />}
            value={form.room}
            onChange={(v) => setForm((prev) => ({ ...prev, room: v }))}
            options={centerRooms.map((r) => ({ value: r._id, label: r.name }))}
          />
        </div>

        {/* Yordamchi o'qituvchi — IXTIYORIY (bo'sh qoldirish mumkin) */}
        <Select
          label={t("group.assistant")}
          placeholder={t("group.assistantEmpty")}
          disabled={!form.center}
          icon={<HiUsers />}
          value={form.assistant}
          onChange={(v) => setForm((prev) => ({ ...prev, assistant: v }))}
          options={[
            { value: "", label: t("group.assistantEmpty") },
            ...centerAssistants.map((s) => ({ value: s._id, label: s.name })),
          ]}
        />

        <div className="flex flex-col gap-1.5">
          <span className="pl-2 text-sm text-slate-800">{t("group.days")}</span>
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
            icon={<HiClock />}
            value={form.startTime}
            onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
          />
          <TimeInput
            label={t("group.endTime")}
            icon={<HiClock />}
            value={form.endTime}
            onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
          />
        </div>

        <Input
          type="number"
          label={t("group.maxStudents")}
          placeholder={t("group.maxStudents")}
          icon={<HiUsers />}
          value={form.maxStudents}
          onChange={(e) => setForm((prev) => ({ ...prev, maxStudents: e.target.value }))}
        />
      </div>
    </Dialog>
  );
}

export default GroupDialog;
