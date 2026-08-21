import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HiBanknotes, HiEye, HiMagnifyingGlass, HiPlus, HiUsers } from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import DropMenu from "../../ui/DropMenu";
import IconButton from "../../ui/IconButton";
import Dialog from "../../ui/Dialog";
import StudentDialog from "./StudentDialog";
import PaymentDialog from "./PaymentDialog";
import ReceiptPromptDialog from "./ReceiptPromptDialog";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";

function Students() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Boshqa sahifadan tayyor filtr bilan kelish mumkin — masalan Reception
  // Dashboard'dagi "Hammasini ko'rish" `/students?debtStatus=debtor` ga
  // olib keladi va qarzdorlar filtri darhol tanlangan bo'lishi kerak.
  const [searchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCenter, setFilterCenter] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [debtStatus, setDebtStatus] = useState(() => {
    const v = searchParams.get("debtStatus");
    return v === "debtor" || v === "noDebt" ? v : "";
  });
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
      `${subjectMap[g.subject] || "?"} - ${g.status === "pending" ? g.pendingId : g.activeId}${
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
  const groupOptions = useMemo(
    () => groups.map((g) => ({ ...g, label: groupLabel(g), filterLabel: groupFilterLabel(g) })),
    [groups, groupLabel, groupFilterLabel],
  );
  const groupLabelMap = useMemo(
    () => Object.fromEntries(groupOptions.map((g) => [g._id, g.label])),
    [groupOptions],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const [entryPickerRow, setEntryPickerRow] = useState(null);
  const [payTarget, setPayTarget] = useState(null);
  const [receipt, setReceipt] = useState(null);

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
        api.get("/groups", { params: { page: 1 } }),
      ]);
      if (centersRes.data.ok) setCenters(centersRes.data.data || []);
      if (subjectsRes.data.ok) setSubjects(subjectsRes.data.data || []);
      if (groupsRes.data.ok) setGroups(groupsRes.data.data || []);
    } catch {
      // lookup ro'yxatlari, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    fetchLookups();
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

  const columns = [
    {
      key: "fullName",
      header: t("student.fullName"),
      render: (row) => (
        <span
          className="font-semibold text-slate-800 hover:text-blue-600 cursor-pointer transition-colors"
          onClick={() => navigate(`/students/${row._id}`)}
        >
          {row.fullName}
        </span>
      ),
    },
    { key: "phone", header: t("student.phone") },
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
            <span className="text-slate-400">—</span>
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
          <span className="font-semibold text-red-600">
            {debt.toLocaleString("uz-UZ")} {t("student.somSuffix")}
          </span>
        ) : (
          <span className="text-emerald-600">{t("student.noDebt")}</span>
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
                iconClass: "bg-slate-50 text-slate-600",
                onClick: () => navigate(`/students/${row._id}`),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <FilterBar
        cols={showCenterFilter ? 3 : 2}
        dim={isSearching}
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
          <Button onClick={openCreate} className="gap-1.5">
            <HiPlus className="text-base" />
            {t("student.create")}
          </Button>
        }
      >
        <Select
          placeholder={t("student.debt")}
          variant="white"
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
              variant="white"
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
            variant="white"
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
            variant="white"
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

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
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
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition-colors"
              >
                <span className="font-medium text-slate-700">
                  {groupLabelMap[entry.group] || "?"}
                </span>
                {(entry.debt || 0) > 0 ? (
                  <span className="text-sm font-semibold text-red-600">
                    {(entry.debt || 0).toLocaleString("uz-UZ")} {t("student.somSuffix")}
                  </span>
                ) : (
                  <span className="text-sm text-emerald-600">{t("student.noDebt")}</span>
                )}
              </button>
            ))}
        </div>
      </Dialog>

      {payTarget && (
        <PaymentDialog
          open={!!payTarget}
          studentId={payTarget.student._id}
          groupEntryId={payTarget.entry._id}
          debt={payTarget.entry.debt}
          currentCyclePrice={payTarget.entry.currentCyclePrice}
          paidForCurrentCycle={payTarget.entry.paidForCurrentCycle}
          currentCycleMonth={payTarget.entry.currentCycleMonth}
          courseStartMonth={payTarget.entry.courseStartMonth}
          onClose={() => setPayTarget(null)}
          onSaved={fetchStudents}
          onPaid={({ amount, forMonth, remainingDebt, debtBreakdown, paymentId }) =>
            setReceipt({
              centerName: centerMap[payTarget.entry.center],
              groupLabel: groupLabelMap[payTarget.entry.group],
              studentName: payTarget.student.fullName,
              phone: payTarget.student.phone,
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
    </div>
  );
}

export default Students;
