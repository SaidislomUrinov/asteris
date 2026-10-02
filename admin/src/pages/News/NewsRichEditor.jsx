import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiOutlineBold,
  HiOutlineItalic,
  HiOutlineUnderline,
  HiOutlineH3,
  HiOutlineListBullet,
  HiOutlineNumberedList,
  HiOutlineLink,
} from "react-icons/hi2";
import { NEWS_HTML_CLASS } from "./newsMeta";

// `pages/Chat/RichComposer.jsx` asosida — lekin "yuborish" xatti-harakatisiz:
// Enter oddiy yangi qator, tarkib har o'zgarishda `onChange(html)` bilan
// tashqariga beriladi. Server `sanitizeNewsHtml` bilan tozalaydi
// (b/strong, i/em, u, ul/ol/li, a, h3, br, p/div).
const TOOLS = [
  { key: "bold", icon: HiOutlineBold, command: "bold", state: "bold" },
  { key: "italic", icon: HiOutlineItalic, command: "italic", state: "italic" },
  { key: "underline", icon: HiOutlineUnderline, command: "underline", state: "underline" },
  { key: "heading", icon: HiOutlineH3, block: "h3" },
  { key: "bulletList", icon: HiOutlineListBullet, command: "insertUnorderedList", state: "insertUnorderedList" },
  { key: "numberedList", icon: HiOutlineNumberedList, command: "insertOrderedList", state: "insertOrderedList" },
];

const isEmptyHtml = (el) =>
  !el.innerText.replace(/\u200b/g, "").trim() && !el.querySelector("li");

export default function NewsRichEditor({ value = "", onChange = () => {}, placeholder = "" }) {
  const { t } = useTranslation();
  const editorRef = useRef(null);
  const lastEmitted = useRef(null);
  const [active, setActive] = useState({});

  // Tashqi qiymat (masalan tahrirlash uchun yuklangan yangilik) faqat
  // o'zimiz chiqargan qiymatdan farq qilsa DOM'ga yoziladi — aks holda
  // kursor har harfda boshiga sakrab ketardi.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || value === lastEmitted.current) return;
    el.innerHTML = value || "";
    lastEmitted.current = value;
  }, [value]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = isEmptyHtml(el) ? "" : el.innerHTML.trim();
    if (!html && el.innerHTML) el.innerHTML = "";
    lastEmitted.current = html;
    onChange(html);
  }, [onChange]);

  const refreshActive = useCallback(() => {
    const el = editorRef.current;
    const sel = document.getSelection();
    if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return;
    const next = {};
    for (const tool of TOOLS) {
      if (tool.state) next[tool.key] = document.queryCommandState(tool.state);
      if (tool.block)
        next[tool.key] = String(document.queryCommandValue("formatBlock")).toLowerCase() === tool.block;
    }
    setActive(next);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshActive);
    return () => document.removeEventListener("selectionchange", refreshActive);
  }, [refreshActive]);

  const exec = (command, arg) => {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emit();
    refreshActive();
  };

  const runTool = (tool) => {
    if (tool.block) {
      exec("formatBlock", active[tool.key] ? "p" : tool.block);
      return;
    }
    exec(tool.command);
  };

  const handleLink = () => {
    const url = window.prompt(t("news.editor.linkPrompt"), "https://");
    if (!url || url === "https://") return;
    if (!/^https?:\/\//i.test(url.trim())) return;
    exec("createLink", url.trim());
  };

  const handlePaste = (e) => {
    // Tashqi HTML uslublari yopishib qolmasin — faqat oddiy matn.
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emit();
  };

  const toolClass = (on) =>
    `flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer duration-150 ${
      on ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-200/70 hover:text-slate-800"
    }`;

  return (
    <div className="flex flex-col w-full rounded-xl border border-slate-200 bg-slate-100 focus-within:bg-white focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-500 duration-300 overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b border-slate-200 bg-white/60">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runTool(tool)}
            title={t(`news.editor.${tool.key}`)}
            aria-label={t(`news.editor.${tool.key}`)}
            className={toolClass(active[tool.key])}
          >
            <tool.icon size={16} />
          </button>
        ))}
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleLink}
          title={t("news.editor.link")}
          aria-label={t("news.editor.link")}
          className={toolClass(false)}
        >
          <HiOutlineLink size={16} />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onPaste={handlePaste}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        data-placeholder={placeholder}
        className={`${NEWS_HTML_CLASS} px-3.5 py-3 min-h-40 max-h-96 overflow-y-auto text-[14px] text-slate-900 outline-none leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400`}
      />
    </div>
  );
}
