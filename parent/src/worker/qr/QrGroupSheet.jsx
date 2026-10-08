import { useTranslation } from "react-i18next";
import { HiChevronRight } from "react-icons/hi2";
import { BottomSheet } from "../components/BottomSheet";

// QR skan `needsGroup` qaytarsa — o'quvchi bugun bir nechta guruhda darsga
// ega: qaysi biriga yozilishi so'raladi (fan · #raqam · vaqt).
export const QrGroupSheet = ({ choice, onChoose, onClose }) => {
  const { t } = useTranslation();
  return (
    <BottomSheet
      open={!!choice}
      onClose={onClose}
      title={choice?.student?.fullName || t("worker.qr.pickTitle")}
      subtitle={t("worker.qr.pickHint")}
    >
      <div className="flex flex-col gap-2">
        {(choice?.groups || []).map((g) => (
          <button
            key={g._id}
            type="button"
            onClick={() => onChoose(g._id)}
            className="w-full flex items-center gap-3 px-3.5 py-3 min-h-14 rounded-2xl bg-card border border-line/70 text-left active:opacity-70"
          >
            <span className="min-w-0 flex-1 block font-bold text-[15px] leading-tight truncate">
              {[g.subject, g.activeId != null && g.activeId !== "" ? `#${g.activeId}` : null].filter(Boolean).join(" · ") || "—"}
            </span>
            {g.startTime && (
              <span className="shrink-0 tabular text-[12.5px] font-bold text-hint">
                {g.startTime}–{g.endTime}
              </span>
            )}
            <HiChevronRight className="w-4 h-4 text-hint/70 shrink-0" />
          </button>
        ))}
      </div>
    </BottomSheet>
  );
};
