import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCamera, HiTrash } from "react-icons/hi2";
import Dialog from "../ui/Dialog";
import Button from "../ui/Button";
import useClosingValue from "./useClosingValue";
import { api } from "../utils/fetching";
import { errorMsg, successMsg } from "../utils/alert";
import { uploadStudentPhoto } from "../utils/studentPhoto";
import StudentPhotoCapture from "../pages/Students/StudentPhotoCapture";

/**
 * O'quvchi rasmini yuklash/olib tashlash oqimi bitta joyda
 * (docs/API_CONTRACT_student_photo.md §3, §5). Ruxsat talab qilinmaydi —
 * barcha rollarga ko'rinadi, cheklovni server qo'yadi (o'qituvchi faqat
 * o'z guruhidagi o'quvchiga).
 *
 * - `pick(student)` — rasm dialogini ochadi: kameradan olish yoki galereyadan
 *   tanlash (docs/API_CONTRACT_photo_source_choice.md), "Saqlash" bilan yuklanadi.
 * - `askRemove(student)` — tasdiqlash modali, keyin DELETE.
 * - `busyId` — hozir yuklanayotgan o'quvchi `_id` si.
 * - `menuItems(student)` — DropMenu bandlari (`useSendQrCard` naqshi).
 * - `element` — rasm dialogi + olib tashlash tasdiqlash modali; sahifada
 *   bir marta render qilinadi.
 *
 * @param {(studentId: string, photo: string) => void} onUpdated
 */
export default function useStudentPhoto(onUpdated) {
  const { t } = useTranslation();
  const busyRef = useRef(false);
  const [busyId, setBusyId] = useState("");
  const [pickTarget, setPickTarget] = useState(null);
  const pickView = useClosingValue(pickTarget);
  const [pickFile, setPickFile] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const removeView = useClosingValue(removeTarget);
  const [removing, setRemoving] = useState(false);

  const pick = useCallback((student) => {
    if (!student?._id || busyRef.current) return;
    setPickFile(null);
    setPickTarget(student);
  }, []);

  const closePick = () => {
    if (!busyRef.current) setPickTarget(null);
  };

  const savePick = async () => {
    const student = pickTarget;
    if (!pickFile || !student?._id || busyRef.current) return;
    busyRef.current = true;
    setBusyId(student._id);
    try {
      const { msg, photo } = await uploadStudentPhoto(student._id, pickFile);
      onUpdated?.(student._id, photo);
      successMsg(msg);
      setPickTarget(null);
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
        iconClass: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
        disabled: busy,
        onClick: () => pick(student),
      },
      ...(student.photo
        ? [
            {
              label: t("student.photoRemove"),
              icon: HiTrash,
              iconClass: "bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400",
              disabled: busy,
              onClick: () => askRemove(student),
            },
          ]
        : []),
    ];
  };

  const element = (
    <>
      {pickView && (
        <Dialog
          open={!!pickTarget}
          onClose={closePick}
          title={pickView.photo ? t("student.photoReplace") : t("student.photoAdd")}
          actions={
            <>
              <Button color="black" variant="text" onClick={closePick} disabled={!!busyId}>
                {t("common.cancel")}
              </Button>
              <Button loading={!!busyId} disabled={!pickFile} onClick={savePick}>
                {t("common.save")}
              </Button>
            </>
          }
        >
          <StudentPhotoCapture
            value={pickFile}
            onChange={setPickFile}
            existingPhoto={pickView.photo}
            active={!!pickTarget}
            disabled={!!busyId}
          />
        </Dialog>
      )}
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
