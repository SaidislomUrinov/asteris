import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Switch from "../../ui/Switch";
import Checkbox from "../../ui/Checkbox";
import Button from "../../ui/Button";
import PermissionMatrix from "./PermissionMatrix";
import { ALL_PERMISSIONS } from "./permissionCatalog";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const initial = {
  name: "",
  price: "",
  trialDays: "",
  studentLimit: "",
  centerLimit: "",
  teacherLimit: "",
  receptionLimit: "",
};

const initialUnlimited = { studentLimit: false, centerLimit: false, teacherLimit: false, receptionLimit: false };

// -1 = cheksiz limit. Toggle yoqilganda son input o'chadi va -1 yuboriladi.
function LimitField({ label, unlimitedLabel, value, onChange, unlimited, onToggleUnlimited }) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center justify-between pl-2 pr-1">
        <span className="text-sm text-slate-800">
          {label}
          <span className="text-red-500">*</span>
        </span>
        <Checkbox
          checked={unlimited}
          onChange={onToggleUnlimited}
          variant="square"
          label={unlimitedLabel}
          className="[&>span]:text-[11px] [&>span]:text-slate-500"
        />
      </div>
      <Input
        type="number"
        value={unlimited ? "" : value}
        onChange={onChange}
        disabled={unlimited}
        placeholder={unlimited ? "∞" : ""}
      />
    </div>
  );
}

export default function TariffDialog({ open, onClose, tariff, onSaved, tariffs = [] }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [unlimited, setUnlimited] = useState(initialUnlimited);
  const [allAllowed, setAllAllowed] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);

  const isEdit = !!tariff;

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      if (tariff) {
        setForm({
          name: tariff.name || "",
          price: tariff.price ?? "",
          trialDays: tariff.trialDays ?? "",
          studentLimit: tariff.studentLimit === -1 ? "" : (tariff.studentLimit ?? ""),
          centerLimit: tariff.centerLimit === -1 ? "" : (tariff.centerLimit ?? ""),
          teacherLimit: tariff.teacherLimit === -1 ? "" : (tariff.teacherLimit ?? ""),
          receptionLimit: tariff.receptionLimit === -1 ? "" : (tariff.receptionLimit ?? ""),
        });
        setUnlimited({
          studentLimit: tariff.studentLimit === -1,
          centerLimit: tariff.centerLimit === -1,
          teacherLimit: tariff.teacherLimit === -1,
          receptionLimit: tariff.receptionLimit === -1,
        });
        const perms = tariff.allowedPermissions || [];
        const isAll = ALL_PERMISSIONS.every((p) => perms.includes(p));
        setAllAllowed(isAll);
        setPermissions(isAll ? [] : perms);
      } else {
        setForm(initial);
        setUnlimited(initialUnlimited);
        setAllAllowed(true);
        setPermissions([]);
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [open, tariff]);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const toggleUnlimited = (key) => () =>
    setUnlimited((p) => ({ ...p, [key]: !p[key] }));

  // Narx kiritilganda — undan arzonroq mavjud tariflar ichidan eng yaqinini topib,
  // uning ruxsat etilgan funksiyalarini avtomatik belgilaydi (tariflar bosqichma-bosqich kengayadi)
  const onPriceChange = (e) => {
    const value = e.target.value;
    setForm((p) => ({ ...p, price: value }));

    const priceNum = Number(value);
    if (!priceNum) return;

    const cheaper = tariffs
      .filter((t) => t._id !== tariff?._id && Number(t.price) < priceNum)
      .sort((a, b) => b.price - a.price)[0];

    if (cheaper?.allowedPermissions?.length) {
      setPermissions((prev) => [...new Set([...prev, ...cheaper.allowedPermissions])]);
    }
  };

  const submit = async () => {
    try {
      const body = {
        ...form,
        price: Number(form.price),
        trialDays: Number(form.trialDays) || 0,
        studentLimit: unlimited.studentLimit ? -1 : Number(form.studentLimit),
        centerLimit: unlimited.centerLimit ? -1 : Number(form.centerLimit),
        teacherLimit: unlimited.teacherLimit ? -1 : Number(form.teacherLimit),
        receptionLimit: unlimited.receptionLimit ? -1 : Number(form.receptionLimit),
        allowedPermissions: allAllowed ? ALL_PERMISSIONS : permissions,
      };

      setLoading(true);
      const res = isEdit
        ? await api.patch(`/tariffs/${tariff._id}`, body)
        : await api.post("/tariffs", body);
      const { ok, msg, data } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      onSaved(data);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("tariff.edit") : t("tariff.new")}
      className="md:w-180"
      actions={
        <>
          <Button color="slate" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={loading} onClick={submit}>
            {isEdit ? t("common.save") : t("common.create")}
          </Button>
        </>
      }
    >
      <Input label={t("tariff.name")} required value={form.name} onChange={set("name")} />

      <div className="grid grid-cols-2 gap-2 w-full">
        <Input
          label={t("tariff.price")}
          required
          type="number"
          value={form.price}
          onChange={onPriceChange}
        />
        <Input
          label={t("tariff.trialDays")}
          type="number"
          value={form.trialDays}
          onChange={set("trialDays")}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 w-full">
        <LimitField
          label={t("tariff.studentLimit")}
          unlimitedLabel={t("tariff.unlimited")}
          value={form.studentLimit}
          onChange={set("studentLimit")}
          unlimited={unlimited.studentLimit}
          onToggleUnlimited={toggleUnlimited("studentLimit")}
        />
        <LimitField
          label={t("tariff.centerLimit")}
          unlimitedLabel={t("tariff.unlimited")}
          value={form.centerLimit}
          onChange={set("centerLimit")}
          unlimited={unlimited.centerLimit}
          onToggleUnlimited={toggleUnlimited("centerLimit")}
        />
        <LimitField
          label={t("tariff.teacherLimit")}
          unlimitedLabel={t("tariff.unlimited")}
          value={form.teacherLimit}
          onChange={set("teacherLimit")}
          unlimited={unlimited.teacherLimit}
          onToggleUnlimited={toggleUnlimited("teacherLimit")}
        />
        <LimitField
          label={t("tariff.receptionLimit")}
          unlimitedLabel={t("tariff.unlimited")}
          value={form.receptionLimit}
          onChange={set("receptionLimit")}
          unlimited={unlimited.receptionLimit}
          onToggleUnlimited={toggleUnlimited("receptionLimit")}
        />
      </div>

      <div className="flex flex-col gap-2 w-full pt-2 border-t border-slate-100 mt-1">
        <Switch
          checked={allAllowed}
          onChange={setAllAllowed}
          label={t("tariff.allAllowed")}
        />
        {!allAllowed && (
          <PermissionMatrix
            value={permissions}
            onChange={setPermissions}
          />
        )}
        {!allAllowed && permissions.length === 0 && (
          <p className="text-[12px] text-orange-600">{t("tariff.noPermissionsWarning")}</p>
        )}
        {allAllowed && (
          <p className="text-[12px] text-slate-400">{t("tariff.allAllowedHint")}</p>
        )}
      </div>
    </Dialog>
  );
}
