import { Fragment, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineSun } from "react-icons/hi2";
import { Page } from "../../components/Page";
import { SectionLabel } from "../../components/Card";
import { EmptyState, ErrorState } from "../../components/States";
import { KpiSkeleton, TimelineSkeleton } from "../components/WorkerSkeleton";
import { fmtDate } from "../../utils/format";
import { useWorker } from "../useWorker";
import { useLive } from "../useLive";
import { workerApi } from "../api";
import { asErr, tashkentHHmm } from "../utils";
import { WorkerHeader } from "../components/WorkerHeader";
import { KpiStrip } from "../components/KpiStrip";
import { LiveBadge } from "../components/LiveBadge";
import { ReadOnlyNote } from "../components/ReadOnlyNote";
import { CenterChips } from "../components/CenterChips";
import { Timeline } from "../components/Timeline";
import { NowLine } from "../components/NowLine";
import { TodayEvent } from "../components/TodayEvent";

// Har daqiqada "hozir" chizig'ini siljitish uchun.
const useNow = () => {
  const [now, setNow] = useState(() => tashkentHHmm());
  useEffect(() => {
    const id = setInterval(() => setNow(tashkentHHmm()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
};

// Lenta sarlavhasi rol bo'yicha (dizayn: "Barcha filiallar" / "Darslarim"...).
const FEED_LABEL = { owner: "owner", reception: "reception", teacher: "teacher", assistant: "assistant" };

export const Today = () => {
  const { t } = useTranslation();
  const { role, isOwner, centerId, me, connected, readOnly } = useWorker();
  const now = useNow();
  const load = useCallback(() => workerApi.today(centerId), [centerId]);
  const { data, loading, error, reload } = useLive(load, [load]);

  const events = [...(data?.events || [])].sort((a, b) => (a.at || 0) - (b.at || 0));
  // "Hozir" chizig'i — boshlanish vaqti hozirdan keyin bo'lgan birinchi voqeadan
  // oldin. Davom etayotgan dars (10:00 da boshlangan, hozir 11:16) chiziqdan
  // YUQORIDA qoladi — aks holda 11:16 belgisi 10:00 dan oldin turib, vaqt
  // tartibi buzilardi; u accent halqa bilan baribir ajralib turadi.
  let nowIdx = events.findIndex((e) => (e.time || "") > now);
  if (nowIdx === -1) nowIdx = events.length;

  const feedLabel = isOwner
    ? centerId
      ? (me?.centers || []).find((c) => c._id === centerId)?.name
      : t("worker.allCenters")
    : t(`worker.today.feed.${FEED_LABEL[role] || "teacher"}`, { center: me?.center?.name || "" });

  return (
    <Page>
      <WorkerHeader title={t("worker.today.title", { date: fmtDate(data?.date || new Date()) })} />
      {readOnly && <ReadOnlyNote />}
      <CenterChips />
      {loading ? (
        <>
          <KpiSkeleton />
          <TimelineSkeleton />
        </>
      ) : error ? (
        <ErrorState error={asErr(error)} onRetry={reload} />
      ) : (
        <>
          <KpiStrip kpis={data?.kpis} />
          <SectionLabel right={<span className="text-[11px] font-bold uppercase"><LiveBadge live={connected} /></span>}>
            {feedLabel}
          </SectionLabel>
          {events.length === 0 ? (
            <EmptyState icon={HiOutlineSun} title={t("worker.today.empty")} text={t("worker.today.emptyText")} />
          ) : (
            <Timeline>
              {events.map((ev, i) => (
                <Fragment key={ev.id || i}>
                  {i === nowIdx && <NowLine time={now} />}
                  <TodayEvent ev={ev} nowHHmm={now} />
                </Fragment>
              ))}
              {nowIdx === events.length && <NowLine time={now} />}
            </Timeline>
          )}
        </>
      )}
    </Page>
  );
};
