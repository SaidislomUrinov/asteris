import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiDocumentText, HiPlus, HiTrash } from "react-icons/hi2";
import { api, API } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Input from "../../ui/Input";
import Dialog from "../../ui/Dialog";
import Loading from "../../ui/Loading";

/**
 * Platforma darajasidagi shrift kutubxonasi — bu yerda yuklangan har bir
 * shrift Client/Staff'ning sertifikat konstruktorida (`certificate.manage`
 * tarif flagi ostida) tanlov sifatida ko'rinadi. `GET /fonts` ochiq bo'lgani
 * uchun ro'yxatni o'sha ilova ham to'g'ridan-to'g'ri o'qiydi — bu yerda
 * faqat yuklash/o'chirish boshqariladi.
 */
export default function Fonts() {
  const { t } = useTranslation();
  const [fonts, setFonts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Ro'yxatdagi HAR bir shrift nomi aynan o'sha shriftda ko'rsatilishi
  // uchun brauzerga `FontFace` orqali o'rnatiladi — CSS `fontFamily` faylni
  // o'zi ulamaydi, faqat shu nom RO'YXATDAN o'tgan bo'lsa ishlaydi
  // (client'dagi TemplateDialog.jsx bilan bir xil naqsh, alohida build
  // bo'lgani uchun takrorlanadi).
  const loadFontFaces = (list) => {
    list.forEach((f) => {
      const face = new FontFace(f.family, `url(${API}${f.fileUrl})`);
      face
        .load()
        .then((loaded) => document.fonts.add(loaded))
        .catch(() => {
          // fayl buzuq/qo'llab-quvvatlanmasa — nom standart shriftda qoladi
        });
    });
  };

  const fetchFonts = async () => {
    try {
      setLoading(true);
      const res = await api.get("/fonts");
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setFonts(data || []);
      loadFontFaces(data || []);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchFonts, 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setName("");
    setFile(null);
    setDialogOpen(true);
  };

  const submit = async () => {
    try {
      if (!name.trim()) throw new Error("font.fillTheRows");
      if (!file) throw new Error("font.fileRequired");
      setSaving(true);

      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("font", file);

      const res = await api.post("/fonts", fd);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);

      successMsg(msg);
      setFonts((prev) => [data, ...prev]);
      loadFontFaces([data]);
      setDialogOpen(false);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleteLoading(true);
      const res = await api.delete(`/fonts/${deleteTarget._id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setFonts((prev) => prev.filter((f) => f._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 w-full">
        <p className="text-[18px] font-semibold text-slate-800">
          {t("font.title")} <span className="text-slate-400 text-sm font-normal">({fonts.length})</span>
        </p>
        <Button onClick={openCreate}>
          <HiPlus className="text-base" />
          {t("font.new")}
        </Button>
      </div>

      {loading ? (
        <Loading height="40vh" />
      ) : fonts.length === 0 ? (
        <div className="flex items-center justify-center w-full h-40 text-slate-400 text-sm">
          {t("font.empty")}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl">
          {fonts.map((f) => (
            <div key={f._id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 shrink-0 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                <HiDocumentText />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span
                  className="font-medium text-slate-800 truncate"
                  style={{ fontFamily: f.family }}
                >
                  {f.name}
                </span>
                <span className="text-[12px] text-slate-400">{f.date}</span>
              </div>
              <IconButton variant="ghost" color="red" onClick={() => setDeleteTarget(f)}>
                <HiTrash />
              </IconButton>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        title={t("font.new")}
        actions={
          <>
            <Button color="slate" variant="text" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={submit}>
              {t("common.create")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 w-full">
          <Input
            label={t("font.nameLabel")}
            placeholder={t("font.namePlaceholder")}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-slate-600">{t("font.fileLabel")}</span>
            <input
              type="file"
              accept=".ttf,.otf,.woff"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:cursor-pointer cursor-pointer"
            />
            <span className="text-[12px] text-slate-400">{t("font.fileHint")}</span>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("font.deleteTitle")}
        actions={
          <>
            <Button color="slate" variant="text" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={deleteLoading} onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-slate-700 text-sm">{t("font.deleteConfirm", { name: deleteTarget?.name })}</p>
      </Dialog>
    </div>
  );
}
