import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiMagnifyingGlass, HiPlus, HiUserGroup, HiXMark } from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import useMediaQuery from "../../hooks/useMediaQuery";
import DayPicker from "../../ui/DayPicker";
import GroupDialog from "./GroupDialog";
import GroupTelegramDialog from "./GroupTelegramDialog";
import useClosingValue from "../../hooks/useClosingValue";
import GroupCard from "./GroupCard";
import ExportExcelButton from "../../ui/ExportExcelButton";
import useCan from "../../hooks/useCan";
import { useSelector } from "react-redux";
import { getTashkentNow } from "../../utils/schedule";
import { GROUP_STATE, STATE_ORDER, buildGroupLive } from "./groupLive";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useQueryState from "../../hooks/useQueryState";

function Groups() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const navigate = useNavigate();
  // Guruh yaratish odatda Resepshin/Boshliq ishi, lekin O'qituvchi/Yordamchiga
  // ham `group:create` ruxsati alohida berilishi mumkin — tugma shunga qarab
  // ko'rinadi (`can("group:create")`).
  const can = useCan();
  // Excel eksporti o'quvchilar narxi/to'lovi bilan keladi — o'qituvchi
  // moliyaviy ma'lumot ko'rmaydi (backendda ham `blockTeacher`).
  const { authType, role } = useSelector((e) => e.user);
  const isTeacher = authType === "staff" && ["teacher", "assistant"].includes(role);
  // Telegram guruh manzili — `PATCH /groups/:id/telegram` bilan bir xil doira:
  // Boshliq, o'z guruhidagi O'qituvchi, `group:update` ruxsatli hodim.
  // Yordamchi o'qituvchi hech qachon.
  const canEditTelegram =
    authType === "owner" || role === "teacher" || (role !== "assistant" && can("group:update"));
  const [telegramTarget, setTelegramTarget] = useState(null);
  const telegramView = useClosingValue(telegramTarget);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  // Filtr/qidiruv/sahifa URL query-param'da (useQueryState) — Detail'ga kirib
  // "Orqaga" bilan qaytilganda list qayta mount bo'lsa ham joyida qoladi.
  const [page, setPage] = useQueryState("page", 1);
  const [search, setSearch] = useQueryState("search", "");
  const [filterCenter, setFilterCenter] = useQueryState("filterCenter", "");
  const [filterTeacher, setFilterTeacher] = useQueryState("filterTeacher", "");
  const [filterStatus, setFilterStatus] = useQueryState("filterStatus", "");
  const [filterDays, setFilterDays] = useQueryState("filterDays", []);
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
    // `allSettled` — har biri mustaqil so'rov: bittasi xato bersa qolganlari
    // bo'sh qolib ketmasligi kerak (avval `Promise.all` edi va bitta 403
    // hammasini yiqitardi).
    //
    // Xonalar `/rooms` EMAS, `/rooms/lookup` dan olinadi: `room:view` ruxsati
    // O'qituvchi/Yordamchiga printsipial berilmaydi, shu sabab `/rooms` ularga
    // 403 qaytarardi va guruhni faollashtirishda xonalar ro'yxati bo'sh
    // chiqardi. `lookup` — ruxsatsiz, faqat tanlov uchun nom/filial ro'yxati.
    const [centersRes, subjectsRes, staffRes, assistantRes, roomsRes] = await Promise.allSettled([
      api.get("/centers", { params: { page: 1 } }),
      api.get("/subjects", { params: { page: 1 } }),
      api.get("/staffs/lookup", { params: { role: "teacher" } }),
      api.get("/staffs/lookup", { params: { role: "assistant" } }),
      api.get("/rooms/lookup"),
    ]);
    if (centersRes.status === "fulfilled" && centersRes.value.data.ok)
      setCenters(centersRes.value.data.data || []);
    if (subjectsRes.status === "fulfilled" && subjectsRes.value.data.ok)
      setSubjects(subjectsRes.value.data.data || []);
    if (staffRes.status === "fulfilled" && staffRes.value.data.ok)
      setTeachers(staffRes.value.data.data || []);
    if (assistantRes.status === "fulfilled" && assistantRes.value.data.ok)
      setAssistants(assistantRes.value.data.data || []);
    if (roomsRes.status === "fulfilled" && roomsRes.value.data.ok)
      setRooms(roomsRes.value.data.data || []);
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchGroups, 0);
    return () => clearTimeout(t);
  }, [fetchGroups]);

  useEffect(() => {
    const t = setTimeout(fetchLookups, 0);
    return () => clearTimeout(t);
  }, [fetchLookups]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(getTashkentNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Boshqa joydan (/schedule, xona detali, GroupScheduleDialog) guruh jadvali
  // o'zgartirilsa — ro'yxatdagi kun/vaqt/holat belgilari refresh'siz eskirib
  // qolmasin deb to'liq qayta yuklanadi.
  // Telegram havolasi — payload'da qiymatning o'zi bor, joyida yangilanadi.
  useSocketEvent("group:changed", (payload) => {
    if (payload?.action === "telegram") {
      setRows((prev) =>
        prev.map((r) => (r._id === payload.groupId ? { ...r, telegramLink: payload.telegramLink ?? null } : r)),
      );
      return;
    }
    fetchGroups();
  });

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
      {isDesktop ? (
        <div className={`flex flex-col gap-2.5 p-3 rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]`}>
          {/* Filtr qatori konvensiyasi: maydonlar flex-1 (tor ekranda yangi
              qatorga o'tadi), amallar bitta guruhda ml-auto bilan o'ngda. */}
          <div className="flex flex-wrap items-center gap-2.5 [&>*]:flex-1 [&>*]:min-w-[200px]">
            <Input
              placeholder={t("common.search")}
              icon={<HiMagnifyingGlass />}
              variant="slate"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
            {showCenterFilter && (
              <Select
                placeholder={t("group.center")}
                variant="slate"
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
            {!isTeacher && (
              <Select
                placeholder={t("group.teacher")}
                variant="slate"
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
            )}
            <Select
              placeholder={t("group.status")}
              variant="slate"
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
            <div className="flex items-center gap-2 !flex-none !min-w-0 ml-auto">
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
            </div>
          </div>
          {/* 2-qator: hafta kunlari doim ko'rinib turadi (chapda), "Tozalash"
              o'ngda — tanlangan filtr bo'lmasa o'chirilgan holatda. */}
          <div className="flex items-end gap-2.5 pt-2.5 border-t border-slate-100">
            <div className="w-full max-w-md">
              <DayPicker
                placeholder={t("group.days")}
                value={filterDays}
                onChange={(days) => {
                  setPage(1);
                  setFilterDays(days);
                }}
              />
            </div>
            <div className="shrink-0">
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
            </div>
          </div>
        </div>
      ) : (
        <FilterBar
          cols={showCenterFilter ? 4 : 3}
          activeCount={activeFilterCount}
          onReset={resetFilters}
          search={
            <Input
              placeholder={t("common.search")}
              icon={<HiMagnifyingGlass />}
              variant="slate"
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
              variant="slate"
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
          {!isTeacher && (
            <Select
              placeholder={t("group.teacher")}
              variant="slate"
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
          )}
          <Select
            placeholder={t("group.status")}
            variant="slate"
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
          <div className={showCenterFilter ? "sm:col-span-4" : "sm:col-span-3"}>
            <DayPicker
              placeholder={t("group.days")}
              value={filterDays}
              onChange={(days) => {
                setPage(1);
                setFilterDays(days);
              }}
            />
          </div>
        </FilterBar>
      )}

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
              canEditTelegram={canEditTelegram}
              onTelegramEdit={() => setTelegramTarget(row)}
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

      {telegramView && (
        <GroupTelegramDialog
          key={telegramView._id}
          open={!!telegramTarget}
          group={telegramView}
          label={groupLabel(telegramView)}
          onClose={() => setTelegramTarget(null)}
          onSaved={(data) =>
            setRows((prev) =>
              prev.map((r) => (r._id === data?._id ? { ...r, telegramLink: data.telegramLink } : r)),
            )
          }
        />
      )}
    </div>
  );
}

export default Groups;
