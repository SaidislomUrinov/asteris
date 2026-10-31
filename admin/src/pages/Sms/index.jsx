import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiOutlineArchiveBox,
  HiOutlineBanknotes,
  HiOutlineChatBubbleLeftRight,
  HiOutlineClock,
  HiOutlineGift,
  HiOutlinePaperAirplane,
  HiOutlineRectangleStack,
} from "react-icons/hi2";
import TemplatesTab from "./TemplatesTab";
import HistoryTab from "./HistoryTab";
import TestTab from "./TestTab";
import PackagesTab from "./PackagesTab";
import StockTab from "./StockTab";
import SalesTab from "./SalesTab";
import GrantTab from "./GrantTab";

const TABS = [
  { key: "templates", glyph: <HiOutlineChatBubbleLeftRight className="text-base" /> },
  { key: "history", glyph: <HiOutlineClock className="text-base" /> },
  { key: "test", glyph: <HiOutlinePaperAirplane className="text-base" /> },
  { key: "packages", glyph: <HiOutlineRectangleStack className="text-base" /> },
  { key: "stock", glyph: <HiOutlineArchiveBox className="text-base" /> },
  { key: "sales", glyph: <HiOutlineBanknotes className="text-base" /> },
  { key: "grant", glyph: <HiOutlineGift className="text-base" /> },
];

function Sms() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("templates");

  return (
    <div className="flex flex-col w-full gap-4">
      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-1 w-max min-w-full">
          {TABS.map(({ key, glyph }) => (
            <button
              type="button"
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-3.5 h-9 shrink-0 whitespace-nowrap rounded-lg text-sm font-semibold duration-200 ${tab === key ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
            >
              {glyph}
              {t(`sms.tabs.${key}`)}
            </button>
          ))}
        </div>
      </div>
      {tab === "templates" && <TemplatesTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "test" && <TestTab />}
      {tab === "packages" && <PackagesTab />}
      {tab === "stock" && <StockTab />}
      {tab === "sales" && <SalesTab />}
      {tab === "grant" && <GrantTab />}
    </div>
  );
}

export default Sms;
