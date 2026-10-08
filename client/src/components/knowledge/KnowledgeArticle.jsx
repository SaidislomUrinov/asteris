import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineExclamationTriangle, HiOutlineLightBulb } from "react-icons/hi2";

// Inline belgilar: **qalin** va [[UI yorlig'i]]. HTML ishlatilmaydi —
// kontent statik bo'lsa ham `dangerouslySetInnerHTML`siz, xavfsiz render.
const INLINE_RE = /(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g;

function Inline({ text }) {
  return text.split(INLINE_RE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("[[") && part.endsWith("]]"))
      return (
        <span
          key={i}
          className="mx-px rounded-md border border-slate-200 dark:border-night-700 bg-slate-50 dark:bg-night-800 px-1.5 py-0 text-[0.92em] font-medium text-slate-700 dark:text-slate-300 box-decoration-clone shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:shadow-none"
        >
          {part.slice(2, -2)}
        </span>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Callout({ tone, text }) {
  const { t } = useTranslation();
  const warn = tone === "warn";
  const Icon = warn ? HiOutlineExclamationTriangle : HiOutlineLightBulb;
  return (
    <div
      className={`flex gap-3 rounded-xl border p-3.5 my-1 ${
        warn ? "border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/15" : "border-blue-100 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/15"
      }`}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-lg ${
          warn ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
        }`}
      >
        <Icon />
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
            warn ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"
          }`}
        >
          {t(warn ? "kb.warn" : "kb.tip")}
        </span>
        <p className={`text-[14px] leading-6 ${warn ? "text-amber-950 dark:text-amber-400" : "text-slate-700 dark:text-slate-300"}`}>
          <Inline text={text} />
        </p>
      </div>
    </div>
  );
}

function Block({ block }) {
  switch (block.type) {
    case "h":
      return (
        <h4 className="mt-4 first:mt-0 text-[16px] leading-snug font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          {block.text}
        </h4>
      );
    case "ul":
      return (
        <ul className="flex flex-col gap-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-6 text-slate-600 dark:text-slate-300">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-blue-400" />
              <span className="min-w-0">
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="flex flex-col">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[14px] leading-6 text-slate-600 dark:text-slate-300">
              <span className="flex flex-col items-center">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[12px] font-semibold text-white tabular-nums">
                  {i + 1}
                </span>
                {i < block.items.length - 1 ? (
                  <span className="w-px flex-1 bg-blue-100 dark:bg-blue-500/20 my-1" />
                ) : null}
              </span>
              <span className={`min-w-0 ${i < block.items.length - 1 ? "pb-3" : ""}`}>
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "tip":
    case "warn":
      return <Callout tone={block.type} text={block.text} />;
    default:
      return (
        <p className="text-[14px] leading-6 text-slate-600 dark:text-slate-300">
          <Inline text={block.text} />
        </p>
      );
  }
}

// Bitta bo'lim maqolasi — `knowledge/index.js` dagi blok formatini chizadi.
export default function KnowledgeArticle({ article }) {
  return (
    <article className="flex flex-col gap-3 pt-1 pb-1">
      {article.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </article>
  );
}
