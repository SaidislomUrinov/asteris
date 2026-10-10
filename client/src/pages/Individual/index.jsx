import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { HiMagnifyingGlass, HiPlus, HiUserCircle, HiXMark } from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import useMediaQuery from "../../hooks/useMediaQuery";
import useCan from "../../hooks/useCan";
import useQueryState from "../../hooks/useQueryState";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { toMinutes } from "../../utils/schedule";
import IndividualCard from "./IndividualCard";
import IndividualDialog from "./IndividualDialog";

const GRID = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-stretch";

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-full bg-slate-100 dark:bg-night-800" />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-4 w-2/3 rounded bg-slate-100 dark:bg-night-800" />
          <div className="h-3 w-1/3 rounded bg-slate-100 dark:bg-night-800" />
        </div>
      </div>
      <div className="h-11 rounded-xl bg-slate-100 dark:bg-night-800" />
      <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-night-800" />
    </div>
  );
}

/**
 * Individual o'quvchilar (/individual) — har biri yashirin "individual"
 * guruh (docs/API_CONTRACT_individual_students.md §4). O'qituvchi faqat
 * o'zinikini ko'radi (backend teacherScope); Boshliq/Resepshin filtrlar,
 * qo'shish, o'qituvchi ismi va foizini ko'radi.
 */
function Individual() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const navigate = useNavigate();
  const can = useCan();
  const { authType, role } = useSelector((e) => e.user);
  const isTeacher = authType === "staff" && ["teacher", "assistant"].includes(role);
  const canCreate = !isTeacher && can("student:create");

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useQueryState("page", 1);
  const [search, setSearch] = useQueryState("search", "");
  const [filterCenter, setFilterCenter] = useQueryState("filterCenter", "");
  const [filterTeacher, setFilterTeacher] = useQueryState("filterTeacher", "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const showCenterFilter = centers.length > 1;
  const subjectMap = Object.fromEntries(subjects.map((s) => [s._id, s.name]));
  const teacherMap = Object.fromEntries(teachers.map((s) => [s._id, s.name]));
  const roomMap = Object.fromEntries(rooms.map((r) => [r._id, r.name]));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const activeFilterCount = [filterCenter, filterTeacher].filter(Boolean).length;
  const resetFilters = () => {
    setPage(1);
    setFilterCenter("");
    setFilterTeacher("");
  };

  // Dars boshlanish soati bo'yicha; jadvalsizlar oxirida (Groups bilan bir xil).
  const startOf = (g) => (g.startTime ? toMinutes(g.startTime) : Infinity);
  const sortedRows = [...rows].sort((a, b) => startOf(a) - startOf(b));

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/groups", {
        params: { kind: "individual", page, search, center: filterCenter, teacher: filterTeacher },
      });
      const { ok, data, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
      setMeta(m || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(true);
      errorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCenter, filterTeacher]);

  const fetchLookups = useCallback(async () => {
    const [centersRes, subjectsRes, staffRes, roomsRes] = await Promise.allSettled([
      api.get("/centers", { params: { page: 1 } }),
      api.get("/subjects", { params: { page: 1 } }),
      api.get("/staffs/lookup", { params: { role: "teacher" } }),
      api.get("/rooms/lookup"),
    ]);
    const take = (res, set) => {
      if (res.status === "fulfilled" && res.value.data.ok) set(res.value.data.data || []);
    };
    take(centersRes, setCenters);
    take(subjectsRes, setSubjects);
    take(staffRes, setTeachers);
    take(roomsRes, setRooms);
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchRows, 0);
    return () => clearTimeout(timer);
  }, [fetchRows]);

  useEffect(() => {
    const timer = setTimeout(fetchLookups, 0);
    return () => clearTimeout(timer);
  }, [fetchLookups]);

  // Individual guruh yaratildi/tahrirlandi (shu yoki boshqa tabdan) — ro'yxat yangilanadi.
  useSocketEvent("group:changed", () => fetchRows());

  const openCreate = () => {
    if (centers.length === 0) {
      errorMsg("staff.noCentersYet");
      return;
    }
    if (subjects.length === 0) {
      errorMsg("group.fillTheRows");
      return;
    }
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const searchInput = (
    <Input
      placeholder={t("individual.searchPlaceholder")}
      icon={<HiMagnifyingGlass />}
      variant="slate"
      value={search}
      onChange={(e) => {
        setPage(1);
        setSearch(e.target.value);
      }}
    />
  );
  const centerSelect = showCenterFilter && (
    <Select
      placeholder={t("group.center")}
      variant="slate"
      value={filterCenter}
      onChange={(v) => {
        setPage(1);
        setFilterCenter(v);
      }}
      options={[{ value: "", label: t("common.all") }, ...centers.map((c) => ({ value: c._id, label: c.name }))]}
    />
  );
  const teacherSelect = !isTeacher && (
    <Select
      placeholder={t("group.teacher")}
      variant="slate"
      value={filterTeacher}
      onChange={(v) => {
        setPage(1);
        setFilterTeacher(v);
      }}
      options={[{ value: "", label: t("common.all") }, ...teachers.map((s) => ({ value: s._id, label: s.name }))]}
    />
  );
  const createButton = canCreate && (
    <Button onClick={openCreate} className="gap-1.5">
      <HiPlus className="text-base" />
      {t("individual.create")}
    </Button>
  );
  const hasFilters = showCenterFilter || !isTeacher;

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {isDesktop ? (
        <div className="flex flex-col gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-sm dark:shadow-none shadow-slate-900/[0.02]">
          <div className="flex flex-wrap items-center gap-2.5 [&>*]:flex-1 [&>*]:min-w-[200px]">
            {searchInput}
            {centerSelect}
            {teacherSelect}
            <div className="flex items-center gap-2 !flex-none !min-w-0 ml-auto">
              {hasFilters && (
                <Button
                  variant="outlined"
                  color="red"
                  onClick={resetFilters}
                  disabled={activeFilterCount === 0}
                  className="gap-1.5"
                >
                  <HiXMark className="text-base" />
                  {t("common.resetFilters")}
                </Button>
              )}
              {createButton}
            </div>
          </div>
        </div>
      ) : !hasFilters ? (
        <div className="flex items-center gap-2 [&>*:first-child]:flex-1">
          {searchInput}
          {createButton}
        </div>
      ) : (
        <FilterBar
          cols={showCenterFilter && !isTeacher ? 2 : 1}
          activeCount={activeFilterCount}
          onReset={resetFilters}
          search={searchInput}
          actions={createButton || null}
        >
          {centerSelect}
          {teacherSelect}
        </FilterBar>
      )}

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
          <HiUserCircle className="text-4xl" />
          <p className="text-sm">{t("individual.loadError")}</p>
          <Button variant="outlined" onClick={fetchRows}>
            {t("common.retry")}
          </Button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className={GRID}>
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <List
          view="grid"
          rows={sortedRows}
          className="!bg-transparent !border-0"
          gridClassName={GRID}
          renderItem={(row) => (
            <IndividualCard
              group={row}
              subjectName={row.subjectName || subjectMap[row.subject]}
              teacherName={isTeacher ? undefined : teacherMap[row.teacher] || row.teacherName || ""}
              roomName={row.roomName || roomMap[row.room]}
              showFinance={!isTeacher}
              onClick={() => navigate(`/individual/${row._id}`)}
            />
          )}
          loading={false}
          empty={
            <div className="flex flex-col items-center gap-3 text-center">
              <HiUserCircle className="text-4xl text-slate-300 dark:text-slate-600" />
              <p>{t("individual.empty")}</p>
              {createButton}
            </div>
          }
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
        />
      )}

      {canCreate && (
        <IndividualDialog
          key={dialogKey}
          open={dialogOpen}
          centers={centers}
          subjects={subjects}
          teachers={teachers}
          rooms={rooms}
          onClose={() => setDialogOpen(false)}
          onSaved={fetchRows}
        />
      )}
    </div>
  );
}

export default Individual;
