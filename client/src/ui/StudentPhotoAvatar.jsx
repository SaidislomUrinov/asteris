import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowPath, HiCamera } from "react-icons/hi2";
import DropMenu from "./DropMenu";
import useStudentPhoto from "../hooks/useStudentPhoto";
import useHoverPreview from "../hooks/useHoverPreview";
import { getAvatarColor, getInitials } from "../utils/avatar";
import { photoSrc } from "../utils/studentPhoto";

/**
 * Tahrirlanadigan o'quvchi avatari — rasmning o'zi kirish nuqtasi
 * (docs/API_CONTRACT_student_photo.md §5). Burchakdagi kamera belgisi
 * bosish mumkinligini bildiradi. Rasm yo'q — bosish fayl tanlashni ochadi;
 * rasm bor — kichik menyu: almashtirish / olib tashlash.
 *
 * O'lcham va shakl (rounded-xl) InfoCard ikonka qutisi bilan bir xil —
 * rasm paydo bo'lganda layout siljimaydi.
 *
 * @param {{_id: string, fullName?: string, photo?: string}} props.student
 * @param {(studentId: string, photo: string) => void} props.onUpdated
 * @param {number} [props.size=44]
 * @param {string} [props.rounded="rounded-xl"] - shakl (ro'yxatlarda "rounded-full")
 * @param {boolean} [props.preview=true] - desktop hover'da rasmni 150×150 ko'rsatish
 */
function StudentPhotoAvatar({ student, onUpdated, size = 44, rounded = "rounded-xl", preview = true }) {
  const { t } = useTranslation();
  const { pick, busyId, menuItems, element } = useStudentPhoto(onUpdated);
  const busy = busyId === student?._id;
  const src = photoSrc(student?.photo);
  // Rasm menyusi ochiq bo'lsa hover preview ko'rinmaydi (bosishga xalaqit bermasin).
  const [menuOpen, setMenuOpen] = useState(false);
  const { handlers, close, element: previewEl } = useHoverPreview(src, {
    enabled: preview && !busy && !menuOpen,
    alt: student?.fullName || "avatar",
  });

  const face = (
    <span
      role="button"
      tabIndex={0}
      aria-label={t("student.photoEdit")}
      title={t("student.photoEdit")}
      aria-busy={busy || undefined}
      style={{ width: size, height: size }}
      className={`relative block shrink-0 ${rounded} select-none ${
        busy ? "pointer-events-none" : "cursor-pointer active:scale-95 duration-200"
      }`}
      onClick={src ? undefined : () => pick(student)}
      {...handlers}
      onMouseDown={close}
      onKeyDown={(e) => {
        // Klaviatura — sichqoncha bosishi bilan bir xil yo'l (menyu yoki tanlash).
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.currentTarget.click();
        }
      }}
    >
      {src ? (
        <img
          src={src}
          alt={student?.fullName || "avatar"}
          className={`w-full h-full ${rounded} object-cover bg-slate-100 dark:bg-night-800`}
        />
      ) : (
        <span
          style={{ backgroundColor: getAvatarColor(student?._id || student?.fullName), fontSize: size * 0.38 }}
          className={`w-full h-full ${rounded} flex items-center justify-center text-white font-semibold`}
        >
          {getInitials(student?.fullName)}
        </span>
      )}

      {busy && (
        <span className={`absolute inset-0 flex items-center justify-center ${rounded} bg-slate-900/45 text-white`}>
          <HiArrowPath className="animate-spin text-lg" />
        </span>
      )}

      {/* Ro'yxatdagi kichik avatarda (≤40px) belgi ham kichik — bosh harfni yopmasin. */}
      <span
        className={`absolute flex items-center justify-center rounded-full bg-white dark:bg-night-900 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-night-700 shadow-sm dark:shadow-none ${
          size <= 40 ? "-bottom-0.5 -right-0.5 size-3.5" : "-bottom-1 -right-1 size-5"
        }`}
      >
        <HiCamera className={size <= 40 ? "text-[8px]" : "text-[11px]"} />
      </span>
    </span>
  );

  return (
    <>
      {src ? <DropMenu items={menuItems(student)} trigger={face} align="start" onOpenChange={setMenuOpen} /> : face}
      {element}
      {previewEl}
    </>
  );
}

export default StudentPhotoAvatar;
