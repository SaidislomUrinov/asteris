import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiOutlineBold,
  HiOutlineListBullet,
  HiOutlineNumberedList,
  HiOutlineLink,
} from "react-icons/hi2";
// Formatlangan (b/i, ul/ol, blockquote, a) xabar yozish uchun minimal
// contentEditable muharrir — loyihada rich-text kutubxonasi yo'q, shuning
// uchun `document.execCommand` orqali (eski, lekin bu ko'lamdagi ichki
// admin vositasi uchun yetarli va qo'shimcha bog'liqlik talab qilmaydi).
// Yuborishda: agar tarkibda formatlash tegi bo'lmasa oddiy matn sifatida
// (`onSend(text)`), aks holda HTML sifatida (`onSendHtml(html)`) yuboriladi
// — server baribir sanitizatsiya qiladi (chat.service.js, richText.util.js).
const RichComposer = forwardRef(function RichComposer(
  { onSend, onSendHtml, disabled = false, placeholder },
  ref,
) {
  const { t } = useTranslation();
  const editorRef = useRef(null);
  const [, setEmpty] = useState(true);

  const updateEmpty = useCallback(() => {
    const el = editorRef.current;
    setEmpty(!el || !el.innerText.replace(/\u200b/g, "").trim());
  }, []);

  const exec = (command, value) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateEmpty();
  };

  const handleLink = () => {
    const url = window.prompt(t("chat.linkPrompt"));
    if (!url) return;
    exec("createLink", url);
  };

  const clear = () => {
    if (editorRef.current) editorRef.current.innerHTML = "";
    setEmpty(true);
  };

  const send = () => {
    const el = editorRef.current;
    if (!el || disabled) return;
    const hasFormatting = !!el.querySelector("b,strong,i,em,ul,ol,blockquote,a");
    if (hasFormatting) {
      const html = el.innerHTML.trim();
      if (!el.innerText.trim()) return;
      onSendHtml(html);
    } else {
      const text = el.innerText.trim();
      if (!text) return;
      onSend(text);
    }
    clear();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  useImperativeHandle(ref, () => ({ submit: send }));

  const handlePaste = (e) => {
    // Boshqa saytdan formatlangan HTML yopishtirilganda tozalab, oddiy
    // matn sifatida qo'yiladi — chegarasiz uslub/skript yopishib qolmasin.
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    updateEmpty();
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-slate-200 bg-slate-50 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/15 focus-within:bg-white duration-150 overflow-hidden">
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={updateEmpty}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        className="px-3.5 py-2.5 max-h-24 min-h-10.5 overflow-y-auto text-[13px] text-slate-900 outline-none leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_blockquote]:text-slate-500 [&_a]:text-blue-600 [&_a]:underline empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
      />
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-t border-slate-200/70">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("bold")}
          title={t("chat.bold")}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 cursor-pointer"
        >
          <HiOutlineBold size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertUnorderedList")}
          title={t("chat.bulletList")}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 cursor-pointer"
        >
          <HiOutlineListBullet size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertOrderedList")}
          title={t("chat.numberedList")}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 cursor-pointer"
        >
          <HiOutlineNumberedList size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("formatBlock", "blockquote")}
          title={t("chat.quote")}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 cursor-pointer font-serif text-base leading-none"
        >
          &ldquo;
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleLink}
          title={t("chat.link")}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 cursor-pointer"
        >
          <HiOutlineLink size={14} />
        </button>
      </div>
    </div>
  );
});

export default RichComposer;
