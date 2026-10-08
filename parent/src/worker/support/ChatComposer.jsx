import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiOutlinePhoto, HiPaperAirplane } from "react-icons/hi2";
import { haptic } from "../../lib/telegram";
import { cn } from "../../utils/cn";
import { errText } from "../utils";
import { CHAT_IMAGE_MAX, CHAT_IMAGE_TYPES } from "../constants";

const MAX_HEIGHT = 120; // ~5 qator, keyin ichida skroll
const ICON_BTN = "w-11 h-11 rounded-full grid place-items-center shrink-0 active:opacity-70 disabled:opacity-40";

// Kompyuterda Enter — yuborish (Shift+Enter yangi qator); telefonda Enter
// yangi qator, yuborish tugma bilan.
const enterSends = () => {
  try {
    return window.matchMedia("(pointer: fine)").matches;
  } catch {
    return false;
  }
};

// Pastdagi yozish maydoni: rasm biriktirish, avtomatik o'suvchi matn maydoni,
// yuborish. Tugmalar bosilganda fokus maydondan ketmaydi — klaviatura yopilmaydi.
export const ChatComposer = ({ sending, onSendText, onSendImage, keyboard }) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const areaRef = useRef(null);
  const fileRef = useRef(null);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);

  const submit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setText("");
    haptic("light");
    try {
      await onSendText(value);
    } catch (e) {
      setText(value);
      haptic("error");
      toast.error(errText(e), { id: "chat-send" });
    }
  };

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!CHAT_IMAGE_TYPES.split(",").includes(file.type)) {
      toast.error(t("common.fileTypeNotAllowed"), { id: "chat-send" });
      return;
    }
    if (file.size > CHAT_IMAGE_MAX) {
      toast.error(t("common.fileTooLarge"), { id: "chat-send" });
      return;
    }
    haptic("light");
    try {
      await onSendImage(file);
    } catch (err) {
      haptic("error");
      toast.error(errText(err), { id: "chat-send" });
    }
  };

  const keepFocus = (e) => e.preventDefault();
  const canSend = !!text.trim() && !sending;

  return (
    <div
      className="shrink-0 border-t border-line/70 bg-card px-2.5 pt-2 flex items-end gap-1.5"
      style={{ paddingBottom: keyboard ? "8px" : "calc(8px + env(safe-area-inset-bottom))" }}
    >
      <input ref={fileRef} type="file" accept={CHAT_IMAGE_TYPES} className="hidden" onChange={pickFile} />
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={() => fileRef.current?.click()}
        disabled={sending}
        aria-label={t("worker.support.attach")}
        className={cn(ICON_BTN, "text-hint")}
      >
        <HiOutlinePhoto className="w-6 h-6" />
      </button>
      <textarea
        ref={areaRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && enterSends()) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t("worker.support.placeholder")}
        aria-label={t("worker.support.placeholder")}
        className="flex-1 min-w-0 resize-none rounded-[22px] bg-bg border border-line/70 px-4 py-[11px] text-[15px] leading-[20px] text-ink placeholder:text-hint outline-none focus:border-accent/60"
        style={{ maxHeight: MAX_HEIGHT }}
      />
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={submit}
        disabled={!canSend}
        aria-label={t("worker.support.send")}
        className={cn(ICON_BTN, "bg-accent text-accent-fg")}
      >
        {sending ? (
          <span className="w-5 h-5 rounded-full border-2 border-accent-fg/40 border-t-accent-fg animate-spin" />
        ) : (
          <HiPaperAirplane className="w-5 h-5" />
        )}
      </button>
    </div>
  );
};
