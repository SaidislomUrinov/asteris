import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiOutlineAcademicCap } from "react-icons/hi2";
import { Page } from "../components/Page";
import { Avatar, Card, Pill, SectionLabel } from "../components/Card";
import { TodayCard } from "../components/TodayCard";
import { StudentGroupCard } from "../components/StudentGroupCard";
import { RecentNotifications } from "../components/RecentNotifications";
import { ListSkeleton, Skeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useAuth } from "../contexts/auth";
import { useChildren } from "../contexts/children";
import { initials } from "../utils/format";
import { photoSrc } from "../lib/studentPhoto";

const greet = (t) => {
  const h = new Date().getHours();
  return t(h < 12 ? "home.morning" : h < 18 ? "home.day" : "home.evening");
};

// O'quvchi roli bosh sahifasi: farzandlar ro'yxati o'rniga o'quvchining o'z
// sahifasi — salom, bugungi darslar, guruh kartalari (o'rin, baho, vazifa).
// /parent/children student rolida odatda bitta yozuv (o'quvchining o'zi) qaytaradi;
// bir nechta bo'lsa ham guruhlar bitta ro'yxatga yig'iladi.
export const StudentHome = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { parent } = useAuth();
  const { list, loading, error, reload } = useChildren();

  const { active, finished, notLinked, today } = useMemo(() => {
    const out = { active: [], finished: [], notLinked: [], today: [] };
    for (const c of list) {
      for (const ce of c.centers || []) {
        if (!ce.linked) {
          out.notLinked.push(ce.center);
          continue;
        }
        for (const g of ce.groups || []) {
          const row = { group: g, sid: c.student._id, centerName: ce.center.name };
          (g.status === "active" ? out.active : out.finished).push(row);
        }
      }
      for (const l of c.today || []) out.today.push({ ...l, student: c.student });
    }
    out.today.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    return out;
  }, [list]);

  const name = list[0]?.student?.fullName || parent?.name || "";
  // O'quvchining o'z rasmi — `name` bilan bir xil manba (/parent/children → list[0].student).
  const photo = list[0]?.student?.photo || "";
  const open = (row) => navigate(`/child/${row.sid}/group/${row.group.entryId}/homework`);

  return (
    <Page>
      <header className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-hint">{greet(t)}</div>
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight break-words">{name}</h1>
        </div>
        <Avatar text={initials(name)} src={photoSrc(photo)} alt={name} className="w-11 h-11 rounded-full text-[15px]" />
      </header>

      {loading ? (
        <>
          <Skeleton className="h-20 rounded-2xl" />
          <ListSkeleton count={2} />
        </>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : active.length + finished.length + notLinked.length === 0 ? (
        <EmptyState icon={HiOutlineAcademicCap} title={t("student.home.noGroups")} text={t("student.home.noGroupsText")} />
      ) : (
        <>
          <TodayCard lessons={today} showStudent={false} tab="homework" />

          <SectionLabel>{t("student.home.groups")}</SectionLabel>
          {active.length === 0 ? (
            <Card className="text-sm text-hint text-center py-4">{t("child.noActiveGroups")}</Card>
          ) : (
            <div className="space-y-2.5">
              {active.map((row) => (
                <StudentGroupCard key={row.group.entryId} group={row.group} centerName={row.centerName} onClick={() => open(row)} />
              ))}
            </div>
          )}

          {notLinked.map((c) => (
            <Card key={c._id} className="opacity-80">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold break-words">{c.name}</div>
                  <div className="text-xs text-hint mt-0.5 break-words">{t("student.child.notLinkedText")}</div>
                </div>
                <Pill tone="mut">{t("child.notLinked")}</Pill>
              </div>
            </Card>
          ))}

          {finished.length > 0 && (
            <>
              <SectionLabel>{t("child.finished")}</SectionLabel>
              <div className="space-y-2.5">
                {finished.map((row) => (
                  <StudentGroupCard key={row.group.entryId} group={row.group} centerName={row.centerName} muted onClick={() => open(row)} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <RecentNotifications />
    </Page>
  );
};
