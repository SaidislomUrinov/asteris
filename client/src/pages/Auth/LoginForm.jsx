import { useRef, useState } from "react";
import { errorMsg, successMsg } from "../../utils/alert";
import { api, API, setActiveCenter, setSession } from "../../utils/fetching";
import { useDispatch } from "react-redux";
import { updateUser } from "../../contexts/user";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import UpdateLang from "../../components/UpdateLang";
import Input from "../../ui/Input";
import { HiDevicePhoneMobile, HiEye, HiEyeSlash } from "react-icons/hi2";
import Button from "../../ui/Button";

// Hozircha faqat O'zbekiston (+998, 9 ta raqam — jami 13 ta ishora "+" bilan
// hisoblaganda). Kelajakda chet davlatlari qo'shilganda bu qattiq kodlangan
// prefiks/uzunlik o'rniga davlat tanlovi (dial code + mask) ga almashtiriladi.
const PHONE_PREFIX = "998";
const PHONE_DIGITS_LEN = 9;

const formatPhone = (raw) => {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith(PHONE_PREFIX)) digits = digits.slice(PHONE_PREFIX.length);
  digits = digits.slice(0, PHONE_DIGITS_LEN);
  return `+${PHONE_PREFIX}${digits}`;
};

// Kiritilgan raqam keyingi safar avtomatik to'ldirilishi uchun saqlanadi
// (parol — yo'q). Raqam avval "owner" kalitida turardi — eski qiymat yo'qolmasin.
const PHONE_KEY = "asteris:auth:identifier:phone";
const LEGACY_PHONE_KEY = "asteris:auth:identifier:owner";
const loadSavedPhone = () => {
  try {
    return localStorage.getItem(PHONE_KEY) || localStorage.getItem(LEGACY_PHONE_KEY) || "";
  } catch {
    return "";
  }
};
const savePhone = (value) => {
  try {
    localStorage.setItem(PHONE_KEY, value);
  } catch {
    // brauzer xotirasi yopiq — keyingi safar qo'lda kiritiladi
  }
};

/**
 * Brend subdomenidagi login (docs/API_CONTRACT_multi_center.md §3.2,
 * docs/API_CONTRACT_staff_phone.md §2). Boshliq ham, Hodim ham TELEFON RAQAM
 * bilan kiradi: subdomen mijozni, raqam esa kimligini aniqlaydi — sessiya
 * `/auth/signin` javobidagi `authType` bilan ochiladi.
 *
 * Tuzilish: markazda bitta ustun — brend logotipi (bo'lsa), nomi, shiori
 * (bo'lsa), ostida forma kartasi.
 *
 * @param {{ brand: { slug: string, name: string, logo: string|null, slogan?: string|null } }} props
 */
function LoginForm({ brand }) {
  const [form, setForm] = useState({ phone: formatPhone(loadSavedPhone()), password: "" });
  const [disabled, setDisabled] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const dp = useDispatch();
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Faqat React state (`disabled`) yetarli emas — Enter va tugma bosilishi bir
  // vaqtda ikkita submit() chaqirsa, ikkalasi ham "disabled hali false"
  // holatida boshlanib ketishi mumkin. Ikkita parallel signIn'da localStorage
  // keyinroq kelgan (Redis'dagidan farqli) tokenni saqlab qolib, keyingi
  // so'rovda "auth.failed" bilan chiqarib yuborilardi — shu sabab sync ref.
  const submittingRef = useRef(false);

  const logoUrl = brand.logo ? `${API}${brand.logo}` : null;

  const submit = async () => {
    if (submittingRef.current) return;
    try {
      if (form.phone.length !== PHONE_DIGITS_LEN + PHONE_PREFIX.length + 1 || !form.password)
        throw new Error("auth.fillTheRows");
      submittingRef.current = true;
      setDisabled(true);

      const res = await api.post("/auth/signin", { slug: brand.slug, phone: form.phone, password: form.password });
      const { ok, data, access, authType, msg } = res.data;
      if (!ok) throw new Error(msg);
      setSession(authType, access);
      setActiveCenter(data.activeCenter || "");
      successMsg(msg);
      dp(updateUser({ ...data, authType }));
      navigate("/dashboard", { replace: true });
    } catch (error) {
      errorMsg(error.message);
      setDisabled(false);
      submittingRef.current = false;
    }
  };

  return (
    <main
      onKeyDown={(k) => k.key === "Enter" && submit()}
      className="relative isolate flex flex-col items-center justify-center w-full min-h-screen px-4 py-16 overflow-hidden"
    >
      {/* Fon — yuqoridan tushadigan yumshoq ko'k nur, sahifani "bo'sh" qilmaydi. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -z-10 left-1/2 -top-48 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-blue-400/20 dark:bg-blue-500/10 blur-3xl"
      />

      {/* Nozik nuqtali to'r — forma atrofida ko'rinadi, chetlarga qarab so'nadi. */}
      <div
        aria-hidden="true"
        data-login-pattern
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(var(--color-slate-300)_1px,transparent_1px)] dark:bg-[radial-gradient(var(--color-night-600)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black_20%,transparent_100%)]"
      />

      <div className="absolute top-4 right-4">
        <UpdateLang />
      </div>

      <div className="flex flex-col items-center w-full max-w-[400px]">
        {/* Brend: logo → nom → shior */}
        <div className="flex flex-col items-center text-center animate-rise-in [animation-delay:0ms]">
          {/* Logo istalgan nisbatda bo'lishi mumkin (kvadrat, keng, baland) —
              ramka/kesish yo'q: balandlik va kenglik chegarasi ichida o'z
              shaklida turadi. Logo bo'lmasa — faqat nom. */}
          {logoUrl && (
            <img
              src={logoUrl}
              alt={brand.name}
              className="block w-auto h-auto max-h-20 max-w-[min(240px,100%)] mb-5 object-contain rounded-xl"
            />
          )}
          <h1 className="text-[26px] font-space font-bold leading-tight text-slate-900 dark:text-slate-100 break-words max-w-full">
            {brand.name}
          </h1>
          {brand.slogan && (
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 break-words max-w-full">{brand.slogan}</p>
          )}
        </div>

        {/* Forma */}
        <div className="w-full mt-8 p-6 sm:p-7 rounded-2xl border border-slate-200/80 dark:border-night-700 bg-white dark:bg-night-900 shadow-xl shadow-slate-900/[0.04] dark:shadow-none animate-rise-in [animation-delay:90ms]">
          <div className="flex flex-col gap-1 mb-5">
            <p className="text-lg font-semibold font-space text-slate-900 dark:text-slate-100">{t("auth.title")}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("auth.desc")}</p>
          </div>

          <div className="flex flex-col gap-4">
            <Input
              label={t("auth.phone")}
              placeholder="+998901234567"
              required
              type="tel"
              inputMode="tel"
              autoComplete="username"
              icon={<HiDevicePhoneMobile />}
              value={form.phone}
              onChange={(e) => {
                const phone = formatPhone(e.target.value);
                setForm((prev) => ({ ...prev, phone }));
                savePhone(phone);
              }}
            />
            <Input
              label={t("auth.password")}
              placeholder="******"
              required
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              icon={
                showPass ? (
                  <HiEye onClick={() => setShowPass(false)} className="cursor-pointer" />
                ) : (
                  <HiEyeSlash onClick={() => setShowPass(true)} className="cursor-pointer" />
                )
              }
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value.trim() }))}
            />
          </div>

          <div className="mt-6">
            <Button fullWith loading={disabled} onClick={submit}>
              {t("common.confirm")}
            </Button>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-400 dark:text-slate-500 animate-rise-in [animation-delay:180ms]">
          © {new Date().getFullYear()} {brand.name} · {t("auth.poweredBy")}{" "}
          <span className="font-space font-semibold">
            <span className="text-blue-500">WE</span>
            <span className="text-slate-500 dark:text-slate-400">NET</span>
          </span>
        </p>
      </div>
    </main>
  );
}

export default LoginForm;
