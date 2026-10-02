import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, Divider, SectionLabel } from "./Card";
import { NotificationItem } from "./NotificationItem";
import { ListSkeleton } from "./Skeleton";
import { ErrorState } from "./States";
import { useRequest } from "../hooks/useRequest";
import { getNotifications } from "../api/parent";

// Bosh sahifadagi "So'nggi xabarlar" bloki (ota-ona va o'quvchi uchun umumiy).
export const RecentNotifications = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const notif = useRequest(() => getNotifications(1), []);
  return (
    <>
      <SectionLabel right={<button type="button" onClick={() => navigate("/notifications")} className="text-[12px] font-bold text-accent">{t("tab.notifications")} →</button>}>{t("home.recent")}</SectionLabel>
      {notif.loading ? (
        <ListSkeleton count={2} />
      ) : notif.error ? (
        <ErrorState error={notif.error} onRetry={notif.reload} />
      ) : !notif.data?.data?.length ? (
        <Card className="text-sm text-hint text-center py-6">{t("notif.empty")}</Card>
      ) : (
        <Card as="button" onClick={() => navigate("/notifications")}>
          {notif.data.data.slice(0, 5).map((n, i) => (
            <div key={n._id}>
              {i > 0 && <Divider />}
              <NotificationItem n={n} clickable={false} />
            </div>
          ))}
        </Card>
      )}
    </>
  );
};
