import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { HiChatBubbleLeftRight } from "react-icons/hi2";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import NumberText from "../../ui/NumberText";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api, getActiveCenter } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import useCan from "../../hooks/useCan";
import SmsSendPanel from "./SmsSendPanel";
import SmsBatchDialog from "./SmsBatchDialog";
import SmsBalanceCard from "./SmsBalanceCard";
import SmsTransactionsTab from "./SmsTransactionsTab";
import SmsPurchasesTab from "./SmsPurchasesTab";
import BuyPackageDialog, { PENDING_SMS_ORDER_KEY } from "./BuyPackageDialog";
import { STATUS_COLOR, TOPIC_COLOR, fmtUnix } from "./smsFormat";

const TABS = ["history", "transactions", "purchases"];
const POLL_MS = 4000;
const POLL_LIMIT_MS = 2 * 60 * 1000;

const Stat = ({ label, value, sub }) => (
  <div className="flex flex-col justify-center gap-0.5 min-w-0 px-4 py-3">
    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
    <span className="text-base font-bold leading-snug text-slate-800 dark:text-slate-100">{value}</span>
    {sub && <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{sub}</span>}
  </div>
);

function Sms() {
  const { t } = useTranslation();
  const can = useCan();
  const [summary, setSummary] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("history");
  const [buyOpen, setBuyOpen] = useState(false);
  const [balance, setBalance] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isOwner = useSelector((e) => e.user.authType) === "owner";
  const lastCreditToast = useRef(0);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const [s, b] = await Promise.all([api.get("/sms/summary"), api.get("/sms/batches", { params: { page } })]);
      if (!s.data.ok) throw new Error(s.data.msg);
      if (!b.data.ok) throw new Error(b.data.msg);
      setSummary(s.data.data);
      if (s.data.data?.balance) setBalance(s.data.data.balance);
      setRows(b.data.data || []);
      setMeta(b.data.meta || { page: 1, totalPages: 1 });
    } catch (e) {
      setError(true);
      errorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  const fetchLookups = useCallback(async () => {
    try {
      const [tpl, first, teachers] = await Promise.all([
        api.get("/sms/templates"),
        api.get("/groups", { params: { page: 1 } }),
        api.get("/staffs/lookup", { params: { role: "teacher" } }).catch(() => null),
      ]);
      if (tpl.data.ok) setTemplates(tpl.data.data || []);
      if (!first.data.ok) return;
      // /groups sahifalab beradi (50 tadan) — qolgan sahifalar ham olinadi.
      let list = first.data.data || [];
      const totalPages = first.data.meta?.totalPages || 1;
      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) => api.get("/groups", { params: { page: i + 2 } })),
        );
        list = list.concat(...rest.map((r) => (r.data.ok ? r.data.data || [] : [])));
      }
      // Ro'yxat faqat `teacher` ID'sini beradi — nomi hodimlar lookup'idan.
      const names = Object.fromEntries((teachers?.data?.ok ? teachers.data.data || [] : []).map((s) => [s._id, s.name]));
      setGroups(list.map((g) => ({ ...g, teacherName: names[g.teacher] || "" })));
    } catch {
      // shablon/guruh ro'yxati yuborish paneli uchun yordamchi ma'lumot
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchAll, 0);
    return () => clearTimeout(timer);
  }, [fetchAll]);

  useEffect(() => {
    const timer = setTimeout(fetchLookups, 0);
    return () => clearTimeout(timer);
  }, [fetchLookups]);

  const creditedToast = useCallback(
    (count) => {
      // Socket va polling ikkalasi ham xabar bersa, bir marta ko'rsatiladi.
      if (Date.now() - lastCreditToast.current < 10000) return;
      lastCreditToast.current = Date.now();
      successMsg(t("sms.credited", { count }));
    },
    [t],
  );

  useSocketEvent("sms:batch", () => {
    fetchAll();
    setRefreshKey((k) => k + 1);
  });
  // Balans filial darajasida — boshqa filial hodisalari e'tiborsiz qoldiriladi.
  const isOwnCenter = (payload) => !payload?.center || payload.center === getActiveCenter();
  useSocketEvent("sms:balance", (payload) => {
    if (!isOwnCenter(payload)) return;
    if (payload?.balance) setBalance(payload.balance);
    setRefreshKey((k) => k + 1);
  });
  useSocketEvent("sms:credited", (payload) => {
    if (!isOwnCenter(payload)) return;
    if (payload?.balance) setBalance(payload.balance);
    creditedToast(payload?.smsCount ?? 0);
    setRefreshKey((k) => k + 1);
  });

  // To'lovdan qaytganda kutilayotgan buyurtma holatini tekshirish.
  useEffect(() => {
    let orderId = null;
    try {
      orderId = localStorage.getItem(PENDING_SMS_ORDER_KEY);
    } catch {
      return;
    }
    if (!orderId) return;
    const startedAt = Date.now();
    let stopped = false;
    let timer;
    const done = () => {
      try {
        localStorage.removeItem(PENDING_SMS_ORDER_KEY);
      } catch {
        // localStorage mavjud emas
      }
    };
    const poll = async () => {
      if (stopped) return;
      try {
        const res = await api.get(`/sms/purchases/${orderId}/status`);
        const { ok, data, status, credited, smsCount, balance: bal, msg } = res.data;
        if (!ok) throw new Error(msg);
        const st = data?.status ?? status;
        if (st === "paid") {
          done();
          const b = data?.balance ?? bal;
          if (b) setBalance(b);
          if (data?.credited ?? credited) creditedToast(data?.smsCount ?? smsCount ?? 0);
          setRefreshKey((k) => k + 1);
          return;
        }
        if (st === "failed" || st === "cancelled") {
          done();
          errorMsg(t("sms.paymentFailed"));
          return;
        }
      } catch (error) {
        done();
        errorMsg(error.message);
        return;
      }
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        done();
        return;
      }
      timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [creditedToast, t]);

  const last = summary?.last;
  const month = summary?.month;

  const columns = [
    {
      key: "template",
      header: t("sms.template"),
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <span className="font-semibold text-slate-800 dark:text-slate-100">{row.templateTitle}</span>
          <Chip value={t(`sms.topics.${row.topic}`)} color={TOPIC_COLOR[row.topic]} />
        </div>
      ),
    },
    { key: "audience", header: t("sms.audience"), render: (row) => t(`sms.audience_${row.audience}`) },
    {
      key: "result",
      header: t("sms.result"),
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">
          {t("sms.resultLine", { sent: row.sent, delivered: row.delivered, failed: row.failed, total: row.total })}
        </span>
      ),
    },
    { key: "by", header: t("sms.sentBy"), render: (row) => row.createdBy?.name || "—" },
    {
      key: "date",
      header: t("sms.startedAt"),
      render: (row) => <span className="text-xs text-slate-500 dark:text-slate-400">{fmtUnix(row.startedAt)}</span>,
    },
    {
      key: "status",
      header: t("common.status"),
      render: (row) => <Chip value={t(`sms.batchStatus.${row.status}`)} color={STATUS_COLOR[row.status]} />,
    },
    {
      key: "open",
      header: "",
      className: "text-right",
      render: (row) => (
        <Button variant="text" onClick={() => setSelected(row)}>
          {t("sms.details")}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col w-full gap-4 pb-4">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
        <SmsBalanceCard balance={balance} loading={loading && !balance} isOwner={isOwner} onBuy={() => setBuyOpen(true)} />
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-night-700 rounded-2xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-none">
          <Stat
            label={t("sms.lastSent")}
            value={last ? fmtUnix(last.startedAt) : t("sms.never")}
            sub={last ? `${last.templateTitle} · ${t(`sms.topics.${last.topic}`)}` : ""}
          />
          <Stat
            label={t("sms.thisMonth")}
            value={<NumberText className="text-base!">{month?.sent ?? 0}</NumberText>}
            sub={t("sms.thisMonthSub", { batches: month?.batches ?? 0 })}
          />
          <Stat
            label={t("sms.delivery")}
            value={
              <span>
                <NumberText className="text-base!">{month?.delivered ?? 0}</NumberText> / <NumberText className="text-base! text-red-500">{month?.failed ?? 0}</NumberText>
              </span>
            }
            sub={t("sms.deliverySub")}
          />
        </div>
      </div>

      {can("sms:send") && (
        <SmsSendPanel
          templates={templates}
          groups={groups}
          onSent={fetchAll}
          isOwner={isOwner}
          onBuy={() => setBuyOpen(true)}
        />
      )}

      <div className="flex flex-col gap-3">
        <div className="flex gap-1 p-1 overflow-x-auto self-start max-w-full rounded-xl bg-slate-100 dark:bg-night-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((key) => (
            <button
              type="button"
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 h-9 shrink-0 rounded-lg text-[13px] font-semibold whitespace-nowrap cursor-pointer ${
                tab === key
                  ? "bg-white dark:bg-night-700 text-blue-600 dark:text-blue-400 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:shadow-none"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {t(`sms.tabs.${key}`)}
            </button>
          ))}
        </div>

      {tab === "history" &&
        (error ? (
          <div className="flex flex-col items-center justify-center w-full h-48 gap-3 text-slate-400 dark:text-slate-500">
            <HiChatBubbleLeftRight className="text-4xl" />
            <p className="text-sm">{t("sms.loadError")}</p>
            <Button variant="outlined" onClick={fetchAll}>
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <List
            columns={columns}
            rows={rows}
            loading={loading}
            empty={t("sms.empty")}
            page={meta.page}
            totalPages={meta.totalPages}
            onPageChange={setPage}
            showPagination
          />
        ))}
      {tab === "transactions" && <SmsTransactionsTab refreshKey={refreshKey} />}
      {tab === "purchases" && <SmsPurchasesTab refreshKey={refreshKey} />}

      </div>

      {isOwner && <BuyPackageDialog open={buyOpen} onClose={() => setBuyOpen(false)} />}
      <SmsBatchDialog key={selected?._id || "none"} batch={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export default Sms;
