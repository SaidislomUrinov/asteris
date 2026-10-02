import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiOutlineUser, HiOutlineCheckCircle, HiOutlineStar, HiOutlineBanknotes } from "react-icons/hi2";
import { Page } from "../components/Page";
import { Avatar, Card, SectionLabel, Pill } from "../components/Card";
import { GroupCard } from "../components/GroupCard";
import { TodayCard } from "../components/TodayCard";
import { StatRow } from "../components/StatRow";
import { ListSkeleton, Skeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useChildren } from "../contexts/children";
import { initials, money } from "../utils/format";

export const Child = () => {
  const { sid } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loading, error, reload, findChild } = useChildren();
  const child = findChild(sid);

  if (loading)
    return (
      <Page>
        <div className="bg-hero rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full bg-white/10" />
            <div className="flex-1 space-y-2"><Skeleton className="h-5 w-40 bg-white/10" /><Skeleton className="h-3.5 w-28 bg-white/10" /></div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[92px] rounded-2xl bg-white/8" />)}
          </div>
        </div>
        <Skeleton className="h-3 w-32 mt-1" />
        <ListSkeleton count={3} />
      </Page>
    );
  if (error) return <Page><ErrorState error={error} onRetry={reload} /></Page>;
  if (!child) return <Page><EmptyState icon={HiOutlineUser} title={t("child.notFound")} /></Page>;

  const { student, stats, centers } = child;
  const finished = centers.flatMap((c) => (c.groups || []).filter((g) => g.status !== "active").map((g) => ({ ...g, centerName: c.center.name })));
  const goto = (g) => navigate(`/child/${sid}/group/${g.entryId}/attendance`);
  const today = (child.today || []).map((l) => ({ ...l, student }));

  return (
    <Page>
      <Card className="bg-hero text-hero-fg border-transparent p-4">
        <div className="flex items-center gap-3">
          <Avatar text={initials(student.fullName)} className="w-12 h-12 rounded-full bg-white/12 text-hero-fg text-base" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-extrabold leading-tight tracking-tight break-words">{student.fullName}</h1>
            <div className="text-[13px] text-hero-fg-mut mt-0.5 break-words tabular">{student.isSelf ? t("child.self") : student.phone}</div>
          </div>
        </div>
        <StatRow
          dark
          className="mt-4"
          items={[
            { icon: HiOutlineCheckCircle, value: stats.attendancePercent != null ? `${stats.attendancePercent}%` : "—", label: t("child.attendance") },
            { icon: HiOutlineStar, value: stats.avgGrade != null ? stats.avgGrade : "—", label: t("child.avgGrade") },
            { icon: HiOutlineBanknotes, value: money(stats.totalDebt), suffix: t("common.sum"), label: t("child.totalDebt"), tone: stats.totalDebt > 0 ? "bad" : undefined },
          ]}
        />
      </Card>

      <TodayCard lessons={today} showStudent={false} />

      {centers.map((c) => {
        const active = (c.groups || []).filter((g) => g.status === "active");
        return (
          <div key={c.center._id} className="space-y-2.5">
            <SectionLabel>{c.center.name}</SectionLabel>
            {!c.linked ? (
              <Card className="opacity-80">
                <div className="flex items-start gap-3">
                  <div className="flex-1 text-sm text-hint break-words">{t("child.notLinkedText")}</div>
                  <Pill tone="mut">{t("child.notLinked")}</Pill>
                </div>
              </Card>
            ) : active.length === 0 ? (
              <Card className="text-sm text-hint text-center py-4">{t("child.noActiveGroups")}</Card>
            ) : (
              active.map((g) => <GroupCard key={g.entryId} group={g} onClick={() => goto(g)} />)
            )}
          </div>
        );
      })}

      {finished.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>{t("child.finished")}</SectionLabel>
          {finished.map((g) => (
            <GroupCard key={g.entryId} group={{ ...g, teacherName: g.centerName }} muted onClick={() => goto(g)} />
          ))}
        </div>
      )}
    </Page>
  );
};
