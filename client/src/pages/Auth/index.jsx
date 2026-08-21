import { useRef, useState } from "react";
import { errorMsg, successMsg } from "../../utils/alert";
import { api, setSession } from "../../utils/fetching";
import { useDispatch } from "react-redux";
import { updateUser } from "../../contexts/user";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import UpdateLang from "../../components/UpdateLang";
import Input from "../../ui/Input";
import {
  HiBriefcase,
  HiDevicePhoneMobile,
  HiEye,
  HiEyeSlash,
  HiUser,
  HiUserGroup,
} from "react-icons/hi2";
import Button from "../../ui/Button";

// `App.jsx`dagi haqiqiy marshrutlar bilan bir xil ro'yxat — login'dan keyin
// faqat SHU prefikslardan biriga mos manzilga qaytariladi. Aks holda (eskirgan
// bookmark, "/login" kabi Auth'ning o'zi joylashgan yo'l, yozuv xatosi...)
// `<Routes>` hech biriga mos kelmay bo'sh sahifa qolib ketardi.
const KNOWN_PATH_PREFIXES = [
  "/dashboard",
  "/centers",
  "/staff",
  "/subjects",
  "/rooms",
  "/groups",
  "/schedule",
  "/lesson",
  "/students",
  "/qr-attendance",
  "/salary",
  "/expenses",
  "/revenue",
  "/subscription",
  "/profile",
  "/notifications",
];

// Bitta panel — Client Owner ("Boshliq") va Staff ("Hodim") shu yerdan tanlab
// kiradi. Ikkalasi ham backendda mustaqil auth zanjiri (/client-auth va
// /staff-auth) — tanlovga qarab boshqa endpoint chaqiriladi.
const ROLES = [
  { value: "owner", key: "auth.roleOwner", endpoint: "/client-auth/signin" },
  { value: "staff", key: "auth.roleStaff", endpoint: "/staff-auth/signin" },
];

// Chap paneldagi tushuntirish — tanlangan rolga qarab icon/rang/matn almashadi.
const ROLE_INFO = {
  owner: {
    icon: HiBriefcase,
    gradient: "from-blue-500 to-blue-950",
    tabActiveText: "text-blue-600",
    titleKey: "auth.ownerInfoTitle",
    descKey: "auth.ownerInfoDesc",
  },
  staff: {
    icon: HiUserGroup,
    gradient: "from-violet-500 via-purple-700 to-purple-950",
    tabActiveText:
      "bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent",
    titleKey: "auth.staffInfoTitle",
    descKey: "auth.staffInfoDesc",
  },
};

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

// Kiritilgan Raqam/Login rolga qarab alohida saqlanadi (owner — telefon,
// staff — login, ikkalasi butunlay boshqa format) — keyingi safar shu
// panelga qaytilganda avtomatik to'ldirilishi uchun. Parol xavfsizlik
// nuqtai nazaridan saqlanmaydi.
const identifierStorageKey = (authType) => `asteris:auth:identifier:${authType}`;
const loadSavedIdentifier = (authType) => localStorage.getItem(identifierStorageKey(authType)) || "";

function Auth() {
  const [authType, setAuthType] = useState("owner");
  const [form, setForm] = useState({
    identifier: loadSavedIdentifier("owner") || formatPhone(""),
    password: "",
  });
  const [disabled, setDisabled] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const dp = useDispatch();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // Faqat React state (`disabled`) yetarli emas — Enter tugmasi (div'dagi
  // onKeyDown) va tugma bosilishi bir vaqtda ikkita submit() chaqirsa, ikkala
  // chaqiruv HAM "disabled hali false" holatida boshlanib ketishi mumkin
  // (state yangilanishi async). Ikkita parallel signIn — ikkalasi ham
  // Redis/DB'da bir xil "oxirgi access" kalitini yozadi, lekin frontend
  // localStorage'ga qaysi javob KEYINROQ kelsa o'shani yozadi — agar tezroq
  // yuborilgan so'rov sekinroq javob qaytarsa, localStorage ESKIRGAN
  // (Redis'dagidan farqli) tokenni saqlab qoladi va keyingi so'rovda darhol
  // "auth.failed" (productionda ENFORCE_SINGLE_DEVICE_SESSION orqali) bilan
  // chiqarib yuboriladi. Shu sabab submit — synchronous ref bilan qulflanadi.
  const submittingRef = useRef(false);

  const info = ROLE_INFO[authType];
  const InfoIcon = info.icon;

  const submit = async () => {
    if (submittingRef.current) return;
    try {
      const identifierFilled =
        authType === "owner"
          ? form.identifier.length === PHONE_DIGITS_LEN + PHONE_PREFIX.length + 1
          : !!form.identifier;
      if (!identifierFilled || !form.password)
        throw new Error("auth.fillTheRows");
      submittingRef.current = true;
      setDisabled(true);

      const endpoint = ROLES.find((r) => r.value === authType).endpoint;
      const body =
        authType === "owner"
          ? { phone: form.identifier, password: form.password }
          : { login: form.identifier, password: form.password };
      const res = await api.post(endpoint, body);
      const { ok, data, access, refresh, msg } = res.data;
      if (!ok) throw new Error(msg);
      setSession(authType, access, refresh);
      successMsg(msg);
      dp(updateUser({ ...data, authType }));
      // `App.jsx` login bo'lmaganda ham URL'ni o'zgartirmaydi (shu joyda
      // `<Auth/>` chizadi) — shuning uchun foydalanuvchi to'g'ridan-to'g'ri
      // (masalan) `/groups/123`ga kirgan yoki sessiyasi o'sha sahifada
      // tugagan bo'lsa, `location.pathname` aynan o'sha manzil. Har doim
      // `/dashboard`ga tashlash o'rniga, mumkin bo'lsa o'sha yerga qaytariladi
      // — lekin FAQAT haqiqiy marshrutlardan biriga mos kelsa (aks holda
      // `<Routes>` hech biriga mos kelmay bo'sh sahifa qolardi).
      const known = KNOWN_PATH_PREFIXES.some(
        (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
      );
      const target = known ? `${location.pathname}${location.search || ""}` : "/dashboard";
      navigate(target, { replace: true });
    } catch (error) {
      errorMsg(error.message);
      setDisabled(false);
      submittingRef.current = false;
    }
  };

  return (
    <div
      onKeyDown={(k) => k.key === "Enter" && submit()}
      className="flex w-full h-screen"
    >
      {/* Chap panel — ro'l tanlanganiga asoslangan tushuntirish */}
      <div
        className={`hidden lg:flex flex-col justify-between flex-1 p-12 text-white bg-gradient-to-br ${info.gradient} duration-500 relative overflow-hidden`}
      >
        <p className="text-2xl font-space font-semibold z-10">Asteris</p>

        <div key={authType} className="flex flex-col gap-5 z-10 max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-2xl animate-rise-in [animation-delay:0ms]">
            <InfoIcon />
          </div>
          <p className="text-3xl font-space font-semibold leading-tight animate-rise-in [animation-delay:80ms]">
            {t(info.titleKey)}
          </p>
          <p className="text-white/70 animate-rise-in [animation-delay:160ms]">
            {t(info.descKey)}
          </p>
        </div>

        <p className="text-white/40 text-xs z-10">
          © {new Date().getFullYear()} Asteris
        </p>
      </div>

      {/* O'ng panel — tizimga kirish containeri */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
        <p className="lg:hidden text-[40px] font-space font-semibold animate-rise-in [animation-delay:0ms]">
          <span className="font-space text-blue-500">A</span>steris
        </p>
        <div className="flex flex-col w-full sm:w-110 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="relative z-20 flex flex-col gap-1 p-5 border-b border-slate-100 animate-rise-in [animation-delay:0ms]">
            <div className="flex items-center justify-between w-full">
              <p className="font-semibold font-space text-[22px]">
                {t("auth.title")}
              </p>
              <UpdateLang />
            </div>
            <p className="text-zinc-500 text-sm">{t("auth.desc")}</p>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-center w-full gap-2 bg-slate-100 rounded-xl p-1 animate-rise-in [animation-delay:80ms]">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => {
                    setAuthType(r.value);
                    const saved = loadSavedIdentifier(r.value);
                    setForm((prev) => ({
                      ...prev,
                      identifier: saved || (r.value === "owner" ? formatPhone("") : ""),
                    }));
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold duration-150 cursor-pointer ${
                    authType === r.value
                      ? "bg-white shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span
                    className={
                      authType === r.value ? ROLE_INFO[r.value].tabActiveText : ""
                    }
                  >
                    {t(r.key)}
                  </span>
                </button>
              ))}
            </div>

            <div className="w-full animate-rise-in [animation-delay:160ms]">
              {authType === "owner" ? (
                <Input
                  key="phone"
                  label={t("auth.phone")}
                  placeholder="+998901234567"
                  required
                  icon={<HiDevicePhoneMobile />}
                  onChange={(e) => {
                    const identifier = formatPhone(e.target.value);
                    setForm((prev) => ({ ...prev, identifier }));
                    localStorage.setItem(identifierStorageKey("owner"), identifier);
                  }}
                  value={form.identifier}
                />
              ) : (
                <Input
                  key="login"
                  label={t("auth.login")}
                  placeholder="login"
                  required
                  icon={<HiUser />}
                  onChange={(e) => {
                    const identifier = e.target.value.trim();
                    setForm((prev) => ({ ...prev, identifier }));
                    localStorage.setItem(identifierStorageKey("staff"), identifier);
                  }}
                  value={form.identifier}
                />
              )}
            </div>

            <div className="w-full animate-rise-in [animation-delay:220ms]">
              <Input
                label={t(`auth.password`)}
                placeholder="******"
                required
                type={showPass ? "text" : "password"}
                icon={
                  !showPass ? (
                    <HiEyeSlash
                      onClick={() => setShowPass((prev) => !prev)}
                      className="cursor-pointer"
                    />
                  ) : (
                    <HiEye
                      onClick={() => setShowPass((prev) => !prev)}
                      className="cursor-pointer"
                    />
                  )
                }
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    password: e.target.value.trim(),
                  }))
                }
                value={form.password}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-slate-100 animate-rise-in [animation-delay:280ms]">
            <Button fullWith loading={disabled} onClick={submit}>
              {t("common.confirm")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Auth;
