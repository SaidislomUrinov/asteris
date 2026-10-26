import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineCamera, HiOutlinePhoto, HiOutlineTrash } from "react-icons/hi2";
import { haptic } from "../../lib/telegram";
import { BottomSheet } from "./BottomSheet";
import { MenuItem } from "./MenuItem";

// Rasm manbasi tanlovi (docs/API_CONTRACT_photo_source_choice.md): kameradan
// olish yoki galereyadan tanlash. Telegram WebView'da `getUserMedia` ishonchsiz,
// shuning uchun kamera — `capture` atributli input (telefonning o'z kamerasi).
// Inputlar oyna yopilgandan keyin ham DOM'da qoladi — `click()` foydalanuvchi
// bosishi ichida chaqiriladi.
export const PhotoSourceSheet = ({ open, onClose, onFile, title, subtitle, onRemove }) => {
  const { t } = useTranslation();
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const pick = (ref) => {
    haptic("light");
    onClose();
    ref.current?.click();
  };

  const onChange = (e) => {
    const file = e.target.files?.[0];
    // Bir xil faylni qayta tanlash ham `change` bersin.
    e.target.value = "";
    if (file) onFile(file);
  };

  return (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} aria-hidden="true" onChange={onChange} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden="true" onChange={onChange} />
      <BottomSheet open={open} onClose={onClose} title={title || t("worker.student.photoTitle")} subtitle={subtitle}>
        <div className="flex flex-col divide-y divide-line/70">
          <MenuItem icon={HiOutlineCamera} label={t("worker.student.photoFromCamera")} onClick={() => pick(cameraRef)} />
          <MenuItem icon={HiOutlinePhoto} label={t("worker.student.photoFromGallery")} onClick={() => pick(galleryRef)} />
          {onRemove && (
            <MenuItem
              icon={HiOutlineTrash}
              label={t("worker.student.photoRemove")}
              onClick={() => {
                onClose();
                onRemove();
              }}
            />
          )}
        </div>
      </BottomSheet>
    </>
  );
};
