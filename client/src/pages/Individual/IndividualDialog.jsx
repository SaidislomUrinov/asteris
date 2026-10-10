import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiBanknotes,
  HiBookOpen,
  HiBuildingOffice2,
  HiCalendarDays,
  HiClock,
  HiHome,
  HiReceiptPercent,
  HiUsers,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import TimeInput from "../../ui/TimeInput";
import DayPicker from "../../ui/DayPicker";
import StudentContactFields from "../Students/StudentContactFields";
import { EMPTY_CONTACT_FORM, buildContactPayload } from "../Students/studentContact.util";
import OpeningDebtsSection from "../Students/OpeningDebtsSection";
import { EMPTY_OPENING, buildOpeningPayload } from "../Students/openingDebts.util";
import { tashkentDay } from "../Students/startDate.util";
import { assertTelegramForm } from "../../utils/telegramPhone";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const DEFAULT_PERCENT = 50;

function SectionTitle({ children }) {
  return (
    <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
      {children}
    </p>
  );
}

/**
 * Individual o'quvchi qo'shish — POST /groups/individual
 * (docs/API_CONTRACT_individual_students.md §2). O'quvchi maydonlari
 * StudentDialog bilan umumiy (StudentContactFields), qo'shimcha "Dars"
 * bo'limi: filial, fan, o'qituvchi (fan bo'yicha), foiz, boshlanish sanasi
 * va ixtiyoriy jadval. To'qnashuv tekshirilmaydi.
 */
function IndividualDialog({ open, onClose, centers = [], subjects = [], teachers = [], rooms = [], onSaved }) {
  const { t } = useTranslation();
  const onlyCenter = centers.length === 1 ? centers[0]._id : "";
  const showCenterField = centers.length > 1;
  const [form, setForm] = useState(() => ({
    ...EMPTY_CONTACT_FORM,
    center: onlyCenter,
    subject: "",
    teacher: "",
    room: "",
    percent: String(DEFAULT_PERCENT),
    price: "",
    startDate: tashkentDay(),
    days: [],
    startTime: "",
    endTime: "",
  }));
  const [existingStudent, setExistingStudent] = useState(null);
  const [opening, setOpening] = useState(EMPTY_OPENING);
  const [disabled, setDisabled] = useState(false);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const centerSubjects = useMemo(
    () => subjects.filter((s) => s.center === form.center),
    [subjects, form.center],
  );
  // GroupDialog bilan bir xil yumshoq filtr: fani belgilanmagan o'qituvchi ham ko'rinadi.
  const centerTeachers = useMemo(
    () =>
      teachers.filter(
        (s) =>
          s.center === form.center &&
          (!form.subject || !s.subjects?.length || s.subjects.includes(form.subject)),
      ),
    [teachers, form.center, form.subject],
  );
  const centerRooms = useMemo(() => rooms.filter((r) => r.center === form.center), [rooms, form.center]);

  const submit = async () => {
    try {
      if (!form.center || !form.subject || !form.teacher || !form.phone.trim())
        throw new Error("group.fillTheRows");
      const percent = Number(form.percent);
      if (form.percent === "" || !Number.isFinite(percent) || percent < 0 || percent > 100)
        throw new Error("individual.invalidPercent");
      assertTelegramForm(form);
      const openingPayload = buildOpeningPayload(opening);
      setDisabled(true);

      const body = {
        ...buildContactPayload(form, existingStudent),
        centerId: form.center,
        subjectId: form.subject,
        teacherId: form.teacher,
        teacherPercent: percent,
        price: form.price === "" ? undefined : Number(form.price),
        startDate: form.startDate || undefined,
        days: form.days.length ? form.days : undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        roomId: form.room || undefined,
        openingDebts: openingPayload.openingDebts,
        openingBalance: openingPayload.openingBalance,
      };

      const res = await api.post("/groups/individual", body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);

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
      title={t("individual.create")}
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
      <div onKeyDown={(k) => k.key === "Enter" && submit()} className="flex flex-col gap-3 w-full">
        <SectionTitle>{t("individual.studentSection")}</SectionTitle>
        <StudentContactFields
          form={form}
          setForm={setForm}
          existingStudent={existingStudent}
          setExistingStudent={setExistingStudent}
          hints={false}
        />

        <div className="border-t border-slate-100 dark:border-night-700" />
        <SectionTitle>{t("individual.lessonSection")}</SectionTitle>

        <div className={`grid grid-cols-1 ${showCenterField ? "sm:grid-cols-2" : ""} gap-3`}>
          {showCenterField && (
            <Select
              label={t("group.center")}
              placeholder={t("group.center")}
              required
              icon={<HiBuildingOffice2 />}
              value={form.center}
              onChange={(v) => set({ center: v, subject: "", teacher: "", room: "" })}
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
            onChange={(v) => {
              const subject = subjects.find((s) => s._id === v);
              setForm((prev) => ({
                ...prev,
                subject: v,
                price: subject?.price != null ? String(subject.price) : prev.price,
                // Tanlangan o'qituvchi yangi fanni o'qitmasa — tozalanadi.
                teacher: teachers.some(
                  (s) => s._id === prev.teacher && (!s.subjects?.length || s.subjects.includes(v)),
                )
                  ? prev.teacher
                  : "",
              }));
            }}
            options={centerSubjects.map((s) => ({ value: s._id, label: s.name }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <Select
            label={t("group.teacher")}
            placeholder={t("group.teacher")}
            required
            disabled={!form.center}
            icon={<HiUsers />}
            value={form.teacher}
            onChange={(v) => set({ teacher: v })}
            options={centerTeachers.map((s) => ({ value: s._id, label: s.name }))}
          />
          <Input
            type="number"
            label={t("individual.percent")}
            placeholder="50"
            required
            min={0}
            max={100}
            icon={<HiReceiptPercent />}
            value={form.percent}
            onChange={(e) => set({ percent: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            type="number"
            label={t("student.price")}
            placeholder={t("student.price")}
            icon={<HiBanknotes />}
            value={form.price}
            onChange={(e) => set({ price: e.target.value })}
          />
          <Input
            type="date"
            label={t("individual.startDate")}
            icon={<HiCalendarDays />}
            value={form.startDate}
            onChange={(e) => set({ startDate: e.target.value })}
          />
        </div>

        <DayPicker
          placeholder={`${t("group.days")} (${t("individual.optional")})`}
          value={form.days}
          onChange={(days) => set({ days })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TimeInput
            label={t("group.startTime")}
            icon={<HiClock />}
            value={form.startTime}
            onChange={(e) => set({ startTime: e.target.value })}
          />
          <TimeInput
            label={t("group.endTime")}
            icon={<HiClock />}
            value={form.endTime}
            onChange={(e) => set({ endTime: e.target.value })}
          />
          <Select
            label={t("group.room")}
            placeholder={t("group.room")}
            disabled={!form.center}
            icon={<HiHome />}
            value={form.room}
            onChange={(v) => set({ room: v })}
            options={[
              { value: "", label: "—" },
              ...centerRooms.map((r) => ({ value: r._id, label: r.name })),
            ]}
          />
        </div>

        <OpeningDebtsSection value={opening} onChange={setOpening} />
      </div>
    </Dialog>
  );
}

export default IndividualDialog;
