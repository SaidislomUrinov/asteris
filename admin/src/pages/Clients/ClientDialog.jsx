import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowUpTray, HiGlobeAlt, HiPhoto, HiTrash } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { api, API } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { downloadClientCredentialsPdf } from "./pdf.util";

const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "wenet.uz";
const initial = { name: "", phone: "", password: "", slug: "" };

// Brend manzili: faqat lotin kichik harf, raqam, chiziqcha (server slug.util bilan bir xil).
const cleanSlug = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);

export default function ClientDialog({ open, onClose, client, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  // Slug qo'lda o'zgartirilmagan bo'lsa — nomdan avtomatik taklif qilinadi.
  const [slugTouched, setSlugTouched] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileRef = useRef(null);

  const isEdit = !!client;

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      setForm(
        client
          ? { name: client.name || "", phone: client.phone || "", password: "", slug: client.slug || "" }
          : initial,
      );
      setSlugTouched(!!client);
      setLogoFile(null);
      setLogoPreview(null);
      setRemoveLogo(false);
    }, 0);
    return () => clearTimeout(timeout);
  }, [open, client]);

  // Yangi mijoz: nom yozilganda bo'sh slug taklifi (band bo'lsa `-2` va h.k.).
  useEffect(() => {
    if (!open || isEdit || slugTouched || !form.name.trim()) return undefined;
    const timeout = setTimeout(async () => {
      try {
        const res = await api.get("/clients/slug-suggest", { params: { name: form.name } });
        if (res.data.ok) setForm((p) => ({ ...p, slug: res.data.data.slug }));
      } catch {
        // taklif ixtiyoriy — admin qo'lda yozadi
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [form.name, open, isEdit, slugTouched]);

  useEffect(() => () => logoPreview && URL.revokeObjectURL(logoPreview), [logoPreview]);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const currentLogo = logoPreview || (!removeLogo && client?.logo ? `${API}${client.logo}` : null);

  const submit = async () => {
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("phone", form.phone);
      if (form.password) fd.append("password", form.password);
      if (form.slug) fd.append("slug", form.slug);
      if (logoFile) fd.append("logo", logoFile);
      if (removeLogo && !logoFile) fd.append("removeLogo", "1");

      const res = isEdit ? await api.patch(`/clients/${client._id}`, fd) : await api.post("/clients", fd);
      const { ok, msg, data } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);

      if (!isEdit) {
        downloadClientCredentialsPdf({
          name: data.name,
          phone: data.phone,
          password: data.plainPassword,
          clientId: data.clientId,
          url: data.appUrl,
        });
      }

      onSaved(data);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const slugChanged = isEdit && client?.slug && form.slug && form.slug !== client.slug;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("client.edit") : t("client.new")}
      actions={
        <>
          <Button color="slate" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={loading} onClick={submit}>
            {isEdit ? t("common.save") : t("common.create")}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <div className="grid place-items-center size-16 shrink-0 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
          {currentLogo ? (
            <img src={currentLogo} alt="" className="w-full h-full object-contain p-1" />
          ) : (
            <HiPhoto className="text-2xl text-slate-400" />
          )}
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-sm text-slate-800">{t("client.logo")}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="outlined" color="slate" onClick={() => fileRef.current?.click()}>
              <HiArrowUpTray className="text-base" />
              {currentLogo ? t("client.logoChange") : t("client.logoUpload")}
            </Button>
            {currentLogo && (
              <Button
                variant="text"
                color="red"
                onClick={() => {
                  setLogoFile(null);
                  setLogoPreview(null);
                  setRemoveLogo(true);
                }}
              >
                <HiTrash className="text-base" />
                {t("common.delete")}
              </Button>
            )}
          </div>
          <span className="text-[12px] text-slate-400">{t("client.logoHint")}</span>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pickLogo} />
      </div>

      <Input label={t("client.name")} required value={form.name} onChange={set("name")} />
      <Input label={t("client.phone")} required value={form.phone} onChange={set("phone")} />
      <div className="flex flex-col gap-1">
        <Input
          label={t("client.slug")}
          required
          icon={<HiGlobeAlt />}
          placeholder="markaz"
          value={form.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setForm((p) => ({ ...p, slug: cleanSlug(e.target.value) }));
          }}
        />
        <p className={`pl-2 text-[12px] ${slugChanged ? "text-amber-600" : "text-slate-400"}`}>
          {form.slug ? `${form.slug}.${ROOT_DOMAIN}` : t("client.slugHint")}
          {slugChanged ? ` — ${t("client.slugChangeHint")}` : ""}
        </p>
      </div>
      <Input
        label={t("client.password")}
        required={!isEdit}
        type="password"
        placeholder={isEdit ? t("client.passwordEditHint") : ""}
        value={form.password}
        onChange={set("password")}
      />
      {!isEdit && <p className="text-[12px] text-slate-400">{t("client.pdfHint")}</p>}
    </Dialog>
  );
}
