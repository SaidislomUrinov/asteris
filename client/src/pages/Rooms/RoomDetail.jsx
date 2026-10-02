import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  HiArrowLeft,
  HiBuildingOffice2,
  HiHome,
  HiPencilSquare,
  HiPlus,
  HiUserGroup,
  HiUsers,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Chip from "../../ui/Chip";
import InfoCard, { InfoMeta } from "../../ui/InfoCard";
import MetricCard from "../../ui/MetricCard";
import Loading from "../../ui/Loading";
import GroupDialog from "../Groups/GroupDialog";
import WeeklyRoomSchedule from "./WeeklyRoomSchedule";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import useCan from "../../hooks/useCan";
import { useSocketEvent } from "../../hooks/useSocketEvent";

function RoomDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const centerMap = Object.fromEntries(centers.map((c) => [c._id, c.name]));

  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  // Hozir saqlanayotgan guruhlar — blok kutish holatida ko'rinadi va
  // saqlanguncha qayta surilmaydi.
  const [savingIds, setSavingIds] = useState([]);

  const can = useCan();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      setNotFound(false);
      const res = await api.get(`/rooms/${id}/schedule`);
      const { ok, data, msg } = res.data;
      if (!ok) {
        if (msg === "room.notFound") setNotFound(true);
        throw new Error(msg);
      }
      setData(data);
    } catch (error) {
      if (!notFound) setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const t = setTimeout(fetchData, 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  useEffect(() => {
    (async () => {
      try {
        const [centersRes, subjectsRes, staffRes, roomsRes] = await Promise.all([
          api.get("/centers", { params: { page: 1 } }),
          api.get("/subjects", { params: { page: 1 } }),
          api.get("/staffs/lookup", { params: { role: "teacher" } }),
          api.get("/rooms", { params: { page: 1 } }),
        ]);
        if (centersRes.data.ok) setCenters(centersRes.data.data || []);
        if (subjectsRes.data.ok) setSubjects(subjectsRes.data.data || []);
        if (staffRes.data.ok) setTeachers(staffRes.data.data || []);
        if (roomsRes.data.ok) setRooms(roomsRes.data.data || []);
      } catch {
        // lookup ro'yxatlari, xato bo'lsa jim o'tkazamiz
      }
    })();
  }, []);

  // Blok surildi yoki cho'zildi — darhol saqlanadi (qoralama yo'q).
  // Optimistik: UI zudlik bilan yangilanadi, server rad etsa eski holat
  // qaytariladi. Konflikt xabari GroupScheduleDialog bilan bir xil formatda.
  const handleGroupMove = useCallback(
    async (group, next) => {
      const id = String(group._id);
      const prev = {
        days: group.days,
        startTime: group.startTime,
        endTime: group.endTime,
      };

      setSavingIds((list) => [...list, id]);
      setData((d) =>
        d
          ? {
              ...d,
              groups: d.groups.map((g) => (String(g._id) === id ? { ...g, ...next } : g)),
            }
          : d,
      );

      const rollback = () =>
        setData((d) =>
          d
            ? {
                ...d,
                groups: d.groups.map((g) => (String(g._id) === id ? { ...g, ...prev } : g)),
              }
            : d,
        );

      try {
        const res = await api.patch(`/groups/${id}/schedule`, next);
        const { ok, msg, conflict } = res.data;
        if (!ok) {
          rollback();
          if (conflict) {
            return errorMsg(msg, {
              room: conflict.room,
              day: t(`group.day.${conflict.day}`),
              start: conflict.startTime,
              end: conflict.endTime,
              label: conflict.label,
            });
          }
          return errorMsg(msg);
        }
        successMsg(msg);
      } catch (error) {
        rollback();
        errorMsg(error.message);
      } finally {
        setSavingIds((list) => list.filter((x) => x !== id));
      }
    },
    [t],
  );

  // Jadvalni surish `group:changed` eventini chiqaradi (group.service.js
  // #reschedule) — boshqa foydalanuvchi surganini refresh'siz ko'ramiz.
  useSocketEvent("group:changed", (payload) => {
    if ((data?.groups || []).some((g) => String(g._id) === String(payload?.groupId))) fetchData();
  });

  if (loading) return <Loading height="40vh" />;

  if (notFound || error) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
        <HiHome className="text-4xl" />
        <p className="text-sm">{t("room.notFound")}</p>
        <Button variant="outlined" onClick={() => navigate("/rooms")}>
          {t("room.backToList")}
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { room, groupsCount, studentsCount, groups } = data;

  // Jadvalni joyida tahrirlash `group:update` ruxsatini talab qiladi — backend
  // ham (`requireGroupScheduleAccess`) shu ruxsatni tekshiradi. Ruxsat yo'q
  // bo'lsa bloklar faqat bosiladi (guruh detailiga o'tadi), surilmaydi.
  const canEditSchedule = can("group:update");

  // Pending guruh yaratilganda kun/vaqt ixtiyoriy (GroupDialog.jsx) —
  // shu maydonlar hali to'ldirilmagan bo'lsa haftalik jadvalning HECH bir
  // kun ustuniga tushmaydi va butunlay ko'rinmay qolar edi. Shu turdagi
  // guruhlar alohida "jadval belgilanmagan" bo'limida ko'rsatiladi.
  const unscheduledGroups = groups.filter(
    (g) => !g.days?.length || !g.startTime || !g.endTime,
  );

  return (
    <div className="flex flex-col w-full h-full min-h-0 gap-4">
      <div className="flex items-center justify-between gap-3">
        <IconButton variant="ghost" color="black" onClick={() => navigate(-1)}>
          <HiArrowLeft />
        </IconButton>
        <div className="flex items-center gap-2">
          <ExportExcelButton endpoint={`/rooms/${id}/export`} />
          <Button
            className="gap-1.5"
            onClick={() => {
              setCreateKey((k) => k + 1);
              setCreateOpen(true);
            }}
          >
            <HiPlus className="text-base" />
            {t("group.create")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoCard
          icon={<HiHome />}
          title={room.name}
          accent="blue"
          badge={
            <Chip
              value={room.status === "inactive" ? t("room.statusInactive") : t("room.statusActive")}
              color={room.status === "inactive" ? "slate" : "emerald"}
              variant="filled"
            />
          }
          subtitle={centerMap[room.center] || "—"}
        >
          {room.capacity != null && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-slate-100">
              <InfoMeta icon={<HiUsers />}>
                {t("room.capacity")}: {room.capacity}
              </InfoMeta>
            </div>
          )}
        </InfoCard>

        <MetricCard
          icon={<HiUserGroup />}
          title={t("room.groupsCount")}
          value={groupsCount}
          accent="indigo"
        />

        <MetricCard
          icon={<HiUsers />}
          title={t("room.studentsCount")}
          value={studentsCount}
          accent="emerald"
        />
      </div>

      {unscheduledGroups.length > 0 && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold text-slate-800">{t("room.unscheduledTitle")}</p>
            <p className="text-xs text-slate-400">{t("room.unscheduledHint")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unscheduledGroups.map((g) => (
              <div
                key={g._id}
                onClick={() => navigate(`/groups/${g._id}`)}
                className="relative overflow-hidden flex flex-col gap-1 px-4 py-3 pl-5 rounded-xl bg-white border border-slate-200/80 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
              >
                <span className="absolute inset-y-0 left-0 w-1 bg-orange-400" />
                <span className="text-base font-bold text-slate-900 truncate">{g.label}</span>
                <span className="text-sm text-slate-500">
                  {g.teacher || t("group.noTeacher")} · {g.studentsCount}{" "}
                  {t("nav.students").toLowerCase()}
                </span>
                <span className="text-xs text-orange-600 font-medium">
                  {t("room.unscheduledBadge")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0 gap-3 p-4 rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="font-semibold text-slate-800">{t("room.weeklyScheduleTitle")}</p>
            <p className="text-xs text-slate-400">
              {t(canEditSchedule ? "room.weeklyScheduleHintEditable" : "room.weeklyScheduleHint")}
            </p>
          </div>
          {/* Bloklarni shu yerning o'zida surish/cho'zish mumkin (darhol
              saqlanadi). "Jadval" ish maydoni esa OMMAVIY qayta tartiblash
              uchun qoladi — u yerda qoralama, undo va xonalar aro ko'chirish
              bor. Shu xona oldindan tanlangan holda o'sha yerga o'tkazadi. */}
          <Button
            variant="outlined"
            color="blue"
            className="gap-1.5 shrink-0"
            onClick={() => navigate(`/schedule?roomId=${room._id}`)}
          >
            <HiPencilSquare className="text-base" />
            {t("room.editSchedule")}
          </Button>
        </div>

        <WeeklyRoomSchedule
          groups={groups}
          onGroupClick={(g) => navigate(`/groups/${g._id}`)}
          editable={canEditSchedule}
          onGroupMove={canEditSchedule ? handleGroupMove : undefined}
          savingIds={savingIds}
          fill
        />
      </div>

      <GroupDialog
        key={createKey}
        open={createOpen}
        centers={centers}
        subjects={subjects}
        teachers={teachers}
        rooms={rooms}
        fixedRoom={room}
        onClose={() => setCreateOpen(false)}
        onSaved={fetchData}
      />
    </div>
  );
}

export default RoomDetail;
