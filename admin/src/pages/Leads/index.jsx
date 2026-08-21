import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  HiOutlineDocumentText,
  HiMagnifyingGlass,
  HiPencilSquare,
} from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg } from "../../utils/alert";
import socket from "../../socket";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import StatusDialog from "./StatusDialog";
import ConfirmClientDialog from "./ConfirmClientDialog";
import { STATUSES, STATUS_COLOR } from "./statusMeta";

export default function Leads() {
  const { t } = useTranslation();
  const nv = useNavigate();
  const own = useSelector((e) => e.user);
  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewers, setViewers] = useState({}); // leadId -> { adminId, name }

  const [activeLead, setActiveLead] = useState(null);
  const [confirmLead, setConfirmLead] = useState(null);

  const isSearching = !!search.trim();
  const fetchLeadsRef = useRef(() => {});

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await api.get("/leads", { params: { page, search, status } });
      const { ok, data, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setLeads(data);
      setMeta(m);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadsRef.current = fetchLeads;
  });

  useEffect(() => {
    const timeout = setTimeout(fetchLeads, isSearching ? 350 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status]);

  const patchLeadInList = (updated) => {
    setLeads((prev) => prev.map((l) => (l._id === updated._id ? updated : l)));
    setActiveLead((prev) => (prev?._id === updated._id ? updated : prev));
  };

  // Boshqa admin lead yaratsa/tahrirlasa — barcha adminlar realtime yangilanadi
  useEffect(() => {
    const onCreated = () => fetchLeadsRef.current();
    const onUpdated = (lead) => {
      setLeads((prev) =>
        prev.some((l) => l._id === lead._id)
          ? prev.map((l) => (l._id === lead._id ? lead : l))
          : prev,
      );
      setActiveLead((prev) => (prev?._id === lead._id ? lead : prev));
    };
    const onViewing = ({ leadId, admin }) =>
      setViewers((prev) => ({ ...prev, [leadId]: admin }));
    const onViewingStop = ({ leadId }) =>
      setViewers((prev) => {
        const next = { ...prev };
        delete next[leadId];
        return next;
      });

    socket.on("lead:created", onCreated);
    socket.on("lead:updated", onUpdated);
    socket.on("lead:viewing", onViewing);
    socket.on("lead:viewingStop", onViewingStop);

    return () => {
      socket.off("lead:created", onCreated);
      socket.off("lead:updated", onUpdated);
      socket.off("lead:viewing", onViewing);
      socket.off("lead:viewingStop", onViewingStop);
    };
  }, []);

  // Shu admin qaysi leadni ochsa — boshqalarga "ko'rayapman" deb signal beradi
  useEffect(() => {
    if (!activeLead) return;
    socket.emit("lead:view", { leadId: activeLead._id });
    return () => socket.emit("lead:unview", { leadId: activeLead._id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLead?._id]);

  const columns = [
    {
      key: "name",
      header: t("lead.name"),
      className: "font-medium text-slate-800",
      render: (lead) => {
        const viewer = viewers[lead._id];
        const viewedByOther = viewer && viewer.adminId !== own?._id;
        return (
          <span className="relative">
            {viewedByOther && (
              <span className="absolute -top-4 left-0 bg-black text-white text-[9px] leading-none px-1.5 py-1 rounded-md font-semibold shadow z-20 whitespace-nowrap">
                {viewer.name || t("lead.viewing")}
              </span>
            )}
            {lead.name}
          </span>
        );
      },
    },
    {
      key: "phone",
      header: t("lead.phone"),
      className: "text-slate-600",
      render: (lead) => lead.phone,
    },
    {
      key: "platform",
      header: t("lead.platform"),
      className: "text-slate-600",
      render: (lead) => t(`platform.${lead.platform}`),
    },
    {
      key: "status",
      header: t("lead.status"),
      render: (lead) => (
        <Chip value={t(`status.${lead.status}`)} color={STATUS_COLOR[lead.status]} />
      ),
    },
    {
      key: "date",
      header: t("lead.date"),
      className: "text-slate-500",
      render: (lead) => lead.date,
    },
    {
      key: "actions",
      header: t("common.actions"),
      className: "text-right",
      render: (lead) => (
        <IconButton variant="ghost" onClick={() => setActiveLead(lead)}>
          <HiPencilSquare />
        </IconButton>
      ),
    },
  ];

  return (
    <div className="flex flex-col w-full h-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full shrink-0">
        <p className="text-[18px] font-semibold text-slate-800">
          {t("lead.title")}{" "}
          <span className="text-slate-400 text-sm font-normal">
            ({meta.total})
          </span>
        </p>
        <Button onClick={() => nv("/leads/docs")}>
          <HiOutlineDocumentText className="text-base" />
          {t("lead.docs")}
        </Button>
      </div>

      <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-zinc-200 w-full justify-center shrink-0">
        <div className="w-1/2 flex items-center justify-center">
          <Input
            placeholder={t("lead.searchPlaceholder")}
            icon={<HiMagnifyingGlass />}
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="w-1/2 flex items-center justify-center">
          <Select
            placeholder={t("lead.allStatuses")}
            value={status}
            disabled={isSearching}
            onChange={(v) => {
              setPage(1);
              setStatus(v);
            }}
            options={[
              { value: "", label: t("lead.allStatuses") },
              ...STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
            ]}
          />
        </div>
      </div>

      <List
        columns={columns}
        rows={leads}
        rowKey={(lead) => lead._id}
        rowClassName={(lead) => {
          const viewer = viewers[lead._id];
          const viewedByOther = viewer && viewer.adminId !== own?._id;
          return viewedByOther ? "outline-2 outline-black z-10" : "";
        }}
        loading={loading}
        empty={t("lead.empty")}
        page={page}
        totalPages={meta.totalPages}
        total={meta.total}
        onPageChange={setPage}
        showPagination={!isSearching}
      />

      <StatusDialog
        lead={activeLead}
        onClose={() => setActiveLead(null)}
        onUpdated={patchLeadInList}
        onConfirmed={(lead) => setConfirmLead(lead)}
      />

      <ConfirmClientDialog
        lead={confirmLead}
        onClose={() => setConfirmLead(null)}
        onCreated={(client) =>
          patchLeadInList({ ...confirmLead, client: client._id })
        }
      />
    </div>
  );
}
