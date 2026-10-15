import { useCallback, useEffect, useState } from "react";
import useQueryState from "../../hooks/useQueryState";
import { useTranslation } from "react-i18next";
import { HiBanknotes, HiCheckCircle, HiClipboardDocumentList } from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import NumberText from "../../ui/NumberText";
import DropMenu from "../../ui/DropMenu";
import SalaryTransactionDialog from "./SalaryTransactionDialog";
import SalaryTransactionsListDialog from "./SalaryTransactionsListDialog";
import ExportExcelButton from "../../ui/ExportExcelButton";
import MonthInput from "../../ui/MonthInput";
import useCan from "../../hooks/useCan";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import useHideFinance from "../../hooks/useHideFinance";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import { maskMoney } from "../../utils/moneyFormat";

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function Salary() {
  const { t } = useTranslation();
  const can = useCan();
  const canManage = can("salary:manage");
  const [hideFinance] = useHideFinance();
  const money = (v) => maskMoney(v, hideFinance);

  const [month, setMonth] = useState(currentMonth());
  const [filterCenter, setFilterCenter] = useQueryState("filterCenter", "");
  const [centers, setCenters] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [txStaff, setTxStaff] = useState(null);
  const [txPreset, setTxPreset] = useState(null);
  const [txKey, setTxKey] = useState(0);
  const [listStaff, setListStaff] = useState(null);
  const [listKey, setListKey] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/salaries/summary", {
        params: { month, center: filterCenter },
      });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [month, filterCenter]);

  useEffect(() => {
    const t = setTimeout(fetchData, 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/centers", { params: { page: 1 } });
        if (res.data.ok) setCenters(res.data.data || []);
      } catch {
        // markazlar faqat filtr uchun
      }
    })();
  }, []);

  // Oylik realtime — tranzaksiya qo'shilsa/bekor qilinsa qayta yuklaymiz
  useSocketEvent("salary:updated", fetchData);
  useSocketEvent("payment:created", fetchData);
  useSocketEvent("payment:updated", fetchData);

  // preset — "Oylikni berish": tur `payout`, summa = shu oy qoldig'i.
  const openTransactionDialog = (row, preset = null) => {
    setTxStaff(row.staff);
    setTxPreset(preset);
    setTxKey((k) => k + 1);
  };

  const openTransactionsList = (row) => {
    setListStaff(row.staff);
    setListKey((k) => k + 1);
  };

  const typeChip = (row) => {
    if (row.salaryType === "fixed") return <Chip value={t("salary.typeFixed")} color="blue" />;
    if (row.salaryType === "percentage")
      return <Chip value={`${row.percent ?? row.staff.salaryValue ?? 0}%`} color="violet" />;
    return <Chip value="—" color="slate" />;
  };

  const columns = [
    {
      key: "name",
      header: t("salary.staff"),
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{row.staff.name}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">{t(`role.${row.staff.role}`)}</span>
        </div>
      ),
    },
    { key: "type", header: t("salary.type"), render: typeChip },
    {
      key: "base",
      header: t("salary.base"),
      render: (row) => <NumberText>{money(row.base)}</NumberText>,
    },
    {
      key: "minus",
      header: t("salary.deductions"),
      // Faqat haqiqatan hodimga BERILGAN summalar (avans + oldindan olingan +
      // berilgan oylik) — jarima bu yig'indiga kirmaydi, alohida ustunda.
      render: (row) => (
        <NumberText className="text-orange-600 dark:text-orange-400">
          {money(row.advance + row.withdrawal + row.payout)}
        </NumberText>
      ),
    },
    {
      key: "penalty",
      header: t("salary.penalty"),
      // Jarima har doim minus ishorasi bilan ko'rsatiladi (masalan -120,000),
      // jarima yo'q bo'lsa neytral "0".
      render: (row) => (
        <NumberText className={row.penalty ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-500"}>
          {row.penalty ? `-${money(row.penalty)}` : money(0)}
        </NumberText>
      ),
    },
    {
      key: "bonus",
      header: t("salary.bonus"),
      render: (row) => <NumberText className="text-emerald-600 dark:text-emerald-400">{money(row.bonus)}</NumberText>,
    },
    {
      key: "final",
      header: t("salary.final"),
      // Hisoblangan oylik to'liq berib bo'lingan bo'lsa — "To'langan" belgisi.
      render: (row) =>
        row.final === 0 && row.base > 0 ? (
          <Chip value={t("salary.paid")} color="emerald" />
        ) : (
          <NumberText className={row.final < 0 ? "text-red-600 dark:text-red-400" : ""}>{money(row.final)}</NumberText>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end">
          <DropMenu
            items={[
              ...(canManage && row.final > 0
                ? [
                    {
                      label: t("salary.payAction"),
                      icon: HiCheckCircle,
                      iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                      onClick: () => openTransactionDialog(row, { type: "payout", amount: row.final }),
                    },
                  ]
                : []),
              ...(canManage
                ? [
                    {
                      label: t("salary.paymentPenaltyAction"),
                      icon: HiBanknotes,
                      iconClass: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                      onClick: () => openTransactionDialog(row),
                    },
                  ]
                : []),
              {
                label: t("salary.transactionsMenu"),
                icon: HiClipboardDocumentList,
                iconClass: "bg-slate-50 dark:bg-night-800 text-slate-600 dark:text-slate-300",
                onClick: () => openTransactionsList(row),
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
        cols={2}
        activeCount={[month !== currentMonth(), filterCenter].filter(Boolean).length}
        onReset={() => {
          setMonth(currentMonth());
          setFilterCenter("");
        }}
      >
        <MonthInput
          value={month}
          onChange={(m) => setMonth(m || currentMonth())}
          max={currentMonth()}
        />
        {centers.length > 1 && (
          <Select
            placeholder={t("salary.center")}
            variant="slate"
            value={filterCenter}
            onChange={setFilterCenter}
            options={[
              { value: "", label: t("common.all") },
              ...centers.map((c) => ({ value: c._id, label: c.name })),
            ]}
          />
        )}
      </FilterBar>

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
          <HiBanknotes className="text-4xl" />
          <p className="text-sm">{t("salary.loadError")}</p>
          <Button variant="outlined" onClick={fetchData}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <List
          columns={columns}
          rows={rows}
          loading={loading}
          empty={t("salary.empty")}
          rowKey={(row) => row.staff._id}
          toolbar={
            <ExportExcelButton
              endpoint="/salaries/summary/export"
              params={{ month, center: filterCenter }}
            />
          }
        />
      )}

      <SalaryTransactionDialog
        key={`tx-${txKey}`}
        open={!!txStaff}
        staff={txStaff}
        month={month}
        preset={txPreset}
        onClose={() => setTxStaff(null)}
        onSaved={fetchData}
      />

      <SalaryTransactionsListDialog
        key={`list-${listKey}`}
        open={!!listStaff}
        staff={listStaff}
        month={month}
        onClose={() => setListStaff(null)}
        onChanged={fetchData}
      />
    </div>
  );
}

export default Salary;
