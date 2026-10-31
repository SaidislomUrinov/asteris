import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Switch from "../../ui/Switch";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const MIN_PRICE = 1000;

function PackageDialog({ open, pkg, onClose, onSaved }) {
  const { t } = useTranslation();
  const [name, setName] = useState(pkg?.name || "");
  const [smsCount, setSmsCount] = useState(pkg?.smsCount ?? "");
  const [price, setPrice] = useState(pkg?.price ?? "");
  const [unlimited, setUnlimited] = useState(pkg ? pkg.validityDays === 0 : false);
  const [validityDays, setValidityDays] = useState(pkg && pkg.validityDays > 0 ? pkg.validityDays : 30);
  const [active, setActive] = useState(pkg?.active ?? true);
  const [order, setOrder] = useState(pkg?.order ?? 0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    try {
      if (!name.trim() || Number(smsCount) < 1 || Number(price) < MIN_PRICE) throw new Error("sms.invalidPackage");
      setSaving(true);
      const payload = {
        name: name.trim(),
        smsCount: Number(smsCount),
        price: Number(price),
        validityDays: unlimited ? 0 : Number(validityDays),
        active,
        order: Number(order) || 0,
      };
      const res = pkg ? await api.put(`/admin/sms/packages/${pkg._id}`, payload) : await api.post("/admin/sms/packages", payload);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      onSaved();
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
      title={pkg ? t("sms.editPackage") : t("sms.createPackage")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={save}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input label={t("sms.packageName")} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input type="number" min={1} label={t("sms.smsCount")} value={smsCount} onChange={(e) => setSmsCount(e.target.value)} />
          <Input type="number" min={MIN_PRICE} label={t("sms.price")} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <Switch checked={unlimited} onChange={setUnlimited} label={t("sms.unlimited")} />
        {!unlimited && (
          <Input
            type="number"
            min={1}
            label={t("sms.validityDays")}
            value={validityDays}
            onChange={(e) => setValidityDays(e.target.value)}
          />
        )}
        <Input type="number" label={t("sms.order")} value={order} onChange={(e) => setOrder(e.target.value)} />
        <Switch checked={active} onChange={setActive} label={t("sms.active")} />
      </div>
    </Dialog>
  );
}

export default PackageDialog;
