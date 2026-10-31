import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPencil, HiPlus, HiTrash } from "react-icons/hi2";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import IconButton from "../../ui/IconButton";
import List from "../../ui/List";
import Dialog from "../../ui/Dialog";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import PackageDialog from "./PackageDialog";
import { fmtNum } from "./smsMeta";

function PackagesTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ open: false, key: 0, pkg: null });
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/sms/packages");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchRows, 0);
    return () => clearTimeout(timer);
  }, [fetchRows]);

  const open = (pkg = null) => setDialog((d) => ({ open: true, key: d.key + 1, pkg }));

  const remove = async () => {
    try {
      setRemoving(true);
      const res = await api.delete(`/admin/sms/packages/${removeTarget._id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setRemoveTarget(null);
      fetchRows();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setRemoving(false);
    }
  };

  const columns = [
    { key: "name", header: t("sms.packageName"), render: (row) => <span className="font-semibold text-slate-800">{row.name}</span> },
    { key: "smsCount", header: t("sms.smsCount"), render: (row) => fmtNum(row.smsCount) },
    { key: "price", header: t("sms.price"), render: (row) => `${fmtNum(row.price)} ${t("sms.som")}` },
    {
      key: "validity",
      header: t("sms.validityDays"),
      render: (row) => (row.validityDays > 0 ? t("sms.validity", { count: row.validityDays }) : t("sms.unlimited")),
    },
    { key: "order", header: t("sms.order"), render: (row) => row.order ?? 0 },
    {
      key: "active",
      header: t("sms.active"),
      render: (row) => <Chip value={row.active ? t("sms.on") : t("sms.off")} color={row.active ? "emerald" : "slate"} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton onClick={() => open(row)}>
            <HiPencil />
          </IconButton>
          <IconButton onClick={() => setRemoveTarget(row)}>
            <HiTrash />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button onClick={() => open()} className="gap-1.5">
          <HiPlus className="text-base" />
          {t("sms.createPackage")}
        </Button>
      </div>
      <List columns={columns} rows={rows} loading={loading} empty={t("sms.emptyPackages")} />
      <PackageDialog
        key={dialog.key}
        open={dialog.open}
        pkg={dialog.pkg}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={fetchRows}
      />
      <Dialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={t("sms.deletePackage")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setRemoveTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={removing} onClick={remove}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p>{t("sms.deletePackageConfirm", { name: removeTarget?.name })}</p>
      </Dialog>
    </div>
  );
}

export default PackagesTab;
