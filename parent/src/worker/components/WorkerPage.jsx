import { useLocation } from "react-router-dom";
import { Page } from "../../components/Page";
import { useWorker } from "../useWorker";
import { rootPathsOf } from "../constants";
import { HeaderActions } from "./HeaderActions";
import { PageBack } from "./PageBack";

// Ishchi sahifasi: sarlavha + o'ngda (sahifa amallari) qidiruv va
// qo'ng'iroqcha (details §1). Tab bar'da yo'q sahifada (detal, qidiruv,
// menyu bandlari) "orqaga" tugmasi ham chiqadi.
export const WorkerPage = ({ title, subtitle, right, children, className }) => {
  const { pathname } = useLocation();
  const { role } = useWorker();
  const back = !rootPathsOf(role).includes(pathname);
  return (
    <Page className={className}>
      <header className="flex items-center justify-between gap-3 mb-0.5 min-h-10">
        <div className="flex items-center gap-1 min-w-0">
          {back && <PageBack />}
          <div className="min-w-0">
            {title && <h1 className="text-[20px] min-[380px]:text-[22px] font-extrabold text-ink leading-tight tracking-tight break-words">{title}</h1>}
            {subtitle && <div className="text-[13px] text-hint mt-0.5 break-words">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <HeaderActions />
        </div>
      </header>
      {children}
    </Page>
  );
};
