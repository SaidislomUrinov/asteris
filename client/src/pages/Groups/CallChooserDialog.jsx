import { useTranslation } from "react-i18next";
import { HiChevronRight, HiPhone, HiUser, HiUsers } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";

// "Qo'ng'iroq qilish" — o'quvchida ota-ona raqami ham bo'lsa kimga qo'ng'iroq
// qilinishi so'raladi. Har variant — `tel:` havolasi (telefonda dialer
// ochiladi). Raqamlar DTO'ning asosiy `phone`/`parentPhone` maydonlari —
// Telegram raqamlari emas.
export default function CallChooserDialog({ open, student, onClose }) {
  const { t } = useTranslation();
  const options = student
    ? [
        { key: "student", label: t("student.callStudent"), phone: student.phone, icon: HiUser, tone: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400" },
        { key: "parent", label: t("student.callParent"), phone: student.parentPhone, icon: HiUsers, tone: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
      ]
    : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("student.callWho")}
      description={student?.fullName}
      className="md:!w-[28rem]"
    >
      <div className="flex flex-col gap-2.5">
        {options.map((o) => (
          <a
            key={o.key}
            href={`tel:${o.phone}`}
            onClick={onClose}
            className="group flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 hover:border-blue-300 dark:hover:border-blue-500/40 hover:bg-slate-50 dark:hover:bg-night-800 transition-colors"
          >
            <span className={`flex items-center justify-center size-11 shrink-0 rounded-xl text-xl ${o.tone}`}>
              <o.icon />
            </span>
            <span className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{o.label}</span>
              <span className="text-sm font-jet tabular-nums text-slate-500 dark:text-slate-400 truncate">{o.phone}</span>
            </span>
            <span className="flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 shrink-0">
              <HiPhone className="text-base" />
              <HiChevronRight className="text-base text-slate-300 dark:text-slate-600" />
            </span>
          </a>
        ))}
      </div>
    </Dialog>
  );
}
