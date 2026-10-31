import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheckCircle, HiGift } from "react-icons/hi2";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import SearchSelect from "../../ui/SearchSelect";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { fmtNum } from "./smsMeta";

const EMPTY = { smsCount: "", validityDays: "0", note: "" };

// Mijozning tanlangan filiali uchun to'lovsiz SMS paket sovg'a qilish.
// Balans filial darajasida — sovg'a faqat tanlangan filialga tushadi.
function GrantTab() {
  const { t } = useTranslation();
  const [client, setClient] = useState({ id: "", name: "" });
  const [centers, setCenters] = useState([]);
  const [center, setCenter] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const searchClients = async (q) => {
    try {
      const res = await api.get("/clients", { params: { search: q, limit: 20 } });
      if (!res.data?.ok) return [];
      return (res.data.data || []).map((c) => ({ value: c._id, label: c.name, sub: c.phone }));
    } catch {
      return [];
    }
  };

  const pickClient = async (id, item) => {
    setClient({ id, name: item?.label || "" });
    setCenters([]);
    setCenter("");
    setResult(null);
    if (!id) return;
    try {
      const res = await api.get(`/admin/sms/clients/${id}/centers`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setCenters(data || []);
      if (data?.length === 1) setCenter(data[0]._id);
    } catch (error) {
      errorMsg(error.message);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    try {
      setSaving(true);
      const res = await api.post("/admin/sms/grant", {
        client: client.id,
        center,
        smsCount: Number(form.smsCount),
        validityDays: Number(form.validityDays || 0),
        note: form.note,
      });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setResult(data);
      setForm(EMPTY);
      successMsg(msg || "sms.grantDone");
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const ready = client.id && center && Number(form.smsCount) > 0;

  return (
    <div className="flex flex-col w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 text-blue-500 shrink-0">
          <HiGift className="text-lg" />
        </span>
        <h2 className="text-base font-bold text-slate-800">{t("sms.tabs.grant")}</h2>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SearchSelect
            label={t("sms.grant.client")}
            value={client.id}
            displayValue={client.name}
            onSearch={searchClients}
            onChange={pickClient}
          />
          <Select
            label={t("sms.grant.center")}
            value={center}
            onChange={setCenter}
            disabled={!centers.length}
            options={centers.map((c) => ({ value: c._id, label: c.name }))}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label={t("sms.grant.smsCount")} type="number" value={form.smsCount} onChange={set("smsCount")} />
          <Input label={t("sms.grant.validityDays")} type="number" value={form.validityDays} onChange={set("validityDays")} />
        </div>
        <Input label={t("sms.grant.note")} value={form.note} onChange={set("note")} />
      </div>
      <div className="flex justify-end px-4 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-xl">
        <Button loading={saving} disabled={!ready} onClick={submit} className="gap-1.5">
          <HiGift className="text-base" />
          {t("sms.grant.submit")}
        </Button>
      </div>
      {result && (
        <div className="flex items-start gap-3 mx-4 mb-4 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-800">
          <HiCheckCircle className="text-xl text-emerald-500 shrink-0 mt-px" />
          <span>
            {t("sms.grant.done", { count: fmtNum(result.smsCount), center: result.centerName, balance: fmtNum(result.balance?.total ?? 0) })}
          </span>
        </div>
      )}
    </div>
  );
}

export default GrantTab;
