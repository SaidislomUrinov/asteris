import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  HiArrowPath,
  HiArrowDownTray,
  HiMagnifyingGlass,
  HiExclamationTriangle,
  HiDocumentText,
  HiBars3BottomLeft,
  HiArrowDown,
} from "react-icons/hi2";
import { api } from "../../utils/fetching";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";

const LINE_OPTIONS = [200, 500, 1000, 2000, 5000];
const SEARCH_DEBOUNCE_MS = 400;

// Xato/ogohlantirish qatorlarini rang bilan ajratish — sof ko'rinish uchun,
// serverdagi haqiqiy log darajasi emas (PM2 matn yozadi, daraja yo'q).
const ERROR_RE = /\b(error|exception|failed|fatal|unhandled|ECONN\w*|E11000)\b/i;
const WARN_RE = /\b(warn(ing)?|deprecated|timeout|retry)\b/i;
const STACK_RE = /^\s+at\s/;

const toneOf = (text, file) => {
  if (STACK_RE.test(text)) return "text-red-300/70";
  if (ERROR_RE.test(text)) return "text-red-400";
  if (WARN_RE.test(text)) return "text-amber-300";
  return file === "error" ? "text-red-200/90" : "text-slate-200";
};

const formatSize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const pad = (n) => String(n).padStart(2, "0");
const formatTs = (sec) => {
  if (!sec) return "";
  const d = new Date(sec * 1000);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// PM2 prefiksi "2026-09-28T10:05:12" → "28.09 10:05:12"
const formatLineTime = (time) => {
  const m = time?.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/);
  return m ? `${m[2]}.${m[1]} ${m[3]}` : "";
};

export default function Logs() {
  const { t } = useTranslation();

  const [file, setFile] = useState("out");
  const [lines, setLines] = useState("500");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [wrap, setWrap] = useState(true);

  const [files, setFiles] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const viewportRef = useRef(null);
  const requestSeq = useRef(0);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await api.get("/admin/logs/files");
      if (res.data.ok) setFiles(res.data.data || []);
    } catch {
      // ro'yxat faqat hajmni ko'rsatish uchun — xato jim o'tadi
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      setLoading(true);
      const res = await api.get("/admin/logs", { params: { file, lines, search } });
      if (seq !== requestSeq.current) return;
      const { ok, data: payload, msg } = res.data;
      if (!ok) throw new Error(msg);
      setData(payload);
      setError("");
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err.message);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [file, lines, search]);

  const refresh = useCallback(() => {
    fetchFiles();
    fetchLogs();
  }, [fetchFiles, fetchLogs]);

  useEffect(() => {
    const id = setTimeout(refresh, 0);
    return () => clearTimeout(id);
  }, [refresh]);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Yangi ma'lumot kelganda eng oxirgi (eng yangi) qatorga tushiriladi.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data]);

  const scrollToBottom = () => {
    const el = viewportRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const download = async () => {
    try {
      setDownloading(true);
      const res = await api.get("/admin/logs/download", {
        params: { file },
        responseType: "blob",
      });
      // Xato bo'lsa server JSON qaytaradi ({ ok:false, msg }).
      if (res.data.type?.includes("application/json")) {
        const json = JSON.parse(await res.data.text());
        throw new Error(json.msg);
      }
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file}-${new Date().toISOString().slice(0, 10)}.log`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(t(err.message || "logs.downloadError", { defaultValue: t("logs.downloadError") }));
    } finally {
      setDownloading(false);
    }
  };

  const fileInfo = files.find((f) => f.key === file);
  const rows = data?.lines || [];
  const exists = data ? data.exists : fileInfo?.exists ?? true;

  return (
    <div className="flex flex-col w-full gap-3 min-h-[calc(100dvh-100px)]">
      {/* Sarlavha qatori */}
      <div className="flex flex-wrap items-center justify-between gap-2 w-full shrink-0">
        <div className="flex flex-col">
          <p className="text-[18px] font-semibold text-slate-800">{t("logs.title")}</p>
          <p className="text-[12px] text-slate-400">{t("logs.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button color="slate" variant="ghost" onClick={refresh} disabled={loading}>
            <HiArrowPath className={`text-base ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{t("logs.refresh")}</span>
          </Button>
          <Button
            color="slate"
            variant="ghost"
            onClick={download}
            loading={downloading}
            disabled={!exists || downloading}
          >
            <HiArrowDownTray className="text-base" />
            <span className="hidden sm:inline">{t("logs.download")}</span>
          </Button>
        </div>
      </div>

      {/* Fayl tanlash */}
      <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:inline-grid sm:self-start p-1 bg-slate-100 rounded-xl">
        {["out", "error"].map((key) => {
          const info = files.find((f) => f.key === key);
          const active = file === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFile(key)}
              className={`flex items-center justify-center gap-2 px-4 h-9 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors ${
                active ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${key === "error" ? "bg-red-500" : "bg-emerald-500"}`} />
              {t(`logs.file.${key}`)}
              {info?.exists && (
                <span className="text-[11px] font-medium text-slate-400 tabular-nums">{formatSize(info.size)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filtrlar */}
      <div className="flex flex-wrap items-center gap-2 w-full">
        <div className="flex-1 min-w-[220px]">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("logs.searchPlaceholder")}
            icon={<HiMagnifyingGlass />}
            variant="white"
          />
        </div>
        <div className="w-[160px]">
          <Select
            value={lines}
            onChange={setLines}
            variant="white"
            options={LINE_OPTIONS.map((n) => ({ value: String(n), label: t("logs.lastLines", { count: n }) }))}
          />
        </div>
        <button
          type="button"
          onClick={() => setWrap((w) => !w)}
          title={t("logs.wrap")}
          className={`flex items-center gap-1.5 h-10 px-3 rounded-xl border text-[12px] font-semibold cursor-pointer transition-colors ${
            wrap ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
          }`}
        >
          <HiBars3BottomLeft className="text-base" />
          {t("logs.wrap")}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 w-full bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <HiExclamationTriangle className="text-base shrink-0" />
            {t(error, { defaultValue: t("logs.loadError") })}
          </span>
          <Button color="red" variant="text" onClick={fetchLogs}>
            {t("logs.retry")}
          </Button>
        </div>
      )}

      {/* Log oynasi */}
      <div className="relative flex flex-col flex-1 min-h-[420px] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
        <div className="flex items-center justify-between gap-2 px-3 h-9 shrink-0 border-b border-slate-800 bg-slate-900 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 font-mono truncate">
            <HiDocumentText className="text-sm shrink-0" />
            {fileInfo?.name || `${file}.log`}
            {data?.exists && (
              <span className="text-slate-500">
                · {formatSize(data.size)} · {t("logs.modified")} {formatTs(data.modifiedAt)}
              </span>
            )}
          </span>
          {data?.exists && (
            <span className="shrink-0 tabular-nums">
              {search ? t("logs.matches", { count: rows.length }) : t("logs.shown", { count: rows.length })}
            </span>
          )}
        </div>

        <div
          ref={viewportRef}
          className="flex-1 overflow-auto font-mono text-[12px] leading-[1.6] py-2 h-0 min-h-[380px]"
        >
          {loading && !data ? (
            <div className="flex flex-col gap-2 px-3 py-2">
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  className="h-3 rounded bg-slate-800/80 animate-pulse"
                  style={{ width: `${40 + ((i * 37) % 55)}%` }}
                />
              ))}
            </div>
          ) : !exists ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center text-slate-400">
              <HiDocumentText className="text-3xl text-slate-600" />
              <p className="text-[13px] font-sans font-semibold text-slate-300">{t("logs.noFile")}</p>
              <p className="text-[12px] font-sans max-w-md">{t("logs.noFileHint")}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 font-sans text-[13px]">
              <HiMagnifyingGlass className="text-2xl text-slate-600" />
              {search ? t("logs.noMatches") : t("logs.empty")}
            </div>
          ) : (
            <>
              {data?.truncated && (
                <p className="px-3 pb-2 mb-1 border-b border-dashed border-slate-800 text-[11px] font-sans text-slate-500">
                  {t("logs.truncated", { count: rows.length })}
                </p>
              )}
              <table className="w-full border-collapse">
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="align-top hover:bg-white/[0.03]">
                      <td className="select-none text-right pl-3 pr-3 text-slate-600 tabular-nums w-px whitespace-nowrap">
                        {i + 1}
                      </td>
                      <td className="select-none pr-3 text-slate-500 tabular-nums w-px whitespace-nowrap">
                        {formatLineTime(row.time)}
                      </td>
                      <td
                        className={`pr-3 ${toneOf(row.text, file)} ${
                          wrap ? "whitespace-pre-wrap [overflow-wrap:anywhere]" : "whitespace-pre"
                        }`}
                      >
                        {row.text || " "}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {rows.length > 30 && (
          <button
            type="button"
            onClick={scrollToBottom}
            title={t("logs.toBottom")}
            className="absolute right-4 bottom-4 flex items-center justify-center w-9 h-9 rounded-full bg-slate-700/90 text-white hover:bg-slate-600 cursor-pointer shadow-lg"
          >
            <HiArrowDown className="text-base" />
          </button>
        )}
      </div>
    </div>
  );
}
