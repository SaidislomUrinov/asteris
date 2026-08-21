import { useTranslation } from "react-i18next";

function Dashboard() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center w-full h-full text-zinc-500">
      {t("dashboard.title", "Dashboard")}
    </div>
  );
}

export default Dashboard;
