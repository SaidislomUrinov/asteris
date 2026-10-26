import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowPath, HiCamera } from "react-icons/hi2";
import { haptic } from "../../lib/telegram";
import { photoSrc } from "../../lib/studentPhoto";
import { Avatar } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { initials } from "../../utils/format";
import { cn } from "../../utils/cn";
import { PhotoSourceSheet } from "../components/PhotoSourceSheet";
import { useSocketEvents } from "../useSocket";
import { useStudentPhoto } from "./useStudentPhoto";

const EVENTS = ["student:updated"];

// Tahrirlanadigan o'quvchi avatari — rasmning o'zi kirish nuqtasi
// (docs/API_CONTRACT_student_photo.md §5). Burchakdagi kamera belgisi
// bosish mumkinligini bildiradi. Rasm yo'q — darhol fayl tanlash (mobilda
// kamera/galereya); rasm bor — pastki oyna: almashtirish / olib tashlash.
// `className` — o'lcham va shakl (masalan "w-14 h-14 rounded-2xl text-lg"),
// rasm paydo bo'lganda layout siljimaydi.
export const StudentPhotoAvatar = ({ student, className, rounded = "rounded-2xl" }) => {
  const { t } = useTranslation();
  const id = student?._id;

  // Javob / socket'dan kelgan yangi rasm darhol ko'rinadi; sahifa ma'lumoti
  // qayta yuklanib `student.photo` o'zgarsa — o'shanga qaytamiz.
  const [override, setOverride] = useState(undefined);
  const [prevPhoto, setPrevPhoto] = useState(student?.photo);
  if (student?.photo !== prevPhoto) {
    setPrevPhoto(student?.photo);
    setOverride(undefined);
  }
  const photo = override !== undefined ? override : student?.photo || "";
  const src = photoSrc(photo);

  useSocketEvents(EVENTS, (_ev, p) => {
    if (id && p?.studentId === id && p.photo !== undefined) setOverride(p.photo || "");
  });

  const { busy, upload, remove } = useStudentPhoto(id, setOverride);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onTap = () => {
    if (busy || !id) return;
    haptic("light");
    setMenuOpen(true);
  };

  const onRemove = async () => {
    const ok = await remove();
    if (ok) setConfirmOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={onTap}
        disabled={busy}
        aria-busy={busy || undefined}
        aria-label={t("worker.student.photoEdit")}
        className={cn("relative shrink-0 active:scale-95 transition-transform", rounded, className)}
      >
        <Avatar
          text={initials(student?.fullName)}
          src={src}
          alt={student?.fullName || ""}
          className={cn("w-full h-full", rounded, className)}
        />
        {busy && (
          <span className={cn("absolute inset-0 grid place-items-center bg-black/45 text-white", rounded)}>
            <HiArrowPath className="w-5 h-5 animate-spin" />
          </span>
        )}
        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full grid place-items-center bg-accent text-accent-fg ring-2 ring-card">
          <HiCamera className="w-3.5 h-3.5" />
        </span>
      </button>

      <PhotoSourceSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onFile={upload}
        title={student?.fullName}
        onRemove={src ? () => setConfirmOpen(true) : undefined}
      />

      <ConfirmDialog
        open={confirmOpen}
        danger
        loading={busy}
        title={t("worker.student.photoRemoveTitle")}
        text={t("worker.student.photoRemoveText", { name: student?.fullName || "" })}
        confirmText={t("worker.student.photoRemove")}
        cancelText={t("common.cancel")}
        onConfirm={onRemove}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
};
