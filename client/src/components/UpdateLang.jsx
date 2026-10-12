import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown } from "react-icons/hi";
import uzFlag from "../assets/uz.png";
import enFlag from "../assets/en.png";
import ruFlag from "../assets/ru.png";
// TODO: uzc uchun haqiqiy bayroq fayli kelganda shu importni almashtiring
import uzcFlag from "../assets/uz.png";

const langs = [
  { value: "uz", label: "O'zbekcha", flag: uzFlag },
  { value: "uzc", label: "Ўзбекча", flag: uzcFlag },
  { value: "ru", label: "Русский", flag: ruFlag },
  { value: "en", label: "English", flag: enFlag },
];

// `dark` — qorong'i fon (Top.jsx / Navbar brend ko'ki) ustida ishlatilganda
// tugma kontrastini moslash uchun; Auth sahifasida (och fon) default holat qoladi.
function UpdateLang({ dark = false }) {
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
        className={`flex items-center cursor-pointer gap-1.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors duration-150 ${
          dark
            ? "px-2 sm:px-3 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            : "px-3 bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-night-700 hover:text-slate-800 dark:hover:text-slate-100"
        }`}
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
        <div className="absolute right-0 top-full mt-1.5 bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 rounded-lg overflow-hidden shadow-lg dark:shadow-none z-50 min-w-32">
          {langs.map((lang) => (
            <button
              key={lang.value}
              onClick={() => select(lang.value)}
              className={`flex items-center cursor-pointer gap-2 w-full px-3 py-2 text-[12px] font-semibold text-left transition-colors duration-150 ${
                lang.value === current.value
                  ? "bg-slate-100 dark:bg-night-800 text-slate-800 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-night-800 hover:text-slate-800 dark:hover:text-slate-100"
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
