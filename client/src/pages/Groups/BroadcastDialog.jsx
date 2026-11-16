import { useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

const MAX_LENGTH = 4096; // Telegram xabar matnining limiti

function BroadcastDialog({ open, onClose, groupId }) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const close = () => {
    if (sending) return;
    setText("");
    onClose();
  };

  const submit = async () => {
    const value = text.trim();
    if (!value) {
      errorMsg(t("group.broadcast.emptyText"));
      return;
    }
    setSending(true);
    try {
      const res = await api.post(`/groups/${groupId}/broadcast`, { text: value });
      const data = res?.data?.data || {};
      successMsg(t("group.broadcast.sent", { sent: data.sent ?? 0, total: data.total ?? 0 }));
      setText("");
      onClose();
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("group.broadcast.title")}
      widthClass="md:w-125"
      actions={
        <>
          <Button color="black" variant="text" onClick={close} disabled={sending}>
            {t("common.cancel")}
          </Button>
          <Button loading={sending} disabled={!text.trim()} onClick={submit}>
            {t("group.broadcast.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <textarea
          rows={7}
          autoFocus
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("group.broadcast.placeholder")}
          className="w-full resize-y rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 px-3 py-2 text-sm leading-relaxed text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-500 focus:ring-3 ring-blue-500/15 duration-200"
        />
        <span className="self-end text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
          {text.length}/{MAX_LENGTH}
        </span>
      </div>
    </Dialog>
  );
}

export default BroadcastDialog;
