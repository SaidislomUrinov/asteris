import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { HiArrowLeft, HiPaperAirplane, HiDocumentCheck, HiExclamationTriangle } from "react-icons/hi2";
import { createNews, fetchNewsItem, publishNews, updateNews } from "../../api/news";
import { errorMsg, successMsg } from "../../utils/alert";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Loading from "../../ui/Loading";
import FieldLabel from "./FieldLabel";
import SegmentControl from "./SegmentControl";
import NewsRichEditor from "./NewsRichEditor";
import MediaField from "./MediaField";
import ResourcesField from "./ResourcesField";
import NewsPreview from "./NewsPreview";
import PublishDialog from "./PublishDialog";
import {
  AUDIENCES,
  DESCRIPTION_MAX,
  LEVELS,
  LEVEL_TONES,
  RESOURCE_LABEL_MAX,
  STATUS_TONES,
  TITLE_MAX,
  htmlToText,
  isValidExternalUrl,
  isValidInternalUrl,
  localKey,
  parseYoutubeId,
} from "./newsMeta";

const EMPTY_FORM = {
  title: "",
  description: "",
  media: [],
  resources: [],
  level: "important",
  audience: "all",
  status: "draft",
  publishedAt: null,
};

const toForm = (news) => ({
  ...EMPTY_FORM,
  title: news.title || "",
  description: news.description || "",
  level: news.level || "important",
  audience: news.audience || "all",
  status: news.status || "draft",
  publishedAt: news.publishedAt || null,
  media: (news.media || []).map((m) => ({
    _key: localKey(),
    type: m.type,
    url: m.url,
    youtubeId: m.type === "youtube" ? m.youtubeId || parseYoutubeId(m.url) : undefined,
  })),
  resources: (news.resources || []).map((r) => ({
    _key: localKey(),
    label: r.label || "",
    kind: r.kind || "internal",
    url: r.url || "",
  })),
});

const toPayload = (form) => ({
  title: form.title.trim(),
  description: form.description,
  media: form.media.map((m) => ({ type: m.type, url: m.url })),
  resources: form.resources.map((r) => ({
    label: r.label.trim(),
    kind: r.kind,
    url: r.url.trim(),
  })),
  level: form.level,
  audience: form.audience,
});

const validate = (form) => {
  const errors = { resources: {} };
  const title = form.title.trim();
  if (!title) errors.title = "news.validation.titleRequired";
  else if (title.length > TITLE_MAX) errors.title = "news.validation.titleTooLong";
  if (form.description.length > DESCRIPTION_MAX) errors.description = "news.validation.descriptionTooLong";

  for (const r of form.resources) {
    const e = {};
    const label = r.label.trim();
    const url = r.url.trim();
    if (!label) e.label = "news.validation.labelRequired";
    else if (label.length > RESOURCE_LABEL_MAX) e.label = "news.validation.labelTooLong";
    if (!url) e.url = r.kind === "internal" ? "news.validation.pageRequired" : "news.validation.urlRequired";
    else if (r.kind === "internal" && !isValidInternalUrl(url)) e.url = "news.invalidResource";
    else if (r.kind === "external" && !isValidExternalUrl(url)) e.url = "news.validation.urlInvalid";
    if (e.label || e.url) errors.resources[r._key] = e;
  }

  const hasErrors =
    !!errors.title || !!errors.description || Object.keys(errors.resources).length > 0;
  return { errors, hasErrors };
};

export default function NewsEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(null); // "draft" | "publish" | null
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setLoadError(false);
      const res = await fetchNewsItem(id);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setForm(toForm(data?.news || data));
    } catch (error) {
      setLoadError(true);
      errorMsg(error.response?.data?.msg || error.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setMedia = useCallback(
    (updater) =>
      setForm((prev) => ({
        ...prev,
        media: typeof updater === "function" ? updater(prev.media) : updater,
      })),
    [],
  );
  const setResources = useCallback(
    (updater) =>
      setForm((prev) => ({
        ...prev,
        resources: typeof updater === "function" ? updater(prev.resources) : updater,
      })),
    [],
  );
  const setDescription = useCallback(
    (html) => setForm((prev) => ({ ...prev, description: html })),
    [],
  );

  const { errors, hasErrors } = validate(form);
  const shownErrors = submitted ? errors : { resources: {} };
  const uploading = form.media.some((m) => m.uploading);
  const isPublished = form.status === "published";
  const descriptionLength = htmlToText(form.description).length;

  const precheck = () => {
    setSubmitted(true);
    if (uploading) {
      errorMsg("news.media.stillUploading");
      return false;
    }
    if (hasErrors) {
      errorMsg("news.validation.fixErrors");
      return false;
    }
    return true;
  };

  const save = async (publish) => {
    try {
      setSaving(publish ? "publish" : "draft");
      const body = toPayload(form);
      if (!isEdit) {
        const res = await createNews({ ...body, publish });
        const { ok, msg } = res.data;
        if (!ok) throw new Error(msg);
        successMsg(publish ? "news.toast.published" : "news.toast.draftSaved");
      } else {
        const res = await updateNews(id, body);
        const { ok, msg } = res.data;
        if (!ok) throw new Error(msg);
        if (publish && !isPublished) {
          const pub = await publishNews(id);
          if (!pub.data?.ok) throw new Error(pub.data?.msg);
          successMsg("news.toast.published");
        } else {
          successMsg("news.toast.saved");
        }
      }
      navigate("/news");
    } catch (error) {
      errorMsg(error.response?.data?.msg || error.message);
    } finally {
      setSaving(null);
      setConfirmOpen(false);
    }
  };

  const handleDraft = () => {
    if (precheck()) save(false);
  };
  const handlePublish = () => {
    if (precheck()) setConfirmOpen(true);
  };

  if (loading) return <Loading height="60vh" />;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 w-full h-[60vh] text-center">
        <HiExclamationTriangle className="text-[36px] text-red-400" />
        <p className="text-slate-600 text-sm">{t("news.loadOneError")}</p>
        <div className="flex items-center gap-2">
          <Button color="slate" variant="text" onClick={() => navigate("/news")}>
            {t("news.back")}
          </Button>
          <Button color="slate" onClick={load}>{t("common.retry")}</Button>
        </div>
      </div>
    );
  }

  const levelOptions = LEVELS.map((l) => ({
    value: l,
    label: t(`news.level.${l}`),
    dot: LEVEL_TONES[l].dot,
  }));
  const audienceOptions = AUDIENCES.map((a) => ({ value: a, label: t(`news.audience.${a}`) }));

  return (
    <div className="flex flex-col w-full gap-4">
      {/* Sarlavha + amallar */}
      <div className="flex flex-wrap items-center gap-3 w-full">
        <Link
          to="/news"
          title={t("news.back")}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
        >
          <HiArrowLeft />
        </Link>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[18px] font-semibold text-slate-800 truncate">
              {isEdit ? t("news.editTitle") : t("news.newTitle")}
            </p>
            {isEdit && (
              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold uppercase shrink-0 ${STATUS_TONES[form.status]}`}>
                {t(`news.status.${form.status}`)}
              </span>
            )}
          </div>
          <p className="text-[12px] text-slate-400">{t("news.editorSubtitle")}</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {!isPublished && (
            <Button
              color="slate"
              variant="ghost"
              loading={saving === "draft"}
              disabled={!!saving || uploading}
              onClick={handleDraft}
            >
              <HiDocumentCheck className="text-base" />
              {t("news.saveDraft")}
            </Button>
          )}
          {isPublished ? (
            <Button
              color="emerald"
              loading={saving === "draft"}
              disabled={!!saving || uploading}
              onClick={handleDraft}
            >
              <HiDocumentCheck className="text-base" />
              {t("news.saveChanges")}
            </Button>
          ) : (
            <Button
              color="emerald"
              loading={saving === "publish"}
              disabled={!!saving || uploading}
              onClick={handlePublish}
            >
              <HiPaperAirplane className="text-base" />
              {t("news.publish")}
            </Button>
          )}
        </div>
      </div>

      {isPublished && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-800">
          <HiExclamationTriangle className="text-base shrink-0 mt-0.5" />
          {t("news.publishedEditHint")}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-4 items-start w-full">
        {/* Forma */}
        <div className="flex flex-col gap-5 p-4 sm:p-5 bg-white border border-slate-200 rounded-xl min-w-0">
          <div className="flex flex-col gap-1">
            <FieldLabel required counter={`${form.title.trim().length} / ${TITLE_MAX}`}>
              {t("news.fields.title")}
            </FieldLabel>
            <Input
              placeholder={t("news.fields.titlePlaceholder")}
              value={form.title}
              maxLength={TITLE_MAX}
              onChange={(e) => setField("title", e.target.value)}
            />
            {shownErrors.title && (
              <span className="px-2 text-[12px] text-red-500">{t(shownErrors.title)}</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel hint={t("news.fields.descriptionHint")} counter={`${descriptionLength}`}>
              {t("news.fields.description")}
            </FieldLabel>
            <NewsRichEditor
              value={form.description}
              onChange={setDescription}
              placeholder={t("news.fields.descriptionPlaceholder")}
            />
            {shownErrors.description && (
              <span className="px-2 text-[12px] text-red-500">{t(shownErrors.description)}</span>
            )}
          </div>

          <MediaField media={form.media} setMedia={setMedia} />

          <ResourcesField
            resources={form.resources}
            setResources={setResources}
            errors={shownErrors.resources}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <FieldLabel hint={t("news.fields.levelHint")}>{t("news.fields.level")}</FieldLabel>
              <SegmentControl
                value={form.level}
                options={levelOptions}
                onChange={(v) => setField("level", v)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <FieldLabel hint={t("news.fields.audienceHint")}>{t("news.fields.audience")}</FieldLabel>
              <SegmentControl
                value={form.audience}
                options={audienceOptions}
                onChange={(v) => setField("audience", v)}
              />
            </div>
          </div>
        </div>

        {/* Jonli ko'rinish */}
        <div className="flex flex-col gap-2 lg:sticky lg:top-0 min-w-0">
          <FieldLabel hint={t("news.preview.hint")}>{t("news.preview.title")}</FieldLabel>
          <div className="p-4 sm:p-6 rounded-xl bg-slate-200/60 border border-slate-200">
            <NewsPreview form={form} />
          </div>
        </div>
      </div>

      <PublishDialog
        open={confirmOpen}
        title={form.title}
        audience={form.audience}
        loading={saving === "publish"}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => save(true)}
      />
    </div>
  );
}
