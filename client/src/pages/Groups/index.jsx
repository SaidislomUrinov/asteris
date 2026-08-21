import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  HiBolt,
  HiClock,
  HiMagnifyingGlass,
  HiPlus,
  HiSparkles,
  HiUserGroup,
} from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import DayPicker from "../../ui/DayPicker";
import GroupDialog from "./GroupDialog";
import GroupCard from "./GroupCard";
import ExportExcelButton from "../../ui/ExportExcelButton";
import useCan from "../../hooks/useCan";
import { useSelector } from "react-redux";
import { getTashkentNow } from "../../utils/schedule";
import { GROUP_STATE, STATE_ORDER, buildGroupLive } from "./groupLive";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

// /rooms sahifasidagi bilan bir xil ixcham statistika kartasi.
function StatCard({ icon, value, label, tone }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-base ${tone}`}>
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xl font-space font-bold leading-none text-slate-900">{value}</span>
        <span className="text-xs text-slate-400 truncate">{label}</span>
      </div>
    </div>
  );
}

function Groups() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Guruh yaratish — Resepshin/Boshliq ishi. O'qituvchi va yordamchi
  // o'qituvchida `group:create` ruxsati umuman bo'lmaydi, shu sabab tugma
  // ham ko'rinmaydi (backend ham rol darajasida rad etadi).
  const can = useCan();
  // Excel eksporti o'quvchilar narxi/to'lovi bilan keladi — o'qituvchi
  // moliyaviy ma'lumot ko'rmaydi (backendda ham `blockTeacher`).
  const { authType, role } = useSelector((e) => e.user);
  const isTeacher = authType === "staff" && ["teacher", "assistant"].includes(role);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCenter, setFilterCenter] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDays, setFilterDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  // Hodim (Staff) bitta filialga biriktirilgan — backend `/centers`ni ham
  // o'sha bitta filial bilan cheklaydi, demak tanlov qolmaydi.
  const showCenterFilter = centers.length > 1;

  // Mobil "Filterlash" tugmasidagi belgi uchun — nechta filtr tanlangan.
  const activeFilterCount =
    [filterCenter, filterTeacher, filterStatus].filter(Boolean).length + (filterDays.length ? 1 : 0);

  const resetFilters = () => {
    setPage(1);
    setFilterCenter("");
    setFilterTeacher("");
    setFilterStatus("");
    setFilterDays([]);
  };
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const centerMap = Object.fromEntries(centers.map((c) => [c._id, c.name]));
  const subjectMap = Object.fromEntries(subjects.map((s) => [s._id, s.name]));
  const teacherMap = Object.fromEntries(teachers.map((s) => [s._id, s.name]));
  const roomMap = Object.fromEntries(rooms.map((r) => [r._id, r.name]));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  // Progress bar va "qolgan vaqt" jonli bo'lishi uchun.
  const [nowTick, setNowTick] = useState(() => getTashkentNow());

  // Har guruh uchun jonli holat (dars ketyaptimi, progress, keyingi kun).
  const liveMap = useMemo(
    () => Object.fromEntries(rows.map((g) => [g._id, buildGroupLive(g, nowTick)])),
    [rows, nowTick],
  );

  // Jonli dars birinchi, keyin yaqin orada boshlanadiganlar — Array#sort
  // ES2019+da stabil, shuning uchun qolgan tartib (backend'dan kelgan)
  // o'zgarmaydi.
  const sortedRows = [...rows].sort(
    (a, b) =>
      (STATE_ORDER[liveMap[a._id]?.state] ?? 9) - (STATE_ORDER[liveMap[b._id]?.state] ?? 9),
  );

  const stats = useMemo(() => {
    const list = rows.map((g) => liveMap[g._id]?.state);
    return {
      total: meta.total || rows.length,
      live: list.filter((x) => x === GROUP_STATE.LIVE).length,
      upcoming: list.filter((x) => x === GROUP_STATE.UPCOMING).length,
      pending: list.filter((x) => x === GROUP_STATE.PENDING).length,
    };
  }, [rows, liveMap, meta.total]);

  const groupLabel = (row) =>
    `${row.subjectName || subjectMap[row.subject] || "?"} - ${row.status === "pending" ? row.pendingId : row.activeId}${
      row.status === "pending" ? ` - ${t("group.pendingSuffix")}` : ""
    }`;

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/groups", {
        params: {
          page,
          search,
          center: filterCenter,
          teacher: filterTeacher,
          status: filterStatus,
          days: filterDays.join(","),
        },
      });
      const { ok, data, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
      setMeta(m || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCenter, filterTeacher, filterStatus, filterDays]);

  const fetchLookups = useCallback(async () => {
    try {
      const [centersRes, subjectsRes, staffRes, assistantRes, roomsRes] = await Promise.all([
        api.get("/centers", { params: { page: 1 } }),
        api.get("/subjects", { params: { page: 1 } }),
        api.get("/staffs/lookup", { params: { role: "teacher" } }),
        api.get("/staffs/lookup", { params: { role: "assistant" } }),
        api.get("/rooms", { params: { page: 1 } }),
      ]);
      if (centersRes.data.ok) setCenters(centersRes.data.data || []);
      if (subjectsRes.data.ok) setSubjects(subjectsRes.data.data || []);
      if (staffRes.data.ok) setTeachers(staffRes.data.data || []);
      if (assistantRes.data.ok) setAssistants(assistantRes.data.data || []);
      if (roomsRes.data.ok) setRooms(roomsRes.data.data || []);
    } catch {
      // lookup ro'yxatlari, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(getTashkentNow()), 30_000);
    return () => clearInterval(id);
  }, []);

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

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<HiUserGroup />}
          value={stats.total}
          label={t("group.statTotal")}
          tone="bg-slate-100 text-slate-500"
        />
        <StatCard
          icon={<HiBolt />}
          value={stats.live}
          label={t("group.statLive")}
          tone="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={<HiClock />}
          value={stats.upcoming}
          label={t("group.statUpcoming")}
          tone="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={<HiSparkles />}
          value={stats.pending}
          label={t("group.statPending")}
          tone="bg-orange-50 text-orange-600"
        />
      </div>

      <FilterBar
        cols={showCenterFilter ? 4 : 3}
        activeCount={activeFilterCount}
        onReset={resetFilters}
        search={
          <Input
            placeholder={t("common.search")}
            icon={<HiMagnifyingGlass />}
            variant="white"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        }
        actions={
          <>
            {!isTeacher && can("group:view") && (
              <ExportExcelButton
                endpoint="/groups/export"
                params={{
                  search,
                  center: filterCenter,
                  teacher: filterTeacher,
                  status: filterStatus,
                  days: filterDays.join(","),
                }}
              />
            )}
            {can("group:create") && (
              <Button onClick={openCreate} className="gap-1.5">
                <HiPlus className="text-base" />
                {t("group.create")}
              </Button>
            )}
          </>
        }
      >
        {showCenterFilter && (
          <Select
            placeholder={t("group.center")}
            variant="white"
            value={filterCenter}
            onChange={(v) => {
              setPage(1);
              setFilterCenter(v);
            }}
            options={[
              { value: "", label: t("common.all") },
              ...centers.map((c) => ({ value: c._id, label: c.name })),
            ]}
          />
        )}
        <Select
          placeholder={t("group.teacher")}
          variant="white"
          value={filterTeacher}
          onChange={(v) => {
            setPage(1);
            setFilterTeacher(v);
          }}
          options={[
            { value: "", label: t("common.all") },
            ...teachers.map((s) => ({ value: s._id, label: s.name })),
          ]}
        />
        <Select
          placeholder={t("group.status")}
          variant="white"
          value={filterStatus}
          onChange={(v) => {
            setPage(1);
            setFilterStatus(v);
          }}
          options={[
            { value: "", label: t("common.all") },
            { value: "pending", label: t("group.statusPending") },
            { value: "active", label: t("group.statusActive") },
            { value: "finished", label: t("group.statusFinished") },
          ]}
        />
        <DayPicker
          value={filterDays}
          onChange={(days) => {
            setPage(1);
            setFilterDays(days);
          }}
        />
      </FilterBar>

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
          <HiUserGroup className="text-4xl" />
          <p className="text-sm">{t("group.loadError")}</p>
          <Button variant="outlined" onClick={fetchGroups}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <List
          view="grid"
          rows={sortedRows}
          /* Kartalar o'zlari "karta" ko'rinishida — yana bir oq/chegarali
             konteynerga solish qatlamni takrorlagan bo'lardi (/rooms bilan bir xil). */
          className="!bg-transparent !border-0"
          gridClassName="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-stretch"
          renderItem={(row) => (
            <GroupCard
              group={row}
              label={groupLabel(row)}
              centerName={centerMap[row.center]}
              teacherName={teacherMap[row.teacher]}
              roomName={row.roomName || roomMap[row.room]}
              live={liveMap[row._id] || { state: GROUP_STATE.ACTIVE, current: null, next: null }}
              onClick={() => navigate(`/groups/${row._id}`)}
            />
          )}
          loading={loading}
          empty={t("group.empty")}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
        />
      )}

      <GroupDialog
        key={dialogKey}
        open={dialogOpen}
        centers={centers}
        subjects={subjects}
        teachers={teachers}
        assistants={assistants}
        rooms={rooms}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchGroups}
      />
    </div>
  );
}

export default Groups;
