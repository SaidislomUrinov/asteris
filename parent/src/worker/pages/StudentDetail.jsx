import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { HiOutlineLockClosed } from "react-icons/hi2";
import { EmptyState } from "../../components/States";
import { useWorker } from "../useWorker";
import { TEACHING_ROLES } from "../constants";
import { WorkerPage } from "../components/WorkerPage";
import { StudentFullView } from "../student/StudentFullView";
import { StudentAchievementsView } from "../student/StudentAchievementsView";

// O'quvchi detali — `/students/:id` (details §3): Boshliq/resepshn — to'liq
// karta (`student:view`); o'qituvchi/yordamchi — yutuqlar ko'rinishi.
export const StudentDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { role, can } = useWorker();
  const teaching = TEACHING_ROLES.includes(role);
  return (
    <WorkerPage title={t("worker.student.title")}>
      {teaching ? (
        <StudentAchievementsView key={id} id={id} />
      ) : can("student:view") ? (
        <StudentFullView key={id} id={id} />
      ) : (
        <EmptyState icon={HiOutlineLockClosed} title={t("worker.errors.auth.forbidden")} />
      )}
    </WorkerPage>
  );
};
