import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import Dialog from "../ui/Dialog";
import useCan from "../hooks/useCan";
import useFeature from "../hooks/useFeature";
import useQrScanner from "../hooks/useQrScanner";
import { api } from "../utils/fetching";
import { errorMsg } from "../utils/alert";
import { scanSound } from "../utils/scanSound";

// Bir xil kartani ketma-ket ikki marta o'tkazsa takroriy so'rov ketmasligi
// uchun (QrAttendance sahifasidagi bilan bir xil qoida).
const RESCAN_COOLDOWN = 3000;

// Apparat QR skaner BUTUN ILOVA bo'ylab ishlaydi — qabulxonachi qaysi
// sahifada turganidan qat'iy nazar, o'quvchi kartani skanerga bosishi bilan
// davomat tushadi. Kamera esa faqat "QR davomat" sahifasida qoladi (fonda
// doim yoqib qo'yish batareyani yeydi va foydalanuvchiga tushunarsiz).
//
// Natija toast orqali ko'rsatiladi — alohida sahifa bo'lmagani uchun
// o'quvchi ISMI ham toast ichida bo'lishi shart.
function GlobalQrScanner() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const can = useCan();
  const hasFeature = useFeature();
  const { authType, subscriptionActive } = useSelector((e) => e.user);

  const [groupChoice, setGroupChoice] = useState(null);
  const lastTokenRef = useRef({ token: "", at: 0 });
  const busyRef = useRef(false);

  // "QR davomat" sahifasining o'z tinglovchisi bor — u yerda ikki marta
  // qayta ishlanmasligi uchun global rejim o'chiriladi.
  // Obuna tugagan bo'lsa ham o'chiriladi: backend baribir bloklaydi
  // (`requireActiveSubscription`), skan qilinaverib bekorga xato toast
  // chiqmasligi kerak.
  const enabled =
    pathname !== "/qr-attendance" &&
    can("attendance:create") &&
    hasFeature("attendance.qr") &&
    !(authType === "staff" && subscriptionActive === false);

  const send = useCallback(
    async (token, groupId) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const res = await api.post("/attendance/qr/scan", { token, groupId });
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);

        if (data.needsGroup) {
          scanSound.attention();
          setGroupChoice({ token, ...data });
          return;
        }

        const name = data.student?.fullName || "";
        if (data.duplicate) scanSound.duplicate();
        else if (data.late) scanSound.late();
        else scanSound.success();
        if (data.duplicate) {
          toast.warning(name, { description: t("attendance.alreadyMarked") });
        } else {
          toast.success(name, {
            description: data.late ? t("attendance.markedLate") : t("attendance.marked"),
          });
        }
      } catch (error) {
        scanSound.error();
        errorMsg(error.message);
      } finally {
        busyRef.current = false;
      }
    },
    [t],
  );

  const onToken = useCallback(
    (token) => {
      const now = Date.now();
      const last = lastTokenRef.current;
      if (last.token === token && now - last.at < RESCAN_COOLDOWN) return;
      lastTokenRef.current = { token, at: now };
      send(token);
    },
    [send],
  );

  useQrScanner(onToken, enabled);

  const chooseGroup = async (groupId) => {
    const { token } = groupChoice;
    setGroupChoice(null);
    await send(token, groupId);
  };

  if (!enabled && !groupChoice) return null;

  // O'quvchi bugun bir nechta guruhda darsga ega bo'lsa — qaysi biriga
  // yozilishini so'raymiz. Modal ilova darajasida, shuning uchun istalgan
  // sahifada chiqa oladi.
  return (
    <Dialog
      open={!!groupChoice}
      onClose={() => setGroupChoice(null)}
      title={t("attendance.chooseGroupTitle")}
      className="md:w-100"
      zIndex="z-40"
    >
      <p className="text-sm text-slate-600 mb-2">
        {t("attendance.chooseGroupHint", { name: groupChoice?.student?.fullName })}
      </p>
      <div className="flex flex-col gap-2">
        {groupChoice?.groups.map((g) => (
          <button
            key={g._id}
            onClick={() => chooseGroup(g._id)}
            className="flex items-center justify-between w-full px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer duration-200"
          >
            <span className="text-sm font-medium text-slate-800">
              {g.subject} - {g.activeId}
            </span>
            <span className="text-xs text-slate-500">
              {g.startTime} - {g.endTime}
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

export default GlobalQrScanner;
