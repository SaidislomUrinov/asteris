import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { HiBookOpen, HiCalendarDays, HiBanknotes, HiBuildingOffice2 } from "react-icons/hi2";

const EMPTY_FORM = { center: "", name: "", price: "", durationMonths: "" };

// Create/Edit uchun bitta dialog — `subject` prop bo'lsa edit rejimi (PATCH),
// bo'lmasa create (POST). CenterDialog.jsx'dagi try/catch + { ok, data, msg }
// patterni. Ota komponent (Subjects/index.jsx) har ochilishda
// `key={subject?._id || "new"}` bilan remount qiladi, shu sabab forma
// boshlang'ich holati useState lazy init orqali to'g'ridan-to'g'ri propsdan
// olinadi — useEffect + setState shart emas.
//
// Nusxalash (duplicate): Subjects/index.jsx `subject` sifatida `_id`siz
// obyekt yuborsa (`{ ...row, _id: undefined }`), `isEdit` avtomatik `false`
// bo'ladi — forma o'sha fanning qiymatlari bilan oldindan to'lib, lekin
// yaratish (POST) rejimida ochiladi, shu jumladan Filialni ham o'zgartirish
// mumkin.
function SubjectDialog({ open, onClose, subject, centers = [], onSaved }) {
  const { t } = useTranslation();
  const isEdit = !!subject?._id;
  // Hodim (Staff) bitta filialga biriktirilgan — unga `/centers` bitta filial
  // qaytaradi, demak tanlaydigan narsa yo'q: maydon yashiriladi va qiymat
  // avtomatik qo'yiladi (bitta filialli Client Owner uchun ham shunday).
  const onlyCenter = centers.length === 1 ? centers[0]._id : "";
  const showCenterField = centers.length > 1;
  const [form, setForm] = useState(() =>
    subject
      ? {
          center: subject.center || "",
          name: subject.name || "",
          price: subject.price ?? "",
          durationMonths: subject.durationMonths ?? "",
        }
      : { ...EMPTY_FORM, center: onlyCenter },
  );
  const [disabled, setDisabled] = useState(false);

  const submit = async () => {
    try {
      if (
        !form.center ||
        !form.name.trim() ||
        form.price === "" ||
        form.durationMonths === ""
      )
        throw new Error("subject.fillTheRows");
      setDisabled(true);

      const body = {
        centerId: form.center,
        name: form.name.trim(),
        price: Number(form.price),
        durationMonths: Number(form.durationMonths),
      };

      const res = isEdit
        ? await api.patch(`/subjects/${subject._id}`, body)
        : await api.post("/subjects", body);
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
      title={t(isEdit ? "subject.edit" : "subject.create")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={disabled} onClick={submit}>
            {t(isEdit ? "common.update" : "common.create")}
          </Button>
        </>
      }
    >
      <div
        onKeyDown={(k) => k.key === "Enter" && submit()}
        className="flex flex-col gap-3 w-full"
      >
        {showCenterField && (
          <Select
            label={t("subject.center")}
            placeholder={t("subject.center")}
            required
            icon={<HiBuildingOffice2 />}
            value={form.center}
            onChange={(v) => setForm((prev) => ({ ...prev, center: v }))}
            options={centers.map((c) => ({ value: c._id, label: c.name }))}
          />
        )}
        <Input
          label={t("subject.name")}
          placeholder={t("subject.name")}
          required
          icon={<HiBookOpen />}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <Input
          type="number"
          label={t("subject.price")}
          placeholder={t("subject.price")}
          required
          icon={<HiBanknotes />}
          value={form.price}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, price: e.target.value }))
          }
        />
        <Input
          type="number"
          label={t("subject.durationMonths")}
          placeholder={t("subject.durationMonths")}
          required
          icon={<HiCalendarDays />}
          value={form.durationMonths}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, durationMonths: e.target.value }))
          }
        />
      </div>
    </Dialog>
  );
}

export default SubjectDialog;
