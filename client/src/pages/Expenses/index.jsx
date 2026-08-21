import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiBanknotes, HiMagnifyingGlass, HiPencil, HiPlus, HiTrash } from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import DropMenu from "../../ui/DropMenu";
import NumberText from "../../ui/NumberText";
import ExpenseDialog from "./ExpenseDialog";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const CATEGORIES = ["rent", "utilities", "equipment", "marketing", "repair", "other"];
const CATEGORY_COLOR = {
  rent: "blue",
  utilities: "orange",
  equipment: "violet",
  marketing: "yellow",
  repair: "red",
  other: "slate",
};

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

function Expenses() {
  const { t } = useTranslation();

  const [rows, setRows] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCenter, setFilterCenter] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [loading, setLoading] = useState(true);
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
        params: { page, search, center: filterCenter, category: filterCategory },
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
  }, [page, search, filterCenter, filterCategory]);

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
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  useSocketEvent("expense:created", fetchExpenses);
  useSocketEvent("expense:updated", fetchExpenses);

  const openCreate = () => {
    if (centers.length === 0) {
      errorMsg("staff.noCentersYet");
      return;
    }
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
          <span className="font-semibold text-slate-800">{row.title}</span>
          {row.note && <span className="text-xs text-slate-400">{row.note}</span>}
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
        <NumberText className={row.status === "cancelled" ? "line-through text-slate-400" : ""}>
          {money(row.amount)}
        </NumberText>
      ),
    },
    {
      key: "date",
      header: t("expense.date"),
      render: (row) => <span className="text-slate-500 text-xs">{row.date}</span>,
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
      render: (row) =>
        row.status === "cancelled" ? null : (
          <div className="flex items-center justify-end">
            <DropMenu
              items={[
                {
                  label: t("common.edit"),
                  icon: HiPencil,
                  iconClass: "bg-blue-50 text-blue-600",
                  onClick: () => openEdit(row),
                },
                {
                  label: t("expense.cancel"),
                  icon: HiTrash,
                  iconClass: "bg-red-50 text-red-600",
                  onClick: () => setCancelTarget(row),
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
            {t("expense.create")}
          </Button>
        }
        extras={
          <div className="flex items-center justify-between gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50">
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <HiBanknotes className="text-emerald-500" />
              {t("expense.total")}
            </span>
            <NumberText>{money(totalAmount)}</NumberText>
          </div>
        }
      >
        {showCenterFilter && (
          <Select
            placeholder={t("expense.center")}
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
          placeholder={t("expense.category")}
          variant="white"
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

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
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
              params={{ search, center: filterCenter, category: filterCategory }}
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
