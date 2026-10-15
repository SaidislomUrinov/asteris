import { useCallback, useEffect, useMemo, useState } from "react";
import usePrerequisite from "../../hooks/usePrerequisite";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiArchiveBox, HiHome, HiMagnifyingGlass, HiPencil, HiPlus } from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import List from "../../ui/List";
import Select from "../../ui/Select";
import DropMenu from "../../ui/DropMenu";
import RoomDialog from "./RoomDialog";
import RoomCard from "./RoomCard";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { getTashkentNow } from "../../utils/schedule";
import { ROOM_STATE, STATE_ORDER, buildRoomLive } from "./roomLive";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import useQueryState from "../../hooks/useQueryState";

function Rooms() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  // Filtr/qidiruv/sahifa URL query-param'da (useQueryState) — Detail'ga kirib
  // "Orqaga" bilan qaytilganda list qayta mount bo'lsa ham joyida qoladi.
  const [page, setPage] = useQueryState("page", 1);
  const [search, setSearch] = useQueryState("search", "");
  const [filterCenter, setFilterCenter] = useQueryState("filterCenter", "");
  const [loading, setLoading] = useState(true);
  const requireFirst = usePrerequisite();
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
    const t = setTimeout(fetchRooms, 0);
    return () => clearTimeout(t);
  }, [fetchRooms]);

  useEffect(() => {
    const t = setTimeout(fetchCenters, 0);
    return () => clearTimeout(t);
  }, [fetchCenters]);

  useEffect(() => {
    const t = setTimeout(fetchActivity, 0);
    return () => clearTimeout(t);
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

  const openCreate = () => {
    if (centers.length === 0) return requireFirst("center");
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-sm dark:shadow-none shadow-slate-900/[0.02]">
        {/* Filtrlar bo'sh joyni to'ldiradi, amallar (Excel / Xona qo'shish)
            o'ng chekkaga tiraladi — /groups va /staff bilan bir xil naqsh.
            Avval sobit `sm:w-[30%]` / `sm:w-1/5` bo'lgani uchun Excel tugmasi
            keraksiz keng chiqib, o'ngda bo'sh joy qolardi. */}
        <div className={`w-full ${showCenterFilter ? "sm:flex-1 sm:min-w-[200px]" : "sm:flex-1"}`}>
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
        </div>

        <div className="flex gap-2.5 sm:contents">
          {showCenterFilter && (
            <div className="flex-1 min-w-0 sm:flex-1 sm:min-w-[200px]">
              <Select
                placeholder={t("room.center")}
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
            </div>
          )}

          <div className="flex-1 sm:flex-none sm:shrink-0 sm:ml-auto">
            <ExportExcelButton
              endpoint="/rooms/export"
              params={{ search, center: filterCenter }}
              className="w-full sm:w-auto"
            />
          </div>
        </div>

        <Button onClick={openCreate} className="gap-1.5 w-full sm:w-auto sm:shrink-0">
          <HiPlus className="text-base" />
          {t("room.create")}
        </Button>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
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
                      iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                      onClick: () => openEdit(row),
                    },
                    // "O'chirish" endi ARXIVLASH — xona yo'qolmaydi,
                    // Arxiv bo'limidan qaytariladi (API_CONTRACT_archive.md).
                    {
                      label: t("archive.archive"),
                      icon: HiArchiveBox,
                      iconClass: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
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
        title={t("archive.archiveTitle")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={deleting} onClick={confirmDelete}>
              {t("archive.archive")}
            </Button>
          </>
        }
      >
        <p>{t("archive.archiveRoomConfirm", { name: deleteTarget?.name })}</p>
      </Dialog>
    </div>
  );
}

export default Rooms;
