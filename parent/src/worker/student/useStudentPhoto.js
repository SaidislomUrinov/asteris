import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { haptic } from "../../lib/telegram";
import { downscaleImage } from "../../lib/studentPhoto";
import { workerApi } from "../api";
import { errText } from "../utils";

// O'quvchi rasmini yuklash / olib tashlash (docs/API_CONTRACT_student_photo.md
// §3, §5). Ruxsat talab qilinmaydi — cheklovni server qo'yadi (o'qituvchi
// faqat o'z guruhidagi o'quvchiga). `onUpdated(photo)` — javobdagi yangi
// `photo` ("" — olib tashlandi). Takroriy bosishdan `busyRef` himoya qiladi.
export const useStudentPhoto = (studentId, onUpdated) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(
    async (request) => {
      if (!studentId || busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      haptic("medium");
      try {
        const res = await request();
        onUpdated?.(res?.data?.photo || "");
        haptic("success");
        if (res?.msg) toast.success(t(res.msg));
        return true;
      } catch (e) {
        haptic("error");
        toast.error(errText(e));
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [studentId, onUpdated, t],
  );

  const upload = useCallback(
    (file) =>
      run(async () => {
        const prepared = await downscaleImage(file);
        return workerApi.setStudentPhoto(studentId, prepared);
      }),
    [run, studentId],
  );

  const remove = useCallback(() => run(() => workerApi.removeStudentPhoto(studentId)), [run, studentId]);

  return { busy, upload, remove };
};
