import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiBuildingOffice2,
  HiUserGroup,
  HiAcademicCap,
  HiUsers,
  HiSquares2X2,
  HiBookOpen,
  HiInbox,
  HiBanknotes,
} from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Loading from "../../ui/Loading";
import NumberText from "../../ui/NumberText";

const COLORS = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  slate: "bg-slate-100 text-slate-600",
};

// limit: -1 — cheksiz, null — obuna yo'q (limit ko'rsatilmaydi).
const limitText = (limit, t) => (limit === null || limit === undefined ? "" : limit < 0 ? ` / ${t("client.stats.unlimited")}` : ` / ${limit}`);

function Tile({ icon, color, label, value, suffix = "", lines = [] }) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-lg text-xl ${COLORS[color]}`}>{icon}</div>
        <div className="flex flex-col min-w-0">
          <span className="flex items-baseline gap-1">
            <NumberText className="text-xl leading-tight">{value}</NumberText>
            {suffix && <span className="text-[12px] text-slate-400">{suffix}</span>}
          </span>
          <span className="text-[12px] text-slate-400 truncate">{label}</span>
        </div>
      </div>
      {lines.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-2 border-t border-slate-100 text-[12px] text-slate-500">
          {lines.map(([k, v]) => (
            <span key={k}>
              {k}: <b className="font-semibold text-slate-700">{v}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientStatsDialog({ open, onClose, client }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !client?._id) return undefined;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setStats(null);
        const res = await api.get(`/clients/${client._id}/stats`);
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        if (alive) setStats(data);
      } catch (error) {
        errorMsg(error.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, client?._id]);

  const s = stats;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={client?.name || t("client.stats.title")}
      className="md:w-170"
      actions={
        <Button color="slate" variant="text" onClick={onClose}>
          {t("common.close")}
        </Button>
      }
    >
      {loading || !s ? (
        <div className="flex justify-center py-10">
          <Loading />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Tile
            icon={<HiBuildingOffice2 />}
            color="blue"
            label={t("client.stats.centers")}
            value={s.centers.total}
            suffix={limitText(s.centers.limit, t).replace(" / ", "/ ")}
            lines={[[t("client.stats.blockedCenters"), s.centers.blocked]]}
          />
          <Tile
            icon={<HiUsers />}
            color="violet"
            label={t("client.stats.staff")}
            value={s.staff.total}
            lines={[
              [t("client.stats.teacher"), `${s.staff.teacher.used}${limitText(s.staff.teacher.limit, t)}`],
              [t("client.stats.reception"), `${s.staff.reception.used}${limitText(s.staff.reception.limit, t)}`],
              [t("client.stats.assistant"), s.staff.assistant],
            ]}
          />
          <Tile
            icon={<HiAcademicCap />}
            color="emerald"
            label={t("client.stats.students")}
            value={s.students.active}
            suffix={limitText(s.students.limit, t).replace(" / ", "/ ")}
            lines={[
              [t("client.stats.studentsLeft"), s.students.left],
              [t("client.stats.studentsArchived"), s.students.archived],
            ]}
          />
          <Tile
            icon={<HiUserGroup />}
            color="amber"
            label={t("client.stats.groups")}
            value={s.groups.active}
            lines={[
              [t("client.stats.groupsPending"), s.groups.pending],
              [t("client.stats.groupsFinished"), s.groups.finished],
              [t("client.stats.groupsIndividual"), s.groups.individual],
            ]}
          />
          <Tile icon={<HiSquares2X2 />} color="slate" label={t("client.stats.rooms")} value={s.rooms} />
          <Tile icon={<HiBookOpen />} color="slate" label={t("client.stats.subjects")} value={s.subjects} />
          <Tile icon={<HiInbox />} color="slate" label={t("client.stats.leads")} value={s.leads} />
          <Tile
            icon={<HiBanknotes />}
            color="emerald"
            label={t("client.stats.subPayments")}
            value={Number(s.payments.total).toLocaleString("uz-UZ")}
            lines={[[t("client.stats.paymentsCount"), s.payments.count]]}
          />
        </div>
      )}
    </Dialog>
  );
}
