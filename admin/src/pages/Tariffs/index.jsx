import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlus, HiPencilSquare, HiTrash, HiUsers, HiBuildingOffice2 } from "react-icons/hi2";
import { HiAcademicCap, HiUserGroup } from "react-icons/hi";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Chip from "../../ui/Chip";
import Loading from "../../ui/Loading";
import Dialog from "../../ui/Dialog";
import TariffDialog from "./TariffDialog";
import { ALL_PERMISSIONS } from "./permissionCatalog";

const TOTAL_PERMISSIONS = ALL_PERMISSIONS.length;

const formatPrice = (price) =>
  Number(price || 0)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default function Tariffs() {
  const { t } = useTranslation();
  const formatLimit = (n) => (n === -1 ? t("tariff.unlimited") : n);
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTariff, setActiveTariff] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchTariffs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/tariffs");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setTariffs(data);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchTariffs, 0);
    return () => clearTimeout(timeout);
  }, []);

  const openCreate = () => {
    setActiveTariff(null);
    setDialogOpen(true);
  };

  const openEdit = (tariff) => {
    setActiveTariff(tariff);
    setDialogOpen(true);
  };

  const onSaved = (saved) => {
    setTariffs((prev) => {
      const exists = prev.some((t) => t._id === saved._id);
      const next = exists
        ? prev.map((t) => (t._id === saved._id ? saved : t))
        : [...prev, saved];
      return next.slice().sort((a, b) => a.price - b.price);
    });
  };

  const confirmDelete = async () => {
    try {
      setDeleteLoading(true);
      const res = await api.delete(`/tariffs/${deleteTarget._id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setTariffs((prev) => prev.filter((t) => t._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full">
        <p className="text-[18px] font-semibold text-slate-800">
          {t("tariff.title")}{" "}
          <span className="text-slate-400 text-sm font-normal">({tariffs.length})</span>
        </p>
        <Button onClick={openCreate}>
          <HiPlus className="text-base" />
          {t("tariff.new")}
        </Button>
      </div>

      {loading ? (
        <Loading height="40vh" />
      ) : tariffs.length === 0 ? (
        <div className="flex items-center justify-center w-full h-40 text-slate-400 text-sm">
          {t("tariff.empty")}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          {tariffs.map((tariff) => {
            const permCount = tariff.allowedPermissions?.length || 0;
            const isAllAllowed = permCount > 0 && permCount === TOTAL_PERMISSIONS;

            return (
              <div
                key={tariff._id}
                className="flex flex-col gap-3 w-full bg-white border border-slate-200 rounded-xl p-4"
              >
                <div className="flex items-start justify-between w-full gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{tariff.name}</p>
                    {!!tariff.trialDays && (
                      <p className="text-[12px] text-emerald-600">
                        {t("tariff.trialDaysValue", { count: tariff.trialDays })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton variant="ghost" onClick={() => openEdit(tariff)}>
                      <HiPencilSquare />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      color="red"
                      onClick={() => setDeleteTarget(tariff)}
                    >
                      <HiTrash />
                    </IconButton>
                  </div>
                </div>

                <p className="text-[22px] font-bold text-slate-900">
                  {formatPrice(tariff.price)}{" "}
                  <span className="text-sm font-normal text-slate-400">
                    so'm / {t("tariff.perMonth")}
                  </span>
                </p>

                <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <HiUsers className="text-slate-400" />
                    {formatLimit(tariff.studentLimit)} {t("tariff.studentLimit")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HiBuildingOffice2 className="text-slate-400" />
                    {formatLimit(tariff.centerLimit)} {t("tariff.centerLimit")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HiAcademicCap className="text-slate-400" />
                    {formatLimit(tariff.teacherLimit)} {t("tariff.teacherLimit")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HiUserGroup className="text-slate-400" />
                    {formatLimit(tariff.receptionLimit)} {t("tariff.receptionLimit")}
                  </div>
                </div>

                <div>
                  {isAllAllowed ? (
                    <Chip value={t("tariff.allAllowed")} color="emerald" />
                  ) : (
                    <Chip
                      value={`${permCount}/${TOTAL_PERMISSIONS} ${t("tariff.permissions")}`}
                      color="slate"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TariffDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        tariff={activeTariff}
        tariffs={tariffs}
        onSaved={onSaved}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("tariff.deleteTitle")}
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
        <p className="text-slate-700 text-sm">
          {t("tariff.deleteConfirm", { name: deleteTarget?.name })}
        </p>
      </Dialog>
    </div>
  );
}
