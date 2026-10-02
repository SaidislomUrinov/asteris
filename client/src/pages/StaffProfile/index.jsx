import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { HiCalendarDays, HiKey, HiLanguage, HiUser } from "react-icons/hi2";
import Avatar from "../../ui/Avatar";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Chip from "../../ui/Chip";
import Dialog from "../../ui/Dialog";
import UpdateLang from "../../components/UpdateLang";
import IntegrationCard from "../Notifications/IntegrationCard";
import { updateUser } from "../../contexts/user";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import useFeature from "../../hooks/useFeature";

// Ulanish jarayonida havola ochilgach, foydalanuvchi Telegram'da "Start"
// bosishini kutamiz — shu oraliqda holatni sekin-sekin so'raymiz
// (Notifications/index.jsx dagi bilan bir xil naqsh).
const POLL_MS = 3000;
const POLL_MAX = 40; // ~2 daqiqa

// Rol bo'yicha urg'u rangi — sarlavha chipida va avatar halqasida, har bir
// rol o'zining panelidagi (TeacherHome — ko'k, ReceptionHome — emerald)
// identifikatsiyasiga mos keladi.
const ROLE_ACCENT = { teacher: "blue", assistant: "violet", reception: "emerald" };

// Har qanday Staff (Reception/Manager/Teacher) uchun umumiy profil sahifasi.
// Dizayn (2026-08-27 qayta qurildi): tepada bitta "hero" konteyner (avatar,
// ism, rol, ro'yxatdan o'tgan sana, tarif), pastda ikki ustun — chapda
// shaxsiy ma'lumot + parol (bitta "Saqlash"), o'ngda Telegram integratsiyasi
// + til tanlovi. Oylik/Tranzaksiya endi alohida "Moliya" (/finance)
// sahifasiga ko'chirildi.
function StaffProfile() {
  const { t } = useTranslation();
  const dp = useDispatch();
  const user = useSelector((e) => e.user);
  const hasFeature = useFeature();
  const telegramAllowed = hasFeature("telegram.notifications");
  const accent = ROLE_ACCENT[user.role] || "slate";

  const [name, setName] = useState(user.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const [tg, setTg] = useState(null); // { linked, lang }
  const [tgLoading, setTgLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState(false);
  const pollRef = useRef(null);

  const roleKey =
    user.role === "reception" ? "reception" : user.role === "teacher" || user.role === "assistant" ? "teacher" : "generic";

  const fetchTgStatus = useCallback(async () => {
    try {
      const res = await api.get("/telegram/status");
      if (res.data.ok) setTg(res.data.data);
    } catch {
      // jim
    } finally {
      setTgLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => (telegramAllowed ? fetchTgStatus() : setTgLoading(false)), 0);
    return () => clearTimeout(id);
  }, [fetchTgStatus, telegramAllowed]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const connectTelegram = async () => {
    try {
      setConnecting(true);
      const res = await api.post("/telegram/link");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      if (!data.deepLink) throw new Error("telegram.botUnavailable");

      window.open(data.deepLink, "_blank", "noopener,noreferrer");

      let ticks = 0;
      pollRef.current = setInterval(async () => {
        ticks += 1;
        const statusRes = await api.get("/telegram/status").catch(() => null);
        const linked = statusRes?.data?.data?.linked;
        if (linked) {
          clearInterval(pollRef.current);
          setConnecting(false);
          setTg(statusRes.data.data);
          successMsg("telegram.linked");
        } else if (ticks >= POLL_MAX) {
          clearInterval(pollRef.current);
          setConnecting(false);
        }
      }, POLL_MS);
    } catch (error) {
      errorMsg(error.message);
      setConnecting(false);
    }
  };

  const confirmUnlink = async () => {
    try {
      const res = await api.post("/telegram/unlink");
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      setTg((prev) => ({ ...prev, linked: false }));
      setUnlinkTarget(false);
      successMsg(msg);
    } catch (error) {
      errorMsg(error.message);
    }
  };

  const changeLang = async (lang) => {
    setTg((prev) => ({ ...prev, lang }));
    try {
      const res = await api.patch("/telegram/lang", { lang });
      if (!res.data.ok) throw new Error(res.data.msg);
    } catch (error) {
      errorMsg(error.message);
    }
  };

  const saveRequisites = async () => {
    const wantsPasswordChange = !!currentPassword || !!newPassword;
    if (!name.trim() && !wantsPasswordChange) return;
    if (wantsPasswordChange && (!currentPassword || !newPassword)) {
      return errorMsg("staff.fillTheRows");
    }
    try {
      setSaving(true);
      const body = {};
      if (name.trim() && name.trim() !== user.name) body.name = name.trim();
      if (wantsPasswordChange) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      if (Object.keys(body).length === 0) return;

      const res = await api.patch("/staff-auth/profile", body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      dp(updateUser({ ...data }));
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full gap-6">
      {/* ── Hero — avatar, ism, rol, ro'yxatdan o'tgan sana, tarif ──────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar user={user} size={64} />
          <div className="flex flex-col gap-2 min-w-0">
            <p className="font-space font-bold text-2xl text-slate-900 truncate">{user.name}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Chip value={t(`role.${user.role}`)} color={accent} variant="ghost" />
              {user.date && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <HiCalendarDays className="text-slate-300" />
                  {t("profile.registeredAt", { date: user.date })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Ikki ustun — chap: shaxsiy ma'lumot, o'ng: telegram + til ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Chap — Shaxsiy ma'lumotlar */}
        <div className="flex flex-col gap-4 p-5 sm:p-6 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="font-semibold text-slate-800 flex items-center gap-2">
            <HiUser className="text-slate-400" />
            {t("profile.requisitesTitle")}
          </p>

          <Input
            label={t("staff.name")}
            variant="white"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex flex-col gap-3 pt-3 mt-1 border-t border-slate-100">
            <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <HiKey className="text-slate-400" />
              {t("profile.changePasswordTitle")}
            </p>
            <Input
              label={t("profile.currentPassword")}
              type="password"
              variant="white"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              label={t("profile.newPassword")}
              type="password"
              variant="white"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="flex justify-end pt-4 mt-1 border-t border-slate-100">
            <Button color="blue" loading={saving} onClick={saveRequisites} className="w-full sm:w-auto">
              {t("common.save")}
            </Button>
          </div>
        </div>

        {/* O'ng — Telegram + Til */}
        <div className="flex flex-col gap-6">
          {telegramAllowed && (
            <IntegrationCard
              linked={!!tg?.linked}
              loading={tgLoading}
              connecting={connecting}
              descriptionKey={`telegram.desc.${roleKey}`}
              lang={tg?.lang}
              onConnect={connectTelegram}
              onUnlinkRequest={() => setUnlinkTarget(true)}
              onLangChange={changeLang}
            />
          )}

          <div className="flex flex-col gap-3 p-5 sm:p-6 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="font-semibold text-slate-800 flex items-center gap-2">
              <HiLanguage className="text-slate-400" />
              {t("profile.languageTitle")}
            </p>
            <UpdateLang />
          </div>
        </div>
      </div>

      <Dialog
        open={!!unlinkTarget}
        onClose={() => setUnlinkTarget(false)}
        title={t("telegram.unlink")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setUnlinkTarget(false)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" onClick={confirmUnlink}>
              {t("telegram.unlink")}
            </Button>
          </>
        }
      >
        <p>{t("telegram.unlinkConfirm")}</p>
      </Dialog>
    </div>
  );
}

export default StaffProfile;
