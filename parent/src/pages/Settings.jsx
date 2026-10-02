import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Page } from "../components/Page";
import { Avatar, Card, Divider, SectionLabel } from "../components/Card";
import { Switch } from "../components/Switch";
import { SegmentTabs } from "../components/SegmentTabs";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ListSkeleton } from "../components/Skeleton";
import { useAuth } from "../contexts/auth";
import { useChildren } from "../contexts/children";
import { patchSettings, setRole, unlink } from "../api/parent";
import { useRoleT } from "../hooks/useRoleT";
import { initials } from "../utils/format";
import { haptic } from "../lib/telegram";

const MUTE_KEYS = ["attendance", "lessonFinished", "payment", "debt", "badge"];
// O'quvchiga davomat/to'lov/qarz xabarlari yuborilmaydi (kontrakt §5)
// `badge` — yutuq nishonlari (TYPE_ROLES.badge = parent + student)
const STUDENT_MUTE_KEYS = ["lessonFinished", "lessonReminder", "homework", "badge"];
const ROLES = ["parent", "student"];
const LANGS = [
  { value: "uz", label: "O'zbekcha" },
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
];

export const Settings = () => {
  const { t, i18n } = useTranslation();
  const rt = useRoleT();
  const { parent, setParent, logout, role, isStudent, availableRoles } = useAuth();
  const { list, loading } = useChildren();
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const save = async (body, key) => {
    setBusy(key);
    try {
      const p = await patchSettings(body);
      setParent(p);
      haptic("success");
    } catch (e) {
      toast.error(t(e.code, { defaultValue: t("error.unknown") }));
    } finally {
      setBusy(null);
    }
  };

  // Rol almashtirish: server yangi /me qaytaradi → setParent → Shell key={role}
  // bilan qayta yuklanadi (children, bildirishnomalar...).
  const changeRole = async (next) => {
    if (next === role || busy) return;
    setBusy("role");
    try {
      const p = await setRole(next);
      haptic("success");
      toast.success(t("parent.roleSaved"));
      setParent(p);
    } catch (e) {
      toast.error(t(e.code, { defaultValue: t("error.unknown") }));
    } finally {
      setBusy(null);
    }
  };

  const doUnlink = async () => {
    setUnlinking(true);
    try {
      await unlink();
      toast.success(t("settings.unlinked"));
      setConfirm(false);
      logout();
    } catch (e) {
      toast.error(t(e.code, { defaultValue: t("error.unknown") }));
    } finally {
      setUnlinking(false);
    }
  };

  const mute = parent?.mute || {};
  const muteKeys = isStudent ? STUDENT_MUTE_KEYS : MUTE_KEYS;
  return (
    <Page title={t("tab.settings")}>
      <Card className="flex items-center gap-3 p-4">
        <Avatar text={initials(parent?.name)} className="w-12 h-12 rounded-full text-base" />
        <div className="min-w-0">
          <div className="font-extrabold text-[15px] break-words">{parent?.name}</div>
          <div className="text-xs text-hint mt-0.5 tabular">{parent?.phone} · Telegram</div>
        </div>
      </Card>

      {availableRoles.length === 2 && (
        <>
          <SectionLabel>{t("student.settings.roleTitle")}</SectionLabel>
          <SegmentTabs
            items={ROLES.map((r) => ({ value: r, label: t(`student.settings.role.${r}`) }))}
            value={role}
            onChange={changeRole}
            className={busy === "role" ? "opacity-60 pointer-events-none" : undefined}
          />
          <div className="text-xs text-hint px-1 -mt-1">{t("student.settings.roleHint")}</div>
        </>
      )}

      <SectionLabel>{t("settings.notifTitle")}</SectionLabel>
      <Card>
        {muteKeys.map((k, i) => (
          <div key={k}>
            {i > 0 && <Divider className="my-1.5" />}
            <div className="flex items-center gap-3 py-1">
              <span className="flex-1 text-sm break-words">{rt(`settings.mute.${k}`)}</span>
              <Switch
                label={rt(`settings.mute.${k}`)}
                checked={!mute[k]}
                disabled={busy === k}
                onChange={(on) => save({ mute: { [k]: !on } }, k)}
              />
            </div>
          </div>
        ))}
      </Card>
      <div className="text-xs text-hint px-1 -mt-1">{rt("settings.notifHint")}</div>

      <SectionLabel>{t("settings.lang")}</SectionLabel>
      <SegmentTabs
        items={LANGS}
        value={i18n.language}
        onChange={(v) => { i18n.changeLanguage(v); save({ lang: v }, "lang"); }}
      />

      <SectionLabel>{rt("home.children")}</SectionLabel>
      <Card>
        {loading ? (
          <ListSkeleton count={2} />
        ) : list.length === 0 ? (
          <div className="text-sm text-hint py-1">{rt("home.noChildren")}</div>
        ) : (
          list.map((c, i) => (
            <div key={c.student._id}>
              {i > 0 && <Divider className="my-1.5" />}
              <div className="py-0.5 min-w-0">
                <div className="text-sm font-bold break-words">{c.student.fullName}</div>
                <div className="text-xs text-hint break-words">{c.centers.map((x) => x.center.name).join(" · ")}</div>
              </div>
            </div>
          ))
        )}
        <Divider />
        <div className="text-xs text-hint">{rt("settings.childrenHint")}</div>
      </Card>

      <Button variant="danger" className="mt-3" onClick={() => setConfirm(true)}>{t("settings.unlink")}</Button>
      <ConfirmDialog
        open={confirm}
        danger
        title={t("settings.unlink")}
        text={rt("settings.unlinkText")}
        confirmText={t("settings.unlink")}
        cancelText={t("common.cancel")}
        loading={unlinking}
        onConfirm={doUnlink}
        onClose={() => setConfirm(false)}
      />
    </Page>
  );
};
