import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  HiArchiveBox,
  HiArrowUturnLeft,
  HiBanknotes,
  HiMagnifyingGlass,
} from "react-icons/hi2";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import MetricCard from "../../ui/MetricCard";
import GroupScheduleDialog from "../Groups/GroupScheduleDialog";
import useCan from "../../hooks/useCan";
import useFeature from "../../hooks/useFeature";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useClosingValue from "../../hooks/useClosingValue";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import StaffPhone from "../../components/staff/StaffPhone";

// Arxiv — API_CONTRACT_archive.md §7. Arxivlangan Guruh / O'quvchi a'zoligi /
// Hodim / Xona / Fan bitta sahifada, tab'lar bo'yicha. Har tab bitta
// endpointdan o'qiydi va bitta `restore` chaqiruvi bilan qaytaradi, shuning
// uchun tab'ga xos farq faqat KONFIGURATSIYA (ustunlar, yo'l, matn) —
// takroriy sahifa komponentlari yozilmaydi.

const money = (value) => `${Number(value || 0).toLocaleString("uz-UZ")}`;

function Archive() {
  const { t } = useTranslation();
  const can = useCan();
  const { authType } = useSelector((e) => e.user);
  const isOwner = authType === "owner";
  const canRestore = can("archive:restore");
  const hasFeature = useFeature();
  // O'qituvchilarning "Dars rejalarim" shablonlari — tarifda dars rejalash
  // bo'lmasa bu tab ma'nosiz (rejalar umuman yaratilmaydi).
  const showPlans = hasFeature("lesson.planning");

  // Hodim arxivi — faqat Boshliq (backendda ham `requireOwner`).
  const TABS = useMemo(
    () =>
      [
        { key: "groups", path: "/archive/groups", labelKey: "archive.tabGroups", emptyKey: "archive.emptyGroups" },
        { key: "students", path: "/archive/students", labelKey: "archive.tabStudents", emptyKey: "archive.emptyStudents" },
        isOwner && { key: "staff", path: "/archive/staff", labelKey: "archive.tabStaff", emptyKey: "archive.emptyStaff" },
        { key: "rooms", path: "/archive/rooms", labelKey: "archive.tabRooms", emptyKey: "archive.emptyRooms" },
        { key: "subjects", path: "/archive/subjects", labelKey: "archive.tabSubjects", emptyKey: "archive.emptySubjects" },
        showPlans && {
          key: "teachingPlans",
          path: "/archive/teaching-plans",
          labelKey: "archive.tabTeachingPlans",
          emptyKey: "archive.emptyTeachingPlans",
        },
      ].filter(Boolean),
    [isOwner, showPlans],
  );

  const [tab, setTab] = useState("groups");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [counts, setCounts] = useState({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCenter, setFilterCenter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  // Hodim bitta filialga biriktirilgan — backend baribir o'sha filial bilan
  // cheklaydi, demak tanlov ko'rsatishning ma'nosi yo'q.
  const showCenterFilter = centers.length > 1;

  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Guruh qaytarilganda eski xona/kun/vaqti band chiqsa (arxivda turgan
  // paytda o'sha slot boshqasiga berilgan bo'lishi mumkin) — shu guruh uchun
  // GroupScheduleDialog ochilib, yangi vaqt tanlashi so'raladi
  // (GroupDialog/Schedule sahifasidagi bilan bir xil komponent, qayta
  // yozilmadi). Lookup ro'yxatlari faqat shu holat yuzaga kelganda,
  // birinchi safar kerak bo'lganda yuklanadi.
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const scheduleTargetView = useClosingValue(scheduleTarget);
  const [scheduleLookups, setScheduleLookups] = useState(null);

  const ensureScheduleLookups = useCallback(async () => {
    if (scheduleLookups) return scheduleLookups;
    const [teachersRes, assistantsRes, roomsRes] = await Promise.allSettled([
      api.get("/staffs/lookup", { params: { role: "teacher" } }),
      api.get("/staffs/lookup", { params: { role: "assistant" } }),
      // Tanlov uchun ruxsatsiz ro'yxat (`room:view` resepshinga berilmaydi).
      api.get("/rooms/lookup"),
    ]);
    const next = {
      teachers: teachersRes.status === "fulfilled" && teachersRes.value.data.ok ? teachersRes.value.data.data || [] : [],
      assistants: assistantsRes.status === "fulfilled" && assistantsRes.value.data.ok ? assistantsRes.value.data.data || [] : [],
      rooms: roomsRes.status === "fulfilled" && roomsRes.value.data.ok ? roomsRes.value.data.data || [] : [],
    };
    setScheduleLookups(next);
    return next;
  }, [scheduleLookups]);

  const activeTab = TABS.find((x) => x.key === tab) || TABS[0];

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get(activeTab.path, {
        params: { page, search, center: filterCenter },
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
  }, [activeTab.path, page, search, filterCenter]);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await api.get("/archive/counts", { params: { center: filterCenter } });
      const { ok, data } = res.data;
      if (ok) setCounts(data || {});
    } catch {
      // sanoqlar yordamchi ma'lumot — xato bo'lsa jim o'tkazamiz
    }
  }, [filterCenter]);

  const fetchCenters = useCallback(async () => {
    try {
      const res = await api.get("/centers", { params: { page: 1 } });
      const { ok, data } = res.data;
      if (ok) setCenters(data || []);
    } catch {
      // faqat lookup uchun
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchRows, 0);
    return () => clearTimeout(t);
  }, [fetchRows]);

  useEffect(() => {
    const t = setTimeout(fetchCounts, 0);
    return () => clearTimeout(t);
  }, [fetchCounts]);

  useEffect(() => {
    const t = setTimeout(fetchCenters, 0);
    return () => clearTimeout(t);
  }, [fetchCenters]);

  // Boshqa foydalanuvchi arxivlasa/qaytarsa sahifa refresh'siz yangilanadi.
  const onArchiveChanged = useCallback(() => {
    fetchRows();
    fetchCounts();
  }, [fetchRows, fetchCounts]);
  useSocketEvent("archive:changed", onArchiveChanged);

  const restorePath = (row) =>
    tab === "students"
      ? `/archive/students/${row.studentId}/entries/${row.entryId}/restore`
      : `${activeTab.path}/${row._id}/restore`;

  const restoreName = (row) =>
    tab === "students" ? `${row.fullName} — ${row.groupLabel}` : row.label || row.name || row.title;

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    try {
      setRestoring(true);
      const res = await api.patch(restorePath(restoreTarget));
      const { ok, msg, conflict } = res.data;
      if (!ok) {
        // Eski xona/kun/vaqti band bo'lib qolgan — xato o'rniga yangi vaqt
        // tanlash oynasi ochiladi.
        if (conflict && tab === "groups") {
          errorMsg(msg, {
            room: conflict.room,
            day: t(`group.day.${conflict.day}`),
            start: conflict.startTime,
            end: conflict.endTime,
            label: conflict.label,
          });
          setRestoreTarget(null);
          await ensureScheduleLookups();
          setScheduleTarget(restoreTarget);
          return;
        }
        throw new Error(msg);
      }
      successMsg(msg);
      setRestoreTarget(null);
      fetchRows();
      fetchCounts();
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setRestoring(false);
    }
  };

  const restoreColumn = {
    key: "actions",
    header: "",
    className: "text-right",
    render: (row) =>
      canRestore ? (
        <Button
          variant="outlined"
          className="gap-1.5 ml-auto"
          onClick={() => setRestoreTarget(row)}
        >
          <HiArrowUturnLeft className="text-base" />
          {t("archive.restore")}
        </Button>
      ) : null,
  };

  const archivedAtColumn = {
    key: "archivedDate",
    header: t("archive.archivedAt"),
    render: (row) => <span className="text-slate-500 dark:text-slate-400">{row.archivedDate || "—"}</span>,
  };

  const centerColumn = {
    key: "centerName",
    header: t("subject.center"),
    render: (row) => row.centerName || "—",
  };

  const COLUMNS = {
    groups: [
      {
        key: "label",
        header: t("archive.group"),
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{row.label}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{row.subjectName}</span>
          </div>
        ),
      },
      { key: "teacherName", header: t("group.teacher"), render: (row) => row.teacherName },
      { key: "roomName", header: t("group.room"), render: (row) => row.roomName },
      {
        key: "studentsCount",
        header: t("group.studentsCount"),
        render: (row) => row.studentsCount,
      },
      {
        key: "debt",
        header: t("student.debt"),
        render: (row) =>
          row.debt > 0 ? (
            <span className="font-semibold text-red-600 dark:text-red-400">{money(row.debt)}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">—</span>
          ),
      },
      centerColumn,
      archivedAtColumn,
      restoreColumn,
    ],
    students: [
      {
        key: "fullName",
        header: t("archive.student"),
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{row.fullName}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{row.phone}</span>
          </div>
        ),
      },
      {
        key: "groupLabel",
        header: t("archive.group"),
        render: (row) => (
          <div className="flex items-center gap-2">
            <span>{row.groupLabel}</span>
            {/* Guruh bilan birga arxivlangan a'zolikni alohida qaytarib
                bo'lmaydi — avval guruhning o'zi qaytarilishi kerak. */}
            <Chip
              value={row.archivedWithGroup ? t("archive.withGroup") : t("archive.manual")}
              color={row.archivedWithGroup ? "slate" : "orange"}
            />
          </div>
        ),
      },
      {
        key: "debt",
        header: t("student.debt"),
        render: (row) =>
          row.debt > 0 ? (
            <span className="font-semibold text-red-600 dark:text-red-400">{money(row.debt)}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">—</span>
          ),
      },
      centerColumn,
      archivedAtColumn,
      {
        ...restoreColumn,
        render: (row) =>
          canRestore && !row.groupArchived ? restoreColumn.render(row) : null,
      },
    ],
    staff: [
      {
        key: "name",
        header: t("staff.name"),
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{row.name}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              <StaffPhone phone={row.phone} />
            </span>
          </div>
        ),
      },
      { key: "role", header: t("staff.role"), render: (row) => t(`role.${row.role}`) },
      centerColumn,
      archivedAtColumn,
      restoreColumn,
    ],
    rooms: [
      {
        key: "name",
        header: t("room.name"),
        render: (row) => <span className="font-semibold text-slate-800 dark:text-slate-100">{row.name}</span>,
      },
      { key: "capacity", header: t("room.capacity"), render: (row) => row.capacity ?? "—" },
      centerColumn,
      archivedAtColumn,
      restoreColumn,
    ],
    subjects: [
      {
        key: "name",
        header: t("subject.name"),
        render: (row) => <span className="font-semibold text-slate-800 dark:text-slate-100">{row.name}</span>,
      },
      {
        key: "price",
        header: t("subject.price"),
        render: (row) => `${money(row.price)} ${t("subscription.somSuffix")}`,
      },
      centerColumn,
      archivedAtColumn,
      restoreColumn,
    ],
    teachingPlans: [
      {
        key: "title",
        header: t("archive.plan"),
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{row.title}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {row.subjectName} · {t("syllabus.importMeta", { modules: row.moduleCount, lessons: row.lessonCount })}
            </span>
          </div>
        ),
      },
      { key: "teacherName", header: t("group.teacher"), render: (row) => row.teacherName },
      centerColumn,
      archivedAtColumn,
      restoreColumn,
    ],
  };

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <MetricCard
        icon={<HiBanknotes />}
        title={t("archive.totalDebt")}
        subtitle={t("archive.debtNote")}
        value={money(counts.totalDebt)}
        suffix={t("subscription.somSuffix")}
        accent="orange"
      />

      <div className="flex flex-col sm:flex-row gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-sm dark:shadow-none shadow-slate-900/[0.02]">
        <div className={`flex-1 min-w-0 ${showCenterFilter ? "sm:w-[60%]" : ""}`}>
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

        {showCenterFilter && (
          <div className="flex-1 min-w-0 sm:w-[40%]">
            <Select
              placeholder={t("subject.center")}
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
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-night-800 w-full sm:w-fit overflow-x-auto">
        {TABS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => {
              setPage(1);
              setSearch("");
              setTab(x.key);
            }}
            className={`px-3 h-8 shrink-0 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 ${
              tab === x.key
                ? "bg-white dark:bg-night-900 text-slate-900 dark:text-slate-100 shadow-sm dark:shadow-none"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t(x.labelKey)}
            {counts[x.key] > 0 && (
              <span className="ml-1.5 text-[11px] text-slate-400 dark:text-slate-500">{counts[x.key]}</span>
            )}
          </button>
        ))}
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
          <HiArchiveBox className="text-4xl" />
          <p className="text-sm">{t("archive.loadError")}</p>
          <Button variant="outlined" onClick={fetchRows}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <List
          columns={COLUMNS[tab] || []}
          rows={rows}
          rowKey={(row, index) => String(row.entryId || row._id || index)}
          loading={loading}
          empty={t(activeTab.emptyKey)}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
        />
      )}

      <Dialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        title={t("archive.restoreTitle")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setRestoreTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="emerald" loading={restoring} onClick={confirmRestore}>
              {t("archive.restore")}
            </Button>
          </>
        }
      >
        <p>
          {t("archive.restoreConfirm", {
            name: restoreTarget ? restoreName(restoreTarget) : "",
          })}
        </p>
      </Dialog>

      {scheduleTargetView && (
        <GroupScheduleDialog
          open={!!scheduleTarget}
          onClose={() => setScheduleTarget(null)}
          group={scheduleTargetView}
          currentLabel={scheduleTargetView.label}
          teachers={scheduleLookups?.teachers || []}
          assistants={scheduleLookups?.assistants || []}
          rooms={scheduleLookups?.rooms || []}
          lockAssignment
          onSubmit={async (form) => {
            const res = await api.patch(`/archive/groups/${scheduleTargetView._id}/restore`, {
              roomId: form.room,
              days: form.days,
              startTime: form.startTime,
              endTime: form.endTime,
            });
            return res.data;
          }}
          onSaved={() => {
            setScheduleTarget(null);
            fetchRows();
            fetchCounts();
          }}
        />
      )}
    </div>
  );
}

export default Archive;
