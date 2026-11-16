import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiOutlineClock, HiOutlineClipboardDocumentCheck } from "react-icons/hi2";
import { Card, IconBox, SectionLabel } from "./Card";
import { Button } from "./Button";
import { useRequest } from "../hooks/useRequest";
import { getActiveQuizzes } from "../api/parent";

const pad = (n) => String(n).padStart(2, "0");
const fmtRemaining = (sec) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

// Rol (Student/Parent) almashganda tugallanmagan test urinishi yo'qolib
// qolmasligi uchun — bosh sahifada "Joriy test(lar)" bo'limi
// (docs/API_CONTRACT_profile_test_and_student_notify.md §1). Bo'sh bo'lsa
// hech narsa ko'rsatilmaydi.
export const ActiveQuizSection = ({ entryIds }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useRequest(getActiveQuizzes, []);
  const all = data || [];
  const items = entryIds ? all.filter((q) => entryIds.has(q.entryId)) : all;
  if (!items.length) return null;

  return (
    <>
      <SectionLabel>{t("quiz.active.title")}</SectionLabel>
      <div className="space-y-2.5">
        {items.map((q) => (
          <Card key={q.entryId + q.quizId}>
            <div className="flex items-center gap-3">
              <IconBox Icon={HiOutlineClipboardDocumentCheck} tone="warn" />
              <div className="flex-1 min-w-0">
                <div className="font-title font-bold text-[15px] break-words leading-tight">{q.title}</div>
                <div className="text-xs text-hint mt-1 break-words leading-snug">{q.groupName}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1 text-[12px] font-bold text-warn">
                <HiOutlineClock className="w-3.5 h-3.5 shrink-0" />
                <span className="tabular">{fmtRemaining(q.remainingSec)}</span>
              </div>
              <div className="ml-auto">
                <Button className="w-auto px-4" onClick={() => navigate(`/quiz/${q.entryId}/${q.quizId}`)}>
                  {t("quiz.active.continue")}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};
