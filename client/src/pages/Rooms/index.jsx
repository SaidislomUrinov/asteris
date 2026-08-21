import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  HiBolt,
  HiCheckCircle,
  HiClock,
  HiHome,
  HiMagnifyingGlass,
  HiPencil,
  HiPlus,
  HiTrash,
} from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import DropMenu from "../../ui/DropMenu";
import RoomDialog from "./RoomDialog";
import RoomCard from "./RoomCard";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { getTashkentNow } from "../../utils/schedule";
import { ROOM_STATE, STATE_ORDER, buildRoomLive } from "./roomLive";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

// Yuqoridagi ixcham statistika kartasi.
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

function Rooms() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCenter, setFilterCenter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  // Hodim (Staff) bitta filialga biriktirilgan — backend `/centers`ni ham
  // o'sha bitta filial bilan cheklaydi, demak tanlov qolmaydi.
  const showCenterFilter = centers.length > 1;
  const centerMap = Object.fromEntries(centers.map((c) => [c._id, c.name]));

  const [activeGroups, setActiveGroups] = useState([]);
  // Guruh DTO'si fan/o'qituvchini faqat ObjectId sifatida qaytaradi —
  // kartada NOM ko'rsatish uchun mavjud lookup endpointlari ishlatiladi.
  const [subjectMap, setSubjectMap] = useState({});
  const [teacherMap, setTeacherMap] = useState({});
  // Progress bar va "qolgan vaqt" jonli bo'lishi uchun daqiqa sayin tiklanadi.
  const [nowTick, setNowTick] = useState(() => getTashkentNow());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/rooms", {
        params: { page, search, center: filterCenter },
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
  }, [page, search, filterCenter]);

  const fetchCenters = useCallback(async () => {
    try {
      const res = await api.get("/centers", { params: { page: 1 } });
      const { ok, data } = res.data;
      if (ok) setCenters(data || []);
    } catch {
      // markazlar ro'yxati faqat lookup uchun, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  // Qaysi xonada hozir/keyin dars borligini bilish uchun faol guruhlar
  // ro'yxati (kun/vaqt/xona shu javobda bor) + nomlar uchun lookuplar.
  // Yangi endpoint qo'shilmadi — hammasi mavjud API'lar.
  const fetchActivity = useCallback(async () => {
    try {
      const [groupsRes, subjectsRes, staffRes] = await Promise.all([
        api.get("/groups", { params: { page: 1, status: "active" } }),
        api.get("/subjects", { params: { page: 1 } }),
        api.get("/staffs/lookup", { params: { role: "teacher" } }),
      ]);
      if (groupsRes.data.ok) setActiveGroups(groupsRes.data.data || []);
      if (subjectsRes.data.ok)
        setSubjectMap(Object.fromEntries((subjectsRes.data.data || []).map((s) => [s._id, s.name])));
      if (staffRes.data.ok)
        setTeacherMap(Object.fromEntries((staffRes.data.data || []).map((s) => [s._id, s.name])));
    } catch {
      // faqat vizual urg'u uchun, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Har daqiqada "hozir"ni yangilaymiz — progress bar va qolgan vaqt jonli
  // yuradi. Interval callback'i render paytida emas, shuning uchun
  // `react-hooks/set-state-in-effect` qoidasiga tegmaydi.
  useEffect(() => {
    const id = setInterval(() => setNowTick(getTashkentNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Har xona uchun jonli holat — hozirgi dars, keyingi dars, progress.
  const liveMap = useMemo(() => {
    const labelOf = (g) => subjectMap[g.subject] || "—";
    const teacherOf = (g) => teacherMap[g.teacher] || "";
    const byRoom = {};
    for (const g of activeGroups) {
      if (!g.room) continue;
      (byRoom[g.room] ||= []).push(g);
    }
    return Object.fromEntries(
      rows.map((r) => [r._id, buildRoomLive(r, byRoom[r._id] || [], nowTick, labelOf, teacherOf)]),
    );
  }, [rows, activeGroups, subjectMap, teacherMap, nowTick]);

  // Jonli faoliyat birinchi: dars ketayotgan xonalar → yaqin orada → bo'sh →
  // nofaol (Array#sort ES2019+ stabil, ichki tartib o'zgarmaydi).
  const sortedRows = [...rows].sort(
    (a, b) =>
      (STATE_ORDER[liveMap[a._id]?.state] ?? 9) - (STATE_ORDER[liveMap[b._id]?.state] ?? 9),
  );

  const stats = useMemo(() => {
    const list = rows.map((r) => liveMap[r._id]?.state);
    return {
      total: meta.total || rows.length,
      active: list.filter((s) => s === ROOM_STATE.ACTIVE).length,
      available: list.filter((s) => s === ROOM_STATE.AVAILABLE).length,
      upcoming: list.filter((s) => s === ROOM_STATE.UPCOMING).length,
    };
  }, [rows, liveMap, meta.total]);

  const openCreate = () => {
    if (centers.length === 0) {
      errorMsg("staff.noCentersYet");
      return;
    }
    setSelected(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const openEdit = (room) => {
    setSelected(room);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await api.delete(`/rooms/${deleteTarget._id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setDeleteTarget(null);
      fetchRooms();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<HiHome />}
          value={stats.total}
          label={t("room.statTotal")}
          tone="bg-slate-100 text-slate-500"
        />
        <StatCard
          icon={<HiBolt />}
          value={stats.active}
          label={t("room.statActive")}
          tone="bg-blue-50 text-blue-600"
        />
        <StatCard
          icon={<HiCheckCircle />}
          value={stats.available}
          label={t("room.statAvailable")}
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={<HiClock />}
          value={stats.upcoming}
          label={t("room.statUpcoming")}
          tone="bg-amber-50 text-amber-600"
        />
      </div>

      <FilterBar
        cols={3}
        activeCount={filterCenter ? 1 : 0}
        onReset={() => {
          setPage(1);
          setFilterCenter("");
        }}
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
            <ExportExcelButton endpoint="/rooms/export" params={{ search, center: filterCenter }} />
            <Button onClick={openCreate} className="gap-1.5">
              <HiPlus className="text-base" />
              {t("room.create")}
            </Button>
          </>
        }
      >
        {showCenterFilter && (
          <Select
            placeholder={t("room.center")}
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
      </FilterBar>

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
          <HiHome className="text-4xl" />
          <p className="text-sm">{t("room.loadError")}</p>
          <Button variant="outlined" onClick={fetchRooms}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <List
          view="grid"
          rows={sortedRows}
          /* Kartalar o'zlari yetarlicha "karta" ko'rinishida — ularni yana bir
             oq/chegarali konteynerga solish qatlamni takrorlagan bo'lardi. */
          className="!bg-transparent !border-0"
          gridClassName="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-stretch"
          renderItem={(row) => (
            <div className="relative h-full">
              <RoomCard
                room={row}
                centerName={centerMap[row.center]}
                groupsCount={row.groupsCount}
                studentsCount={row.studentsCount}
                live={liveMap[row._id] || { state: ROOM_STATE.AVAILABLE, current: null, next: null }}
                onClick={() => navigate(`/rooms/${row._id}`)}
              />
              <div onClick={(e) => e.stopPropagation()} className="absolute top-4 right-4">
                <DropMenu
                  items={[
                    {
                      label: t("common.edit"),
                      icon: HiPencil,
                      iconClass: "bg-blue-50 text-blue-600",
                      onClick: () => openEdit(row),
                    },
                    {
                      label: t("common.delete"),
                      icon: HiTrash,
                      iconClass: "bg-red-50 text-red-600",
                      onClick: () => setDeleteTarget(row),
                    },
                  ]}
                />
              </div>
            </div>
          )}
          loading={loading}
          empty={t("room.empty")}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
        />
      )}

      <RoomDialog
        key={dialogKey}
        open={dialogOpen}
        room={selected}
        centers={centers}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchRooms}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("room.delete")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={deleting} onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p>{t("room.deleteConfirm", { name: deleteTarget?.name })}</p>
      </Dialog>
    </div>
  );
}

export default Rooms;
