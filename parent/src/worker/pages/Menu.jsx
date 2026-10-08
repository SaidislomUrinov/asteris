import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { HiOutlineBanknotes, HiOutlineSquares2X2 } from "react-icons/hi2";
import { Card, SectionLabel } from "../../components/Card";
import { EmptyState } from "../../components/States";
import { haptic } from "../../lib/telegram";
import { useWorker } from "../useWorker";
import { FAB_DEFS, MENU_ORDER, ROLE_LAYOUT, TAB_DEFS, defAllowed } from "../constants";
import { WorkerPage } from "../components/WorkerPage";
import { MenuItem } from "../components/MenuItem";
import { ReadOnlyNote } from "../components/ReadOnlyNote";

const badgeOf = (n) => (n > 0 ? (n > 99 ? "99+" : n) : null);

// "Menyu" (details §1) — tab bar'ga sig'magan bo'limlar (ruxsat/tarifga
// qarab): Lidlar, Xabarlar, Profil va rolga qarab Moliya/Hisobot/Qarzdorlar/
// Baholar/Oylik. Ruxsatsiz band umuman ko'rinmaydi.
export const Menu = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role, can, hasFeature, readOnly, unread, chatUnread, openSheet } = useWorker();
  const layout = ROLE_LAYOUT[role] || ROLE_LAYOUT.teacher;
  const items = MENU_ORDER.filter((k) => !layout.includes(k) && defAllowed(TAB_DEFS[k], role, can, hasFeature, readOnly));
  // To'lov qabul qilish — FAB'i bo'lmagan rol uchun (Boshliq) menyuda.
  const showPay = !layout.includes("payment") && role !== "teacher" && role !== "assistant" && can(FAB_DEFS.payment.perm);

  const pay = () => {
    if (readOnly) {
      haptic("warning");
      toast.info(t("worker.readOnly.fab"), { id: "ro-fab" });
      return;
    }
    haptic("medium");
    openSheet("payment");
  };

  return (
    <WorkerPage title={t("worker.menu.title")}>
      {readOnly && <ReadOnlyNote />}
      {showPay && (
        <Card className="py-1 px-3.5">
          <MenuItem icon={HiOutlineBanknotes} label={t("worker.pay.title")} hint={readOnly ? t("worker.readOnly.title") : null} disabled={readOnly} onClick={pay} />
        </Card>
      )}
      {items.length === 0 ? (
        !showPay && <EmptyState icon={HiOutlineSquares2X2} title={t("worker.menu.empty")} text={t("worker.menu.emptyText")} />
      ) : (
        <>
      <SectionLabel>{t("worker.menu.sections")}</SectionLabel>
      <Card className="py-1 px-3.5 divide-y divide-line/70">
        {items.map((k) => {
          const def = TAB_DEFS[k];
          return (
            <MenuItem
              key={k}
              icon={def.off}
              label={t(def.key)}
              badge={badgeOf(k === "notifications" ? unread : k === "support" ? chatUnread : 0)}
              onClick={() => {
                haptic("light");
                navigate(def.to);
              }}
            />
          );
        })}
      </Card>
        </>
      )}
    </WorkerPage>
  );
};
