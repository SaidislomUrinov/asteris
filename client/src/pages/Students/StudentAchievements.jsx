import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiArrowLeft, HiTrophy, HiUsers } from "react-icons/hi2";
import IconButton from "../../ui/IconButton";
import Button from "../../ui/Button";
import Avatar from "../../ui/Avatar";
import StudentBadges from "./StudentBadges";

/**
 * O'qituvchi / yordamchi uchun o'quvchi sahifasi — FAQAT yutuqlar va medallar
 * (API_CONTRACT_student_achievements.md). Pul, to'lov, kontakt va guruhlar
 * tarixi yo'q: ma'lumot ham faqat `/badges/student/:id` dan (server o'z
 * guruhlari bilan cheklaydi), `/students/:id` chaqirilmaydi.
 */
function StudentAchievements() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  // undefined — yuklanmoqda, null — o'quvchi topilmadi (umumiy guruh yo'q).
  const [student, setStudent] = useState(undefined);

  // Boshqa o'quvchiga o'tilganda oldingisining sarlavhasi qolib ketmasin.
  const [loadedFor, setLoadedFor] = useState(id);
  if (loadedFor !== id) {
    setLoadedFor(id);
    setStudent(undefined);
  }

  if (student === null) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 px-4 text-center text-slate-400 dark:text-slate-500">
        <HiUsers className="text-4xl" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t("student.notFound")}</p>
          <p className="text-sm">{t("badge.notTeacherStudent")}</p>
        </div>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <IconButton variant="ghost" color="black" onClick={() => navigate(-1)}>
          <HiArrowLeft />
        </IconButton>
        {student === undefined ? (
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-night-800 animate-pulse" />
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-40 rounded bg-slate-100 dark:bg-night-800 animate-pulse" />
              <div className="h-3 w-56 max-w-[50vw] rounded bg-slate-100 dark:bg-night-800 animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar user={{ _id: student._id, name: student.fullName, avatar: student.photo }} size={44} />
            <div className="flex flex-col gap-0.5 min-w-0">
              <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 leading-tight break-words">{student.fullName}</h1>
              <p className="flex items-start gap-1.5 text-xs text-slate-400 dark:text-slate-500 leading-snug">
                <HiTrophy className="shrink-0 mt-px text-amber-500" />
                {t("badge.teacherScope")}
              </p>
            </div>
          </div>
        )}
      </div>

      <StudentBadges
        studentId={id}
        showTitle={false}
        onLoaded={(data) => setStudent(data ? data.student : null)}
      />
    </div>
  );
}

export default StudentAchievements;
