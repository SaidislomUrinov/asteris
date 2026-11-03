import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineCamera, HiXMark } from "react-icons/hi2";
import { haptic } from "../../lib/telegram";

// Kvadrat kadr o'lchami (server baribir kvadratga keltiradi).
const SIDE = 720;

// O'quvchi rasmi uchun jonli kamera (getUserMedia). Telegram WebView ko'pincha
// `<input capture>` ni e'tiborsiz qoldirib galereyani ochadi — shuning uchun
// avval oqim ochiladi; ruxsat/qurilma bo'lmasa, foydalanuvchi bosishi bilan
// `capture` input (telefonning o'z kamerasi) taklif qilinadi.
export const PhotoCameraOverlay = ({ open, onClose, onFile }) => {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const nativeRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    const run = async () => {
      setFailed(false);
      setReady(false);
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera.missing");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!alive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setReady(true);
      } catch {
        if (alive) setFailed(true);
      }
    };
    run();
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  const shoot = () => {
    const video = videoRef.current;
    const w = video?.videoWidth;
    const h = video?.videoHeight;
    if (!video || !w || !h) return;
    haptic("light");
    const side = Math.min(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = SIDE;
    canvas.height = SIDE;
    canvas.getContext("2d").drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIDE, SIDE);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onFile(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onClose();
      },
      "image/jpeg",
      0.9,
    );
  };

  const onNative = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      onFile(file);
      onClose();
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-60 bg-black flex flex-col">
      <div className="relative flex-1 min-h-0">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 w-full h-full object-cover" />
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center text-white">
            <p className="text-[14px]">{t("worker.student.cameraFailed")}</p>
            <button
              type="button"
              onClick={() => nativeRef.current?.click()}
              className="h-11 px-5 rounded-full bg-white text-black text-[14px] font-bold active:opacity-70"
            >
              {t("worker.student.cameraNative")}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.cancel")}
          className="absolute top-4 right-4 size-10 rounded-full bg-black/50 text-white grid place-items-center active:opacity-70"
        >
          <HiXMark className="w-5 h-5" />
        </button>
      </div>
      <div className="flex justify-center py-6 bg-black">
        <button
          type="button"
          disabled={!ready}
          onClick={shoot}
          aria-label={t("worker.student.photoFromCamera")}
          className="size-16 rounded-full bg-white text-black grid place-items-center ring-4 ring-white/30 disabled:opacity-40 active:opacity-70"
        >
          <HiOutlineCamera className="w-7 h-7" />
        </button>
      </div>
      <input ref={nativeRef} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} aria-hidden="true" onChange={onNative} />
    </div>
  );
};
