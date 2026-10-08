import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { money } from "../../utils/format";
import { useWorker } from "../useWorker";
import { TimelineItem } from "./TimelineItem";
import { EventTitle } from "./EventTitle";
import { AttendancePills } from "./AttendancePills";
import { MiniAction } from "./MiniAction";

const join = (...xs) => xs.filter(Boolean).join(" · ");

// `/worker/today` voqeasi → lenta kartasi. Server matn bermaydi — hammasi
// t() orqali (§3.2). `state` faqat lesson uchun keladi; qolganlari uchun
// joriy vaqtga solishtirib o'tgan/kelgusi aniqlanadi.
export const TodayEvent = ({ ev, nowHHmm }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role, can, hasFeature, readOnly, openSheet } = useWorker();
  const state = ev.state || (ev.time && ev.time <= nowHHmm ? "past" : "upcoming");
  const teaching = role === "teacher" || role === "assistant";

  switch (ev.type) {
    case "lesson": {
      const a = ev.attendance;
      const canMark = teaching && state === "now" && can("attendance:create") && !readOnly;
      // Dars kartasi → guruh detali (details §1).
      const open = ev.group?._id && can("group:view") ? () => navigate(`/groups/${ev.group._id}`) : undefined;
      return (
        <TimelineItem time={ev.time} state={state} dot={a && !a.unmarked ? "ok" : "mut"} onClick={open}>
          <EventTitle
            title={join(ev.group?.name, !teaching && ev.teacherName)}
            sub={join(
              ev.endTime ? `${ev.time}–${ev.endTime}` : null,
              ev.room,
              ev.studentsCount != null && t("worker.today.students", { count: ev.studentsCount }),
              state === "now" && t("worker.today.lessonNow"),
            )}
          />
          <AttendancePills attendance={a} />
          {canMark && (
            <MiniAction onClick={() => openSheet("attendance")}>{t("worker.fab.attendance")}</MiniAction>
          )}
        </TimelineItem>
      );
    }
    case "payment":
      return (
        <TimelineItem time={ev.time} state={state} dot="ok">
          <EventTitle
            title={ev.student?.fullName || t("worker.today.payment")}
            amount={`+${money(ev.amount)}`}
            sub={join(
              ev.group?.name,
              ev.method && t(`worker.payType.${ev.method}`, { defaultValue: ev.method }),
              ev.collectedByName,
            )}
          />
        </TimelineItem>
      );
    case "dueToday":
      return (
        // Kun bo'yi dolzarb (00:00 da bo'lsa ham xiralashtirilmaydi).
        <TimelineItem time={ev.time} state="upcoming" dot="bad">
          <EventTitle
            title={t("worker.today.dueToday", { count: ev.count })}
            sub={t("worker.today.dueTodaySum", { amount: money(ev.amount) })}
          />
          {can("student:view") && (
            <MiniAction onClick={() => navigate("/debtors")}>{t("worker.today.list")}</MiniAction>
          )}
        </TimelineItem>
      );
    case "lead":
      return (
        <TimelineItem time={ev.time} state={state}>
          <EventTitle
            title={t("worker.today.lead", { name: ev.name })}
            sub={join(
              ev.source && t(`worker.leads.source.${ev.source}`, { defaultValue: ev.source }),
              ev.status && t(`worker.leads.status.${ev.status}`, { defaultValue: ev.status }),
            )}
          />
        </TimelineItem>
      );
    case "expense":
      return (
        <TimelineItem time={ev.time} state={state} dot="bad">
          <EventTitle
            title={t("worker.today.expense")}
            amount={`−${money(ev.amount)}`}
            amountTone="bad"
            sub={ev.category}
          />
        </TimelineItem>
      );
    case "gradesPending":
      return (
        <TimelineItem time={ev.time} state={state} dot="warn">
          <EventTitle title={t("worker.today.gradesPending", { count: ev.count })} sub={ev.group?.name} />
          {hasFeature("student.rate") && can("attendance:create") && !readOnly && (
            <MiniAction onClick={() => navigate(`/grades?group=${ev.group?._id || ""}`)}>
              {t("worker.today.rate")}
            </MiniAction>
          )}
        </TimelineItem>
      );
    case "homeworkMissing":
      return (
        <TimelineItem time={ev.time} state={state} dot="warn">
          <EventTitle title={t("worker.today.homeworkMissing")} sub={ev.group?.name} />
        </TimelineItem>
      );
    case "eveningReport":
      return (
        <TimelineItem time={ev.time} state={state}>
          <EventTitle title={t("worker.today.eveningReport")} sub={t("worker.today.eveningReportSub")} />
        </TimelineItem>
      );
    default:
      return null;
  }
};
