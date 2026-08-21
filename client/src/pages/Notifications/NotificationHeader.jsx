import { HiBell } from "react-icons/hi2";

/**
 * Sahifa sarlavhasi — icon + title + subtitle. Notification Center'ga xos
 * kompakt header (juda baland bo'lmasin degan talab bilan).
 */
function NotificationHeader({ title, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-500 text-lg">
        <HiBell />
      </span>
      <div className="flex flex-col min-w-0">
        <p className="font-space font-bold text-xl text-slate-900 leading-tight truncate">{title}</p>
        <p className="text-sm text-slate-500 truncate">{subtitle}</p>
      </div>
    </div>
  );
}

export default NotificationHeader;
