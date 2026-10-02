import { useEffect } from "react";
import { Button } from "./Button";

// Tasdiq modali — pastdan yuqoriga + fade (loyiha motion qoidasi).
export const ConfirmDialog = ({ open, title, text, confirmText, cancelText, danger, loading, onConfirm, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && !loading && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/45 animate-overlay-in" onClick={() => !loading && onClose()} />
      <div
        className="relative w-full max-w-md bg-card text-ink rounded-t-3xl sm:rounded-3xl p-5 animate-dialog-in"
        style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
      >
        <div className="text-lg font-extrabold">{title}</div>
        {text && <div className="text-sm text-hint mt-1.5">{text}</div>}
        <div className="flex gap-2.5 mt-5">
          <Button variant="soft" onClick={onClose} disabled={loading}>{cancelText}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmText}</Button>
        </div>
      </div>
    </div>
  );
};
