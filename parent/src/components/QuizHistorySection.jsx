import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiOutlineClipboardDocumentCheck } from "react-icons/hi2";
import { Card, IconBox, Pill, SectionLabel } from "./Card";
import { useRequest } from "../hooks/useRequest";
import { getQuizHistory } from "../api/parent";

// Tugallangan testlar ro'yxati — ActiveQuizSection bilan bir xil joyda,
// pastroqda. Bosilsa natija sahifasiga o'tadi (QuizPage finishedAt bo'lsa
// avtomatik "result" fazasini ko'rsatadi).
export const QuizHistorySection = ({ entryIds }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useRequest(getQuizHistory, []);
  const all = data || [];
  const items = entryIds ? all.filter((q) => entryIds.has(q.entryId)) : all;
  if (!items.length) return null;

  return (
    <>
      <SectionLabel>{t("quiz.history.title")}</SectionLabel>
      <div className="space-y-2.5">
        {items.map((q) => (
          <Card key={q.entryId + q.quizId} onClick={() => navigate(`/quiz/${q.entryId}/${q.quizId}`)}>
            <div className="flex items-center gap-3">
              <IconBox Icon={HiOutlineClipboardDocumentCheck} tone="mut" />
              <div className="flex-1 min-w-0">
                <div className="font-title font-bold text-[15px] break-words leading-tight">{q.title}</div>
                <div className="text-xs text-hint mt-1 break-words leading-snug">{q.groupName}</div>
              </div>
              <Pill tone={q.score >= 7 ? "ok" : q.score >= 4 ? "warn" : "bad"}>
                {t("quiz.history.score", { score: q.score })}
              </Pill>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};
