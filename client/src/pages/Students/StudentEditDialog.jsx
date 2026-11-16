import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBanknotes, HiChevronDown, HiDevicePhoneMobile, HiInformationCircle, HiPhone, HiUser } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import TelegramPhoneField from "../../ui/TelegramPhoneField";
import {
  assertTelegramForm,
  buildTelegramPayload,
  telegramFormFromDto,
} from "../../utils/telegramPhone";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { maskMoney } from "../../utils/moneyFormat";
import useCan from "../../hooks/useCan";
import StartDateField from "./StartDateField";
import { assertStartDate, startDateMinOf, tashkentDay } from "./startDate.util";

const PHONE_PREFIX = "+998";

// Eski (prefiksdan oldingi) yozuvlar uchun ham ishlaydi — "+998" bo'lsa
// kesib tashlanadi, bo'lmasa oxirgi 9 ta raqam suffiks sifatida olinadi.
const phoneSuffix = (raw) => {
  const digits = (raw || "").replace(/\D/g, "");
  // Mamlakat kodi FAQAT uzunlik uni tasdiqlaganda kesiladi — 9 raqamli
  // mahalliy raqam ham "998..." bo'lishi mumkin (99 operator kodi + 8),
  // masalan 998104230 (ImportStudentsDialog.jsx dagi bilan bir xil qoida).
  return (digits.length > 9 && digits.startsWith("998") ? digits.slice(3) : digits).slice(-9);
};

// O'quvchi ma'lumotlarini tahrirlash — fullName/phone/parentPhone
// (API_CONTRACT.md §1/§4) va FAOL guruh-yozuvlaridagi oylik summa
// (docs/API_CONTRACT_student_edit_price.md). `student:update` ruxsati
// bo'lganlarga (Resepshin/Boshliq) StudentDetail.jsx header'idagi qalam
// tugmasi, Students ro'yxati va Guruh Detail'dagi DropMenu orqali ochiladi.
// Ota komponent har ochilishda `key={student._id}` bilan remount qiladi.
//
// `entries` — ixtiyoriy, [{ _id, label, price, cycles? }] — tahrirlanadigan FAOL
// guruh-yozuvlari. Berilmasa (yoki bo'sh bo'lsa) summa bo'limi ko'rsatilmaydi.
// `cycles` — entry.priceCycles (API_CONTRACT_past_cycle_price.md): o'tgan
// oylar summasini o'zgartirish (`{ price, cycleStart }`) — tanlangan oydan
// boshlab keyingi barcha oylarga amal qiladi.
// `joinedAt`/`groupStatus`/`activatedAt` — ixtiyoriy: berilsa va guruh faol
// bo'lsa "O'qishni boshlagan sana" maydoni chiqadi
// (API_CONTRACT_group_month_filter_and_start_date.md §B.3/§B.5).

const cycleKey = (entryId, cycleStart) => `${entryId}:${cycleStart}`;
// O'tgan (yopilgan) sikllar — yangisi tepada.
const pastCyclesOf = (en) => (en.cycles || []).filter((c) => !c.isCurrent).reverse();
const canEditStartDate = (en) => en.groupStatus === "active" && !!en.joinedAt;
const startMinOf = (en) => startDateMinOf(en.activatedAt);

function StudentEditDialog({ open, onClose, student, entries = [], onSaved }) {
  const { t } = useTranslation();
  const can = useCan();
  const showStartDate = can("student:update");
  const [form, setForm] = useState(() => ({
    fullName: student?.fullName || "",
    phone: phoneSuffix(student?.phone),
    parentPhone: phoneSuffix(student?.parentPhone),
    ...telegramFormFromDto(student),
  }));
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(entries.map((en) => [en._id, String(en.price ?? "")])),
  );
  const [cyclePrices, setCyclePrices] = useState(() =>
    Object.fromEntries(
      entries.flatMap((en) => pastCyclesOf(en).map((c) => [cycleKey(en._id, c.cycleStart), String(c.price)])),
    ),
  );
  // Boshlang'ich qiymat — a'zolikning hozirgi `joinedAt` kuni; faqat
  // o'zgargan sana PATCH qilinadi.
  const initialStartDates = Object.fromEntries(
    entries.filter(canEditStartDate).map((en) => [en._id, tashkentDay(en.joinedAt)]),
  );
  const [startDates, setStartDates] = useState(initialStartDates);
  const [openPast, setOpenPast] = useState({}); // { [entryId]: true } — "O'tgan oylar" ochiq
  const [disabled, setDisabled] = useState(false);
  const monthNames = t("common.monthNames", { returnObjects: true });
  const monthLabel = (ym) => `${monthNames[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

  const submit = async () => {
    try {
      if (form.fullName.trim().length < 2 || !form.phone.trim())
        throw new Error("student.fillTheRows");
      assertTelegramForm(form);

      const changedPrices = entries.filter((en) => {
        const next = prices[en._id];
        if (next === "" || next == null) return false;
        const nextNum = Number(next);
        if (Number.isNaN(nextNum) || nextNum < 0) throw new Error("student.invalidPrice");
        return nextNum !== (en.price ?? 0);
      });

      const changedCycles = entries.flatMap((en) =>
        pastCyclesOf(en)
          .filter((c) => {
            const next = cyclePrices[cycleKey(en._id, c.cycleStart)];
            if (next === "" || next == null) return false;
            const nextNum = Number(next);
            if (!Number.isInteger(nextNum) || nextNum < 0) throw new Error("student.invalidPrice");
            return nextNum !== c.price;
          })
          .map((c) => ({ entryId: en._id, cycleStart: c.cycleStart, price: Number(cyclePrices[cycleKey(en._id, c.cycleStart)]) })),
      );

      const changedStartDates = showStartDate
        ? entries.filter(canEditStartDate).filter((en) => {
            const next = startDates[en._id];
            if (!next || next === initialStartDates[en._id]) return false;
            assertStartDate(next, startMinOf(en));
            return true;
          })
        : [];

      setDisabled(true);

      const body = {
        fullName: form.fullName.trim(),
        phone: PHONE_PREFIX + form.phone.trim(),
        ...buildTelegramPayload(form, student),
        parentPhone: form.parentPhone.trim() ? PHONE_PREFIX + form.parentPhone.trim() : "",
      };

      const res = await api.patch(`/students/${student._id}`, body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);

      // O'tgan oy narxi shu oydan boshlab KEYINGI barcha oylarga tarqaladi
      // (API_CONTRACT_past_cycle_price.md) — shuning uchun avval o'tgan oylar
      // eskisidan yangisiga qarab, eng oxirida joriy summa yuboriladi; aks
      // holda keyingi so'rov oldingisini bekor qilib yuborardi.
      const orderedCycles = [...changedCycles].sort((a, b) => a.cycleStart - b.cycleStart);
      for (const c of orderedCycles) {
        const cycleRes = await api.patch(`/students/${student._id}/groups/${c.entryId}`, {
          price: c.price,
          cycleStart: c.cycleStart,
        });
        if (!cycleRes.data.ok) throw new Error(cycleRes.data.msg);
      }

      for (const en of changedPrices) {
        const priceRes = await api.patch(`/students/${student._id}/groups/${en._id}`, {
          price: Number(prices[en._id]),
        });
        if (!priceRes.data.ok) throw new Error(priceRes.data.msg);
      }

      // O'qishni boshlagan sana — kreditlar va qarz serverda qayta hisoblanadi.
      for (const en of changedStartDates) {
        const startRes = await api.patch(`/students/${student._id}/groups/${en._id}/start-date`, {
          startDate: startDates[en._id],
        });
        if (!startRes.data.ok) throw new Error(startRes.data.msg);
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
      title={t("student.edit")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={disabled} onClick={submit}>
            {t("common.update")}
          </Button>
        </>
      }
    >
      <div
        onKeyDown={(k) => k.key === "Enter" && submit()}
        className="flex flex-col gap-3 w-full"
      >
        <Input
          label={t("student.fullName")}
          placeholder={t("student.fullName")}
          required
          icon={<HiUser />}
          value={form.fullName}
          onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
        />
        <TelegramPhoneField
          same={form.telegramSame}
          onSameChange={(v) => setForm((prev) => ({ ...prev, telegramSame: v }))}
          value={form.telegramPhone}
          onChange={(v) => setForm((prev) => ({ ...prev, telegramPhone: v }))}
          label={t("telegramPhone.studentLabel")}
        >
          <Input
            label={t("student.phone")}
            placeholder="90 123 45 67"
            required
            icon={<HiDevicePhoneMobile />}
            prefix={PHONE_PREFIX}
            variant="white"
            value={form.phone}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, phone: e.target.value.replace(/\D/g, "").slice(0, 9) }))
            }
          />
        </TelegramPhoneField>
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

        {entries.length > 0 && (
          <div className="flex flex-col gap-3 pt-1 border-t border-slate-100 dark:border-night-700">
            {entries.map((en) => {
              const past = pastCyclesOf(en);
              const isOpen = !!openPast[en._id];
              const changedCount = past.filter(
                (c) => {
                  const v = cyclePrices[cycleKey(en._id, c.cycleStart)];
                  return v !== "" && v != null && Number(v) !== c.price;
                },
              ).length;
              return (
                <div key={en._id} className="flex flex-col gap-2">
                  <Input
                    type="number"
                    label={en.label ? `${t("student.price")} — ${en.label}` : t("student.price")}
                    placeholder={t("student.price")}
                    icon={<HiBanknotes />}
                    value={prices[en._id] ?? ""}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [en._id]: e.target.value }))
                    }
                  />

                  {showStartDate && canEditStartDate(en) && (
                    <StartDateField
                      label={en.label ? `${t("student.startDate")} — ${en.label}` : undefined}
                      value={startDates[en._id] ?? ""}
                      min={startMinOf(en)}
                      onChange={(v) => setStartDates((prev) => ({ ...prev, [en._id]: v }))}
                    />
                  )}

                  {past.length > 0 && (
                    <div className="flex flex-col rounded-xl border border-slate-200 dark:border-night-700 bg-slate-50/60 dark:bg-night-800/60">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenPast((prev) => ({ ...prev, [en._id]: !isOpen }))}
                        className="flex items-center justify-between gap-2 px-3 h-10 text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{t("student.pastMonthsPrice")}</span>
                          {changedCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-blue-500 text-white text-[11px] font-bold">
                              {changedCount}
                            </span>
                          )}
                        </span>
                        <HiChevronDown className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isOpen && (
                        <div className="flex flex-col gap-2 px-3 pb-3 border-t border-slate-200 dark:border-night-700 pt-2">
                          <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <HiInformationCircle className="shrink-0 mt-0.5 text-sm text-slate-400 dark:text-slate-500" />
                            {t("student.pastMonthsHint")}
                          </p>
                          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
                            {past.map((c) => {
                              const key = cycleKey(en._id, c.cycleStart);
                              const raw = cyclePrices[key];
                              const changed = raw !== "" && raw != null && Number(raw) !== c.price;
                              return (
                                <div
                                  key={key}
                                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border ${
                                    changed ? "bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30" : "bg-white dark:bg-night-900 border-slate-200 dark:border-night-700"
                                  }`}
                                >
                                  <div className="flex-1 min-w-0 flex flex-col leading-tight">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize wrap-break-word">
                                      {monthLabel(c.month)}
                                    </span>
                                    {changed && (
                                      <span className="text-[11px] text-slate-400 dark:text-slate-500 line-through truncate">
                                        {maskMoney(c.price, false)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="w-28 sm:w-40 shrink-0">
                                    <Input
                                      type="number"
                                      placeholder={t("student.price")}
                                      value={raw ?? ""}
                                      onChange={(e) =>
                                        setCyclePrices((prev) => ({ ...prev, [key]: e.target.value }))
                                      }
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default StudentEditDialog;
