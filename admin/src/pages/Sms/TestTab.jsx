import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPaperAirplane } from "react-icons/hi2";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import Input from "../../ui/Input";
import Textarea from "../../ui/Textarea";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { STATUS_COLOR } from "./smsMeta";

// Bitta raqamga test SMS — getsms.uz ulanishi va jo'natuvchi nomini tekshirish uchun.
function TestTab() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState("+998");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    try {
      setSending(true);
      setResult(null);
      const res = await api.post("/admin/sms/test", { phone, text });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setResult(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSending(false);
    }
  };

  const check = async () => {
    try {
      setChecking(true);
      const res = await api.get(`/admin/sms/test/${result._id}`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setResult(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 text-blue-500 shrink-0">
          <HiPaperAirplane className="text-lg" />
        </span>
        <h2 className="text-base font-bold text-slate-800">{t("sms.tabs.test")}</h2>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <Input label={t("sms.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Textarea label={t("sms.text")} value={text} onChange={(e) => setText(e.target.value)} />
        <p className="text-xs text-slate-400 text-right">{t("sms.charCount", { count: text.length })}</p>
      </div>
      <div className="flex justify-end px-4 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-xl">
        <Button loading={sending} disabled={!text.trim()} onClick={send} className="gap-1.5">
          <HiPaperAirplane className="text-base" />
          {t("sms.sendTest")}
        </Button>
      </div>
      {result && (
        <div className="flex flex-col gap-2 mx-4 mb-4 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Chip value={t(`sms.logStatus.${result.status}`)} color={STATUS_COLOR[result.status]} />
              <span className="text-sm font-semibold text-slate-700">{result.phone}</span>
            </div>
            {result.status === "sent" && (
              <Button variant="outlined" loading={checking} onClick={check}>
                {t("sms.refreshStatus")}
              </Button>
            )}
          </div>
          {result.error && <p className="text-xs text-red-500">{result.error}</p>}
        </div>
      )}
    </div>
  );
}

export default TestTab;
