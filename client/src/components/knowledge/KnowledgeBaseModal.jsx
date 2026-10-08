import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineBookOpen } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import KnowledgeArticle from "./KnowledgeArticle";
import { loadKnowledge } from "../../knowledge";

function ArticleSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse" aria-hidden="true">
      <div className="h-4 w-11/12 rounded bg-slate-100 dark:bg-night-800" />
      <div className="h-4 w-4/5 rounded bg-slate-100 dark:bg-night-800" />
      <div className="h-5 w-1/3 rounded bg-slate-100 dark:bg-night-800 mt-3" />
      <div className="h-4 w-full rounded bg-slate-100 dark:bg-night-800" />
      <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-night-800" />
      <div className="h-16 w-full rounded-2xl bg-slate-100 dark:bg-night-800 mt-2" />
    </div>
  );
}

export default function KnowledgeBaseModal({ open, onClose, articleKey, titleKey }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [state, setState] = useState({ status: "idle", data: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const data = await loadKnowledge(lang);
      setState({ status: "ready", data });
    } catch {
      setState({ status: "error", data: null });
    }
  }, [lang]);

  // Kontent faqat modal birinchi ochilganda (yoki til almashganda) yuklanadi.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [open, load]);

  const article = state.data?.[articleKey];
  const sectionTitle = titleKey ? t(titleKey) : t("kb.title");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={t("kb.title")}
      title={sectionTitle}
      description={article?.summary}
      className="md:w-170"
    >
      {state.status === "error" ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("kb.error")}</p>
          <Button variant="outlined" color="slate" onClick={load}>
            {t("kb.retry")}
          </Button>
        </div>
      ) : state.status !== "ready" ? (
        <ArticleSkeleton />
      ) : article ? (
        <KnowledgeArticle article={article} />
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <HiOutlineBookOpen className="text-3xl text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("kb.empty")}</p>
        </div>
      )}
    </Dialog>
  );
}
