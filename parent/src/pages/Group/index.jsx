import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { HiOutlineAcademicCap, HiOutlineQrCode } from "react-icons/hi2";
import { FaTelegram } from "react-icons/fa";
import { Page } from "../../components/Page";
import { SegmentTabs } from "../../components/SegmentTabs";
import { Skeleton, StatSkeleton } from "../../components/Skeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { useChildren } from "../../contexts/children";
import { useAuth } from "../../contexts/auth";
import { AttendanceTab } from "./AttendanceTab";
import { GradesTab } from "./GradesTab";
import { PaymentsTab } from "./PaymentsTab";
import { HomeworkTab } from "./HomeworkTab";
import { RankCard } from "../../components/RankCard";
import { BadgesTab } from "./BadgesTab";
import { LessonPlanTab } from "./LessonPlanTab";
import { useRequest } from "../../hooks/useRequest";
import { getBadges, getLessonPlan, getQrCard } from "../../api/parent";
import { QrCardSheet } from "./QrCardSheet";
import { cn } from "../../utils/cn";
import { Button } from "../../components/Button";
import { openTelegramLink } from "../../lib/telegram";
import { Avatar } from "../../components/Card";
import { photoSrc } from "../../lib/studentPhoto";
import { initials } from "../../utils/format";

const TABS = ["attendance", "grades", "payments"];
// O'quvchi: Vazifalar (default) · Baholar · Davomat — to'lov yo'q
const STUDENT_TABS = ["homework", "grades", "attendance"];
// "Dars rejasi" tabi shu tabdan KEYIN qo'yiladi (rolga qarab).
const PLAN_AFTER = { parent: "grades", student: "homework" };

export const Group = () => {
  const { sid, eid, tab: rawTab } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isStudent } = useAuth();
  const { loading, error, reload, findEntry } = useChildren();
  const found = findEntry(eid);
  const baseTabs = isStudent ? STUDENT_TABS : TABS;
  const tab = rawTab || baseTabs[0];
  // Yutuqlar: bitta so'rov, tab almashganda qayta yuborilmaydi (Group mount
  // bo'lib qoladi). `enabled:false` (tarif flagi o'chiq) yoki xato → tab yo'q;
  // to'g'ridan-to'g'ri /badges havolasida esa yuklanish/xato holati tab ichida.
  const badges = useRequest(() => getBadges(eid), [eid]);
  const onBadges = tab === "badges";
  const showBadges = badges.data?.enabled === true || (onBadges && (badges.loading || !!badges.error));
  // Dars rejasi: tarifda dars rejalash bor VA guruhda reja tuzilgan bo'lsa.
  // Badges bilan bir xil naqsh — bitta so'rov, javobga qarab tab ko'rinadi.
  const plan = useRequest(() => getLessonPlan(eid), [eid]);
  const onPlan = tab === "plan";
  const showPlan =
    (plan.data?.enabled === true && plan.data?.hasPlan === true) || (onPlan && (plan.loading || !!plan.error));
  const withPlan = showPlan
    ? baseTabs.flatMap((v) => (v === PLAN_AFTER[isStudent ? "student" : "parent"] ? [v, "plan"] : [v]))
    : baseTabs;
  const tabs = showBadges ? [...withPlan, "badges"] : withPlan;
  // QR karta: faqat faol a'zolikda so'raladi; javob muvaffaqiyatli bo'lsa
  // tugma ko'rinadi (`parent.qrUnavailable` va boshqa xatoda — jimgina yo'q).
  const isActive = findEntry(eid)?.group?.status === "active";
  const qr = useRequest(() => getQrCard(eid), [eid], { enabled: isActive });
  const [qrOpen, setQrOpen] = useState(false);

  // O'quvchi to'lov tabiga (eski havola) kirsa — vazifalarga
  if (isStudent && !onBadges && !onPlan && !STUDENT_TABS.includes(tab))
    return <Navigate to={`/child/${sid}/group/${eid}/homework`} replace />;
  // Dars rejasi yo'q (tarif yoki reja tuzilmagan) — birinchi tabga
  if (onPlan && plan.data && !(plan.data.enabled && plan.data.hasPlan))
    return <Navigate to={`/child/${sid}/group/${eid}/${baseTabs[0]}`} replace />;
  // Yutuqlar yoqilmagan markaz — birinchi tabga
  if (onBadges && badges.data && !badges.data.enabled)
    return <Navigate to={`/child/${sid}/group/${eid}/${baseTabs[0]}`} replace />;

  if (loading)
    return (
      <Page title={<Skeleton className="h-6 w-44" />} subtitle={<Skeleton className="h-3.5 w-56 mt-1" />}
        right={<Skeleton className="w-12 h-12 rounded-full shrink-0" />}
      >
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-72 rounded-2xl" />
        <StatSkeleton />
      </Page>
    );
  if (error) return <Page><ErrorState error={error} onRetry={reload} /></Page>;
  if (!found) return <Page><EmptyState icon={HiOutlineAcademicCap} title={t("group.notFound")} /></Page>;

  const { child, group, center } = found;
  const subParts = [center.center.name, group.teacherName, group.roomName ? <span key="room" className="whitespace-nowrap">{group.roomName}</span> : null].filter(Boolean);

  return (
    <Page
      title={group.name}
      subtitle={
        <>
          {/* Ota-ona bir nechta farzand ko'rishi mumkin — qaysi bola ekani ko'rinsin */}
          {!isStudent && <div className="font-bold text-ink break-words">{child.student.fullName}</div>}
          <div className="break-words">
            {subParts.map((p, i) => (
              <span key={i}>
                {i > 0 && " · "}
                {p}
              </span>
            ))}
          </div>
        </>
      }
      right={
        <Avatar
          text={initials(child.student.fullName)}
          src={photoSrc(group.photo)}
          alt={child.student.fullName}
          className={cn("w-12 h-12 rounded-full text-base", group.photo && "ring-2 ring-line")}
        />
      }
    >
      {/* Reyting faqat faol a'zolikda — tugagan guruhda so'rov yuborilmaydi */}
      {group.status === "active" && <RankCard entryId={eid} />}
      {/* Telegram guruh — faqat faol a'zolikda va markaz havola qo'ygan bo'lsa */}
      {group.status === "active" && (qr.data || group.telegramLink) && (
        <div className={cn("grid gap-2.5", qr.data && group.telegramLink && "grid-cols-2")}>
          {qr.data && (
            <Button variant="soft" className="px-2" onClick={() => setQrOpen(true)}>
              <HiOutlineQrCode className="w-5 h-5 shrink-0" />
              {t("group.qrCard.button")}
            </Button>
          )}
          {group.telegramLink && (
            <Button variant="soft" className="px-2" onClick={() => openTelegramLink(group.telegramLink)}>
              <FaTelegram className="w-5 h-5 shrink-0" />
              {t("group.telegram")}
            </Button>
          )}
        </div>
      )}
      {qrOpen && qr.data && <QrCardSheet onClose={() => setQrOpen(false)} entryId={eid} initial={qr.data} />}
      <SegmentTabs
        items={tabs.map((v) => ({ value: v, label: t(`group.tab.${v}`) }))}
        value={tabs.includes(tab) ? tab : tabs[0]}
        onChange={(v) => navigate(`/child/${sid}/group/${eid}/${v}`, { replace: true })}
      />
      {onBadges ? (
        <BadgesTab state={badges} />
      ) : onPlan ? (
        <LessonPlanTab state={plan} />
      ) : tab === "grades" ? (
        <GradesTab entryId={eid} />
      ) : tab === "payments" && !isStudent ? (
        <PaymentsTab entryId={eid} group={group} />
      ) : tab === "homework" && isStudent ? (
        <HomeworkTab entryId={eid} />
      ) : (
        <AttendanceTab entryId={eid} />
      )}
    </Page>
  );
};
