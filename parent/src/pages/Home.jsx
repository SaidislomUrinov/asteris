import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HiOutlineUserGroup } from "react-icons/hi2";
import { Page } from "../components/Page";
import { Avatar, SectionLabel } from "../components/Card";
import { TodayCard } from "../components/TodayCard";
import { ChildCard } from "../components/ChildCard";
import { RecentNotifications } from "../components/RecentNotifications";
import { ListSkeleton, Skeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useAuth } from "../contexts/auth";
import { useChildren } from "../contexts/children";
import { initials } from "../utils/format";

const greet = (t) => {
  const h = new Date().getHours();
  return t(h < 12 ? "home.morning" : h < 18 ? "home.day" : "home.evening");
};

export const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { parent } = useAuth();
  const { list, loading, error, reload } = useChildren();

  // Bitta farzand — faqat BIRINCHI ochilishda to'g'ridan-to'g'ri o'tadi;
  // tab bar "Asosiy" bosilganda bu sahifa ko'rinadi.
  const redirected = useRef(sessionStorage.getItem("parent_home_seen") === "1");
  useEffect(() => {
    if (loading || redirected.current || list.length !== 1) return;
    redirected.current = true;
    sessionStorage.setItem("parent_home_seen", "1");
    navigate(`/child/${list[0].student._id}`, { replace: true });
  }, [loading, list, navigate]);
  useEffect(() => {
    if (!loading) sessionStorage.setItem("parent_home_seen", "1");
  }, [loading]);

  const today = useMemo(
    () => list.flatMap((c) => (c.today || []).map((l) => ({ ...l, student: c.student }))).sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
    [list],
  );

  return (
    <Page>
      <header className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-hint">{greet(t)}</div>
          <h1 className="text-[20px] min-[380px]:text-[22px] font-extrabold leading-tight tracking-tight break-words">{parent?.name || ""}</h1>
        </div>
        <Avatar text={initials(parent?.name)} className="w-11 h-11 rounded-full text-[15px]" />
      </header>

      {loading ? (
        <>
          <Skeleton className="h-20 rounded-2xl" />
          <ListSkeleton count={2} />
        </>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : list.length === 0 ? (
        <EmptyState icon={HiOutlineUserGroup} title={t("home.noChildren")} text={t("home.noChildrenText")} />
      ) : (
        <>
          <TodayCard lessons={today} />

          <SectionLabel>{t("home.children")}</SectionLabel>
          <div className="space-y-2.5">
            {list.map((c, i) => (
              <ChildCard key={c.student._id} child={c} index={i} onClick={() => navigate(`/child/${c.student._id}`)} />
            ))}
          </div>
        </>
      )}

      <RecentNotifications />
    </Page>
  );
};
