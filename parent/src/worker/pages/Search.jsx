import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiMagnifyingGlass, HiOutlineMagnifyingGlass, HiXMark } from "react-icons/hi2";
import { Card, SectionLabel } from "../../components/Card";
import { RowsSkeleton } from "../components/WorkerSkeleton";
import { EmptyState, ErrorState } from "../../components/States";
import { useRequest } from "../../hooks/useRequest";
import { useWorker } from "../useWorker";
import { workerApi } from "../api";
import { loadAllGroups } from "../loadAllGroups";
import { asErr, groupLabel } from "../utils";
import { TEACHING_ROLES } from "../constants";
import { WorkerPage } from "../components/WorkerPage";
import { ListRow } from "../components/ListRow";

const MIN = 2;
const DEBOUNCE_MS = 300;
const MAX_STUDENTS = 30;

// Qidiruv — `/search` (details §4). O'quvchilar: GET /students?search&page=1
// (`student:view`, ≥2 belgi, 300ms debounce; o'qituvchi rollari uchun server
// guruhsiz ro'yxatni yopadi — ular faqat guruhlarni qidiradi). Guruhlar:
// GET /groups dan nom/fan bo'yicha lokal filtr (`group:view`).
export const Search = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role, can, centerId } = useWorker();
  const canStudents = can("student:view") && !TEACHING_ROLES.includes(role);
  const canGroups = can("group:view");
  const [q, setQ] = useState("");
  const [students, setStudents] = useState({ loading: false, error: null, data: null, for: "" });

  const needle = q.trim();
  const ready = needle.length >= MIN;

  useEffect(() => {
    if (!canStudents || !ready) return undefined;
    let alive = true;
    const id = setTimeout(async () => {
      setStudents((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await workerApi.searchStudents(needle, centerId);
        if (alive) setStudents({ loading: false, error: null, data: res?.data || res || [], for: needle });
      } catch (e) {
        if (alive) setStudents({ loading: false, error: e, data: null, for: needle });
      }
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [needle, ready, canStudents, centerId]);

  // Guruhlar bir marta yuklanadi (barcha holatlar), keyin lokal filtr.
  const groupsLoad = useCallback(() => loadAllGroups({ center: centerId || undefined }), [centerId]);
  const groupsReq = useRequest(groupsLoad, [groupsLoad], { enabled: canGroups });
  const groups = useMemo(() => {
    if (!ready) return [];
    const n = needle.toLowerCase();
    return (groupsReq.data || []).filter((g) =>
      `${groupLabel(g)} ${g.subjectName || ""} ${g.roomName || ""}`.toLowerCase().includes(n),
    );
  }, [groupsReq.data, needle, ready]);

  const studentsPending = canStudents && ready && (students.loading || students.for !== needle);
  const groupsPending = canGroups && groupsReq.loading;
  const nothing =
    ready && !studentsPending && !groupsPending && !(students.data?.length > 0) && groups.length === 0 && !students.error && !groupsReq.error;

  return (
    <WorkerPage title={t("worker.search.title")}>
      <label className="flex items-center gap-2 rounded-2xl bg-card border border-line/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3.5 h-12 focus-within:border-accent">
        <HiMagnifyingGlass className="w-5 h-5 text-hint shrink-0" />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t(canStudents ? "worker.search.ph" : "worker.search.phGroups")}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink placeholder:text-hint/70"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label={t("common.cancel")} className="w-8 h-8 -mr-1.5 rounded-full bg-ink/6 grid place-items-center text-hint">
            <HiXMark className="w-4 h-4" />
          </button>
        )}
      </label>

      {!ready ? (
        <EmptyState icon={HiOutlineMagnifyingGlass} title={t("worker.search.hintTitle")} text={t("worker.search.hint")} />
      ) : nothing ? (
        <EmptyState icon={HiOutlineMagnifyingGlass} title={t("worker.search.empty")} text={t("worker.search.emptyText")} />
      ) : (
        <>
          {canStudents && (
            <>
              <SectionLabel>{t("worker.search.students")}</SectionLabel>
              {studentsPending && !students.data ? (
                <RowsSkeleton count={3} />
              ) : students.error ? (
                <ErrorState error={asErr(students.error)} />
              ) : !students.data?.length ? (
                <div className="text-[13px] text-hint px-1 pb-1">{t("worker.search.noStudents")}</div>
              ) : (
                <Card className="py-1 px-3.5 divide-y divide-line/70">
                  {students.data.slice(0, MAX_STUDENTS).map((s) => (
                    <ListRow key={s._id} title={s.fullName} sub={s.phone} onClick={() => navigate(`/students/${s._id}`)} />
                  ))}
                </Card>
              )}
            </>
          )}
          {canGroups && (
            <>
              <SectionLabel>{t("worker.search.groups")}</SectionLabel>
              {groupsPending ? (
                <RowsSkeleton count={2} />
              ) : groupsReq.error ? (
                <ErrorState error={asErr(groupsReq.error)} onRetry={groupsReq.reload} />
              ) : groups.length === 0 ? (
                <div className="text-[13px] text-hint px-1 pb-1">{t("worker.search.noGroups")}</div>
              ) : (
                <Card className="py-1 px-3.5 divide-y divide-line/70">
                  {groups.map((g) => (
                    <ListRow
                      key={g._id}
                      title={groupLabel(g)}
                      sub={[g.startTime && `${g.startTime}–${g.endTime}`, g.roomName, t(`worker.group.status.${g.status}`)]
                        .filter(Boolean)
                        .join(" · ")}
                      right={t("worker.today.students", { count: g.studentsCount || 0 })}
                      onClick={() => navigate(`/groups/${g._id}`)}
                    />
                  ))}
                </Card>
              )}
            </>
          )}
        </>
      )}
    </WorkerPage>
  );
};
