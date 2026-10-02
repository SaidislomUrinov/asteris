import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown } from "react-icons/hi";
import uzFlag from "../assets/uz.png";
import ruFlag from "../assets/ru.png";
import enFlag from "../assets/en.png";

const langs = [
  { value: "uz", label: "O'zbekcha", flag: uzFlag },
  { value: "ru", label: "Русский", flag: ruFlag },
  { value: "en", label: "English", flag: enFlag },
];

function UpdateLang() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = langs.find((l) => l.value === i18n.language) || langs[0];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (val) => {
    i18n.changeLanguage(val);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center cursor-pointer gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-150"
      >
        <img
          src={current.flag}
          alt={current.value}
          className="w-4 h-4 rounded-full object-cover shrink-0"
        />
        <span className="hidden lg:inline">{current.label}</span>
        <HiChevronDown
          size={12}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden shadow-lg z-50 min-w-32">
          {langs.map((lang) => (
            <button
              key={lang.value}
              onClick={() => select(lang.value)}
              className={`flex items-center cursor-pointer gap-2 w-full px-3 py-2 text-[12px] font-semibold text-left transition-colors duration-150 ${
                lang.value === current.value
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <img
                src={lang.flag}
                alt={lang.value}
                className="w-4 h-4 rounded-full object-cover shrink-0"
              />
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default UpdateLang;
