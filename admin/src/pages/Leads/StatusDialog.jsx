import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Select from "../../ui/Select";
import Textarea from "../../ui/Textarea";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { STATUSES, STATUS_COLOR } from "./statusMeta";

export default function StatusDialog({ lead, onClose, onUpdated, onConfirmed }) {
  const { t } = useTranslation();
  const [to, setTo] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const close = () => {
    setTo("");
    setComment("");
    onClose();
  };

  const submit = async () => {
    try {
      if (!to) throw new Error("lead.invalidStatus");
      setLoading(true);
      const res = await api.patch(`/leads/${lead._id}/status`, { to, comment });
      const { ok, data, msg, lockedBy } = res.data;
      if (!ok) {
        const err = new Error(msg);
        err.lockedBy = lockedBy;
        throw err;
      }
      successMsg(msg);
      onUpdated(data);
      if (data.status === "confirmed" && !data.client) {
        onConfirmed(data);
      }
      close();
    } catch (error) {
      errorMsg(error.message, error.lockedBy ? { name: error.lockedBy } : undefined);
    } finally {
      setLoading(false);
    }
  };

  if (!lead) return null;

  const statusOptions = STATUSES.filter((s) => s !== lead.status).map((s) => ({
    value: s,
    label: t(`status.${s}`),
  }));

  return (
    <Dialog
      open={!!lead}
      onClose={close}
      title={t("lead.detail")}
      actions={
        <>
          <Button color="slate" variant="text" onClick={close}>
            {t("common.close")}
          </Button>
          <Button loading={loading} onClick={submit}>
            {t("lead.changeStatus")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center justify-between w-full">
          <p className="font-semibold text-slate-800">{lead.name}</p>
          <Chip
            value={t(`status.${lead.status}`)}
            color={STATUS_COLOR[lead.status]}
          />
        </div>
        <p className="text-sm text-slate-500">{lead.phone}</p>
        <p className="text-sm text-slate-500">
          {t(`platform.${lead.platform}`)}
          {lead.platformNote ? ` — ${lead.platformNote}` : ""}
        </p>
        {lead.comment && (
          <p className="text-sm text-slate-600 mt-1">{lead.comment}</p>
        )}
      </div>

      <div className="w-full border-t border-slate-200 pt-2 mt-1">
        <p className="text-sm font-semibold text-slate-800 mb-2">
          {t("lead.history")}
        </p>
        {lead.statusHistory?.length ? (
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
            {lead.statusHistory
              .slice()
              .reverse()
              .map((h, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-0.5 text-[12px] bg-slate-50 rounded-lg p-2"
                >
                  <div className="flex items-center gap-1.5">
                    {h.from && (
                      <>
                        <Chip value={t(`status.${h.from}`)} color={STATUS_COLOR[h.from]} />
                        <span className="text-slate-400">→</span>
                      </>
                    )}
                    <Chip value={t(`status.${h.to}`)} color={STATUS_COLOR[h.to]} />
                  </div>
                  {h.comment && <p className="text-slate-600">{h.comment}</p>}
                  <p className="text-slate-400">
                    {h.changedBy?.name} · {h.date}
                  </p>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t("lead.historyEmpty")}</p>
        )}
      </div>

      <div className="w-full border-t border-slate-200 pt-2 mt-1 flex flex-col gap-2">
        <Select
          label={t("lead.newStatus")}
          required
          placeholder={t("common.select")}
          value={to}
          onChange={setTo}
          options={statusOptions}
        />
        <Textarea
          label={t("lead.statusComment")}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
    </Dialog>
  );
}
