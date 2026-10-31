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
import TemplateDialog from "./TemplateDialog";
import { TOPIC_COLOR } from "./smsMeta";

function TemplatesTab() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState({ open: false, key: 0, template: null });
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/sms/templates");
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

  const open = (template = null) => setDialog((d) => ({ open: true, key: d.key + 1, template }));

  const remove = async () => {
    try {
      setRemoving(true);
      const res = await api.delete(`/admin/sms/templates/${removeTarget._id}`);
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
    {
      key: "title",
      header: t("sms.templateTitle"),
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-slate-800">{row.title}</span>
          <span className="text-xs text-slate-500 w-72 sm:w-[28rem] whitespace-normal leading-relaxed">{row.text}</span>
        </div>
      ),
    },
    {
      key: "topic",
      header: t("sms.topic"),
      render: (row) => <Chip value={t(`sms.topics.${row.topic}`)} color={TOPIC_COLOR[row.topic]} />,
    },
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
          {t("sms.createTemplate")}
        </Button>
      </div>
      <List columns={columns} rows={rows} loading={loading} empty={t("sms.emptyTemplates")} />
      <TemplateDialog
        key={dialog.key}
        open={dialog.open}
        template={dialog.template}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={fetchRows}
      />
      <Dialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={t("sms.deleteTemplate")}
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
        <p>{t("sms.deleteConfirm", { title: removeTarget?.title })}</p>
      </Dialog>
    </div>
  );
}

export default TemplatesTab;
