import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBuildingOffice2, HiHome, HiUsers } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const EMPTY_FORM = { center: "", name: "", capacity: "" };

// Create/Edit uchun bitta dialog — SubjectDialog.jsx bilan aynan bir xil naqsh.
function RoomDialog({ open, onClose, room, centers = [], onSaved }) {
  const { t } = useTranslation();
  const isEdit = !!room?._id;
  // Hodim (Staff) bitta filialga biriktirilgan — maydon yashiriladi va
  // qiymat avtomatik qo'yiladi (bitta filialli Owner uchun ham shunday).
  const onlyCenter = centers.length === 1 ? centers[0]._id : "";
  const showCenterField = centers.length > 1;
  const [form, setForm] = useState(() =>
    room
      ? {
          center: room.center || "",
          name: room.name || "",
          capacity: room.capacity ?? "",
        }
      : { ...EMPTY_FORM, center: onlyCenter },
  );
  const [disabled, setDisabled] = useState(false);

  const submit = async () => {
    try {
      if (!form.center || !form.name.trim()) throw new Error("room.fillTheRows");
      setDisabled(true);

      const body = {
        centerId: form.center,
        name: form.name.trim(),
        capacity: form.capacity === "" ? null : Number(form.capacity),
      };

      const res = isEdit
        ? await api.patch(`/rooms/${room._id}`, body)
        : await api.post("/rooms", body);
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
      title={t(isEdit ? "room.edit" : "room.create")}
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
            label={t("room.center")}
            placeholder={t("room.center")}
            required
            icon={<HiBuildingOffice2 />}
            value={form.center}
            onChange={(v) => setForm((prev) => ({ ...prev, center: v }))}
            options={centers.map((c) => ({ value: c._id, label: c.name }))}
          />
        )}
        <Input
          label={t("room.name")}
          placeholder={t("room.name")}
          required
          icon={<HiHome />}
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <Input
          type="number"
          label={t("room.capacity")}
          placeholder={t("room.capacity")}
          icon={<HiUsers />}
          value={form.capacity}
          onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
        />
      </div>
    </Dialog>
  );
}

export default RoomDialog;
