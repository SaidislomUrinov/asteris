import { Toaster } from "sonner";
import useTheme from "../hooks/useTheme";

// Ilova bo'ylab YAGONA toast uslubi — WECOIN'dagi "yangi buyurtma" toasti
// kabi: oq (tungi rejimda to'q) karta, qalin sarlavha, kulrang izoh, kerak
// bo'lsa amal tugmasi. Avvalgi `richColors` (to'liq yashil/qizil fon) olib
// tashlandi — holat endi faqat ikonka rangida ko'rinadi.
function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-center"
      theme={theme}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)] !font-[inherit] dark:!bg-night-900 dark:!border-night-700 dark:!text-slate-100",
          title: "!font-semibold",
          description: "!text-slate-500 dark:!text-slate-400",
          success: "[&_[data-icon]]:!text-emerald-500",
          error: "[&_[data-icon]]:!text-red-500",
          warning: "[&_[data-icon]]:!text-amber-500",
          info: "[&_[data-icon]]:!text-blue-500",
        },
      }}
    />
  );
}

export default AppToaster;
