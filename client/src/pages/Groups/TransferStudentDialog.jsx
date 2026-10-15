import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiArrowsRightLeft,
  HiBanknotes,
  HiBuildingOffice2,
  HiCalendarDays,
  HiClock,
  HiMapPin,
  HiUser,
  HiUserGroup,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// O'quvchini boshqa filial/guruhga o'tkazish — bitta atomar endpoint
// (API_CONTRACT_student_transfer.md §3). Oldingi baholar, davomat va
// to'lovlar tarixi yangi guruhda o'z sanasi bilan ko'rinadi, qoldiq (avans
// yoki qarz) ham o'tadi — hammasini server bajaradi.
function TransferStudentDialog({
  open,
  onClose,
  student,
  entry,
  centers = [],
  groups = [],
  subjects = [],
  teachers = [],
  onSaved,
}) {
  const { t } = useTranslation();
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((s) => [s._id, s.name])), [subjects]);
  const subjectPriceMap = useMemo(
    () => Object.fromEntries(subjects.map((s) => [s._id, s.price])),
    [subjects],
  );

  const groupLabel = (g) =>
    `${subjectMap[g.subject] || "?"} - ${g.status === "pending" ? g.pendingId : g.activeId}${
      g.status === "pending" ? ` - ${t("group.pendingSuffix")}` : ""
    }`;

  const teacherMap = useMemo(() => Object.fromEntries(teachers.map((s) => [s._id, s.name])), [teachers]);

  // Ro'yxatdagi ikkinchi qator: o'qituvchi · kunlar · HH:mm - HH:mm · xona.
  // Ma'lumoti yo'q bo'lak ko'rsatilmaydi.
  const groupDescription = (g) => {
    const parts = [
      g.teacher && teacherMap[g.teacher] && { key: "teacher", icon: <HiUser />, text: teacherMap[g.teacher] },
      g.days?.length && {
        key: "days",
        icon: <HiCalendarDays />,
        text: DAY_ORDER.filter((d) => g.days.includes(d)).map((d) => t(`group.dayShort.${d}`)).join("-"),
      },
      g.startTime && g.endTime && { key: "time", icon: <HiClock />, text: `${g.startTime} - ${g.endTime}` },
      g.roomName && { key: "room", icon: <HiMapPin />, text: g.roomName },
    ].filter(Boolean);
    if (!parts.length) return null;
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1 whitespace-nowrap">
            <span className="text-slate-400 dark:text-slate-500">{p.icon}</span>
            {p.text}
          </span>
        ))}
      </span>
    );
  };

  // Hodim (Staff) bitta filialga biriktirilgan — maydon yashiriladi va qiymat
  // avtomatik qo'yiladi (maqsad guruhlar ro'yxati `form.center` ga bog'liq).
  const onlyCenter = centers.length === 1 ? centers[0]._id : "";
  const showCenterField = centers.length > 1;
  const [form, setForm] = useState({ center: onlyCenter, group: "", price: "" });
  const [disabled, setDisabled] = useState(false);

  const targetGroups = groups.filter(
    (g) => g.center === form.center && g.status !== "finished" && g._id !== entry?.group,
  );

  const submit = async () => {
    try {
      if (!form.center || !form.group) throw new Error("group.fillTheRows");
      setDisabled(true);

      const res = await api.post(`/students/${student._id}/groups/${entry._id}/transfer`, {
        centerId: form.center,
        groupId: form.group,
        price: form.price === "" ? undefined : Number(form.price),
      });
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);

      successMsg("student.transferred");
      onSaved?.();
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
      title={t("student.transferTitle")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button color="blue" className="gap-1.5" loading={disabled} onClick={submit}>
            <HiArrowsRightLeft className="text-base" />
            {t("student.transferAction")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 w-full">
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("student.transferHint", { name: student?.fullName })}</p>

        {showCenterField && (
          <Select
            label={t("student.center")}
            placeholder={t("student.center")}
            required
            icon={<HiBuildingOffice2 />}
            value={form.center}
            onChange={(v) => setForm((prev) => ({ ...prev, center: v, group: "" }))}
            options={centers.map((c) => ({ value: c._id, label: c.name }))}
          />
        )}
        <Select
          label={t("student.group")}
          placeholder={t("student.group")}
          required
          disabled={!form.center}
          icon={<HiUserGroup />}
          value={form.group}
          onChange={(v) => {
            const selected = groups.find((g) => g._id === v);
            const groupPrice = selected ? subjectPriceMap[selected.subject] : undefined;
            setForm((prev) => ({ ...prev, group: v, price: groupPrice ?? prev.price }));
          }}
          options={targetGroups.map((g) => ({
            value: g._id,
            label: groupLabel(g),
            description: groupDescription(g),
          }))}
        />
        <Input
          type="number"
          label={t("student.price")}
          placeholder={t("student.price")}
          icon={<HiBanknotes />}
          value={form.price}
          onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
        />
      </div>
    </Dialog>
  );
}

export default TransferStudentDialog;
