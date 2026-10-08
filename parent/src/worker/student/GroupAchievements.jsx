import { useTranslation } from "react-i18next";
import { Card, Pill } from "../../components/Card";
import { BadgesTab } from "../../pages/Group/BadgesTab";

const TONE = { active: "ok", finished: "mut", left: "mut", archived: "mut" };

// Bitta guruh bo'yicha yutuqlar (GET /badges/student/:id `groups[]` bandi) —
// ota-ona WebApp'idagi "Yutuqlar" tabi bilan bir xil ko'rinish.
export const GroupAchievements = ({ item, month }) => {
  const { t } = useTranslation();
  const state = {
    data: { enabled: true, month, earned: item.earned, medals: item.medals, progress: item.progress },
    loading: false,
    error: null,
    reload: () => {},
  };
  return (
    <div className="flex flex-col gap-2.5">
      <Card className="flex items-center justify-between gap-2 py-2.5">
        <span className="font-extrabold text-[15px] min-w-0 break-words">{item.groupName || item.subjectName || "—"}</span>
        <Pill tone={TONE[item.state] || "mut"} className="shrink-0">{t(`worker.student.entry.${item.state}`)}</Pill>
      </Card>
      <BadgesTab state={state} />
    </div>
  );
};
