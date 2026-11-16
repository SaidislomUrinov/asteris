import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import TimeInput from "../../ui/TimeInput";
import Loading from "../../ui/Loading";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { sendQuizTemplate } from "../../api/quiz";

const DEFAULT_DURATION = 10;
const pad = (n) => String(n).padStart(2, "0");

// Standart boshlanish — hozirdan 5 daqiqa keyin (SendQuizDialog bilan bir xil).
const defaultStart = () => {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Shablondan test yuborish — guruh tanlash (shu fan + shu o'qituvchi/
 * yordamchi) + startAt/durationMin (API_CONTRACT_quiz_templates.md).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {{_id, title, subject}} props.template
 * @param {(quiz) => void} [props.onSent]
 */
function SendTemplateDialog({ open, onClose, template, onSent }) {
  const { t } = useTranslation();
  const { _id: myId } = useSelector((e) => e.user);
  const [groups, setGroups] = useState(null);
  const [groupId, setGroupId] = useState("");
  const [startAt, setStartAt] = useState(defaultStart);
  const [durationMin, setDurationMin] = useState(String(DEFAULT_DURATION));
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !template) return;
    let cancelled = false;
    // `setTimeout(…, 0)` — loyihadagi react-hooks/set-state-in-effect naqshi.
    const id = setTimeout(() => {
      setGroups(null);
      setGroupId("");
      setStartAt(defaultStart());
      setDurationMin(String(template.defaultDurationMin || DEFAULT_DURATION));
    }, 0);
    (async () => {
      try {
        const res = await api.get("/groups", { params: { page: 1 } });
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        const subjectId = template.subject?._id || template.subject;
        const mine = (data || []).filter(
          (g) => String(g.subject) === String(subjectId) && (String(g.teacher) === String(myId) || String(g.assistant) === String(myId)),
        );
        if (cancelled) return;
        setGroups(mine);
        if (mine.length === 1) setGroupId(mine[0]._id);
      } catch (err) {
        if (!cancelled) {
          setGroups([]);
          errorMsg(err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, template, myId]);

  const duration = Number(durationMin);
  const valid = groupId && /^\d{2}:\d{2}$/.test(startAt) && Number.isFinite(duration) && duration >= 1 && duration <= 180;

  const submit = async () => {
    if (!valid || sending) return;
    try {
      setSending(true);
      const res = await sendQuizTemplate(template._id, { groupId, startAt, durationMin: duration });
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg || "quiz.template.sent");
      onSent?.(data);
      onClose();
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setSending(false);
    }
  };

  const options = (groups || []).map((g) => ({
    value: g._id,
    label: g.name || `${g.status === "pending" ? g.pendingId : g.activeId}`,
  }));

  return (
    <Dialog
      open={open}
      onClose={() => !sending && onClose()}
      title={t("quiz.template.sendTitle")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose} disabled={sending}>
            {t("common.cancel")}
          </Button>
          <Button loading={sending} disabled={!valid} onClick={submit}>
            {t("quiz.template.send")}
          </Button>
        </>
      }
    >
      {groups === null ? (
        <div className="flex items-center justify-center py-8">
          <Loading />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-4 text-sm text-slate-500 dark:text-slate-400">{t("quiz.template.noGroups")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Select
            label={t("quiz.template.pickGroup")}
            placeholder={t("quiz.template.pickGroup")}
            value={groupId}
            onChange={setGroupId}
            options={options}
          />
          <div className="grid grid-cols-2 gap-3">
            <TimeInput label={t("quiz.send.startAt")} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            <Input
              label={t("quiz.send.duration")}
              type="number"
              min={1}
              max={180}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              error={durationMin !== "" && !(duration >= 1 && duration <= 180)}
            />
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default SendTemplateDialog;
