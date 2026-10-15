import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBanknotes, HiBuildingOffice2, HiUserGroup } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import { toast } from "sonner";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import OpeningDebtsSection from "./OpeningDebtsSection";
import StudentContactFields from "./StudentContactFields";
import { EMPTY_CONTACT_FORM, buildContactPayload } from "./studentContact.util";
import StudentPhotoCapture from "./StudentPhotoCapture";
import StartDateField from "./StartDateField";
import { assertStartDate, startDateMinOf, tashkentDay } from "./startDate.util";
import { uploadStudentPhoto } from "../../utils/studentPhoto";
import { EMPTY_OPENING, buildOpeningPayload } from "./openingDebts.util";
import { assertTelegramForm } from "../../utils/telegramPhone";

const EMPTY_FORM = {
  center: "",
  group: "",
  price: "",
  ...EMPTY_CONTACT_FORM,
};

// O'quvchini guruhga yozish (yaratish yoki mavjud telefon bo'lsa qo'shimcha
// guruhga qo'shish) — API_CONTRACT.md'dagi Group/Subject naqshiga mos.
// `fixedGroup` berilsa (GroupDetail ichidan chaqirilganda) markaz/guruh
// tanlovi yashiriladi, to'g'ridan-to'g'ri shu guruhga yoziladi.
function StudentDialog({
  open,
  onClose,
  centers = [],
  groups = [],
  subjects = [],
  fixedGroup = null,
  onSaved,
}) {
  const { t } = useTranslation();
  const subjectPriceMap = useMemo(
    () => Object.fromEntries(subjects.map((s) => [s._id, s.price])),
    [subjects],
  );
  // Hodim (Staff) bitta filialga biriktirilgan — maydon yashiriladi va qiymat
  // avtomatik qo'yiladi (Guruh tanlovi `disabled={!form.center}` ga bog'liq).
  const onlyCenter = centers.length === 1 ? centers[0]._id : "";
  const showCenterField = centers.length > 1;
  const [form, setForm] = useState(() =>
    fixedGroup
      ? {
          ...EMPTY_FORM,
          center: fixedGroup.center,
          group: fixedGroup._id,
          price: subjectPriceMap[fixedGroup.subject] ?? "",
        }
      : { ...EMPTY_FORM, center: onlyCenter },
  );
  const [disabled, setDisabled] = useState(false);
  // "Oldingi qarzdorlik" — ko'chirishdan oldingi qarz (API_CONTRACT_opening_debts.md §3.1).
  const [opening, setOpening] = useState(EMPTY_OPENING);
  const [existingStudent, setExistingStudent] = useState(null);
  // Guruh detalidan qo'shishda olingan/tanlangan rasm
  // (docs/API_CONTRACT_enroll_with_photo.md) — saqlashdan keyin yuboriladi.
  const [photoFile, setPhotoFile] = useState(null);
  // "O'qishni boshlagan sana" — faqat FAOL guruhga qo'shishda
  // (API_CONTRACT_group_month_filter_and_start_date.md §B.5). Kech kiritilgan
  // o'quvchi uchun to'lov shu sanadan hisoblanadi; default — bugun.
  const [startDate, setStartDate] = useState(() => tashkentDay());
  const selectedGroup = fixedGroup || groups.find((g) => g._id === form.group) || null;
  const showStartDate = selectedGroup?.status === "active";
  const startDateMin = startDateMinOf(selectedGroup?.activatedAt);

  const centerGroups = useMemo(
    () =>
      groups.filter((g) => g.center === form.center && g.status !== "finished"),
    [groups, form.center],
  );

  const submit = async () => {
    try {
      if (!form.center || !form.group || !form.phone.trim())
        throw new Error("student.fillTheRows");
      assertTelegramForm(form);
      const openingPayload = buildOpeningPayload(opening);
      if (showStartDate) assertStartDate(startDate, startDateMin);
      // Bugun (yoki bo'sh) bo'lsa yuborilmaydi — server avvalgidek "hozir"ni oladi.
      const sendStartDate = showStartDate && startDate && startDate !== tashkentDay();
      setDisabled(true);

      const body = {
        ...buildContactPayload(form, existingStudent),
        centerId: form.center,
        groupId: form.group,
        price: form.price === "" ? undefined : Number(form.price),
        openingDebts: openingPayload.openingDebts,
        openingBalance: openingPayload.openingBalance,
        startDate: sendStartDate ? startDate : undefined,
      };

      const res = await api.post("/students", body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);

      let saved = data;
      if (fixedGroup && photoFile && data?._id) {
        // O'quvchi allaqachon yaratilgan — rasm xatosi butun amalni
        // bekor qilmaydi, faqat ogohlantiradi (rasmni keyin ⋮ dan qo'shish mumkin).
        try {
          const { photo } = await uploadStudentPhoto(data._id, photoFile);
          saved = { ...data, photo };
        } catch {
          toast.warning(t("student.photoSaveFailed"));
        }
      }

      successMsg(msg);
      onSaved?.(saved);
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
      title={t("student.create")}
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
        {fixedGroup && (
          <StudentPhotoCapture
            value={photoFile}
            onChange={setPhotoFile}
            existingPhoto={existingStudent?.photo || ""}
            active={open}
            disabled={disabled}
          />
        )}

        {!fixedGroup && (
          <div
            className={`grid grid-cols-1 ${showCenterField ? "sm:grid-cols-2" : ""} gap-3`}
          >
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
                setForm((prev) => ({
                  ...prev,
                  group: v,
                  price: groupPrice ?? prev.price,
                }));
              }}
              options={centerGroups.map((g) => ({ value: g._id, label: g.label }))}
            />
          </div>
        )}

        <StudentContactFields
          form={form}
          setForm={setForm}
          existingStudent={existingStudent}
          setExistingStudent={setExistingStudent}
        />
        <Input
          type="number"
          label={t("student.price")}
          placeholder={t("student.price")}
          icon={<HiBanknotes />}
          value={form.price}
          onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
        />

        {showStartDate && <StartDateField value={startDate} onChange={setStartDate} min={startDateMin} />}

        <OpeningDebtsSection value={opening} onChange={setOpening} />
      </div>
    </Dialog>
  );
}

export default StudentDialog;
