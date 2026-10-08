import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  HiArrowPath,
  HiBuildingOffice2,
  HiChevronLeft,
  HiChevronRight,
  HiEye,
  HiMagnifyingGlass,
  HiPencil,
  HiPlus,
  HiTrash,
} from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import LazyImage from "../../ui/LazyImage";
import Loading from "../../ui/Loading";
import DropMenu from "../../ui/DropMenu";
import CenterDialog from "./CenterDialog";
import { api, API } from "../../utils/fetching";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { errorMsg, successMsg } from "../../utils/alert";
import useQueryState from "../../hooks/useQueryState";

function Centers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subscription } = useSelector((e) => e.user);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  // Qidiruv/sahifa URL query-param'da (useQueryState) — Detail'ga kirib "Orqaga"
  // bilan qaytilganda list qayta mount bo'lsa ham joyida qoladi.
  const [page, setPage] = useQueryState("page", 1);
  const [search, setSearch] = useQueryState("search", "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [unblockTarget, setUnblockTarget] = useState(null);
  const [unblocking, setUnblocking] = useState(false);

  // Tarif limiti — bloklangan filialni qayta yoqish uchun joy bormi.
  // Yakuniy haqiqat manbai baribir backend (`/centers/:id/unblock`), bu
  // faqat tugmani behuda ko'rsatmaslik uchun.
  const centerLimit = subscription?.tariffSnapshot?.centerLimit;
  const activeCount = rows.filter((c) => c.status !== "blocked").length;
  const canUnblock = centerLimit == null || centerLimit === -1 || activeCount < centerLimit;

  const fetchCenters = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/centers", { params: { page, search } });
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
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(fetchCenters, 0);
    return () => clearTimeout(t);
  }, [fetchCenters]);

  // Tarif o'zgarishi / downgrade tanlovi — kartalar holati realtime yangilanadi.
  useSocketEvent("center:statusChanged", fetchCenters);

  const openCreate = () => {
    const limit = subscription?.tariffSnapshot?.centerLimit;
    if (limit != null && limit !== -1 && meta.total >= limit) {
      errorMsg("center.limitReached");
      return;
    }
    setSelected(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const openEdit = (center) => {
    setSelected(center);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await api.delete(`/centers/${deleteTarget._id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setDeleteTarget(null);
      fetchCenters();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const confirmUnblock = async () => {
    if (!unblockTarget) return;
    try {
      setUnblocking(true);
      const res = await api.post(`/centers/${unblockTarget._id}/unblock`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setUnblockTarget(null);
      fetchCenters();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setUnblocking(false);
    }
  };

  const pageNumbers = getPageNumbers(meta.page, meta.totalPages);

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">
        <div className="w-full sm:w-80">
          <Input
            placeholder={t("common.search")}
            icon={<HiMagnifyingGlass />}
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="gap-1.5">
            <HiPlus className="text-base" />
            {t("center.create")}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
          <HiBuildingOffice2 className="text-4xl" />
          <p className="text-sm">{t("center.loadError")}</p>
          <Button variant="outlined" onClick={fetchCenters}>
            {t("common.retry")}
          </Button>
        </div>
      ) : loading ? (
        <Loading height="40vh" />
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center w-full flex-1 text-slate-400 dark:text-slate-500 text-sm">
          {t("center.empty")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rows.map((center) => {
              // Bloklangan filial — tarif pasayganda tanlanmagan markaz.
              // Ma'lumot o'chirilmaydi, faqat ishlamaydi: karta kulrang
              // ko'rinadi va ichiga kirilmaydi (docs/API_CONTRACT.md §7).
              const blocked = center.status === "blocked";

              return (
              <div
                key={center._id}
                onClick={() => navigate(`/centers/${center._id}`)}
                className={`flex flex-col gap-3 p-5 rounded-xl border bg-white dark:bg-night-900 duration-200 ${
                  blocked
                    ? "border-slate-200 dark:border-night-700 bg-slate-50 dark:bg-night-800 cursor-pointer"
                    : "border-slate-200 dark:border-night-700 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-none cursor-pointer"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  {center.logo ? (
                    <LazyImage
                      src={
                        center.logo.startsWith("http")
                          ? center.logo
                          : `${API}${center.logo}`
                      }
                      className={`w-18 h-18 rounded-full object-cover shrink-0 bg-slate-100 dark:bg-night-800 ${
                        blocked ? "grayscale opacity-60" : ""
                      }`}
                    />
                  ) : (
                    <div className="w-18 h-18 rounded-full bg-slate-100 dark:bg-night-800 flex items-center justify-center text-slate-400 dark:text-slate-500 text-2xl shrink-0">
                      <HiBuildingOffice2 />
                    </div>
                  )}

                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropMenu
                      items={[
                        {
                          label: t("common.detail"),
                          icon: HiEye,
                          iconClass: "bg-slate-50 dark:bg-night-800 text-slate-600 dark:text-slate-300",
                          onClick: () => navigate(`/centers/${center._id}`),
                        },
                        // Bloklangan filial Read-Only — tahrirlash yashiriladi.
                        ...(blocked
                          ? []
                          : [
                              {
                                label: t("common.edit"),
                                icon: HiPencil,
                                iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                                onClick: () => openEdit(center),
                              },
                            ]),
                        {
                          label: t("common.delete"),
                          icon: HiTrash,
                          iconClass: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
                          onClick: () => setDeleteTarget(center),
                        },
                      ]}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p
                      className={`font-space font-bold text-lg truncate ${
                        blocked ? "text-slate-500 dark:text-slate-400" : "text-slate-800 dark:text-slate-100"
                      }`}
                    >
                      {center.name}
                    </p>
                    {/* `ui/Badge` faqat raqamli nishon uchun — matnli holat
                        yorlig'i loyihada `Chip` bilan beriladi. */}
                    {blocked && <Chip value={t("center.blocked")} color="slate" />}
                  </div>
                  {center.slogan && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {center.slogan}
                    </p>
                  )}
                </div>

                {blocked && (
                  <div
                    className="flex flex-col gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs text-amber-800 dark:text-amber-400">{t("center.blockedHint")}</p>
                    <Button
                      color="emerald"
                      variant="outlined"
                      disabled={!canUnblock}
                      className="gap-1.5 w-full"
                      onClick={() => setUnblockTarget(center)}
                    >
                      <HiArrowPath className="text-base" />
                      {t("center.unblock")}
                    </Button>
                    {!canUnblock && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">{t("center.unblockLimit")}</p>
                    )}
                  </div>
                )}

                {center.date && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-night-700">
                    {center.date}
                  </p>
                )}
              </div>
              );
            })}
          </div>

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-end gap-1.5 w-full py-2 shrink-0">
              <button
                type="button"
                disabled={meta.page <= 1}
                onClick={() => setPage(Math.max(1, meta.page - 1))}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-night-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent duration-200"
              >
                <HiChevronLeft />
              </button>

              {pageNumbers.map((p, i) =>
                p === "..." ? (
                  <span
                    key={`dots-${i}`}
                    className="inline-flex items-center justify-center w-8 h-8 text-slate-400 dark:text-slate-500 text-sm"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPage(p)}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium duration-200 ${
                      p === meta.page
                        ? "bg-slate-800 text-white"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-night-800"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}

              <button
                type="button"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage(Math.min(meta.totalPages, meta.page + 1))}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-night-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent duration-200"
              >
                <HiChevronRight />
              </button>
            </div>
          )}
        </>
      )}

      <CenterDialog
        key={dialogKey}
        open={dialogOpen}
        center={selected}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchCenters}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("center.delete")}
        actions={
          <>
            <Button
              color="black"
              variant="text"
              onClick={() => setDeleteTarget(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={deleting} onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p>{t("center.deleteConfirm", { name: deleteTarget?.name })}</p>
      </Dialog>

      <Dialog
        open={!!unblockTarget}
        onClose={() => setUnblockTarget(null)}
        title={t("center.unblock")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setUnblockTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="emerald" loading={unblocking} onClick={confirmUnblock}>
              {t("center.unblock")}
            </Button>
          </>
        }
      >
        <p>{t("center.unblockConfirm", { name: unblockTarget?.name })}</p>
      </Dialog>
    </div>
  );
}

function getPageNumbers(page, totalPages) {
  const delta = 1;
  const range = [];
  const rangeWithDots = [];
  let last;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      range.push(i);
    }
  }

  for (const i of range) {
    if (last) {
      if (i - last === 2) rangeWithDots.push(last + 1);
      else if (i - last > 2) rangeWithDots.push("...");
    }
    rangeWithDots.push(i);
    last = i;
  }

  return rangeWithDots;
}

export default Centers;
