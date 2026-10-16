import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import CenterDialog from "./CenterDialog";
import { api, notifyCentersChanged } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import switchCenter from "../../utils/switchCenter";
import { CENTER_CREATE_EVENT, CENTER_UNBLOCK_EVENT } from "../../utils/centerActions";

// Tarif limiti: -1 / yo'q — cheklovsiz. Bloklangan filial ham hisobga kiradi
// (backend ham shunday sanaydi), arxivlangani — yo'q.
const limitOf = (subscription) => subscription?.tariffSnapshot?.centerLimit;
const isUnlimited = (limit) => limit == null || limit === -1;

/**
 * Filial qo'shish va bloklangan filialni qayta yoqish oynalari — App'da bitta
 * nusxa, faqat Client Owner uchun (Center CRUD hodim ruxsati emas). Ochish:
 * utils/centerActions.js. Yaratilgan filialga darhol o'tiladi.
 */
export default function CenterActionsHost() {
  const { t } = useTranslation();
  const { centers = [], subscription } = useSelector((e) => e.user);
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [unblockTarget, setUnblockTarget] = useState(null);
  const [unblocking, setUnblocking] = useState(false);

  const limit = limitOf(subscription);
  const list = Array.isArray(centers) ? centers : [];
  const activeCount = list.filter((c) => c.status !== "blocked").length;

  useEffect(() => {
    const onCreate = () => {
      if (!isUnlimited(limit) && list.length >= limit) {
        errorMsg("center.limitReached");
        return;
      }
      setCreateKey((k) => k + 1);
      setCreateOpen(true);
    };
    const onUnblock = (e) => setUnblockTarget(e.detail || null);
    window.addEventListener(CENTER_CREATE_EVENT, onCreate);
    window.addEventListener(CENTER_UNBLOCK_EVENT, onUnblock);
    return () => {
      window.removeEventListener(CENTER_CREATE_EVENT, onCreate);
      window.removeEventListener(CENTER_UNBLOCK_EVENT, onUnblock);
    };
  }, [limit, list.length]);

  const canUnblock = isUnlimited(limit) || activeCount < limit;

  const confirmUnblock = async () => {
    if (!unblockTarget) return;
    try {
      setUnblocking(true);
      const res = await api.post(`/centers/${unblockTarget._id}/unblock`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setUnblockTarget(null);
      notifyCentersChanged();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setUnblocking(false);
    }
  };

  return (
    <>
      <CenterDialog
        key={createKey}
        open={createOpen}
        center={null}
        onClose={() => setCreateOpen(false)}
        onSaved={(created) => {
          // Yangi filialga darhol o'tish (to'liq reload — filial konteksti toza).
          if (created?._id) switchCenter(created._id);
          else notifyCentersChanged();
        }}
      />

      <Dialog
        open={!!unblockTarget}
        onClose={() => setUnblockTarget(null)}
        title={t("center.unblock")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setUnblockTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="emerald" loading={unblocking} disabled={!canUnblock} onClick={confirmUnblock}>
              {t("center.unblock")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <p>{t("center.unblockConfirm", { name: unblockTarget?.name })}</p>
          {!canUnblock && (
            <p className="text-sm text-amber-700 dark:text-amber-400">{t("center.unblockLimit")}</p>
          )}
        </div>
      </Dialog>
    </>
  );
}
