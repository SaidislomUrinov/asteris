import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiArrowUp,
  HiArrowDown,
  HiTrash,
  HiArrowUpTray,
  HiPlay,
  HiPhoto,
  HiFilm,
  HiLink,
} from "react-icons/hi2";
import { uploadNewsMedia } from "../../api/news";
import { errorMsg } from "../../utils/alert";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import FieldLabel from "./FieldLabel";
import {
  MAX_MEDIA,
  MEDIA_ACCEPT,
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  detectFileType,
  parseYoutubeId,
  youtubeThumb,
  resolveMediaUrl,
  localKey,
} from "./newsMeta";

const TYPE_ICONS = { image: HiPhoto, video: HiFilm, youtube: HiPlay };

function MediaThumb({ item }) {
  if (item.type === "youtube") {
    return (
      <div className="relative w-full h-full">
        <img src={youtubeThumb(item.youtubeId)} alt="" className="w-full h-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-red-600 text-white shadow">
            <HiPlay size={14} />
          </span>
        </span>
      </div>
    );
  }
  const src = item.previewUrl || resolveMediaUrl(item.url);
  if (item.type === "video") {
    return <video src={src} muted preload="metadata" className="w-full h-full object-cover bg-slate-900" />;
  }
  return <img src={src} alt="" className="w-full h-full object-cover" />;
}

function MediaRow({ item, index, total, onMove, onRemove }) {
  const { t } = useTranslation();
  const TypeIcon = TYPE_ICONS[item.type];
  const caption =
    item.type === "youtube" ? item.url : item.fileName || item.url?.split("/").pop() || "";

  return (
    <div className="flex items-center gap-3 p-2 rounded-xl border border-slate-200 bg-white">
      <div className="relative w-24 aspect-video shrink-0 rounded-lg overflow-hidden bg-slate-100">
        <MediaThumb item={item} />
        {item.uploading && (
          <div className="absolute inset-0 flex items-end bg-slate-900/40">
            <div className="w-full h-1.5 bg-white/30">
              <div className="h-full bg-emerald-400 duration-150" style={{ width: `${item.progress || 0}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
          {TypeIcon && <TypeIcon className="text-slate-400 shrink-0" />}
          {t(`news.media.type.${item.type}`)}
          {index === 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-white text-[10px] uppercase tracking-wide">
              {t("news.media.cover")}
            </span>
          )}
        </div>
        <span className="text-[12px] text-slate-400 truncate">
          {item.uploading ? t("news.media.uploading", { progress: item.progress || 0 }) : caption}
        </span>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          title={t("news.media.moveUp")}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
        >
          <HiArrowUp />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          title={t("news.media.moveDown")}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
        >
          <HiArrowDown />
        </button>
        <button
          type="button"
          onClick={() => onRemove(item._key)}
          title={t("news.media.remove")}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
        >
          <HiTrash />
        </button>
      </div>
    </div>
  );
}

export default function MediaField({ media, setMedia }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const blobUrls = useRef(new Set());

  // Yuklash uchun yaratilgan blob: URL'lar komponent yopilganda bo'shatiladi.
  useEffect(() => {
    const urls = blobUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const remaining = MAX_MEDIA - media.length;

  const patchItem = (key, patch) =>
    setMedia((prev) => prev.map((m) => (m._key === key ? { ...m, ...patch } : m)));

  const uploadOne = async (file, key) => {
    try {
      const res = await uploadNewsMedia(file, (progress) => patchItem(key, { progress }));
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      patchItem(key, { type: data.type, url: data.url, uploading: false, progress: 100 });
    } catch (error) {
      const msg = error.response?.data?.msg || error.message;
      errorMsg(msg || "news.media.uploadFailed");
      setMedia((prev) => prev.filter((m) => m._key !== key));
    }
  };

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (files.length > remaining) errorMsg("news.media.limit", { max: MAX_MEDIA });

    const accepted = [];
    for (const file of files.slice(0, Math.max(remaining, 0))) {
      const type = detectFileType(file);
      if (!type) {
        errorMsg("news.fileType");
        continue;
      }
      const limit = type === "video" ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
      if (file.size > limit) {
        errorMsg("news.fileTooLarge");
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      blobUrls.current.add(previewUrl);
      accepted.push({
        file,
        item: {
          _key: localKey(),
          type,
          url: "",
          previewUrl,
          fileName: file.name,
          uploading: true,
          progress: 0,
        },
      });
    }
    if (!accepted.length) return;
    setMedia((prev) => [...prev, ...accepted.map((a) => a.item)]);
    accepted.forEach(({ file, item }) => uploadOne(file, item._key));
  };

  const addYoutube = () => {
    if (remaining <= 0) {
      errorMsg("news.media.limit", { max: MAX_MEDIA });
      return;
    }
    const id = parseYoutubeId(youtubeUrl);
    if (!id) {
      errorMsg("news.invalidYoutube");
      return;
    }
    setMedia((prev) => [
      ...prev,
      { _key: localKey(), type: "youtube", url: youtubeUrl.trim(), youtubeId: id },
    ]);
    setYoutubeUrl("");
  };

  const move = (index, dir) =>
    setMedia((prev) => {
      const next = prev.slice();
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const remove = (key) => setMedia((prev) => prev.filter((m) => m._key !== key));

  const youtubeId = parseYoutubeId(youtubeUrl);

  return (
    <div className="flex flex-col gap-2 w-full">
      <FieldLabel hint={t("news.fields.mediaHint")} counter={`${media.length} / ${MAX_MEDIA}`}>
        {t("news.fields.media")}
      </FieldLabel>

      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <div className="shrink-0">
          <Button
            type="button"
            color="slate"
            variant="ghost"
            disabled={remaining <= 0}
            onClick={() => inputRef.current?.click()}
          >
            <HiArrowUpTray className="text-base" />
            {t("news.media.upload")}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={MEDIA_ACCEPT}
          multiple
          className="sr-only"
          onChange={handleFiles}
        />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <Input
              icon={<HiLink />}
              placeholder={t("news.media.youtubePlaceholder")}
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addYoutube();
                }
              }}
            />
          </div>
          <div className="shrink-0">
            <Button
              type="button"
              color="red"
              variant="ghost"
              disabled={!youtubeUrl.trim() || remaining <= 0}
              onClick={addYoutube}
            >
              <HiPlay className="text-base" />
              {t("news.media.addYoutube")}
            </Button>
          </div>
        </div>
      </div>

      {youtubeUrl.trim() && (
        <div className="flex items-center gap-3 px-1">
          {youtubeId ? (
            <>
              <img
                src={youtubeThumb(youtubeId)}
                alt=""
                className="w-24 aspect-video object-cover rounded-lg border border-slate-200"
              />
              <span className="text-[12px] text-slate-500 font-jet">{youtubeId}</span>
            </>
          ) : (
            <span className="text-[12px] text-red-500">{t("news.invalidYoutube")}</span>
          )}
        </div>
      )}

      <p className="px-1 text-[12px] text-slate-400">{t("news.media.limits")}</p>

      {media.length === 0 ? (
        <div className="flex items-center justify-center h-20 rounded-xl border border-dashed border-slate-300 text-[13px] text-slate-400">
          {t("news.media.empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {media.map((item, index) => (
            <MediaRow
              key={item._key}
              item={item}
              index={index}
              total={media.length}
              onMove={move}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
