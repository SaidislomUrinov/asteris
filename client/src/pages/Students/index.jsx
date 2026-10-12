import { useCallback, useEffect, useMemo, useState } from "react";
import useQueryState from "../../hooks/useQueryState";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  HiBanknotes,
  HiEye,
  HiMagnifyingGlass,
  HiPencilSquare,
  HiPlus,
  HiUsers,
  HiXMark,
} from "react-icons/hi2";
import Avatar from "../../ui/Avatar";
import ShareChip from "../../ui/ShareChip";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import useMediaQuery from "../../hooks/useMediaQuery";
import DropMenu from "../../ui/DropMenu";
import IconButton from "../../ui/IconButton";
import Dialog from "../../ui/Dialog";
import StudentDialog from "./StudentDialog";
import StudentEditDialog from "./StudentEditDialog";
import StudentContactDialog from "./StudentContactDialog";
import TelegramStatusBadges from "../../ui/TelegramStatusBadges";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import PaymentDialog from "./PaymentDialog";
import ReceiptPromptDialog from "./ReceiptPromptDialog";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import useFeature from "../../hooks/useFeature";
import useCan from "../../hooks/useCan";
import useSendQrCard from "../../hooks/useSendQrCard";
import useHideFinance from "../../hooks/useHideFinance";
import useClosingValue from "../../hooks/useClosingValue";
import { maskMoney } from "../../utils/moneyFormat";


function Students() {
  const { t } = useTranslation();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const navigate = useNavigate();
  const hasFeature = useFeature();
  const can = useCan();
  const { menuItems: qrSendItems } = useSendQrCard();
  const [hideFinance] = useHideFinance();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  // Filtr/qidiruv/sahifa URL query-param'da (useQueryState) — Detail'ga kirib
  // "Orqaga" qaytilganda joyida qoladi, boshqa sahifadan tayyor havola bilan
  // kelish ham ishlaydi (Reception Dashboard → `/students?debtStatus=debtor`).
  const [page, setPage] = useQueryState("page", 1);
  const [search, setSearch] = useQueryState("search", "");
  const [filterCenter, setFilterCenter] = useQueryState("filterCenter", "");
  const [filterGroup, setFilterGroup] = useQueryState("filterGroup", "");
  const [filterStatus, setFilterStatus] = useQueryState("filterStatus", "");
  const [debtStatus, setDebtStatus] = useQueryState("debtStatus", "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [groups, setGroups] = useState([]);
  // Hodim (Staff) har doim BITTA filialga biriktirilgan — backend ham
  // `/centers` ro'yxatini o'sha bitta filial bilan cheklaydi. Shu sabab
  // tanlaydigan narsa qolmaydi va filtr ko'rsatilmaydi (bitta filialli
  // Client Owner uchun ham xuddi shunday).
  const showCenterFilter = centers.length > 1;
  const centerMap = Object.fromEntries(centers.map((c) => [c._id, c.name]));
  const subjectMap = Object.fromEntries(subjects.map((s) => [s._id, s.name]));

  const groupLabel = useCallback(
    (g) =>
      // Individual (yashirin 1 kishilik) guruh raqami ma'nosiz — "Fan · Individual".
      g.kind === "individual"
        ? `${subjectMap[g.subject] || "?"} · ${t("individual.label")}`
        : `${subjectMap[g.subject] || "?"} - ${g.status === "pending" ? g.pendingId : g.activeId}${
            g.status === "pending" ? ` - ${t("group.pendingSuffix")}` : ""
          }`,
    [subjectMap, t],
  );
  // Filtr dropdown'i uchun KENGAYTIRILGAN yorliq — bir xil fandan bir nechta
  // guruh bo'lganda ularni faqat raqam bilan ajratish qiyin, shuning uchun
  // dars kunlari (Du-Se-Ju) va soati (HH:MM - HH:MM) ham qo'shiladi.
  // Jadval ustuni va chek uchun qisqa `groupLabel` o'z holicha qoladi —
  // u yerda bunday uzun matn joyni buzardi.
  const groupFilterLabel = useCallback(
    (g) => {
      const days = (g.days || []).map((d) => t(`group.dayShort.${d}`)).join("-");
      const time = g.startTime && g.endTime ? `${g.startTime} - ${g.endTime}` : "";
      return [groupLabel(g), days, time].filter(Boolean).join(" · ");
    },
    [groupLabel, t],
  );
  // `groups` individual guruhlarni ham o'z ichiga oladi (`kind: "all"`) —
  // yorliqlar xaritasi uchun. Filtr/qo'shish selectlariga esa faqat oddiy guruhlar.
  const allGroupOptions = useMemo(
    () => groups.map((g) => ({ ...g, label: groupLabel(g), filterLabel: groupFilterLabel(g) })),
    [groups, groupLabel, groupFilterLabel],
  );
  const groupOptions = useMemo(
    () => allGroupOptions.filter((g) => g.kind !== "individual"),
    [allGroupOptions],
  );
  const groupActivatedAtMap = useMemo(
    () => Object.fromEntries(groups.map((g) => [g._id, g.activatedAt])),
    [groups],
  );
  const groupLabelMap = useMemo(
    () => Object.fromEntries(allGroupOptions.map((g) => [g._id, g.label])),
    [allGroupOptions],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const [entryPickerRow, setEntryPickerRow] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const payTargetView = useClosingValue(payTarget);
  const [receipt, setReceipt] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const editRowView = useClosingValue(editRow);
  // Faqat `student:contact` (lekin `student:update` emas) bo'lgan hodim uchun.
  const [contactRow, setContactRow] = useState(null);
  const contactRowView = useClosingValue(contactRow);

  // Kontakt maydonlarini (tahrirlash javobi yoki socket payload'idan)
  // ro'yxatdagi qatorga refetchsiz birlashtiradi.
  const mergeContact = useCallback((studentId, patch) => {
    if (!studentId || !patch) return;
    setRows((prev) =>
      prev.map((r) =>
        r._id !== studentId
          ? r
          : {
              ...r,
              fullName: patch.fullName ?? r.fullName,
              // Rasm o'chirilganda "" keladi — `??` bilan emas, `in` bilan.
              photo: "photo" in patch ? patch.photo : r.photo,
              phone: patch.phone ?? r.phone,
              parentPhone: patch.parentPhone ?? r.parentPhone,
              telegramSame: patch.telegramSame ?? r.telegramSame,
              telegramPhone: patch.telegramPhone ?? r.telegramPhone,
              parentTelegramSame: patch.parentTelegramSame ?? r.parentTelegramSame,
              parentTelegramPhone: patch.parentTelegramPhone ?? r.parentTelegramPhone,
              parentTelegram: patch.parentTelegram ?? r.parentTelegram,
              studentTelegram: patch.studentTelegram ?? r.studentTelegram,
            },
      ),
    );
  }, []);

  // docs/API_CONTRACT_student_contact_telegram.md §4.
  useSocketEvent("student:updated", (payload) => mergeContact(payload?.studentId, payload));
  useSocketEvent("student:telegram", (payload) => {
    if (!Array.isArray(payload?.items)) return;
    const byId = new Map(payload.items.map((it) => [String(it.studentId), it]));
    setRows((prev) =>
      prev.map((r) => {
        const it = byId.get(r._id);
        return it ? { ...r, parentTelegram: it.parentTelegram, studentTelegram: it.studentTelegram } : r;
      }),
    );
  });

  // Qidiruv ustuvor: search bo'sh bo'lmasa, boshqa BARCHA filtrlar
  // (filial/guruh/holat/qarzdorlik) so'rovga yuborilmaydi — filtr state'lari
  // saqlanadi, faqat qidiruv tugagach qayta amal qiladi.
  const isSearching = !!search.trim();

  // Mobil "Filterlash" tugmasidagi belgi uchun — nechta filtr tanlangan.
  const activeFilterCount = [debtStatus, filterCenter, filterGroup, filterStatus].filter(
    Boolean,
  ).length;

  const resetFilters = () => {
    setPage(1);
    setDebtStatus("");
    setFilterCenter("");
    setFilterGroup("");
    setFilterStatus("");
  };


  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/students", {
        params: isSearching
          ? { page, search }
          : {
              page,
              search,
              center: filterCenter,
              group: filterGroup,
              status: filterStatus,
              debtStatus,
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
  }, [page, search, isSearching, filterCenter, filterGroup, filterStatus, debtStatus]);

  const fetchLookups = useCallback(async () => {
    try {
      const [centersRes, subjectsRes, groupsRes] = await Promise.all([
        api.get("/centers", { params: { page: 1 } }),
        api.get("/subjects", { params: { page: 1 } }),
        api.get("/groups", { params: { page: 1, kind: "all" } }),
      ]);
      if (centersRes.data.ok) setCenters(centersRes.data.data || []);
      if (subjectsRes.data.ok) setSubjects(subjectsRes.data.data || []);
      if (groupsRes.data.ok) setGroups(groupsRes.data.data || []);
    } catch {
      // lookup ro'yxatlari, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchStudents, 0);
    return () => clearTimeout(t);
  }, [fetchStudents]);

  useEffect(() => {
    const t = setTimeout(fetchLookups, 0);
    return () => clearTimeout(t);
  }, [fetchLookups]);

  const openCreate = () => {
    if (groups.length === 0) {
      errorMsg("student.noGroupsYet");
      return;
    }
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const activeGroupsOf = (row) => row.groups.filter((g) => g.status === "active");
  // TO'LIQ qarzdorlik — o'tgan barcha sikllar + joriy sikl qoldig'i
  // (`g.debt`, server: computeBilling). Avval faqat joriy sikl qoldig'i
  // qo'shilardi, shu sabab o'tgan oylardan qarzi bor o'quvchi ro'yxatda
  // "Qarzi yo'q" bo'lib ko'rinardi. StudentDetail va Dashboard'dagi
  // "Umumiy qarzdorlik" ham aynan shu formulaga tayanadi.
  const totalDebtOf = (row) =>
    row.groups.filter((g) => g.status === "active").reduce((sum, g) => sum + (g.debt || 0), 0);

  const openPay = (row) => {
    const actives = activeGroupsOf(row);
    if (actives.length === 0) {
      errorMsg("student.noActiveGroups");
      return;
    }
    if (actives.length === 1) {
      setPayTarget({ student: row, entry: actives[0] });
      return;
    }
    setEntryPickerRow(row);
  };

  const pickEntry = (entry) => {
    setPayTarget({ student: entryPickerRow, entry });
    setEntryPickerRow(null);
  };

  // Individual o'quvchi belgisi tooltip'i (API_CONTRACT_individual_students.md §2, §4).
  const individualTitle = (row) =>
    t("individual.studentTooltip", { teacher: row.individualTeacher || "—" });

  const renderCard = (row) => {
    const debt = totalDebtOf(row);
    const actives = activeGroupsOf(row);
    const centerIds = [...new Set(actives.map((g) => g.center))];
    return (
      <div className="flex flex-col gap-2.5 p-3.5 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">
        <div className="flex items-start justify-between gap-2">
          <div
            className="flex flex-1 min-w-0 items-center gap-3 cursor-pointer"
            onClick={() => navigate(`/students/${row._id}`)}
          >
            <Avatar user={{ _id: row._id, name: row.fullName, avatar: row.photo }} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
                  {row.fullName}
                </p>
                {row.isIndividual && <ShareChip individual title={individualTitle(row)} />}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{row.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <IconButton
              variant="ghost"
              color="emerald"
              title={t("student.addPayment")}
              onClick={() => openPay(row)}
            >
              <HiBanknotes />
            </IconButton>
            <DropMenu
              items={[
                {
                  label: t("common.detail"),
                  icon: HiEye,
                  iconClass: "bg-slate-50 dark:bg-night-800 text-slate-600 dark:text-slate-300",
                  onClick: () => navigate(`/students/${row._id}`),
                },
                ...(can("student:update")
                  ? [
                      {
                        label: t("common.edit"),
                        icon: HiPencilSquare,
                        iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                        onClick: () => setEditRow(row),
                      },
                    ]
                  : can("student:contact")
                    ? [
                        {
                          label: t("common.edit"),
                          icon: HiPencilSquare,
                          iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                          onClick: () => setContactRow(row),
                        },
                      ]
                    : []),
                ...qrSendItems(row),
              ]}
            />
          </div>
        </div>

        <TelegramStatusBadges student={row.studentTelegram} parent={row.parentTelegram} />

        <div className="flex flex-wrap gap-1">
          {actives.length ? (
            actives.map((g) => (
              <Chip key={g._id} value={groupLabelMap[g.group] || "?"} color="slate" variant="ghost" />
            ))
          ) : (
            <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-night-700 text-sm">
          <span className="text-slate-500 dark:text-slate-400 truncate">
            {centerIds.map((id) => centerMap[id] || "—").join(", ") || "—"}
          </span>
          {debt > 0 ? (
            <span className="font-semibold text-red-600 dark:text-red-400 shrink-0">
              {maskMoney(debt, hideFinance)} {t("student.somSuffix")}
            </span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 shrink-0">{t("student.noDebt")}</span>
          )}
        </div>
      </div>
    );
  };

  const columns = [
    {
      key: "fullName",
      header: t("student.fullName"),
      render: (row) => (
        <span
          className="inline-flex items-center gap-2.5 font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
          onClick={() => navigate(`/students/${row._id}`)}
        >
          <Avatar user={{ _id: row._id, name: row.fullName, avatar: row.photo }} size={32} />
          <span className="whitespace-nowrap">{row.fullName}</span>
          {row.isIndividual && <ShareChip individual title={individualTitle(row)} />}
        </span>
      ),
    },
    {
      key: "phone",
      header: t("student.phone"),
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span>{row.phone}</span>
          <TelegramStatusBadges student={row.studentTelegram} parent={row.parentTelegram} />
        </span>
      ),
    },
    {
      key: "groups",
      header: t("student.activeGroups"),
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {activeGroupsOf(row).length ? (
            activeGroupsOf(row).map((g) => (
              <Chip key={g._id} value={groupLabelMap[g.group] || "?"} color="slate" variant="ghost" />
            ))
          ) : (
            <span className="text-slate-400 dark:text-slate-500">—</span>
          )}
        </div>
      ),
    },
    {
      key: "center",
      header: t("student.center"),
      render: (row) => {
        const ids = [...new Set(activeGroupsOf(row).map((g) => g.center))];
        return ids.map((id) => centerMap[id] || "—").join(", ") || "—";
      },
    },
    {
      key: "debt",
      header: t("student.debt"),
      render: (row) => {
        const debt = totalDebtOf(row);
        return debt > 0 ? (
          <span className="font-semibold text-red-600 dark:text-red-400">
            {maskMoney(debt, hideFinance)} {t("student.somSuffix")}
          </span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400">{t("student.noDebt")}</span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <IconButton
            variant="ghost"
            color="emerald"
            title={t("student.addPayment")}
            onClick={() => openPay(row)}
          >
            <HiBanknotes />
          </IconButton>
          <DropMenu
            items={[
              {
                label: t("common.detail"),
                icon: HiEye,
                iconClass: "bg-slate-50 dark:bg-night-800 text-slate-600 dark:text-slate-300",
                onClick: () => navigate(`/students/${row._id}`),
              },
              ...(can("student:update")
                ? [
                    {
                      label: t("common.edit"),
                      icon: HiPencilSquare,
                      iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                      onClick: () => setEditRow(row),
                    },
                  ]
                : can("student:contact")
                  ? [
                      {
                        label: t("common.edit"),
                        icon: HiPencilSquare,
                        iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                        onClick: () => setContactRow(row),
                      },
                    ]
                  : []),
              ...qrSendItems(row),
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {isDesktop ? (
        <div className={`flex flex-col gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-sm dark:shadow-none shadow-slate-900/[0.02] duration-150 ${isSearching ? "opacity-50 pointer-events-none" : ""}`}>
          {/* Filtr qatori konvensiyasi: maydonlar flex-1 (tor ekranda yangi
              qatorga o'tadi), amallar bitta guruhda ml-auto bilan o'ngda. */}
          <div className="flex flex-wrap items-center gap-2.5 [&>*]:flex-1 [&>*]:min-w-[180px]">
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
            <Select
              placeholder={t("student.debt")}
              variant="slate"
              disabled={isSearching}
              value={debtStatus}
              onChange={(v) => {
                setPage(1);
                setDebtStatus(v);
              }}
              options={[
                { value: "", label: t("student.debtFilterAll") },
                { value: "debtor", label: t("student.debtFilterDebtors") },
                { value: "noDebt", label: t("student.debtFilterNoDebt") },
              ]}
            />
            {showCenterFilter && (
              <Select
                placeholder={t("student.center")}
                variant="slate"
                disabled={isSearching}
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
              placeholder={t("student.group")}
              variant="slate"
              disabled={isSearching}
              value={filterGroup}
              onChange={(v) => {
                setPage(1);
                setFilterGroup(v);
              }}
              options={[
                { value: "", label: t("common.all") },
                ...groupOptions.map((g) => ({ value: g._id, label: g.filterLabel })),
              ]}
            />
            <Select
              placeholder={t("student.status")}
              variant="slate"
              disabled={isSearching}
              value={filterStatus}
              onChange={(v) => {
                setPage(1);
                setFilterStatus(v);
              }}
              options={[
                { value: "", label: t("common.all") },
                { value: "active", label: t("student.statusActive") },
                { value: "left", label: t("student.statusLeft") },
              ]}
            />
            <div className="!flex-none !min-w-0">
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
            <div className="flex items-center gap-2 !flex-none !min-w-0 ml-auto">
              <Button onClick={openCreate} className="gap-1.5">
                <HiPlus className="text-base" />
                {t("student.create")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <FilterBar
          cols={showCenterFilter ? 3 : 2}
          dim={isSearching}
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
              <Button onClick={openCreate} className="gap-1.5">
                <HiPlus className="text-base" />
                {t("student.create")}
              </Button>
            </>
          }
        >
          <Select
            placeholder={t("student.debt")}
            variant="slate"
            disabled={isSearching}
            value={debtStatus}
            onChange={(v) => {
              setPage(1);
              setDebtStatus(v);
            }}
            options={[
              { value: "", label: t("student.debtFilterAll") },
              { value: "debtor", label: t("student.debtFilterDebtors") },
              { value: "noDebt", label: t("student.debtFilterNoDebt") },
            ]}
          />
          {showCenterFilter && (
            <Select
              placeholder={t("student.center")}
              variant="slate"
              disabled={isSearching}
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
            placeholder={t("student.group")}
            variant="slate"
            disabled={isSearching}
            value={filterGroup}
            onChange={(v) => {
              setPage(1);
              setFilterGroup(v);
            }}
            options={[
              { value: "", label: t("common.all") },
              ...groupOptions.map((g) => ({ value: g._id, label: g.filterLabel })),
            ]}
          />
          <Select
            placeholder={t("student.status")}
            variant="slate"
            disabled={isSearching}
            value={filterStatus}
            onChange={(v) => {
              setPage(1);
              setFilterStatus(v);
            }}
            options={[
              { value: "", label: t("common.all") },
              { value: "active", label: t("student.statusActive") },
              { value: "left", label: t("student.statusLeft") },
            ]}
          />
        </FilterBar>
      )}

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
          <HiUsers className="text-4xl" />
          <p className="text-sm">{t("student.loadError")}</p>
          <Button variant="outlined" onClick={fetchStudents}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <List
          columns={columns}
          rows={rows}
          loading={loading}
          view={isDesktop ? "table" : "grid"}
          renderItem={renderCard}
          gridClassName="grid grid-cols-1 gap-2 p-2"
          empty={t("student.empty")}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
          toolbar={
            <ExportExcelButton
              endpoint="/students/export"
              params={
                isSearching
                  ? { search }
                  : { search, center: filterCenter, group: filterGroup, status: filterStatus, debtStatus }
              }
            />
          }
        />
      )}

      <StudentDialog
        key={dialogKey}
        open={dialogOpen}
        centers={centers}
        groups={groupOptions}
        subjects={subjects}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchStudents}
      />

      <Dialog
        open={!!entryPickerRow}
        onClose={() => setEntryPickerRow(null)}
        title={t("student.chooseGroupForPayment")}
      >
        <div className="flex flex-col gap-2 w-full">
          {entryPickerRow &&
            activeGroupsOf(entryPickerRow).map((entry) => (
              <button
                key={entry._id}
                type="button"
                onClick={() => pickEntry(entry)}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-night-700 hover:bg-slate-50 dark:hover:bg-night-800 text-left transition-colors"
              >
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {groupLabelMap[entry.group] || "?"}
                </span>
                {(entry.debt || 0) > 0 ? (
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                    {(entry.debt || 0).toLocaleString("uz-UZ")} {t("student.somSuffix")}
                  </span>
                ) : (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400">{t("student.noDebt")}</span>
                )}
              </button>
            ))}
        </div>
      </Dialog>

      {payTargetView && (
        <PaymentDialog
          open={!!payTarget}
          studentId={payTargetView.student._id}
          groupEntryId={payTargetView.entry._id}
          debt={payTargetView.entry.debt}
          currentCyclePrice={payTargetView.entry.currentCyclePrice}
          paidForCurrentCycle={payTargetView.entry.paidForCurrentCycle}
          currentCycleMonth={payTargetView.entry.currentCycleMonth}
          courseStartMonth={payTargetView.entry.courseStartMonth}
          earliestPayableMonth={payTargetView.entry.earliestPayableMonth}
          onClose={() => setPayTarget(null)}
          onSaved={fetchStudents}
          onPaid={({ amount, forMonth, remainingDebt, debtBreakdown, paymentId }) =>
            hasFeature("receipt.manage") &&
            setReceipt({
              centerName: centerMap[payTargetView.entry.center],
              groupLabel: groupLabelMap[payTargetView.entry.group],
              studentName: payTargetView.student.fullName,
              phone: payTargetView.student.phone,
              amount,
              forMonth,
              remainingDebt,
              debtBreakdown,
              paymentId,
            })
          }
        />
      )}

      <ReceiptPromptDialog open={!!receipt} receipt={receipt} onClose={() => setReceipt(null)} />

      {editRowView && (
        <StudentEditDialog
          key={editRowView._id}
          open={!!editRow}
          student={editRowView}
          entries={activeGroupsOf(editRowView).map((g) => ({
            _id: g._id,
            label: groupLabelMap[g.group],
            price: g.price,
            cycles: g.priceCycles,
            joinedAt: g.joinedAt,
            groupStatus: g.groupStatus,
            activatedAt: groupActivatedAtMap[g.group],
          }))}
          onClose={() => setEditRow(null)}
          onSaved={fetchStudents}
        />
      )}

      {contactRowView && (
        <StudentContactDialog
          key={contactRowView._id}
          open={!!contactRow}
          student={contactRowView}
          onClose={() => setContactRow(null)}
          onSaved={(data) => mergeContact(data?._id, data)}
        />
      )}
    </div>
  );
}

export default Students;
