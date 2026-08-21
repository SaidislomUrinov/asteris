import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  HiBanknotes,
  HiCalendarDays,
  HiClipboardDocumentList,
  HiKey,
  HiUser,
} from "react-icons/hi2";
import Avatar from "../../ui/Avatar";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import NumberText from "../../ui/NumberText";
import Loading from "../../ui/Loading";
import SalaryDonut from "../../ui/SalaryDonut";
import LedgerRow from "../../ui/LedgerRow";
import MonthNav from "../../ui/MonthNav";
import { updateUser } from "../../contexts/user";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const money = (v) => `${(v || 0).toLocaleString("uz-UZ")}`;

const monthOf = (str) => Number(str.slice(5, 7)) - 1;
const yearOf = (str) => Number(str.slice(0, 4));
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const TABS = [
  { key: "requisites", labelKey: "profile.tabRequisites", icon: HiUser },
  { key: "salary", labelKey: "profile.tabSalary", icon: HiBanknotes },
  { key: "transactions", labelKey: "profile.tabTransactions", icon: HiClipboardDocumentList },
];

// Rol bo'yicha urg'u rangi — sarlavha chipida va avatar halqasida, har bir
// rol o'zining panelidagi (TeacherHome — ko'k, ReceptionHome — emerald)
// identifikatsiyasiga mos keladi.
const ROLE_ACCENT = { teacher: "blue", assistant: "violet", reception: "emerald" };

// Har qanday Staff (Reception/Manager/Teacher) uchun umumiy — o'z rekvizitlarini
// (ism/parol) yangilash, oyma-oy maoshini va shu oy tranzaksiyalarini ko'rish.
// Dizayn (2026-08-08 qayta qurildi): TeacherHome bilan bir xil moliyaviy til
// (SalaryDonut/LedgerRow/MonthNav — umumiy `ui/` komponentlar), ikki ustunli
// "Rekvizitlar" paneli (bo'sh joy kamaytirildi), rolga mos urg'u rangi.
function StaffProfile() {
  const { t } = useTranslation();
  const dp = useDispatch();
  const user = useSelector((e) => e.user);
  const [tab, setTab] = useState("requisites");
  const accent = ROLE_ACCENT[user.role] || "slate";

  const [name, setName] = useState(user.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const [month, setMonth] = useState(currentMonth());
  const [salary, setSalary] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(true);

  const fetchSalary = useCallback(async () => {
    try {
      setSalaryLoading(true);
      const res = await api.get(`/salaries/${user._id}`, { params: { month } });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setSalary(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSalaryLoading(false);
    }
  }, [user._id, month]);

  useEffect(() => {
    const id = setTimeout(fetchSalary, 0);
    return () => clearTimeout(id);
  }, [fetchSalary]);

  const saveRequisites = async () => {
    const wantsPasswordChange = !!currentPassword || !!newPassword;
    if (!name.trim() && !wantsPasswordChange) return;
    if (wantsPasswordChange && (!currentPassword || !newPassword)) {
      return errorMsg("staff.fillTheRows");
    }
    try {
      setSaving(true);
      const body = {};
      if (name.trim() && name.trim() !== user.name) body.name = name.trim();
      if (wantsPasswordChange) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      if (Object.keys(body).length === 0) return;

      const res = await api.patch("/staff-auth/profile", body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      dp(updateUser({ ...data }));
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const typeChip = () => {
    if (salary?.salaryType === "fixed") return <Chip value={t("salary.typeFixed")} color="blue" />;
    if (salary?.salaryType === "percentage")
      return <Chip value={`${salary.percent ?? salary.staff?.salaryValue ?? 0}%`} color="violet" />;
    if (salary?.salaryType === "perGroup")
      return <Chip value={t("salary.typePerGroup")} color="orange" />;
    return <Chip value="—" color="slate" />;
  };

  const txTypeColor = { advance: "blue", withdrawal: "orange", bonus: "emerald", penalty: "red" };
  const monthNames = t("common.monthNames", { returnObjects: true });
  const monthLabel = `${monthNames[monthOf(month)]} ${yearOf(month)}`;

  return (
    <div className="flex flex-col w-full h-full gap-6">
      {/* ── Sarlavha — avatar, ism, rol va tezkor rekvizitlar bir qatorda ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar user={user} size={56} />
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-space font-bold text-xl text-slate-900 truncate">{user.name}</p>
              <Chip value={t(`role.${user.role}`)} color={accent} variant="ghost" />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              {user.login && (
                <span className="flex items-center gap-1">
                  <HiKey className="text-slate-300" />
                  {user.login}
                </span>
              )}
              {user.date && (
                <span className="flex items-center gap-1">
                  <HiCalendarDays className="text-slate-300" />
                  {user.date}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tablar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit overflow-x-auto max-w-full">
        {TABS.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-2 px-3.5 h-9 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="text-base" />
              {t(tb.labelKey)}
            </button>
          );
        })}
      </div>

      {/* ── Rekvizitlar — bitta panel, ikki ustun (bo'sh joy kamaytirildi) ── */}
      {tab === "requisites" && (
        <div className="flex flex-col gap-1 p-5 sm:p-6 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1px_1fr] gap-6">
            <div className="flex flex-col gap-3">
              <p className="font-semibold text-slate-800 flex items-center gap-2">
                <HiUser className="text-slate-400" />
                {t("profile.requisitesTitle")}
              </p>
              <Input
                label={t("staff.name")}
                variant="white"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="hidden lg:block w-px bg-slate-100 self-stretch" />

            <div className="flex flex-col gap-3">
              <p className="font-semibold text-slate-800 flex items-center gap-2">
                <HiKey className="text-slate-400" />
                {t("profile.changePasswordTitle")}
              </p>
              <Input
                label={t("profile.currentPassword")}
                type="password"
                variant="white"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Input
                label={t("profile.newPassword")}
                type="password"
                variant="white"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-5 mt-4 border-t border-slate-100">
            <Button color="blue" loading={saving} onClick={saveRequisites} className="w-full sm:w-auto">
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}

      {/* ── Oyligim — TeacherHome bilan bir xil donut + ledger til ──────── */}
      {tab === "salary" && (
        <div className="flex flex-col gap-1 p-5 sm:p-6 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600">
                <HiBanknotes className="text-base" />
              </span>
              <p className="font-semibold text-slate-800">{t("salary.title")}</p>
              {typeChip()}
            </div>
            <MonthNav month={month} label={monthLabel} onChange={setMonth} max={currentMonth()} />
          </div>

          {salaryLoading ? (
            <Loading height="20vh" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1px_1fr] gap-6 items-start">
              <div className="flex justify-center lg:justify-start pt-2">
                <SalaryDonut
                  base={salary?.base}
                  bonus={salary?.bonus}
                  advance={salary?.advance}
                  withdrawal={salary?.withdrawal}
                  penalty={salary?.penalty}
                  final={salary?.final}
                />
              </div>

              <div className="hidden lg:block w-px bg-slate-100 self-stretch" />

              <div className="flex flex-col divide-y divide-slate-100 pt-1">
                <LedgerRow label={t("salary.base")} value={salary?.base} />
                <LedgerRow label={t("salary.bonus")} value={salary?.bonus} tone="positive" />
                <LedgerRow label={t("salary.advance")} value={salary?.advance} tone="negative" />
                <LedgerRow label={t("salary.withdrawal")} value={salary?.withdrawal} tone="negative" />
                <LedgerRow label={t("salary.penalty")} value={salary?.penalty} tone="negative" />
                <div className="flex items-center justify-between pt-3 mt-1 border-t-2 border-slate-100">
                  <span className="font-semibold text-slate-800">{t("salary.final")}</span>
                  <NumberText
                    className={`!text-lg ${salary?.final < 0 ? "text-red-600" : "text-emerald-600"}`}
                  >
                    {money(salary?.final)}
                  </NumberText>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tranzaksiyalarim ─────────────────────────────────────────── */}
      {tab === "transactions" && (
        <div className="flex flex-col gap-1 p-5 sm:p-6 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-2 flex-wrap pb-4">
            <p className="font-semibold text-slate-800">{t("profile.tabTransactions")}</p>
            <MonthNav month={month} label={monthLabel} onChange={setMonth} max={currentMonth()} />
          </div>

          {salaryLoading ? (
            <Loading height="20vh" />
          ) : !salary?.transactions?.length ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 text-lg text-slate-300">
                <HiClipboardDocumentList />
              </span>
              <p className="text-xs text-slate-400">{t("salary.noTransactions")}</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100">
              {salary.transactions.map((tx) => (
                <div
                  key={tx._id}
                  className={`flex items-center justify-between gap-2 py-2.5 ${
                    tx.status !== "active" ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Chip
                      value={t(`salary.txType.${tx.type}`)}
                      color={txTypeColor[tx.type] || "slate"}
                      variant="ghost"
                    />
                    <div className="flex flex-col min-w-0">
                      <span
                        className={`font-semibold text-sm ${
                          tx.status === "active" ? "text-slate-800" : "text-slate-400 line-through"
                        }`}
                      >
                        {money(tx.amount)} {t("student.somSuffix")}
                      </span>
                      {tx.note && <span className="text-xs text-slate-400 truncate">{tx.note}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{tx.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StaffProfile;
