import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Select from "../../ui/Select";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Checkbox from "../../ui/Checkbox";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

// Diqqat: Date#toISOString() UTC'ga o'giradi — mahalliy vaqt zonasi UTC'dan oldinda
// bo'lsa (Asia/Tashkent = UTC+5) sana 1 kunga orqaga siljib qoladi. Shuning uchun
// yil/oy/kunni to'g'ridan-to'g'ri mahalliy Date maydonlaridan o'qiymiz.
const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const todayStr = () => toDateStr(new Date());
const toUnix = (dateStr) => Math.floor(new Date(`${dateStr}T00:00:00`).getTime() / 1000);

// Berilgan sanadan "keyingi oy, o'sha kun"ni hisoblaydi. Oy oxiridagi kunlar
// (masalan 31-yanvar) uchun mavjud bo'lmagan kunga chiqib ketmasin deb, o'sha
// oyning oxirgi kuniga qisqartiriladi (moment "add month" xatti-harakati bilan bir xil).
const nextMonthSameDay = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + 1, day);
  if (target.getDate() !== day) target.setDate(0);
  return toDateStr(target);
};

export default function SubscriptionDialog({ open, onClose, client, tariffs = [], onSaved }) {
  const { t } = useTranslation();
  const [tariffId, setTariffId] = useState("");
  const [price, setPrice] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(nextMonthSameDay(todayStr()));
  const [mode, setMode] = useState("new"); // "new" | "keep"
  const [loading, setLoading] = useState(false);

  const isChange = !!client?.subscription;
  const showDates = !isChange || mode === "new";

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      setTariffId(client?.subscription?.tariff || "");
      setPrice("");
      const today = todayStr();
      setStartDate(today);
      setEndDate(nextMonthSameDay(today));
      setMode("new");
    }, 0);
    return () => clearTimeout(timeout);
  }, [open, client]);

  // Tarif tanlanganda narx maydoni o'sha tarifning o'z narxi bilan avtomatik
  // to'ldiriladi (default qiymat) — admin xohlasa kelishilgan (masalan
  // tanish-bilishlik) narxga qarab qo'lda o'zgartira oladi.
  const onTariffChange = (value) => {
    setTariffId(value);
    const tariff = tariffs.find((tf) => tf._id === value);
    setPrice(tariff ? String(tariff.price) : "");
  };

  const selectedTariff = tariffs.find((tf) => tf._id === tariffId);

  const onStartDateChange = (e) => {
    const value = e.target.value;
    setStartDate(value);
    setEndDate(nextMonthSameDay(value));
  };

  const submit = async () => {
    try {
      if (!tariffId) throw new Error("client.fillTheRows");
      if (showDates && endDate <= startDate) throw new Error("client.invalidEndDate");
      if (price !== "" && Number(price) < 0) throw new Error("client.invalidPrice");
      setLoading(true);

      const priceValue = price !== "" ? Number(price) : undefined;

      const res = isChange
        ? await api.patch(`/clients/${client._id}/change-tariff`, {
            tariffId,
            mode,
            price: priceValue,
            ...(mode === "new" && {
              startDate: toUnix(startDate),
              endDate: toUnix(endDate),
            }),
          })
        : await api.post(`/clients/${client._id}/subscribe`, {
            tariffId,
            price: priceValue,
            startDate: toUnix(startDate),
            endDate: toUnix(endDate),
          });

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
      title={isChange ? t("client.changeTariff") : t("client.subscribe")}
      actions={
        <>
          <Button color="slate" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={loading} onClick={submit}>
            {t("common.confirm")}
          </Button>
        </>
      }
    >
      <Select
        label={t("client.tariff")}
        required
        value={tariffId}
        onChange={onTariffChange}
        placeholder={t("client.selectTariff")}
        options={tariffs.map((tf) => ({ value: tf._id, label: tf.name }))}
      />

      <Input
        label={t("client.price")}
        type="number"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        disabled={!selectedTariff}
        placeholder={selectedTariff ? String(selectedTariff.price) : t("client.selectTariff")}
      />

      {isChange && (
        <div className="flex flex-col gap-2 w-full pt-1">
          <span className="pl-2 text-sm text-slate-800">{t("client.dateMode")}</span>
          <Checkbox
            checked={mode === "new"}
            onChange={() => setMode("new")}
            label={t("client.dateModeNew")}
          />
          <Checkbox
            checked={mode === "keep"}
            onChange={() => setMode("keep")}
            label={t("client.dateModeKeep")}
          />
        </div>
      )}

      {showDates && (
        <div className="grid grid-cols-2 gap-2 w-full">
          <Input
            label={t("client.startDate")}
            type="date"
            value={startDate}
            onChange={onStartDateChange}
          />
          <Input
            label={t("client.endDate")}
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      )}
    </Dialog>
  );
}
