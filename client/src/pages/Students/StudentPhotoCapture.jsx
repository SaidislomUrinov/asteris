import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiArrowPath, HiCamera, HiPhoto, HiXMark } from "react-icons/hi2";
import { CgSpinner } from "react-icons/cg";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import { errorMsg } from "../../utils/alert";
import { photoSrc } from "../../utils/studentPhoto";

// Kameradan olingan kadr — kvadrat markazdan kesiladi (server ham kvadratga
// keltiradi, bu yerda faqat preview mos bo'lishi va trafik uchun).
const CAPTURE_SIDE = 720;
const CAPTURE_QUALITY = 0.9;

const stopStream = (stream) => {
  stream?.getTracks().forEach((track) => track.stop());
};

const canUseCamera = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

/**
 * O'quvchi qo'shish formasidagi rasm maydoni (docs/API_CONTRACT_enroll_with_photo.md):
 * dialog ichida inline kamera (getUserMedia) yoki fayldan tanlash.
 *
 * @param {Object} props
 * @param {File|null} props.value - Tanlangan/olingan yangi rasm
 * @param {(file: File|null) => void} props.onChange
 * @param {string} [props.existingPhoto] - Mavjud o'quvchining rasmi (yangi olinmaguncha ko'rinadi)
 * @param {boolean} [props.active=true] - false bo'lsa kamera darhol to'xtatiladi (dialog yopilganda)
 * @param {boolean} [props.disabled=false]
 */
function StudentPhotoCapture({ value, onChange, existingPhoto = "", active = true, disabled = false }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // Har bir startCamera chaqiruvi o'z tartib raqamini oladi — kechikib kelgan
  // (eski) oqim yoki komponent yopilgandan keyin kelgan oqim darhol to'xtatiladi.
  const requestRef = useRef(0);
  const activeRef = useRef(active);

  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  // Old (selfie) kamerada preview va olingan rasm ko'zgu ko'rinishida.
  const [mirrored, setMirrored] = useState(true);

  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : ""), [value]);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);
  const shownSrc = previewUrl || photoSrc(existingPhoto);

  const releaseCamera = useCallback(() => {
    requestRef.current += 1;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Dialog yopilganda (yoki komponent unmount bo'lganda) kamera chirog'i
  // yonib qolmasin.
  useEffect(() => {
    activeRef.current = active;
    if (!active) releaseCamera();
  }, [active, releaseCamera]);
  useEffect(() => releaseCamera, [releaseCamera]);

  // Oqim video elementi render bo'lishidan oldin kelsa — keyin ulanadi.
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (cameraOn && !starting && video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
    }
  }, [cameraOn, starting]);

  const failCamera = (key) => {
    setCameraError(key);
    setCameraOn(false);
    toast.warning(t(key), { description: t("student.photoChooseInstead") });
  };

  const startCamera = async (nextDeviceId = "") => {
    if (disabled) return;
    if (!canUseCamera()) {
      failCamera("student.cameraUnavailable");
      return;
    }
    releaseCamera();
    const requestId = requestRef.current;
    setCameraError("");
    setCameraOn(true);
    setStarting(true);
    try {
      let stream;
      if (nextDeviceId) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: nextDeviceId } },
          audio: false,
        });
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
        } catch (error) {
          if (error?.name === "NotAllowedError" || error?.name === "SecurityError") throw error;
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }

      if (requestId !== requestRef.current || !activeRef.current) {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // autoplay — `autoPlay muted playsInline` bilan odatda kerak emas
        }
      }

      // facingMode yo'q (desktop webcam) yoki "user" — ko'zgu; faqat "environment" — oddiy.
      const facing = stream.getVideoTracks()[0]?.getSettings?.().facingMode;
      setMirrored(facing !== "environment");

      const currentId = stream.getVideoTracks()[0]?.getSettings?.().deviceId || nextDeviceId;
      setDeviceId(currentId || "");
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list.filter((d) => d.kind === "videoinput"));
      } catch {
        setDevices([]);
      }
    } catch (error) {
      if (requestId !== requestRef.current) return;
      releaseCamera();
      failCamera(
        error?.name === "NotAllowedError" || error?.name === "SecurityError"
          ? "student.cameraDenied"
          : "student.cameraUnavailable",
      );
    } finally {
      if (requestId === requestRef.current) setStarting(false);
    }
  };

  const cancelCamera = () => {
    releaseCamera();
    setCameraOn(false);
    setStarting(false);
  };

  const switchCamera = () => {
    if (devices.length < 2) return;
    const index = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(index + 1) % devices.length];
    startCamera(next.deviceId);
  };

  const capture = async () => {
    const video = videoRef.current;
    const w = video?.videoWidth;
    const h = video?.videoHeight;
    if (!video || !w || !h) return;
    try {
      const side = Math.min(w, h);
      const canvas = document.createElement("canvas");
      canvas.width = CAPTURE_SIDE;
      canvas.height = CAPTURE_SIDE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("student.photoInvalid");
      if (mirrored) {
        ctx.translate(CAPTURE_SIDE, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, 0, 0, CAPTURE_SIDE, CAPTURE_SIDE);
      const blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", CAPTURE_QUALITY),
      );
      if (!blob) throw new Error("student.photoInvalid");
      onChange(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      cancelCamera();
    } catch (error) {
      errorMsg(error.message);
    }
  };

  const pickFile = () => {
    if (disabled) return;
    fileRef.current?.click();
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type && !file.type.startsWith("image/")) {
      errorMsg("student.photoInvalid");
      return;
    }
    cancelCamera();
    onChange(file);
  };

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={handleFile}
    />
  );

  if (cameraOn) {
    return (
      <div className="flex flex-col gap-3" onKeyDown={(e) => e.stopPropagation()}>
        {fileInput}
        <div className="relative w-full max-w-xs mx-auto aspect-square overflow-hidden rounded-2xl bg-slate-900 dark:bg-night-800 border border-slate-200 dark:border-night-700 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)]">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`absolute inset-0 w-full h-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
          />
          {/* Yuz-markazlash yo'riqchisi: nozik oval + burchak chiziqlari */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-[18%] rounded-full border-2 border-dashed border-white/50" />
            <span className="absolute top-3 left-3 size-5 border-t-2 border-l-2 border-white/70 rounded-tl-lg" />
            <span className="absolute top-3 right-3 size-5 border-t-2 border-r-2 border-white/70 rounded-tr-lg" />
            <span className="absolute bottom-3 left-3 size-5 border-b-2 border-l-2 border-white/70 rounded-bl-lg" />
            <span className="absolute bottom-3 right-3 size-5 border-b-2 border-r-2 border-white/70 rounded-br-lg" />
          </div>
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-white/80">
              <CgSpinner className="animate-spin text-3xl" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 w-full max-w-xs mx-auto">
          <Button color="black" variant="text" onClick={cancelCamera}>
            {t("common.cancel")}
          </Button>
          {devices.length > 1 && (
            <IconButton
              color="slate"
              variant="outlined"
              title={t("student.cameraSwitch")}
              aria-label={t("student.cameraSwitch")}
              disabled={starting}
              onClick={switchCamera}
            >
              <HiArrowPath />
            </IconButton>
          )}
          <div className="flex-1 min-w-0">
            <Button fullWith disabled={starting} onClick={capture}>
              <HiCamera className="text-base" />
              {t("student.cameraCapture")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4" onKeyDown={(e) => e.stopPropagation()}>
      {fileInput}
      <div className="relative shrink-0 p-1.5 -m-1.5">
        {shownSrc ? (
          <img
            src={shownSrc}
            alt=""
            className="size-20 rounded-2xl object-cover border border-slate-200 dark:border-night-700 bg-slate-100 dark:bg-night-800"
          />
        ) : (
          <button
            type="button"
            onClick={() => startCamera()}
            disabled={disabled}
            aria-label={t("student.photoTake")}
            className="size-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-night-700 bg-slate-50 dark:bg-night-800 text-slate-400 dark:text-slate-500 hover:border-blue-300 hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer transition-colors disabled:cursor-not-allowed"
          >
            <HiCamera className="text-2xl" />
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            title={t("student.photoRemove")}
            aria-label={t("student.photoRemove")}
            className="absolute top-0 right-0 size-7 flex items-center justify-center rounded-full bg-white dark:bg-night-900 border border-slate-200 dark:border-night-700 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/40 shadow-[0_2px_6px_-1px_rgba(15,23,42,0.2)] cursor-pointer disabled:cursor-not-allowed"
          >
            <HiXMark className="text-base" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2.5 min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          <Button color="blue" variant="outlined" disabled={disabled} onClick={() => startCamera()}>
            <HiCamera className="text-base" />
            {value ? t("student.photoRetake") : t("student.photoTake")}
          </Button>
          <Button color="slate" variant="outlined" disabled={disabled} onClick={pickFile}>
            <HiPhoto className="text-base" />
            {t("student.photoChoose")}
          </Button>
        </div>
        {cameraError ? (
          <p className="text-xs leading-snug text-amber-600 dark:text-amber-400">
            {t(cameraError)} · {t("student.photoChooseInstead")}
          </p>
        ) : (
          <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">{t("student.photoHint")}</p>
        )}
      </div>
    </div>
  );
}

export default StudentPhotoCapture;
