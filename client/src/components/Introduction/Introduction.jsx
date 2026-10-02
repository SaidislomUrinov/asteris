import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { api } from "../../utils/fetching";
import { updateUser } from "../../contexts/user";
import IntroductionOverlay from "./IntroductionOverlay";
import { INTRO_STEPS } from "./steps";
import { useBlockingModal } from "../../utils/blockingModal";

// Login rolga qarab boshqa auth zanjiri (server/CLAUDE.md), App.jsx dagi
// `VERIFY_ENDPOINT` xaritasiga o'xshash tanlov.
const INTRO_SEEN_ENDPOINT = {
  owner: "/client-auth/intro-seen",
  staff: "/staff-auth/intro-seen",
};

/**
 * Birinchi kirishda Navbar → Bildirishnomalar → Video darsliklar tugmasini
 * ketma-ket tushuntiradigan spotlight-tur (docs/API_CONTRACT_floating_video_lessons.md § 4).
 */
function Introduction() {
  const dp = useDispatch();
  const { authType } = useSelector((e) => e.user);
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  // Nishoni DOM'da MAVJUD bosqichlargina qoladi. Masalan video darsliklar
  // tugmasi shu sahifa uchun darslik biriktirilmagan bo'lsa umuman
  // render qilinmaydi — u holda o'sha bosqichda overlay nishonni topolmay
  // bo'sh ekran ko'rsatardi ("Keyingi" tugmasi ham chiqmay, tur qotib
  // qolardi).
  const [steps, setSteps] = useState(INTRO_STEPS);
  // Tur davomida yangiliklar popup'i kutadi (utils/blockingModal.js).
  useBlockingModal(true);

  // DOM/layout tayyor bo'lishi uchun ~500ms kutib birinchi step boshlanadi.
  useEffect(() => {
    const id = setTimeout(() => {
      setSteps(INTRO_STEPS.filter((s) => document.querySelector(s.target())));
      setStarted(true);
    }, 500);
    return () => clearTimeout(id);
  }, []);

  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  const handleBack = () => {
    if (!isFirst) setStepIndex((i) => i - 1);
  };

  const handleNext = async () => {
    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }

    try {
      const endpoint = INTRO_SEEN_ENDPOINT[authType];
      if (endpoint) await api.patch(endpoint);
    } catch {
      // tarmoq xatosi bo'lsa ham keyingi loginda qayta urinilmasligi uchun
      // baribir mahalliy holatni yakunlaymiz — foydalanuvchi tur bilan
      // tanishgan, qayta ko'rsatish shart emas
    } finally {
      dp(updateUser({ introSeen: true }));
    }
  };

  if (!started || !steps.length) return null;

  return (
    <IntroductionOverlay
      step={steps[stepIndex]}
      index={stepIndex}
      total={steps.length}
      isFirst={isFirst}
      isLast={isLast}
      onNext={handleNext}
      onBack={handleBack}
    />
  );
}

export default Introduction;
