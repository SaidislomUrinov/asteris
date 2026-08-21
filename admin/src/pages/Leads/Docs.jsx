import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Highlight, themes } from "prism-react-renderer";
import {
  HiArrowLeft,
  HiClipboard,
  HiCheck,
  HiArrowPath,
  HiExclamationTriangle,
  HiLockClosed,
} from "react-icons/hi2";
import IconButton from "../../ui/IconButton";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import Dialog from "../../ui/Dialog";
import Loading from "../../ui/Loading";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { PLATFORMS } from "./statusMeta";

const DOCS_BASE_URL = "https://server.asteris.uz";

const curlExample = (key) => `curl -X POST ${DOCS_BASE_URL}/api/leads \\
  -H "Content-Type: application/json" \\
  -H "x-lead-api-key: ${key || "YOUR_API_KEY"}" \\
  -d '{
    "name": "Aziz Karimov",
    "phone": "+998901234567",
    "platform": "instagram",
    "comment": "Kurs narxi haqida so'radi"
  }'`;

const jsExample = (key) => `await fetch("${DOCS_BASE_URL}/api/leads", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-lead-api-key": "${key || "YOUR_API_KEY"}",
  },
  body: JSON.stringify({
    name: "Aziz Karimov",
    phone: "+998901234567",
    platform: "instagram",
    comment: "Kurs narxi haqida so'radi",
  }),
});`;

const successExample = `{
  "ok": true,
  "msg": "lead.created",
  "data": {
    "_id": "6a5901...",
    "name": "Aziz Karimov",
    "phone": "+998901234567",
    "platform": "instagram",
    "status": "pending",
    "date": "16.07.2026 | 21:30"
  }
}`;

const errorExample = `{ "ok": false, "msg": "lead.apiKeyInvalid" }`;

const errorExamples = [
  { code: "lead.apiKeyRequired", desc: "x-lead-api-key header'i yuborilmagan" },
  { code: "lead.apiKeyInvalid", desc: "Kalit noto'g'ri yoki eskirgan" },
  { code: "lead.fillTheRows", desc: "Majburiy maydonlardan biri bo'sh" },
  { code: "lead.invalidPlatform", desc: "platform enum qiymatlaridan biri emas" },
];

const FIELDS = [
  { name: "name", type: "string", required: true, desc: "Mijoz ismi" },
  { name: "phone", type: "string", required: true, desc: "Telefon raqami" },
  {
    name: "platform",
    type: "enum",
    required: true,
    desc: `Qaysi kanaldan kelgani: ${PLATFORMS.join(", ")}`,
  },
  {
    name: "platformNote",
    type: "string",
    required: false,
    desc: "platform: \"other\" bo'lganda qo'shimcha izoh",
  },
  { name: "comment", type: "string", required: false, desc: "Erkin izoh" },
];

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "authentication", label: "Authentication" },
  { id: "fields", label: "Request body" },
  { id: "responses", label: "Responses" },
  { id: "rate-limit", label: "Rate limiting" },
];

// Matn ichida urg'u berish uchun — rangni ota elementdan meros oladi
const Em = ({ children }) => <strong className="font-semibold">{children}</strong>;

const Section = ({ id, title, children }) => (
  <section id={id} className="flex flex-col gap-3 scroll-mt-4 py-8 border-b border-slate-100 last:border-b-0">
    <h2 className="text-[15px] font-semibold text-slate-800 uppercase tracking-wide">
      {title}
    </h2>
    {children}
  </section>
);

const FieldsTable = ({ t }) => (
  <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-slate-500 text-[11px] uppercase bg-slate-50">
          <th className="py-2 px-3 font-semibold">Field</th>
          <th className="py-2 px-3 font-semibold">Type</th>
          <th className="py-2 px-3 font-semibold">Required</th>
          <th className="py-2 px-3 font-semibold">Izoh</th>
        </tr>
      </thead>
      <tbody>
        {FIELDS.map((f) => (
          <tr key={f.name} className="border-t border-slate-100">
            <td className="py-2 px-3 font-mono text-slate-800 whitespace-nowrap">
              {f.name}
            </td>
            <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
              {f.type}
            </td>
            <td className="py-2 px-3">
              {f.required ? (
                <Chip value={t("common.yes")} color="red" />
              ) : (
                <Chip value={t("common.no")} color="slate" />
              )}
            </td>
            <td className="py-2 px-3 text-slate-600">{f.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// VS Code Dark+ uslubidagi sintaksis rangi
const HighlightedCode = ({ code, language }) => (
  <Highlight theme={themes.vsDark} code={code} language={language}>
    {({ className, style, tokens, getLineProps, getTokenProps }) => (
      <pre
        className={`${className} w-full overflow-x-auto text-[12.5px] leading-relaxed p-4`}
        style={{ ...style, background: "transparent" }}
      >
        {tokens.map((line, i) => (
          <div key={i} {...getLineProps({ line })}>
            {line.map((token, key) => (
              <span key={key} {...getTokenProps({ token })} />
            ))}
          </div>
        ))}
      </pre>
    )}
  </Highlight>
);

// Sticky o'ng panel — cURL/JavaScript so'rov namunasi va javob (success/error) tablari
const Tab = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors cursor-pointer ${
      active ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
    }`}
  >
    {children}
  </button>
);

const CodePanel = ({ apiKey }) => {
  const [reqTab, setReqTab] = useState("curl");
  const [resTab, setResTab] = useState("success");
  const [copied, setCopied] = useState(false);

  const requestCode = reqTab === "curl" ? curlExample(apiKey) : jsExample(apiKey);
  const responseCode = resTab === "success" ? successExample : errorExample;

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard mavjud bo'lmasa jim o'tkazamiz
    }
  };

  return (
    <div className="flex flex-col gap-4 sticky top-4">
      <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-1">
            <Tab active={reqTab === "curl"} onClick={() => setReqTab("curl")}>
              cURL
            </Tab>
            <Tab active={reqTab === "js"} onClick={() => setReqTab("js")}>
              JavaScript
            </Tab>
          </div>
          <button
            onClick={() => copy(requestCode)}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            {copied ? (
              <>
                <HiCheck className="text-emerald-400" /> Copied
              </>
            ) : (
              <>
                <HiClipboard /> Copy
              </>
            )}
          </button>
        </div>
        <HighlightedCode
          code={requestCode}
          language={reqTab === "curl" ? "bash" : "javascript"}
        />
      </div>

      <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
        <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10">
          <Tab active={resTab === "success"} onClick={() => setResTab("success")}>
            200 · Success
          </Tab>
          <Tab active={resTab === "error"} onClick={() => setResTab("error")}>
            200 · Error
          </Tab>
        </div>
        <HighlightedCode code={responseCode} language="json" />
      </div>
    </div>
  );
};

export default function LeadsDocs() {
  const { t } = useTranslation();
  const nv = useNavigate();

  const [apiKey, setApiKey] = useState("");
  const [keyLoading, setKeyLoading] = useState(true);
  const [regenLoading, setRegenLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [baseUrlCopied, setBaseUrlCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/admin/api-key");
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        setApiKey(data.apiKey);
      } catch (error) {
        errorMsg(error.message);
      } finally {
        setKeyLoading(false);
      }
    })();
  }, []);

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 1500);
    } catch {
      // clipboard mavjud bo'lmasa jim o'tkazamiz
    }
  };

  const regenerate = async () => {
    try {
      setRegenLoading(true);
      const res = await api.post("/admin/api-key/regenerate");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setApiKey(data.apiKey);
      successMsg(msg);
      setConfirmOpen(false);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setRegenLoading(false);
    }
  };

  const copyBaseUrl = async () => {
    try {
      await navigator.clipboard.writeText(DOCS_BASE_URL);
      setBaseUrlCopied(true);
      setTimeout(() => setBaseUrlCopied(false), 1500);
    } catch {
      // clipboard mavjud bo'lmasa jim o'tkazamiz
    }
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-124px)]">
      {/* Header */}
      <div className="flex flex-col gap-4 w-full rounded-2xl bg-linear-to-br from-slate-800 to-slate-950 text-white p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-2">
          <IconButton variant="ghost" color="black" onClick={() => nv("/leads")}>
            <HiArrowLeft />
          </IconButton>
          <span className="text-[11px] sm:text-[12px] uppercase tracking-widest text-slate-400 font-semibold">
            API Reference
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-[20px] sm:text-[26px] font-bold">{t("lead.docsTitle")}</h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            <Trans i18nKey="lead.docsIntro" components={{ 1: <Em /> }} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Chip value="POST" color="emerald" />
          <code className="text-sm font-mono text-slate-200">/api/leads</code>
          <Chip value="API kalit majburiy" color="red" />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold shrink-0">
            {t("lead.docsBaseUrl")}
          </span>
          <code className="text-sm font-mono text-emerald-300 break-all sm:break-normal flex-1 min-w-0">
            {DOCS_BASE_URL}
          </code>
          <IconButton variant="ghost" color="black" onClick={copyBaseUrl} className="shrink-0">
            {baseUrlCopied ? (
              <HiCheck className="text-emerald-400" />
            ) : (
              <HiClipboard className="text-slate-300" />
            )}
          </IconButton>
        </div>
      </div>

      {/* Mobil/tablet navigatsiya — gorizontal skroll pill'lar */}
      <div className="lg:hidden flex items-center gap-2 w-full overflow-x-auto pb-2 mb-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-full px-3 py-1.5 cursor-pointer"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 3-ustunli layout: navigatsiya | matn | kod namunasi */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_380px] xl:grid-cols-[220px_1fr_440px] gap-6 lg:gap-8 w-full items-start">
        <aside className="hidden lg:flex flex-col gap-1 sticky top-4 self-start border-l border-slate-200 pl-4">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className="text-left text-[13px] font-medium text-slate-500 hover:text-slate-900 py-1 transition-colors cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </aside>

        <main className="flex flex-col w-full min-w-0">
          <Section id="overview" title="Overview">
            <p className="text-sm text-slate-600 leading-relaxed">
              <Trans i18nKey="lead.docsIntro" components={{ 1: <Em /> }} />
            </p>
          </Section>

          <Section id="authentication" title="Authentication">
            <div className="flex items-start gap-2 w-full rounded-xl border border-red-200 bg-red-50 p-3">
              <HiLockClosed className="text-red-500 text-lg shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 leading-relaxed">
                <Trans i18nKey="lead.docsApiKeyDesc" components={{ 1: <Em /> }} />
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3">
              {keyLoading ? (
                <Loading height="24px" />
              ) : (
                <>
                  <code className="flex-1 min-w-0 font-mono text-[13px] text-slate-800 truncate">
                    {apiKey}
                  </code>
                  <div className="flex items-center gap-2 shrink-0">
                    <IconButton variant="ghost" onClick={copyKey}>
                      {keyCopied ? (
                        <HiCheck className="text-emerald-500" />
                      ) : (
                        <HiClipboard />
                      )}
                    </IconButton>
                    <Button
                      color="red"
                      variant="outlined"
                      onClick={() => setConfirmOpen(true)}
                      className="flex-1 sm:flex-none"
                    >
                      <HiArrowPath className="text-base" />
                      {t("lead.regenerate")}
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 text-[11px] uppercase bg-slate-50">
                    <th className="py-2 px-3 font-semibold">{t("lead.docsApiKeyHeaderName")}</th>
                    <th className="py-2 px-3 font-semibold">{t("lead.docsApiKeyHeaderRequired")}</th>
                    <th className="py-2 px-3 font-semibold">{t("lead.docsApiKeyHeaderOwner")}</th>
                    <th className="py-2 px-3 font-semibold">{t("lead.docsApiKeyHeaderEffect")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100 align-top">
                    <td className="py-2 px-3 font-mono text-slate-800 whitespace-nowrap">
                      x-lead-api-key
                    </td>
                    <td className="py-2 px-3">
                      <Chip value={t("common.yes")} color="red" />
                    </td>
                    <td className="py-2 px-3 text-slate-600 min-w-40">
                      {t("lead.docsApiKeyHeaderOwnerValue")}
                    </td>
                    <td className="py-2 px-3 text-slate-600 min-w-52">
                      {t("lead.docsApiKeyHeaderEffectValue")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-semibold text-slate-800 text-sm">{t("lead.docsApiKeyHow")}</p>
              <ol className="flex flex-col gap-2 list-decimal pl-5 text-sm text-slate-600 leading-relaxed">
                <li>{t("lead.docsApiKeyStep1")}</li>
                <li>{t("lead.docsApiKeyStep2")}</li>
                <li>{t("lead.docsApiKeyStep3")}</li>
                <li>
                  <Trans i18nKey="lead.docsApiKeyStep4" components={{ 1: <Em /> }} />
                </li>
              </ol>
            </div>

            <div className="flex items-start gap-2 w-full rounded-xl border border-orange-200 bg-orange-50 p-3">
              <HiExclamationTriangle className="text-orange-500 text-lg shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800 leading-relaxed">
                <Trans i18nKey="lead.docsApiKeySecurity" components={{ 1: <Em /> }} />
              </p>
            </div>
          </Section>

          <Section id="fields" title={t("lead.docsFields")}>
            <FieldsTable t={t} />
          </Section>

          <Section id="responses" title="Responses">
            <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 text-[11px] uppercase bg-slate-50">
                    <th className="py-2 px-3 font-semibold">msg</th>
                    <th className="py-2 px-3 font-semibold">Izoh</th>
                  </tr>
                </thead>
                <tbody>
                  {errorExamples.map((e) => (
                    <tr key={e.code} className="border-t border-slate-100">
                      <td className="py-2 px-3 font-mono text-red-600 whitespace-nowrap">
                        {e.code}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{e.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-500">
              HTTP status har doim <code className="font-mono">200</code>, muvaffaqiyat{" "}
              <code className="font-mono">ok</code> maydoni orqali aniqlanadi. To'liq
              javob namunalari o'ng paneldagi <b>Success</b> / <b>Error</b> tablarida.
            </p>
          </Section>

          <Section id="rate-limit" title="Rate limiting">
            <p className="text-sm text-slate-600 leading-relaxed">
              <Trans i18nKey="lead.docsRateLimit" components={{ 1: <Em /> }} />
            </p>
          </Section>
        </main>

        <div className="hidden lg:block">
          <CodePanel apiKey={apiKey} />
        </div>
      </div>

      {/* Mobil/tablet uchun kod paneli content ostida */}
      <div className="lg:hidden mt-6">
        <CodePanel apiKey={apiKey} />
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("lead.regenerateTitle")}
        actions={
          <>
            <Button color="slate" variant="text" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={regenLoading} onClick={regenerate}>
              {t("lead.regenerate")}
            </Button>
          </>
        }
      >
        <p className="text-slate-700 text-sm">{t("lead.regenerateConfirm")}</p>
      </Dialog>
    </div>
  );
}
