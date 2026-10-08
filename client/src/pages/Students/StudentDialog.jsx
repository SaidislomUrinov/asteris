import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiBanknotes,
  HiBuildingOffice2,
  HiCheckCircle,
  HiOutlineChevronRight,
  HiDevicePhoneMobile,
  HiPhone,
  HiUser,
  HiUserGroup,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import Avatar from "../../ui/Avatar";
import TelegramPhoneField from "../../ui/TelegramPhoneField";
import { toast } from "sonner";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import OpeningDebtsEditor from "./OpeningDebtsEditor";
import StudentPhotoCapture from "./StudentPhotoCapture";
import { uploadStudentPhoto } from "../../utils/studentPhoto";
import { EMPTY_OPENING, buildOpeningPayload, openingTotal } from "./openingDebts.util";
import {
  EMPTY_TELEGRAM_FORM,
  assertTelegramForm,
  buildTelegramPayload,
  telegramFormFromDto,
} from "../../utils/telegramPhone";

const PHONE_PREFIX = "+998";

// "+998901234567" → "901234567" (prefiksli inputga qo'yish uchun); eski
// formatdagi yozuvlar uchun ham — oxirgi 9 ta raqam.
const phoneSuffix = (raw) => {
  const digits = (raw || "").replace(/\D/g, "");
  return (digits.length > 9 && digits.startsWith("998") ? digits.slice(3) : digits).slice(-9);
};

const EMPTY_FORM = {
  center: "",
  group: "",
  fullName: "",
  phone: "",
  parentPhone: "",
  price: "",
  ...EMPTY_TELEGRAM_FORM,
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
  const [openingOpen, setOpeningOpen] = useState(false);
  const openingSum = openingTotal(opening.openingDebts);
  // Bir nechta bola bitta telefon raqamda bo'lishi mumkin — lookup endi
  // massiv qaytaradi (API_CONTRACT.md §2). Foydalanuvchi ro'yxatdan birini
  // tanlasa "mavjud o'quvchi" oqimi (existingStudentId), tanlamasa/tozalasa
  // — har doim yangi Student hujjati yaratiladi (dublikat telefon bilan ham).
  const [matches, setMatches] = useState([]);
  const [existingStudent, setExistingStudent] = useState(null);
  // Guruh detalidan qo'shishda olingan/tanlangan rasm
  // (docs/API_CONTRACT_enroll_with_photo.md) — saqlashdan keyin yuboriladi.
  const [photoFile, setPhotoFile] = useState(null);

  useEffect(() => {
    const suffix = form.phone.trim();
    if (suffix.length < 9) {
      const clearTimer = setTimeout(() => setMatches([]), 0);
      return () => clearTimeout(clearTimer);
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/students/lookup", { params: { phone: PHONE_PREFIX + suffix } });
        const { ok, data } = res.data;
        setMatches(ok && Array.isArray(data) ? data : []);
      } catch {
        // lookup xatosi jim o'tkaziladi — foydalanuvchi qo'lda kiritishda davom etadi
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.phone]);

  const selectExisting = (student) => {
    setExistingStudent(student);
    setForm((prev) => ({
      ...prev,
      fullName: student.fullName || "",
      parentPhone: phoneSuffix(student.parentPhone) || prev.parentPhone,
      ...telegramFormFromDto(student),
    }));
  };

  const clearExisting = () => {
    setExistingStudent(null);
    setForm((prev) => ({ ...prev, fullName: "", ...EMPTY_TELEGRAM_FORM }));
  };

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
      setDisabled(true);

      const body = {
        fullName: form.fullName.trim() || undefined,
        phone: PHONE_PREFIX + form.phone.trim(),
        parentPhone: form.parentPhone.trim() ? PHONE_PREFIX + form.parentPhone.trim() : "",
        centerId: form.center,
        groupId: form.group,
        price: form.price === "" ? undefined : Number(form.price),
        existingStudentId: existingStudent?._id || undefined,
        ...buildTelegramPayload(form),
        openingDebts: openingPayload.openingDebts,
        openingBalance: openingPayload.openingBalance,
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

        <Input
          label={t("student.phone")}
          placeholder="90 123 45 67"
          required
          icon={<HiDevicePhoneMobile />}
          prefix={PHONE_PREFIX}
          value={form.phone}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
            if (existingStudent) {
              setExistingStudent(null);
              setForm((prev) => ({ ...prev, phone: digits, fullName: "", ...EMPTY_TELEGRAM_FORM }));
              return;
            }
            setForm((prev) => ({ ...prev, phone: digits, fullName: "" }));
          }}
        />

        {existingStudent ? (
          <div className="flex items-center justify-between gap-2 -mt-2 pl-2 pr-1 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <p className="flex items-center gap-2 text-xs min-w-0">
              <Avatar user={{ _id: existingStudent._id, name: existingStudent.fullName, avatar: existingStudent.photo }} size={24} />
              <HiCheckCircle className="shrink-0" /> {t("student.existingStudentFound", { name: existingStudent.fullName })}
            </p>
            <button
              type="button"
              className="text-xs font-semibold underline shrink-0 cursor-pointer"
              onClick={clearExisting}
            >
              {t("student.chooseDifferent")}
            </button>
          </div>
        ) : null}
        {existingStudent?.shared && (
          <p className="-mt-1 text-xs text-slate-500 dark:text-slate-400">{t("student.sharedContactHint")}</p>
        )}
        {existingStudent ? null : matches.length > 0 ? (
          <div className="flex flex-col gap-1 -mt-1">
            <p className="pl-2 text-xs text-slate-400 dark:text-slate-500">{t("student.existingMatchesHint")}</p>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {matches.map((m) => (
                <button
                  type="button"
                  key={m._id}
                  onClick={() => selectExisting(m)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-night-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/15 text-left transition-colors cursor-pointer"
                >
                  <Avatar user={{ _id: m._id, name: m.fullName, avatar: m.photo }} size={32} />
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{m.fullName}</span>
                    {m.parentPhone && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{m.parentPhone}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <p className="pl-2 text-xs text-slate-400 dark:text-slate-500">{t("student.newStudentHint")}</p>
          </div>
        ) : (
          <p className="pl-2 -mt-2 text-xs text-slate-400 dark:text-slate-500">{t("student.existingPhoneHint")}</p>
        )}

        <TelegramPhoneField
          same={form.telegramSame}
          onSameChange={(v) => setForm((prev) => ({ ...prev, telegramSame: v }))}
          value={form.telegramPhone}
          onChange={(v) => setForm((prev) => ({ ...prev, telegramPhone: v }))}
          label={t("telegramPhone.studentLabel")}
        />
        <Input
          label={t("student.fullName")}
          placeholder={t("student.fullName")}
          icon={<HiUser />}
          readOnly={!!existingStudent}
          value={form.fullName}
          onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
        />
        <TelegramPhoneField
          same={form.parentTelegramSame}
          onSameChange={(v) => setForm((prev) => ({ ...prev, parentTelegramSame: v }))}
          value={form.parentTelegramPhone}
          onChange={(v) => setForm((prev) => ({ ...prev, parentTelegramPhone: v }))}
          label={t("telegramPhone.parentLabel")}
        >
          <Input
            label={t("student.parentPhone")}
            placeholder="90 123 45 67"
            hint={t("student.parentPhoneHint")}
            icon={<HiPhone />}
            prefix={PHONE_PREFIX}
            variant="white"
            value={form.parentPhone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, parentPhone: e.target.value.replace(/\D/g, "").slice(0, 9) }))
            }
          />
        </TelegramPhoneField>
        <Input
          type="number"
          label={t("student.price")}
          placeholder={t("student.price")}
          icon={<HiBanknotes />}
          value={form.price}
          onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
        />

        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setOpeningOpen((v) => !v)}
            className="flex items-center justify-between gap-2 py-2 cursor-pointer text-left"
          >
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
              <HiOutlineChevronRight
                className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${openingOpen ? "rotate-90" : ""}`}
              />
              {t("student.openingSectionTitle")}
            </span>
            {openingSum > 0 && (
              <Chip
                color="orange"
                className="normal-case"
                value={`${openingSum.toLocaleString("uz-UZ")} ${t("student.somSuffix")}`}
              />
            )}
          </button>
          {openingOpen && (
            <div
              className="border-t border-slate-100 dark:border-night-700 pt-3 mt-1"
              onKeyDown={(e) => e.stopPropagation()}
            >
              <OpeningDebtsEditor value={opening} onChange={setOpening} />
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export default StudentDialog;
