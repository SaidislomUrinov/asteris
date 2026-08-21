import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiBanknotes,
  HiBuildingOffice2,
  HiCheckCircle,
  HiDevicePhoneMobile,
  HiPhone,
  HiUser,
  HiUserGroup,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const EMPTY_FORM = {
  center: "",
  group: "",
  fullName: "",
  phone: "",
  parentPhone: "",
  price: "",
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
  const [existingStudent, setExistingStudent] = useState(null);

  // Telefon raqam bo'yicha global directory qidiruvi (debounce) — N o'quvchi
  // boshqa filial/mijozdagi L guruhga qo'shilmoqchi bo'lsa, raqami allaqachon
  // Student hujjatida bor bo'lsa ismi avtomatik keladi (student.service.js
  // "lookupByPhone" — Student telefon bo'yicha global yagona hujjat).
  useEffect(() => {
    const phone = form.phone.trim();
    if (phone.length < 9) {
      const clearTimer = setTimeout(() => setExistingStudent(null), 0);
      return () => clearTimeout(clearTimer);
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/students/lookup", { params: { phone } });
        const { ok, data } = res.data;
        if (!ok || !data?.exists) {
          setExistingStudent(null);
          return;
        }
        setExistingStudent(data);
        setForm((prev) => ({
          ...prev,
          fullName: data.fullName || prev.fullName,
          parentPhone: data.parentPhone || prev.parentPhone,
        }));
      } catch {
        // lookup xatosi jim o'tkaziladi — foydalanuvchi qo'lda kiritishda davom etadi
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.phone]);

  const centerGroups = useMemo(
    () =>
      groups.filter((g) => g.center === form.center && g.status !== "finished"),
    [groups, form.center],
  );

  const submit = async () => {
    try {
      if (!form.center || !form.group || !form.phone.trim())
        throw new Error("student.fillTheRows");
      setDisabled(true);

      const body = {
        fullName: form.fullName.trim() || undefined,
        phone: form.phone.trim(),
        parentPhone: form.parentPhone.trim(),
        centerId: form.center,
        groupId: form.group,
        price: form.price === "" ? undefined : Number(form.price),
      };

      const res = await api.post("/students", body);
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
          placeholder="+998901234567"
          required
          icon={<HiDevicePhoneMobile />}
          value={form.phone}
          onChange={(e) => {
            setExistingStudent(null);
            setForm((prev) => ({ ...prev, phone: e.target.value }));
          }}
        />
        {existingStudent ? (
          <p className="flex items-center gap-1 pl-2 -mt-2 text-xs text-emerald-600">
            <HiCheckCircle /> {t("student.existingStudentFound", { name: existingStudent.fullName })}
          </p>
        ) : (
          <p className="pl-2 -mt-2 text-xs text-slate-400">{t("student.existingPhoneHint")}</p>
        )}

        <Input
          label={t("student.fullName")}
          placeholder={t("student.fullName")}
          icon={<HiUser />}
          readOnly={!!existingStudent}
          value={form.fullName}
          onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
        />
        <Input
          label={t("student.parentPhone")}
          placeholder="+998901234567"
          icon={<HiPhone />}
          value={form.parentPhone}
          onChange={(e) => setForm((prev) => ({ ...prev, parentPhone: e.target.value }))}
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

export default StudentDialog;
