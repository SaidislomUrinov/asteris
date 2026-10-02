import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiCheckCircle,
  HiClipboardDocumentList,
  HiExclamationTriangle,
  HiMagnifyingGlass,
  HiUserGroup,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Loading from "../../ui/Loading";
import CurrentLessonPicker from "./CurrentLessonPicker";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const TAB_PLANS = "plans";
const TAB_GROUPS = "groups";

// Manba ro'yxatini yuklash — ikkala tab bir xil naqshda.
const useSourceList = (url, enabled) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchItems = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      setError("");
      const res = await api.get(url);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setItems(data || []);
    } catch (err) {
      setError(err.message || "syllabus.loadError");
    } finally {
      setLoading(false);
    }
  }, [url, enabled]);

  useEffect(() => {
    const id = setTimeout(fetchItems, 0);
    return () => clearTimeout(id);
  }, [fetchItems]);

  return { items, loading, error, refetch: fetchItems };
};

/**
 * Kurs dasturini import qilish (to'liq nusxa) — 2 bosqich
 * (API_CONTRACT_teaching_plans.md §6):
 *   1) Manba: "O'qituvchilar rejalari" (`GET /syllabus/:groupId/plans`) yoki
 *      "Boshqa guruhlar" (`GET /syllabus/:groupId/sources`).
 *   2) "Hozir qaysi darsdamiz?" — `CurrentLessonPicker`.
 * Import: `POST /syllabus/:groupId/import { planId | sourceGroupId, currentLessonNo }`.
 * Mavjud dastur bo'lsa — almashtirish tasdig'i.
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
  const plans = useSourceList(`/syllabus/${groupId}/plans`, open);
  const groups = useSourceList(`/syllabus/${groupId}/sources`, open);

  const [tab, setTab] = useState(TAB_PLANS);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // { kind, item }
  const [step, setStep] = useState(1);
  const [currentLessonNo, setCurrentLessonNo] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const list = tab === TAB_PLANS ? plans : groups;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list.items;
    return list.items.filter((s) =>
      tab === TAB_PLANS
        ? (s.title || "").toLowerCase().includes(q) ||
          (s.teacher?.name || "").toLowerCase().includes(q)
        : (s.name || "").toLowerCase().includes(q),
    );
  }, [list.items, search, tab]);

  const select = (kind, item) => {
    setSelected({ kind, item });
    setCurrentLessonNo(1);
  };

  const runImport = async () => {
    if (!selected) return;
    try {
      setImporting(true);
      const body =
        selected.kind === TAB_PLANS
          ? { planId: selected.item._id, currentLessonNo }
          : { sourceGroupId: selected.item._id, currentLessonNo };
      const res = await api.post(`/syllabus/${groupId}/import`, body);
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

  const tabs = [
    { key: TAB_PLANS, label: t("syllabus.importTabPlans") },
    { key: TAB_GROUPS, label: t("syllabus.importTabGroups") },
  ];

  const renderList = () => {
    if (list.loading) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <Loading />
        </div>
      );
    }
    if (list.error) {
      return (
        <div className="flex flex-col flex-1 items-center justify-center gap-2 text-center">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 text-xl text-red-400">
            <HiExclamationTriangle />
          </span>
          <p className="text-sm text-slate-600">{t("syllabus.loadError")}</p>
          <Button variant="outlined" color="black" onClick={list.refetch}>
            {t("syllabus.retry")}
          </Button>
        </div>
      );
    }
    if (filtered.length === 0) {
      const EmptyIcon = tab === TAB_PLANS ? HiClipboardDocumentList : HiUserGroup;
      return (
        <div className="flex flex-col flex-1 items-center justify-center gap-2 text-center">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-50 text-xl text-slate-300">
            <EmptyIcon />
          </span>
          <p className="text-sm text-slate-600">
            {tab === TAB_PLANS ? t("syllabus.importPlansEmpty") : t("syllabus.importEmpty")}
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col flex-1 min-h-0 gap-2 overflow-y-auto pr-0.5">
        {filtered.map((s) => {
          const active = selected?.kind === tab && selected.item._id === s._id;
          return (
            <button
              key={s._id}
              type="button"
              onClick={() => select(tab, s)}
              className={`flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                active
                  ? "border-blue-400 bg-blue-50/60"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                <span className="text-sm font-semibold text-slate-800 truncate">
                  {tab === TAB_PLANS ? s.title : s.name}
                </span>
                {tab === TAB_PLANS && (
                  <span className="flex items-center gap-1.5 min-w-0 text-xs text-slate-500">
                    <span className="truncate">{s.teacher?.name || "—"}</span>
                    {s.mine && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-50 text-[10px] font-semibold uppercase text-emerald-600">
                        {t("syllabus.importMine")}
                      </span>
                    )}
                  </span>
                )}
                <span className="text-xs text-slate-400 tabular-nums">
                  {t("syllabus.importMeta", {
                    modules: s.moduleCount || 0,
                    lessons: s.lessonCount || 0,
                  })}
                  {tab === TAB_GROUPS && typeof s.studentsCount === "number" && (
                    <> · {t("syllabus.importStudents", { count: s.studentsCount })}</>
                  )}
                </span>
              </div>
              {active && <HiCheckCircle className="shrink-0 text-xl text-blue-500" />}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={t("syllabus.importTitle")}
        actions={
          step === 1 ? (
            <>
              <Button color="black" variant="text" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button disabled={!selected} onClick={() => setStep(2)}>
                {t("syllabus.importNext")}
              </Button>
            </>
          ) : (
            <>
              <Button color="black" variant="text" onClick={() => setStep(1)}>
                {t("common.back")}
              </Button>
              <Button disabled={!selected} loading={importing} onClick={start}>
                {t("syllabus.importAction")}
              </Button>
            </>
          )
        }
      >
        {/* Sobit balandlik — bosqich/tab almashganda dialog "sakramaydi",
            ro'yxatlar ichkarida suriladi. */}
        <div className="flex flex-col gap-3 w-full min-w-0 h-[min(480px,64vh)]">
          {/* Bosqich ko'rsatkichi */}
          <ol className="flex items-center gap-2 shrink-0">
            {[t("syllabus.stepSource"), t("syllabus.stepLesson")].map((label, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              return (
                <li key={n} className="flex items-center gap-2 min-w-0 flex-1 last:flex-none">
                  <span
                    className={`flex items-center justify-center w-6 h-6 shrink-0 rounded-full text-xs font-semibold ${
                      active || done ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {done ? <HiCheckCircle className="text-base" /> : n}
                  </span>
                  <span
                    className={`text-sm truncate ${
                      active ? "font-semibold text-slate-900" : "text-slate-400"
                    }`}
                  >
                    {label}
                  </span>
                  {n === 1 && <span className="flex-1 h-px min-w-3 bg-slate-200" />}
                </li>
              );
            })}
          </ol>

          {step === 1 ? (
            <>
              <div className="flex p-1 rounded-xl bg-slate-100 shrink-0">
                {tabs.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setTab(item.key);
                      setSearch("");
                    }}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                      tab === item.key
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="shrink-0">
                <Input
                  variant="white"
                  placeholder={
                    tab === TAB_PLANS ? t("syllabus.importSearchPlans") : t("syllabus.importSearch")
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={<HiMagnifyingGlass />}
                />
              </div>

              {renderList()}

              <p className="shrink-0 text-xs text-slate-400">{t("syllabus.importHint")}</p>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-0.5 shrink-0">
                <p className="text-sm font-semibold text-slate-800">
                  {t("syllabus.currentLessonQuestion")}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {selected?.kind === TAB_PLANS ? selected?.item?.title : selected?.item?.name}
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <CurrentLessonPicker
                  key={selected?.item?._id || "none"}
                  modules={selected?.item?.modules || []}
                  value={currentLessonNo}
                  onChange={setCurrentLessonNo}
                />
              </div>
            </>
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
