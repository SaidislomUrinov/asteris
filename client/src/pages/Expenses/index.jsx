import { useCallback, useEffect, useState } from "react";
import usePrerequisite from "../../hooks/usePrerequisite";
import { useTranslation } from "react-i18next";
import useQueryState from "../../hooks/useQueryState";
import { HiBanknotes, HiMagnifyingGlass, HiPencil, HiPlus, HiTrash, HiXMark } from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import useMediaQuery from "../../hooks/useMediaQuery";
import DropMenu from "../../ui/DropMenu";
import NumberText from "../../ui/NumberText";
import MonthNav from "../../ui/MonthNav";
import ExpenseDialog from "./ExpenseDialog";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useHideFinance from "../../hooks/useHideFinance";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { maskMoney } from "../../utils/moneyFormat";
import useCan from "../../hooks/useCan";

const CATEGORIES = ["rent", "utilities", "equipment", "marketing", "repair", "other"];
const CATEGORY_COLOR = {
  rent: "blue",
  utilities: "orange",
  equipment: "violet",
  marketing: "yellow",
  repair: "red",
  other: "slate",
};

const monthOf = (str) => Number(str.slice(5, 7)) - 1;
const yearOf = (str) => Number(str.slice(0, 4));
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};


function Expenses() {
  const { t } = useTranslation();
  const can = useCan();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const [hideFinance] = useHideFinance();
  const money = (v) => maskMoney(v, hideFinance);

  const [rows, setRows] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useQueryState("page", 1);
  const [search, setSearch] = useQueryState("search", "");
  const [filterCenter, setFilterCenter] = useQueryState("filterCenter", "");
  const [filterCategory, setFilterCategory] = useQueryState("filterCategory", "");
  const [filterMonth, setFilterMonth] = useQueryState("filterMonth", currentMonth());
  const [loading, setLoading] = useState(true);
  const requireFirst = usePrerequisite();
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  // Hodim (Staff) bitta filialga biriktirilgan — backend `/centers`ni ham
  // o'sha bitta filial bilan cheklaydi, demak tanlov qolmaydi.
  const showCenterFilter = centers.length > 1;
  const centerMap = Object.fromEntries(centers.map((c) => [c._id, c.name]));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [canceling, setCanceling] = useState(false);

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/expenses", {
        params: { page, search, center: filterCenter, category: filterCategory, month: filterMonth },
      });
      const { ok, data, totalAmount: total, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
      setTotalAmount(total || 0);
      setMeta(m || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCenter, filterCategory, filterMonth]);

  const fetchCenters = useCallback(async () => {
    try {
      const res = await api.get("/centers", { params: { page: 1 } });
      const { ok, data } = res.data;
      if (ok) setCenters(data || []);
    } catch {
      // markazlar ro'yxati faqat lookup uchun
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchExpenses, 0);
    return () => clearTimeout(t);
  }, [fetchExpenses]);

  useEffect(() => {
    const t = setTimeout(fetchCenters, 0);
    return () => clearTimeout(t);
  }, [fetchCenters]);

  useSocketEvent("expense:created", fetchExpenses);
  useSocketEvent("expense:updated", fetchExpenses);

  const openCreate = () => {
    if (centers.length === 0) return requireFirst("center");
    setSelected(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      setCanceling(true);
      const res = await api.patch(`/expenses/${cancelTarget._id}/cancel`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setCancelTarget(null);
      fetchExpenses();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setCanceling(false);
    }
  };

  const columns = [
    {
      key: "title",
      header: t("expense.title"),
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{row.title}</span>
          {row.note && <span className="text-xs text-slate-400 dark:text-slate-500">{row.note}</span>}
        </div>
      ),
    },
    {
      key: "category",
      header: t("expense.category"),
      render: (row) => (
        <Chip value={t(`expense.categories.${row.category}`)} color={CATEGORY_COLOR[row.category]} />
      ),
    },
    {
      key: "center",
      header: t("expense.center"),
      render: (row) => centerMap[row.center] || "—",
    },
    {
      key: "amount",
      header: t("expense.amount"),
      render: (row) => (
        <NumberText className={row.status === "cancelled" ? "line-through text-slate-400 dark:text-slate-500" : ""}>
          {money(row.amount)}
        </NumberText>
      ),
    },
    {
      key: "date",
      header: t("expense.date"),
      render: (row) => <span className="text-slate-500 dark:text-slate-400 text-xs">{row.date}</span>,
    },
    {
      key: "status",
      header: t("common.status"),
      render: (row) =>
        row.status === "cancelled" ? (
          <Chip value={t("expense.statusCancelled")} color="red" />
        ) : (
          <Chip value={t("expense.statusActive")} color="emerald" />
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      // Tahrir/bekor qilish — backendda `expense:update` (ruxsatsiz hodimga
      // menyu ko'rinmaydi).
      render: (row) =>
        row.status === "cancelled" || !can("expense:update") ? null : (
          <div className="flex items-center justify-end">
            <DropMenu
              items={[
                {
                  label: t("common.edit"),
                  icon: HiPencil,
                  iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                  onClick: () => openEdit(row),
                },
                {
                  label: t("expense.cancel"),
                  icon: HiTrash,
                  iconClass: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
                  onClick: () => setCancelTarget(row),
                },
              ]}
            />
          </div>
        ),
    },
  ];

  const monthNames = t("common.monthNames", { returnObjects: true });
  const monthLabel = `${monthNames[monthOf(filterMonth)]} ${yearOf(filterMonth)}`;

  const totalCard = (
    <div className="flex items-center justify-between gap-2 h-10 px-3 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15">
      <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
        <HiBanknotes className="text-emerald-500" />
        {t("expense.total")}
      </span>
      <NumberText className="text-emerald-700 dark:text-emerald-400">{money(totalAmount)}</NumberText>
    </div>
  );

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {isDesktop ? (
        <div className={`flex flex-col gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-sm dark:shadow-none shadow-slate-900/[0.02]`}>
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
                placeholder={t("expense.center")}
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
            <Select
              placeholder={t("expense.category")}
              variant="slate"
              value={filterCategory}
              onChange={(v) => {
                setPage(1);
                setFilterCategory(v);
              }}
              options={[
                { value: "", label: t("common.all") },
                ...CATEGORIES.map((c) => ({ value: c, label: t(`expense.categories.${c}`) })),
              ]}
            />
            <div className="!flex-none !min-w-0">
              <Button
                variant="outlined"
                color="red"
                onClick={() => {
                setPage(1);
                setFilterCenter("");
                setFilterCategory("");
                }}
                disabled={[filterCenter, filterCategory].filter(Boolean).length === 0}
                className="gap-1.5"
              >
                <HiXMark className="text-base" />
                {t("common.resetFilters")}
              </Button>
            </div>
            <div className="flex items-center gap-2 !flex-none !min-w-0 ml-auto">
              <Button onClick={openCreate} className="gap-1.5">
                <HiPlus className="text-base" />
                {t("expense.create")}
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center justify-center h-11 px-2 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
              <MonthNav
                month={filterMonth}
                label={monthLabel}
                onChange={(m) => {
                  setPage(1);
                  setFilterMonth(m);
                }}
                max={currentMonth()}
              />
            </div>
            {totalCard}
          </div>
        </div>
      ) : (
        <FilterBar
          cols={showCenterFilter ? 3 : 2}
          activeCount={[filterCenter, filterCategory].filter(Boolean).length}
          onReset={() => {
            setPage(1);
            setFilterCenter("");
            setFilterCategory("");
          }}
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
                {t("expense.create")}
              </Button>
            </>
          }
          extras={
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center justify-center h-11 px-2 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
                <MonthNav
                  month={filterMonth}
                  label={monthLabel}
                  onChange={(m) => {
                    setPage(1);
                    setFilterMonth(m);
                  }}
                  max={currentMonth()}
                />
              </div>
              {totalCard}
            </div>
          }
        >
          {showCenterFilter && (
            <Select
              placeholder={t("expense.center")}
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
          <Select
            placeholder={t("expense.category")}
            variant="slate"
            value={filterCategory}
            onChange={(v) => {
              setPage(1);
              setFilterCategory(v);
            }}
            options={[
              { value: "", label: t("common.all") },
              ...CATEGORIES.map((c) => ({ value: c, label: t(`expense.categories.${c}`) })),
            ]}
          />
        </FilterBar>
      )}

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
          <HiBanknotes className="text-4xl" />
          <p className="text-sm">{t("expense.loadError")}</p>
          <Button variant="outlined" onClick={fetchExpenses}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <List
          columns={columns}
          rows={rows}
          loading={loading}
          empty={t("expense.empty")}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
          toolbar={
            <ExportExcelButton
              endpoint="/expenses/export"
              params={{ search, center: filterCenter, category: filterCategory, month: filterMonth }}
            />
          }
        />
      )}

      <ExpenseDialog
        key={dialogKey}
        open={dialogOpen}
        expense={selected}
        centers={centers}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchExpenses}
      />

      <Dialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={t("expense.cancel")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setCancelTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={canceling} onClick={confirmCancel}>
              {t("expense.cancel")}
            </Button>
          </>
        }
      >
        <p>{t("expense.cancelConfirm", { title: cancelTarget?.title })}</p>
      </Dialog>
    </div>
  );
}

export default Expenses;
