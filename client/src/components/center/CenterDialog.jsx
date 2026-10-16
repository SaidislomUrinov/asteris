import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import ImageInput from "../../ui/ImageInput";
import Button from "../../ui/Button";
import { api, API } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { HiBuildingOffice2, HiChatBubbleBottomCenterText } from "react-icons/hi2";

const EMPTY_FORM = { name: "", slogan: "", logoFile: null };

// Create/Edit uchun bitta dialog — `center` prop bo'lsa edit rejimi (PATCH),
// bo'lmasa create (POST). Auth.jsx'dagi try/catch + { ok, data, msg } patterni.
// Ota komponent (CenterActionsHost / Dashboard) har ochilishda `key`
// bilan remount qiladi, shu sabab forma boshlang'ich holati useState lazy init
// orqali to'g'ridan-to'g'ri propsdan olinadi — useEffect + setState shart emas.
function CenterDialog({ open, onClose, center, onSaved }) {
  const { t } = useTranslation();
  const isEdit = !!center?._id;
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          name: center.name || "",
          slogan: center.slogan || "",
          logoFile: null,
        }
      : EMPTY_FORM,
  );
  const [disabled, setDisabled] = useState(false);

  const submit = async () => {
    try {
      if (!form.name.trim()) throw new Error("center.fillTheRows");
      setDisabled(true);

      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("slogan", form.slogan.trim());
      if (form.logoFile) fd.append("logo", form.logoFile);

      const res = isEdit
        ? await api.patch(`/centers/${center._id}`, fd)
        : await api.post("/centers", fd);
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
      title={t(isEdit ? "center.edit" : "center.create")}
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
        <Input
          label={t("center.name")}
          placeholder={t("center.name")}
          required
          icon={<HiBuildingOffice2 />}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <Input
          label={t("center.slogan")}
          placeholder={t("center.slogan")}
          icon={<HiChatBubbleBottomCenterText />}
          value={form.slogan}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, slogan: e.target.value }))
          }
        />
        <ImageInput
          label={t("center.logo")}
          width="96px"
          height="96px"
          prev={
            center?.logo
              ? center.logo.startsWith("http")
                ? center.logo
                : `${API}${center.logo}`
              : ""
          }
          onChange={(file) => setForm((prev) => ({ ...prev, logoFile: file }))}
        />
      </div>
    </Dialog>
  );
}

export default CenterDialog;
