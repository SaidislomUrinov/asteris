import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  HiArrowPath,
  HiOutlineCamera,
  HiOutlinePhoto,
  HiOutlineTrash,
  HiOutlineUser,
} from "react-icons/hi2";
import { Button } from "../../components/Button";
import { haptic } from "../../lib/telegram";
import { Avatar } from "../../components/Card";
import { initials } from "../../utils/format";
import { downscaleImage, photoSrc } from "../../lib/studentPhoto";
import { workerApi } from "../api";
import { useWorker } from "../useWorker";
import { errText, groupLabel } from "../utils";
import { BottomSheet } from "../components/BottomSheet";
import { MoneyInput } from "../components/MoneyInput";
import { PhotoCameraOverlay } from "../components/PhotoCameraOverlay";

const PHONE_PREFIX = "+998";
const PHONE_LEN = 9;
const LOOKUP_DEBOUNCE_MS = 400;

const onlyDigits = (v) => String(v || "").replace(/\D/g, "").slice(0, PHONE_LEN);
// "+998901234567" → "901234567" (mavjud o'quvchi ota-ona raqami uchun).
const phoneSuffix = (v) => onlyDigits(String(v || "").replace(/^\+?998/, ""));

const fieldCls =
  "block rounded-2xl border border-line px-3.5 py-2.5 focus-within:border-accent transition-colors";
const inputCls = "bg-transparent outline-none w-full min-w-0 text-[15px] text-ink placeholder:text-hint/60";

// +998 prefiksli telefon maydoni (9 raqam).
const PhoneField = ({ label, value, onChange, hint, autoFocus }) => (
  <div className="flex flex-col gap-1">
    <label className={fieldCls}>
      <span className="block text-[11px] font-bold text-hint">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="tabular text-[15px] font-bold text-hint shrink-0">{PHONE_PREFIX}</span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(onlyDigits(e.target.value))}
          placeholder="90 123 45 67"
          className={`${inputCls} tabular font-bold`}
        />
      </span>
    </label>
    {hint && <div className="text-[12px] text-hint px-1">{hint}</div>}
  </div>
);

// Guruh sahifasidan o'quvchi qo'shish + rasmga olish
// (docs/API_CONTRACT_enroll_with_photo.md "Frontend — parent"). Oqim client
// StudentDialog bilan bir xil: telefon 9 raqam bo'lganda lookup → mavjud
// o'quvchini tanlash (`existingStudentId`), aks holda yangi hujjat. Telegram
// maydonlari so'ralmaydi (server default). Rasm: Telegram WebView'da
// jonli kamera (PhotoCameraOverlay), u ochilmasa `<input capture>`.
export const AddStudentSheet = ({ open, group, onClose, onAdded }) => {
  const { t } = useTranslation();
  const { can } = useWorker();
  const [cameraOpen, setCameraOpen] = useState(false);
  const galleryRef = useRef(null);

  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [price, setPrice] = useState("");
  const priceTouched = useRef(false);
  const [file, setFile] = useState(null);
  const [existing, setExisting] = useState(null);
  // Natija qaysi raqamga tegishli — raqam o'zgarsa eski ro'yxat ko'rinmaydi.
  const [lookup, setLookup] = useState({ phone: "", list: [] });
  const [busy, setBusy] = useState(false);

  // Narx default'i — fan narxi (guruh DTO'sida narx yo'q, faqat `subject` id).
  // Ruxsat bo'lmasa bo'sh qoladi va server o'zi fan narxini qo'yadi.
  const canSubject = can("subject:view");
  useEffect(() => {
    if (!canSubject || !group?.subject) return undefined;
    let alive = true;
    (async () => {
      try {
        const s = await workerApi.subject(group.subject);
        if (alive && !priceTouched.current && s?.price != null) setPrice(String(s.price));
      } catch {
        // jim — narx bo'sh qoladi, server default
      }
    })();
    return () => {
      alive = false;
    };
  }, [canSubject, group?.subject]);

  // Lookup — 9 raqam bo'lganda 400ms debounce; xato jim o'tkaziladi.
  useEffect(() => {
    if (phone.length !== PHONE_LEN || existing) return undefined;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const res = await workerApi.lookupStudents(PHONE_PREFIX + phone);
        if (alive) setLookup({ phone, list: Array.isArray(res) ? res : [] });
      } catch {
        // jim — qo'lda kiritishda davom etadi
      }
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [phone, existing]);
  const matches = !existing && lookup.phone === phone && phone.length === PHONE_LEN ? lookup.list : [];

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const changePhone = (v) => {
    if (existing) {
      setExisting(null);
      setFullName("");
    }
    setPhone(v);
  };
  const selectExisting = (s) => {
    haptic("light");
    setExisting(s);
    setFullName(s.fullName || "");
    if (s.parentPhone) setParentPhone(phoneSuffix(s.parentPhone));
  };
  const clearExisting = () => {
    setExisting(null);
    setFullName("");
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    // Bir xil faylni qayta tanlash ham `change` bersin.
    e.target.value = "";
    if (f) {
      haptic("light");
      setFile(f);
    }
  };
  const fromCamera = () => !busy && setCameraOpen(true);
  const fromGallery = () => !busy && galleryRef.current?.click();

  const submit = async () => {
    if (busy) return;
    if (phone.length !== PHONE_LEN || (parentPhone && parentPhone.length !== PHONE_LEN)) {
      haptic("error");
      toast.error(errText({ code: "student.invalidPhone" }));
      return;
    }
    if (!existing && !fullName.trim()) {
      haptic("error");
      toast.error(errText({ code: "student.fillTheRows" }));
      return;
    }
    setBusy(true);
    let created = null;
    try {
      const res = await workerApi.createStudent({
        fullName: fullName.trim() || undefined,
        phone: PHONE_PREFIX + phone,
        parentPhone: parentPhone ? PHONE_PREFIX + parentPhone : "",
        centerId: group.center,
        groupId: group._id,
        price: price === "" ? undefined : Number(price),
        existingStudentId: existing?._id || undefined,
      });
      created = res?.data || null;
      haptic("success");
      toast.success(t(res?.msg || "student.created"));
    } catch (e) {
      haptic("error");
      toast.error(errText(e));
      setBusy(false);
      return;
    }

    // O'quvchi yaratildi — rasm xatosi uni bekor qilmaydi (kontrakt §Backend).
    if (file && created?._id) {
      try {
        const prepared = await downscaleImage(file);
        await workerApi.setStudentPhoto(created._id, prepared);
      } catch {
        haptic("warning");
        toast.warning(t("student.photoSaveFailed"));
      }
    }
    setBusy(false);
    onAdded?.(created);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      busy={busy}
      title={t("worker.addStudent")}
      subtitle={groupLabel(group)}
      footer={
        <Button onClick={submit} loading={busy} disabled={phone.length !== PHONE_LEN}>
          {t("worker.enroll.submit")}
        </Button>
      }
    >
      {/* Rasm */}
      <div className="flex flex-col items-center gap-2 pt-1 pb-1">
        <button
          type="button"
          onClick={fromCamera}
          aria-label={preview ? t("student.photoRetake") : t("student.photoTake")}
          className="relative w-[88px] h-[88px] active:opacity-80"
        >
          <span
            className={`w-full h-full rounded-full overflow-hidden grid place-items-center ${
              preview ? "border border-line" : "border-2 border-dashed border-accent/40 bg-accent/5 text-accent"
            }`}
          >
            {preview ? (
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : (
              <HiOutlineUser className="w-9 h-9" />
            )}
          </span>
          <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full grid place-items-center bg-accent text-accent-fg border-2 border-bg shadow-sm">
            {preview ? <HiArrowPath className="w-3.5 h-3.5" /> : <HiOutlineCamera className="w-3.5 h-3.5" />}
          </span>
        </button>
        <div className="flex items-center gap-2 text-[13px] font-bold">
          <button
            type="button"
            onClick={fromCamera}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-accent/10 text-accent active:opacity-70"
          >
            <HiOutlineCamera className="w-4 h-4" />
            {t("worker.student.photoFromCamera")}
          </button>
          <button
            type="button"
            onClick={fromGallery}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-ink/6 text-ink active:opacity-70"
          >
            <HiOutlinePhoto className="w-4 h-4" />
            {t("worker.student.photoFromGallery")}
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => !busy && setFile(null)}
              aria-label={t("worker.student.photoRemove")}
              className="inline-grid place-items-center size-9 rounded-full bg-bad/10 text-bad active:opacity-70"
            >
              <HiOutlineTrash className="w-4 h-4" />
            </button>
          )}
        </div>
        <PhotoCameraOverlay
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onFile={(f) => {
            haptic("light");
            setFile(f);
          }}
        />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>

      {/* Telefon + lookup */}
      <PhoneField
        label={t("worker.enroll.phone")}
        value={phone}
        onChange={changePhone}
        hint={!existing && !matches.length ? t("worker.enroll.phoneHint") : null}
      />
      {existing && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-ok-bg text-ok px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 min-w-0 text-[13px] font-bold">
            <Avatar text={initials(existing.fullName)} src={photoSrc(existing.photo)} alt={existing.fullName} className="w-7 h-7 text-[11px]" />
            <span className="truncate">{t("worker.enroll.existingFound", { name: existing.fullName })}</span>
          </span>
          <button type="button" onClick={clearExisting} className="text-[12px] font-extrabold underline shrink-0">
            {t("worker.enroll.chooseDifferent")}
          </button>
        </div>
      )}
      {matches.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[12px] text-hint px-1">{t("worker.enroll.matchesHint")}</div>
          <div className="flex flex-col divide-y divide-line/70 rounded-2xl border border-line">
            {matches.map((m, i) => (
              <button
                key={m._id}
                type="button"
                onClick={() => selectExisting(m)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-left active:opacity-70"
              >
                <Avatar text={initials(m.fullName)} tone={i} src={photoSrc(m.photo)} alt={m.fullName} className="w-9 h-9" />
                <span className="flex flex-col min-w-0">
                  <span className="font-bold truncate">
                    {t("worker.enroll.existingStudent", { name: m.fullName })}
                  </span>
                  {m.parentPhone && <span className="tabular text-[12px] text-hint truncate">{m.parentPhone}</span>}
                </span>
              </button>
            ))}
          </div>
          <div className="text-[12px] text-hint px-1">{t("worker.enroll.newStudentHint")}</div>
        </div>
      )}

      {/* F.I.Sh. */}
      <label className={fieldCls}>
        <span className="block text-[11px] font-bold text-hint">{t("worker.enroll.fullName")}</span>
        <input
          value={fullName}
          readOnly={!!existing}
          maxLength={120}
          autoComplete="off"
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t("worker.enroll.fullNamePh")}
          className={`${inputCls} font-bold ${existing ? "text-hint" : ""}`}
        />
      </label>

      <PhoneField
        label={t("worker.enroll.parentPhone")}
        value={parentPhone}
        onChange={setParentPhone}
        hint={t("worker.enroll.parentPhoneHint")}
      />

      <div className="flex flex-col gap-1">
        <MoneyInput
          label={t("worker.student.price")}
          value={price}
          onChange={(v) => {
            priceTouched.current = true;
            setPrice(v);
          }}
        />
        {price === "" && <div className="text-[12px] text-hint px-1">{t("worker.enroll.priceHint")}</div>}
      </div>
    </BottomSheet>
  );
};
