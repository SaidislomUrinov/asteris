import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAcademicCap,
  HiBookOpen,
  HiBuildingOffice2,
  HiChevronDown,
  HiDevicePhoneMobile,
  HiMegaphone,
  HiUser,
  HiClock,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Textarea from "../../ui/Textarea";
import Button from "../../ui/Button";
import TelegramPhoneField from "../../ui/TelegramPhoneField";
import DayPicker from "../../ui/DayPicker";
import {
  assertTelegramForm,
  buildTelegramPayload,
  telegramFormFromDto,
} from "../../utils/telegramPhone";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { PHONE_PREFIX, SOURCES, TIMES } from "./leadOptions";

const stripPrefix = (phone) => (phone || "").replace(PHONE_PREFIX, "");

// Yaratish va tahrirlash — bitta forma. `lead` berilsa tahrirlash rejimi.
function LeadDialog({ open, onClose, lead = null, centers = [], subjects = [], defaultSubject = "", onSaved }) {
  const { t } = useTranslation();
  const onlyCenter = centers.length === 1 ? centers[0]._id : "";
  const [form, setForm] = useState(() => ({
    center: lead?.center || onlyCenter,
    subject: lead?.subject || defaultSubject,
    fullName: lead?.fullName || "",
    phone: stripPrefix(lead?.phone),
    parentPhone: stripPrefix(lead?.parentPhone),
    preferredDays: lead?.preferredDays || [],
    preferredTime: lead?.preferredTime || "any",
    level: lead?.level || "",
    source: lead?.source || "walkIn",
    note: lead?.note || "",
    ...telegramFormFromDto(lead),
  }));
  const [saving, setSaving] = useState(false);
  // Qo'shimcha maydonlar (daraja, manba, ota-ona raqami, izoh) yangi lid
  // qo'shishda yopiq boshlanadi — tez kiritish uchun faqat 4 ta asosiy maydon
  // ko'rinadi (ism, telefon, fan, qachon). Tahrirlashda — agar shu
  // maydonlarning birortasida qiymat bo'lsa, ochiq boshlanadi.
  const [showMore, setShowMore] = useState(
    () => !!(lead?.level || lead?.note || (lead?.source && lead.source !== "walkIn") || lead?.parentPhone),
  );

  const centerSubjects = useMemo(
    () => subjects.filter((s) => s.center === form.center),
    [subjects, form.center],
  );
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const digits = (v) => v.replace(/\D/g, "").slice(0, 9);

  const submit = async () => {
    try {
      if (!form.center || !form.subject || !form.fullName.trim() || !form.phone) {
        throw new Error("lead.fillTheRows");
      }
      if (form.phone.length !== 9 || (form.parentPhone && form.parentPhone.length !== 9)) {
        throw new Error("lead.invalidPhone");
      }
      assertTelegramForm(form);
      setSaving(true);
      const body = {
        centerId: form.center,
        subjectId: form.subject,
        fullName: form.fullName.trim(),
        phone: PHONE_PREFIX + form.phone,
        parentPhone: form.parentPhone ? PHONE_PREFIX + form.parentPhone : "",
        preferredDays: form.preferredDays,
        preferredTime: form.preferredTime,
        level: form.level,
        source: form.source,
        note: form.note,
        ...buildTelegramPayload(form, lead || undefined),
      };
      const res = lead
        ? await api.patch(`/student-leads/${lead._id}`, body)
        : await api.post("/student-leads", body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      onSaved?.(data);
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
      title={lead ? t("lead.edit") : t("lead.create")}
      description={lead ? undefined : t("lead.createDesc")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={submit}>
            {lead ? t("common.save") : t("common.create")}
          </Button>
        </>
      }
    >
      {/* To'rtta asosiy maydon tepada, bitta ustunda — ism familiya, telefon,
          fan, qachon bo'lishi. Qolgan hammasi (daraja, manba, ota-ona
          raqami, izoh) "Qo'shimcha" ostida yopiq — yangi lid bir necha
          soniyada, bosimsiz yoziladi. */}
      <div className="flex flex-col gap-3 w-full">
        <Input
          label={t("lead.fullName")}
          placeholder={t("lead.fullNamePlaceholder")}
          required
          icon={<HiUser />}
          value={form.fullName}
          onChange={(e) => set("fullName", e.target.value)}
        />

        <TelegramPhoneField
          same={form.telegramSame}
          onSameChange={(v) => set("telegramSame", v)}
          value={form.telegramPhone}
          onChange={(v) => set("telegramPhone", v)}
          label={t("telegramPhone.studentLabel")}
        >
          <Input
            label={t("lead.phone")}
            placeholder="90 123 45 67"
            required
            icon={<HiDevicePhoneMobile />}
            prefix={PHONE_PREFIX}
            variant="white"
            value={form.phone}
            onChange={(e) => set("phone", digits(e.target.value))}
          />
        </TelegramPhoneField>

        <div className={`grid grid-cols-1 gap-3 ${centers.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {centers.length > 1 && (
            <Select
              label={t("lead.center")}
              placeholder={t("lead.center")}
              required
              icon={<HiBuildingOffice2 />}
              value={form.center}
              onChange={(v) => setForm((prev) => ({ ...prev, center: v, subject: "" }))}
              options={centers.map((c) => ({ value: c._id, label: c.name }))}
            />
          )}
          <Select
            label={t("lead.subject")}
            placeholder={t("lead.subject")}
            required
            disabled={!form.center}
            icon={<HiBookOpen />}
            value={form.subject}
            onChange={(v) => set("subject", v)}
            options={centerSubjects.map((s) => ({ value: s._id, label: s.name }))}
          />
        </div>

        {/* Qachon bo'lishi kerak — kunlar + vaqt bitta guruhlangan blokda,
            fan bilan bir xil ahamiyatga ega bo'lgani uchun o'z konteyneri bor. */}
        <div className="flex flex-col gap-2.5 w-full rounded-xl border border-slate-200 dark:border-night-700 bg-slate-50/60 dark:bg-night-800/60 p-3">
          <DayPicker
            value={form.preferredDays}
            onChange={(v) => set("preferredDays", v)}
            placeholder={t("lead.preferredDays")}
          />
          <span className="pl-0.5 text-[11px] text-slate-400 dark:text-slate-500">{t("lead.preferredDaysHint")}</span>
          <Select
            variant="white"
            label={t("lead.preferredTime")}
            icon={<HiClock />}
            value={form.preferredTime}
            onChange={(v) => set("preferredTime", v)}
            options={TIMES.map((v) => ({ value: v, label: t(`lead.time.${v}`) }))}
          />
        </div>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="flex items-center gap-1.5 self-start px-0.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
        >
          {showMore ? t("lead.lessFields") : t("lead.moreFields")}
          <HiChevronDown className={`text-base duration-200 ${showMore ? "rotate-180" : ""}`} />
        </button>

        {showMore && (
          <div className="flex flex-col gap-3 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={t("lead.level")}
                placeholder={t("lead.levelPlaceholder")}
                icon={<HiAcademicCap />}
                value={form.level}
                onChange={(e) => set("level", e.target.value)}
              />
              <Select
                label={t("lead.source")}
                icon={<HiMegaphone />}
                value={form.source}
                onChange={(v) => set("source", v)}
                options={SOURCES.map((v) => ({ value: v, label: t(`lead.sources.${v}`) }))}
              />
            </div>

            <TelegramPhoneField
              same={form.parentTelegramSame}
              onSameChange={(v) => set("parentTelegramSame", v)}
              value={form.parentTelegramPhone}
              onChange={(v) => set("parentTelegramPhone", v)}
              label={t("telegramPhone.parentLabel")}
            >
              <Input
                label={t("lead.parentPhone")}
                placeholder="90 123 45 67"
                icon={<HiDevicePhoneMobile />}
                prefix={PHONE_PREFIX}
                variant="white"
                value={form.parentPhone}
                onChange={(e) => set("parentPhone", digits(e.target.value))}
              />
            </TelegramPhoneField>

            <Textarea
              label={t("lead.note")}
              placeholder={t("lead.notePlaceholder")}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default LeadDialog;
