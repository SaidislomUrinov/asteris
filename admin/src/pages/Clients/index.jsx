import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiPlus,
  HiMagnifyingGlass,
  HiPencilSquare,
  HiLockClosed,
  HiLockOpen,
  HiTag,
  HiArrowPath,
  HiXCircle,
  HiTrash,
} from "react-icons/hi2";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Dialog from "../../ui/Dialog";
import DropMenu from "../../ui/DropMenu";
import ClientDialog from "./ClientDialog";
import SubscriptionDialog from "./SubscriptionDialog";

export default function Clients() {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeClient, setActiveClient] = useState(null);
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subClient, setSubClient] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isSearching = !!search.trim();
  const fetchRef = useRef(() => {});

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await api.get("/clients", { params: { page, search } });
      const { ok, data, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setClients(data);
      setMeta(m);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRef.current = fetchClients;
  });

  useEffect(() => {
    const timeout = setTimeout(fetchClients, isSearching ? 350 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/tariffs");
        if (res.data?.ok) setTariffs(res.data.data);
      } catch {
        // tariflar bo'lmasa ham mijozlar ro'yxati ishlashda davom etadi
      }
    })();
  }, []);

  const patchClientInList = (updated) => {
    setClients((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
  };

  const openCreate = () => {
    setActiveClient(null);
    setDialogOpen(true);
  };
  const openEdit = (client) => {
    setActiveClient(client);
    setDialogOpen(true);
  };
  const openSubscribe = (client) => {
    setSubClient(client);
    setSubDialogOpen(true);
  };

  const onSaved = (client) => {
    const exists = clients.some((c) => c._id === client._id);
    if (exists) patchClientInList(client);
    else fetchClients();
  };

  const toggleBlock = async (client) => {
    try {
      const res = await api.patch(`/clients/${client._id}/${client.blocked ? "unblock" : "block"}`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      patchClientInList(data);
    } catch (error) {
      errorMsg(error.message);
    }
  };

  const unsubscribe = async (client) => {
    try {
      const res = await api.post(`/clients/${client._id}/unsubscribe`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      patchClientInList(data);
    } catch (error) {
      errorMsg(error.message);
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleteLoading(true);
      const res = await api.delete(`/clients/${deleteTarget._id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setClients((prev) => prev.filter((c) => c._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: t("client.name"),
      className: "font-medium text-slate-800",
      render: (c) => c.name,
    },
    {
      key: "phone",
      header: t("client.phone"),
      className: "text-slate-600",
      render: (c) => c.phone,
    },
    {
      key: "slug",
      header: t("client.slug"),
      render: (c) =>
        c.slug ? (
          <a
            href={c.appUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-blue-600 hover:underline"
          >
            {c.appUrl.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: t("client.status"),
      render: (c) =>
        c.blocked ? (
          <Chip value={t("client.blocked")} color="red" />
        ) : c.subscription ? (
          <Chip value={t("client.active")} color="emerald" />
        ) : (
          <Chip value={t("client.noSubscription")} color="slate" />
        ),
    },
    {
      key: "tariff",
      header: t("client.tariff"),
      className: "text-slate-600",
      render: (c) =>
        c.subscription ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-slate-700">
              {c.subscription.tariffSnapshot?.name} — {Number(c.subscription.price || 0).toLocaleString("uz-UZ")}
            </span>
            <span className="text-[11px] text-slate-400">
              {t("client.until")} {c.subscription.endDateText}
            </span>
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: "date",
      header: t("client.date"),
      className: "text-slate-500",
      render: (c) => c.date,
    },
    {
      key: "actions",
      header: t("common.actions"),
      className: "text-right",
      render: (c) => (
        <div className="flex items-center justify-end">
          <DropMenu
            items={[
              {
                label: t("common.edit"),
                icon: HiPencilSquare,
                iconClass: "bg-blue-100 text-blue-500",
                onClick: () => openEdit(c),
              },
              c.blocked
                ? {
                    label: t("client.unblock"),
                    icon: HiLockOpen,
                    iconClass: "bg-emerald-100 text-emerald-500",
                    onClick: () => toggleBlock(c),
                  }
                : {
                    label: t("client.block"),
                    icon: HiLockClosed,
                    iconClass: "bg-orange-100 text-orange-500",
                    onClick: () => toggleBlock(c),
                  },
              c.subscription
                ? {
                    label: t("client.changeTariff"),
                    icon: HiArrowPath,
                    iconClass: "bg-violet-100 text-violet-500",
                    onClick: () => openSubscribe(c),
                  }
                : {
                    label: t("client.subscribe"),
                    icon: HiTag,
                    iconClass: "bg-emerald-100 text-emerald-500",
                    onClick: () => openSubscribe(c),
                  },
              ...(c.subscription
                ? [
                    {
                      label: t("client.unsubscribe"),
                      icon: HiXCircle,
                      iconClass: "bg-orange-100 text-orange-500",
                      onClick: () => unsubscribe(c),
                    },
                  ]
                : []),
              {
                label: t("common.delete"),
                icon: HiTrash,
                iconClass: "bg-red-100 text-red-500",
                onClick: () => setDeleteTarget(c),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col w-full h-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full shrink-0">
        <p className="text-[18px] font-semibold text-slate-800">
          {t("client.title")}{" "}
          <span className="text-slate-400 text-sm font-normal">({meta.total})</span>
        </p>
        <Button onClick={openCreate}>
          <HiPlus className="text-base" />
          {t("client.new")}
        </Button>
      </div>

      <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-zinc-200 w-full shrink-0">
        <Input
          placeholder={t("client.searchPlaceholder")}
          icon={<HiMagnifyingGlass />}
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </div>

      <List
        columns={columns}
        rows={clients}
        rowKey={(c) => c._id}
        loading={loading}
        empty={t("client.empty")}
        page={page}
        totalPages={meta.totalPages}
        onPageChange={setPage}
        showPagination={!isSearching}
      />

      <ClientDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        client={activeClient}
        onSaved={onSaved}
      />

      <SubscriptionDialog
        open={subDialogOpen}
        onClose={() => setSubDialogOpen(false)}
        client={subClient}
        tariffs={tariffs}
        onSaved={(data) => {
          patchClientInList(data);
          setSubClient(data);
        }}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("client.deleteTitle")}
        actions={
          <>
            <Button color="slate" variant="text" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={deleteLoading} onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-slate-700">
          {t("client.deleteConfirm", { name: deleteTarget?.name })}
        </p>
      </Dialog>
    </div>
  );
}
