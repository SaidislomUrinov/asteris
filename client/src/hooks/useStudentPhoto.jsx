import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCamera, HiTrash } from "react-icons/hi2";
import Dialog from "../ui/Dialog";
import Button from "../ui/Button";
import useClosingValue from "./useClosingValue";
import { api } from "../utils/fetching";
import { errorMsg, successMsg } from "../utils/alert";
import { downscaleImage } from "../utils/studentPhoto";

/**
 * O'quvchi rasmini yuklash/olib tashlash oqimi bitta joyda
 * (docs/API_CONTRACT_student_photo.md §3, §5). Ruxsat talab qilinmaydi —
 * barcha rollarga ko'rinadi, cheklovni server qo'yadi (o'qituvchi faqat
 * o'z guruhidagi o'quvchiga).
 *
 * - `pick(student)` — fayl tanlash oynasini ochadi (foydalanuvchi bosishi
 *   ichida chaqirilishi shart, aks holda brauzer bloklaydi).
 * - `askRemove(student)` — tasdiqlash modali, keyin DELETE.
 * - `busyId` — hozir yuklanayotgan o'quvchi `_id` si.
 * - `menuItems(student)` — DropMenu bandlari (`useSendQrCard` naqshi).
 * - `element` — yashirin `<input type="file">` + tasdiqlash modali; sahifada
 *   bir marta render qilinadi.
 *
 * @param {(studentId: string, photo: string) => void} onUpdated
 */
export default function useStudentPhoto(onUpdated) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const targetRef = useRef(null);
  const busyRef = useRef(false);
  const [busyId, setBusyId] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const removeView = useClosingValue(removeTarget);
  const [removing, setRemoving] = useState(false);

  const pick = useCallback((student) => {
    if (!student?._id || busyRef.current) return;
    targetRef.current = student;
    inputRef.current?.click();
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    // Bir xil faylni qayta tanlash ham `change` bersin.
    e.target.value = "";
    const student = targetRef.current;
    if (!file || !student?._id || busyRef.current) return;
    busyRef.current = true;
    setBusyId(student._id);
    try {
      const body = new FormData();
      const prepared = await downscaleImage(file);
      body.append("photo", prepared, prepared.name || file.name || "photo.jpg");
      const res = await api.put(`/students/${student._id}/photo`, body);
      const { ok, msg, data } = res.data;
      if (!ok) throw new Error(msg);
      onUpdated?.(student._id, data?.photo || "");
      successMsg(msg);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      busyRef.current = false;
      setBusyId("");
    }
  };

  const askRemove = useCallback((student) => {
    if (!student?._id || busyRef.current) return;
    setRemoveTarget(student);
  }, []);

  const confirmRemove = async () => {
    const student = removeTarget;
    if (!student?._id || busyRef.current) return;
    busyRef.current = true;
    setRemoving(true);
    setBusyId(student._id);
    try {
      const res = await api.delete(`/students/${student._id}/photo`);
      const { ok, msg, data } = res.data;
      if (!ok) throw new Error(msg);
      onUpdated?.(student._id, data?.photo || "");
      successMsg(msg);
      setRemoveTarget(null);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      busyRef.current = false;
      setRemoving(false);
      setBusyId("");
    }
  };

  const menuItems = (student) => {
    if (!student?._id) return [];
    const busy = Boolean(busyId);
    return [
      {
        label: student.photo ? t("student.photoReplace") : t("student.photoAdd"),
        icon: HiCamera,
        iconClass: "bg-indigo-50 text-indigo-600",
        disabled: busy,
        onClick: () => pick(student),
      },
      ...(student.photo
        ? [
            {
              label: t("student.photoRemove"),
              icon: HiTrash,
              iconClass: "bg-red-50 text-red-600",
              disabled: busy,
              onClick: () => askRemove(student),
            },
          ]
        : []),
    ];
  };

  const element = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFile}
      />
      {removeView && (
        <Dialog
          open={!!removeTarget}
          onClose={() => !removing && setRemoveTarget(null)}
          title={t("student.photoRemove")}
          actions={
            <>
              <Button color="black" variant="text" onClick={() => setRemoveTarget(null)} disabled={removing}>
                {t("common.cancel")}
              </Button>
              <Button color="red" loading={removing} onClick={confirmRemove}>
                {t("student.photoRemove")}
              </Button>
            </>
          }
        >
          <p>{t("student.photoRemoveConfirm", { name: removeView.fullName })}</p>
        </Dialog>
      )}
    </>
  );

  return { pick, askRemove, busyId, menuItems, element };
}
