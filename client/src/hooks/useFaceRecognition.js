import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../utils/fetching";
import { photoSrc } from "../utils/studentPhoto";

// FaceID davomat (docs/API_CONTRACT_face_attendance.md). Yuzni tanish butunlay
// brauzerda: modellar `public/models/face/` da, galereya (o'quvchi → descriptor)
// serverdan keladi, hisoblanmagan descriptor'larni esa shu hook orqa fonda
// hisoblab serverga qaytaradi — shuning uchun rasm yuklanadigan joylar
// (client, ishchi WebApp) o'zgarmaydi.
const MODELS_URL = "/models/face";

// Moslash qoidasi: eng yaqin masofa shu chegaradan kichik VA ikkinchi eng
// yaqin o'quvchidan kamida MARGIN ga yaqinroq bo'lsin (o'xshash yuzlarda xato
// belgilamaslik uchun). Ketma-ket kadrlarda tasdiqlash sahifada.
export const FACE_MATCH_DISTANCE = 0.45;
export const FACE_MATCH_MARGIN = 0.05;

const DETECT_OPTIONS = { inputSize: 320, scoreThreshold: 0.5 };
const BACKFILL_OPTIONS = { inputSize: 416, scoreThreshold: 0.5 };
// Orqa fon hisobi kamera siklini bo'g'ib qo'ymasligi uchun elementlar orasida pauza.
const BACKFILL_GAP_MS = 120;

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("face.image"));
    img.src = url;
  });

// Pasport uslubidagi rasmda yuz kadrning katta qismini egallaydi — TinyFaceDetector
// bunday yaqin yuzni topa olmaydi. Rasmni kulrang fonli kattaroq kanvasga
// markazlab joylab, yuzni kadrga nisbatan kichraytiramiz.
const FACE_PAD = 2;
const padded = (source, canvas = document.createElement("canvas")) => {
  const w = source.naturalWidth || source.videoWidth;
  const h = source.naturalHeight || source.videoHeight;
  const size = Math.round(Math.max(w, h) * FACE_PAD);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(source, (size - w) / 2, (size - h) / 2, w, h);
  return canvas;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {boolean} enabled - tarifda `attendance.face` bor bo'lsa true; false bo'lsa hech narsa yuklanmaydi
 * @returns {{ status: "off"|"loading"|"ready"|"error", total: number, done: number,
 *            detect: (video: HTMLVideoElement) => Promise<null|{studentId: string, distance: number, matched: boolean}> }}
 */
export default function useFaceRecognition(enabled) {
  const [status, setStatus] = useState(enabled ? "loading" : "off");
  const [counts, setCounts] = useState({ total: 0, done: 0 });
  const apiRef = useRef(null);
  // [{ _id, fullName, descriptor: Float32Array }]
  const galleryRef = useRef([]);
  // Kameraga yaqin turgan odam uchun kichraytirilgan kadr — bitta kanvas qayta ishlatiladi.
  const padCanvasRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    const run = async () => {
      try {
        const faceapi = await import("@vladmandic/face-api");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);
        if (cancelled) return;
        apiRef.current = faceapi;

        const res = await api.get("/attendance/face/gallery");
        if (!res.data.ok) throw new Error(res.data.msg);
        const students = res.data.data.students || [];
        if (cancelled) return;

        galleryRef.current = students
          .filter((s) => s.face)
          .map((s) => ({ _id: s._id, fullName: s.fullName, descriptor: Float32Array.from(s.face) }));
        const pending = students.filter((s) => !s.face);
        setCounts({ total: students.length, done: galleryRef.current.length });
        setStatus("ready");

        // Orqa fon: descriptor'i yo'q o'quvchilarni birma-bir hisoblab serverga yozish.
        // Yuz topilmagan rasm shu seansda qayta urinilmaydi (pending ro'yxati bir martalik).
        for (const s of pending) {
          if (cancelled) return;
          try {
            const img = await loadImage(photoSrc(s.photo));
            const found = await faceapi
              .detectSingleFace(padded(img), new faceapi.TinyFaceDetectorOptions(BACKFILL_OPTIONS))
              .withFaceLandmarks(true)
              .withFaceDescriptor();
            if (found) {
              const descriptor = Array.from(found.descriptor);
              await api.put(`/attendance/face/${s._id}`, { descriptor, photo: s.photo });
              galleryRef.current.push({ _id: s._id, fullName: s.fullName, descriptor: found.descriptor });
              if (!cancelled) setCounts((prev) => ({ ...prev, done: galleryRef.current.length }));
            }
          } catch {
            // Bitta rasm xatosi (yuklanmadi/rasm almashgan) butun jarayonni to'xtatmaydi.
          }
          await sleep(BACKFILL_GAP_MS);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Kadrdagi eng katta yuzni galereya bilan solishtiradi. Yuz yo'q yoki
  // galereya bo'sh bo'lsa `null`.
  const detect = useCallback(async (video) => {
    const faceapi = apiRef.current;
    const gallery = galleryRef.current;
    if (!faceapi || !gallery.length || !video) return null;

    const options = new faceapi.TinyFaceDetectorOptions(DETECT_OPTIONS);
    const run = (input) => faceapi.detectSingleFace(input, options).withFaceLandmarks(true).withFaceDescriptor();
    let found = await run(video);
    if (!found) {
      // Yuz kadrni to'ldirib turgan bo'lsa detektor topa olmaydi — kichraytirib qayta urinamiz.
      padCanvasRef.current = padded(video, padCanvasRef.current || undefined);
      found = await run(padCanvasRef.current);
    }
    if (!found) return null;

    let best = null;
    let bestDistance = Infinity;
    let secondDistance = Infinity;
    for (const item of gallery) {
      const distance = faceapi.euclideanDistance(found.descriptor, item.descriptor);
      if (distance < bestDistance) {
        secondDistance = bestDistance;
        bestDistance = distance;
        best = item;
      } else if (distance < secondDistance) {
        secondDistance = distance;
      }
    }
    if (!best) return null;
    const matched = bestDistance < FACE_MATCH_DISTANCE && secondDistance - bestDistance >= FACE_MATCH_MARGIN;
    return { studentId: best._id, distance: bestDistance, matched };
  }, []);

  return { status, total: counts.total, done: counts.done, detect };
}
