import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiCheckCircle,
  HiExclamationTriangle,
  HiMagnifyingGlass,
  HiUserGroup,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Loading from "../../ui/Loading";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

/**
 * Kurs dasturini boshqa guruhdan import qilish (to'liq nusxa).
 * Manba ro'yxati `GET /syllabus/:groupId/sources` — faqat SHU FANDAGI,
 * dasturi bo'sh bo'lmagan guruhlar. Import REPLACE: mavjud dastur o'chadi.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.groupId - maqsad guruh
 * @param {boolean} props.hasSyllabus - maqsadda dastur bormi (ogohlantirish uchun)
 * @param {(data) => void} props.onImported - GET bilan bir xil shakldagi javob
 */
function ImportSyllabusDialog({ open, onClose, groupId, hasSyllabus = false, onImported }) {
  const { t } = useTranslation();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchSources = useCallback(async () => {
    if (!open) return;
    try {
      setLoading(true);
      setLoadError("");
      const res = await api.get(`/syllabus/${groupId}/sources`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setSources(data || []);
    } catch (error) {
      setLoadError(error.message || "syllabus.loadError");
    } finally {
      setLoading(false);
    }
  }, [groupId, open]);

  useEffect(() => {
    const id = setTimeout(fetchSources, 0);
    return () => clearTimeout(id);
  }, [fetchSources]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter((s) => (s.name || "").toLowerCase().includes(q));
  }, [sources, search]);

  const runImport = async () => {
    try {
      setImporting(true);
      const res = await api.post(`/syllabus/${groupId}/import`, { sourceGroupId: selected });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || "syllabus.imported");
      onImported?.(data);
      setConfirmOpen(false);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setImporting(false);
    }
  };

  const start = () => {
    if (!selected) return;
    // Mavjud dastur ustiga yoziladi — tasdiq so'raymiz.
    if (hasSyllabus) setConfirmOpen(true);
    else runImport();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={t("syllabus.importTitle")}
        actions={
          <>
            <Button color="black" variant="text" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!selected} loading={importing} onClick={start}>
              {t("syllabus.importAction")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 w-full">
          <p className="text-xs text-slate-400">{t("syllabus.importHint")}</p>

          <Input
            variant="white"
            placeholder={t("syllabus.importSearch")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<HiMagnifyingGlass />}
          />

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loading />
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 text-xl text-red-400">
                <HiExclamationTriangle />
              </span>
              <p className="text-sm text-slate-600">{t("syllabus.loadError")}</p>
              <Button variant="outlined" color="black" onClick={fetchSources}>
                {t("syllabus.retry")}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-50 text-xl text-slate-300">
                <HiUserGroup />
              </span>
              <p className="text-sm text-slate-600">{t("syllabus.importEmpty")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {filtered.map((s) => {
                const active = selected === s._id;
                return (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => setSelected(s._id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                      active
                        ? "border-blue-400 bg-blue-50/60"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {s.name}
                      </span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {t("syllabus.importMeta", {
                          modules: s.moduleCount || 0,
                          lessons: s.lessonCount || 0,
                        })}
                        {typeof s.studentsCount === "number" && (
                          <> · {t("syllabus.importStudents", { count: s.studentsCount })}</>
                        )}
                      </span>
                    </div>
                    {active && <HiCheckCircle className="shrink-0 text-xl text-blue-500" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("syllabus.importTitle")}
        zIndex="z-40"
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={importing} onClick={runImport}>
              {t("syllabus.importAction")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{t("syllabus.importReplaceWarning")}</p>
      </Dialog>
    </>
  );
}

export default ImportSyllabusDialog;
