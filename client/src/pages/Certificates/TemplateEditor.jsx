import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  HiArrowLeft,
  HiPlus,
  HiQrCode,
  HiTrash,
  HiXMark,
  HiBars3BottomLeft,
  HiBars3,
  HiBars3BottomRight,
  HiMagnifyingGlassPlus,
  HiMagnifyingGlassMinus,
  HiArrowsPointingOut,
  HiEye,
  HiEyeSlash,
  HiSquares2X2,
  HiPhoto,
  HiArrowUpTray,
  HiUser,
  HiBookOpen,
  HiUserGroup,
  HiCalendarDays,
  HiPencilSquare,
} from "react-icons/hi2";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Input from "../../ui/Input";
import Textarea from "../../ui/Textarea";
import Select from "../../ui/Select";
import DropMenu from "../../ui/DropMenu";
import Loading from "../../ui/Loading";
import { api, API } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

// Har bir maydon turi uchun standart ko'rinish — konstruktor palitrasida
// va joylashtirilgan belgida ishlatiladi. `repeatable` — "text" bir nechta
// marta qo'shilishi mumkin (masalan sarlavha + tabrik matni alohida-alohida),
// qolganlari sertifikatda faqat BITTA marta ma'noga ega. `icon`/`iconClass`
// faqat vizual — "Element qo'shish" menyusi va joylashtirilgan elementlar
// ro'yxatida ishlatiladi.
const FIELD_META = {
  studentName: {
    labelKey: "certificateTemplate.fieldStudentName",
    sample: "Shahnoza Karimova",
    icon: HiUser,
    iconClass: "bg-blue-100 text-blue-600",
  },
  subjectName: {
    labelKey: "certificateTemplate.fieldSubjectName",
    sample: "Matematika",
    icon: HiBookOpen,
    iconClass: "bg-amber-100 text-amber-600",
  },
  groupName: {
    labelKey: "certificateTemplate.fieldGroupName",
    sample: "Matematika - 12",
    icon: HiUserGroup,
    iconClass: "bg-pink-100 text-pink-600",
  },
  date: {
    labelKey: "certificateTemplate.fieldDate",
    sample: "22.08.2026",
    icon: HiCalendarDays,
    iconClass: "bg-emerald-100 text-emerald-600",
  },
  qr: {
    labelKey: "certificateTemplate.fieldQr",
    sample: "",
    icon: HiQrCode,
    iconClass: "bg-slate-200 text-slate-700",
  },
  text: {
    labelKey: "certificateTemplate.fieldText",
    sample: "",
    repeatable: true,
    icon: HiPencilSquare,
    iconClass: "bg-violet-100 text-violet-600",
  },
};
const FIELD_KEYS = Object.keys(FIELD_META);
const ALIGN_OPTIONS = [
  { value: "left", Icon: HiBars3BottomLeft, labelKey: "certificateTemplate.alignLeft" },
  { value: "center", Icon: HiBars3, labelKey: "certificateTemplate.alignCenter" },
  { value: "right", Icon: HiBars3BottomRight, labelKey: "certificateTemplate.alignRight" },
];

// Konstruktor "sahifa"sining nominal kengligi (px) — zoom shu kenglikka
// nisbatan CSS `scale()` bilan ishlaydi, mobil ekranda `max-w-full` orqali
// konteynerga moslab kichrayadi.
const PAGE_WIDTH = 880;

// Serverdan kelgan maydonlarda `id` yo'q (schema'da saqlanmaydi — faqat
// UI ichida bir nechta "text" maydonini bir-biridan ajratish uchun kerak).
let idCounter = 0;
const nextId = () => `f${Date.now()}${idCounter++}`;

/**
 * Sertifikat konstruktori — fon rasmi ustiga o'quvchi ismi/fan/sana/QR/matn
 * maydonlarini SUDRAB (pointer drag) joylashtirish. Har bir maydon foizda
 * (`xPct`/`yPct`, 0-100) saqlanadi — shu bilan preview o'lchamidan mustaqil
 * bo'lib, server tomonda PDF generatsiyada ham xuddi shu nisbat ishlatiladi.
 *
 * Avval modal (Dialog) ko'rinishida edi — endi mustaqil sahifa
 * (`/certificates/template/new` yoki `/certificates/template/:id`), UI/holat
 * mantig'i o'zgarmagan.
 */
function TemplateEditor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id && id !== "new";

  const canvasRef = useRef(null);
  const dragIdRef = useRef(null);

  const [loading, setLoading] = useState(isEdit);
  const [template, setTemplate] = useState(null);
  const [limit, setLimit] = useState(10);
  const [currentCount, setCurrentCount] = useState(0);

  const [name, setName] = useState("");
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fields, setFields] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [fonts, setFonts] = useState([]);

  // Faqat KO'RINISHGA oid holatlar — saqlanadigan ma'lumotga umuman
  // ta'sir qilmaydi. `zoom` canvas'ga CSS `scale()` bilan qo'llanadi (drag
  // hisob-kitobi `getBoundingClientRect()`dan olingani uchun to'g'ri
  // ishlayveradi), `previewMode` faqat tahrirlash chizig'i/handle'larni
  // vaqtincha yashiradi, `mobileSidebarOpen` kichik ekranda panelni
  // ko'rsatish/yashirish uchun.
  const [zoom, setZoom] = useState(100);
  const [previewMode, setPreviewMode] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const goBack = () => navigate("/certificates");

  // Ro'yxat sahifasidagi limit/currentCount + (tahrirlash bo'lsa) shablon
  // hujjatining o'zi — sahifa to'g'ridan-to'g'ri URL orqali ochilsa ham
  // ishlashi uchun har doim serverdan qayta so'raladi.
  useEffect(() => {
    const idTimeout = setTimeout(async () => {
      try {
        setLoading(true);
        const listRes = await api.get("/certificate-templates");
        if (listRes.data.ok) {
          setCurrentCount((listRes.data.data || []).length);
          if (listRes.data.limit) setLimit(listRes.data.limit);
        }

        if (isEdit) {
          const res = await api.get(`/certificate-templates/${id}`);
          const { ok, data, msg } = res.data;
          if (!ok) throw new Error(msg);
          setTemplate(data);
          setName(data.name || "");
          setPreviewUrl(data.backgroundUrl ? `${API}${data.backgroundUrl}` : "");
          setFields((data.fields || []).map((f) => ({ ...f, id: nextId() })));
          setCenterId(data.center || "");
        }
      } catch (error) {
        errorMsg(error.message);
        goBack();
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => clearTimeout(idTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const idTimeout = setTimeout(async () => {
      try {
        const res = await api.get("/centers", { params: { page: 1 } });
        const { ok, data } = res.data;
        if (!ok) return;
        setCenters(data || []);
        if (!isEdit && data?.length === 1) setCenterId(data[0]._id);
      } catch {
        // filial tanlovi ixtiyoriy yordamchi ma'lumot — xato bo'lsa jim
      }
    }, 0);
    return () => clearTimeout(idTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shriftlar ro'yxati + brauzerga yuklash (`FontFace`) — shunda constructor
  // preview'da HAQIQIY shrift ko'rinadi, PDF'dagi natijaga yaqin bo'ladi.
  useEffect(() => {
    const idTimeout = setTimeout(async () => {
      try {
        const res = await api.get("/fonts");
        const { ok, data } = res.data;
        if (!ok) return;
        setFonts(data || []);
        data?.forEach((f) => {
          const face = new FontFace(f.family, `url(${API}${f.fileUrl})`);
          face
            .load()
            .then((loaded) => document.fonts.add(loaded))
            .catch(() => {
              // shrift fayli buzuq/qo'llab-quvvatlanmasa — standart shriftga qoladi
            });
        });
      } catch {
        // shrift ro'yxati ixtiyoriy — xato bo'lsa standart shrift ishlatiladi
      }
    }, 0);
    return () => clearTimeout(idTimeout);
  }, []);

  const usedKeys = new Set(fields.filter((f) => !FIELD_META[f.key].repeatable).map((f) => f.key));
  const availableKeys = FIELD_KEYS.filter((k) => FIELD_META[k].repeatable || !usedKeys.has(k));
  const selected = fields.find((f) => f.id === selectedId) || null;

  const onPickBackground = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackgroundFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const addField = (key) => {
    const fid = nextId();
    setFields((prev) => [
      ...prev,
      {
        id: fid,
        key,
        xPct: 50,
        yPct: 50,
        fontSize: key === "qr" ? 90 : 28,
        color: "#0f172a",
        align: "center",
        content: key === "text" ? t("certificateTemplate.fieldTextDefault") : "",
        fontFamily: "",
      },
    ]);
    setSelectedId(fid);
  };

  const removeField = (fid) => {
    setFields((prev) => prev.filter((f) => f.id !== fid));
    setSelectedId((prev) => (prev === fid ? null : prev));
  };

  const updateField = (fid, patch) =>
    setFields((prev) => prev.map((f) => (f.id === fid ? { ...f, ...patch } : f)));

  // Pointer drag — sichqoncha/barmoq bosilganda boshlanadi (shu bosish
  // maydonni ham TANLAYDI — sozlamalar paneli shu bilan ochiladi),
  // harakatlanganda konteyner ichidagi nisbiy foizga aylantiriladi.
  const startDrag = (fid) => (e) => {
    e.preventDefault();
    setSelectedId(fid);
    dragIdRef.current = fid;

    // Bosilgan nuqta bilan elementning ankraj nuqtasi (xPct/yPct) orasidagi
    // farq — aks holda birinchi harakatda ankraj nuqta to'g'ridan-to'g'ri
    // kursor ostiga "sakrab" ketardi (element qayerdan ushlangani muhim
    // emas edi). Shu farq butun sudrash davomida saqlanadi, shunda element
    // kursor bilan QAYERDAN ushlangan bo'lsa o'sha nisbiy holatda ergashadi.
    const rect = canvasRef.current?.getBoundingClientRect();
    const field = fields.find((f) => f.id === fid);
    const startClientX = e.touches?.[0]?.clientX ?? e.clientX;
    const startClientY = e.touches?.[0]?.clientY ?? e.clientY;
    const offsetX =
      rect && field ? startClientX - rect.left - (field.xPct / 100) * rect.width : 0;
    const offsetY =
      rect && field ? startClientY - rect.top - (field.yPct / 100) * rect.height : 0;

    const move = (ev) => {
      const rect2 = canvasRef.current?.getBoundingClientRect();
      if (!rect2 || !dragIdRef.current) return;
      const clientX = ev.touches?.[0]?.clientX ?? ev.clientX;
      const clientY = ev.touches?.[0]?.clientY ?? ev.clientY;
      const xPct = Math.min(
        100,
        Math.max(0, ((clientX - rect2.left - offsetX) / rect2.width) * 100),
      );
      const yPct = Math.min(
        100,
        Math.max(0, ((clientY - rect2.top - offsetY) / rect2.height) * 100),
      );
      updateField(dragIdRef.current, { xPct, yPct });
    };
    const stop = () => {
      dragIdRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", stop);
  };

  // Chegaradan ushlab kattalashtirish/kichraytirish — sichqoncha pastga
  // bosilgan nuqtadan qancha uzoqlashsa, `fontSize` (matn uchun shrift
  // o'lchami, QR uchun quti tomoni px'da) shuncha o'zgaradi. Diagonal
  // masofa ishlatiladi — foydalanuvchi qaysi burchakdan tortmasin bir xil
  // tabiiy his beradi.
  const startResize = (fid) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(fid);
    const field = fields.find((f) => f.id === fid);
    const startFontSize = field?.fontSize || 24;
    const startX = e.touches?.[0]?.clientX ?? e.clientX;
    const startY = e.touches?.[0]?.clientY ?? e.clientY;
    const move = (ev) => {
      const clientX = ev.touches?.[0]?.clientX ?? ev.clientX;
      const clientY = ev.touches?.[0]?.clientY ?? ev.clientY;
      const delta = clientX - startX + (clientY - startY);
      const next = Math.min(300, Math.max(10, Math.round(startFontSize + delta)));
      updateField(fid, { fontSize: next });
    };
    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", stop);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", stop);
  };

  const submit = async () => {
    try {
      if (!name.trim() || (!isEdit && !centerId)) throw new Error("certificateTemplate.fillTheRows");
      if (!isEdit && !backgroundFile) throw new Error("certificateTemplate.backgroundRequired");
      if (!isEdit && currentCount >= limit) throw new Error("certificateTemplate.limitReached");
      setSaving(true);

      // `id` faqat UI ichida kerak — serverga jo'natilmaydi (schema'da yo'q).
      // eslint-disable-next-line no-unused-vars
      const payloadFields = fields.map(({ id: _fid, ...rest }) => rest);

      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("fields", JSON.stringify(payloadFields));
      if (!isEdit) fd.append("centerId", centerId);
      if (backgroundFile) fd.append("background", backgroundFile);

      const res = isEdit
        ? await api.patch(`/certificate-templates/${template._id}`, fd)
        : await api.post("/certificate-templates", fd);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);

      successMsg(msg);
      goBack();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  const zoomIn = () => setZoom((z) => Math.min(150, z + 10));
  const zoomOut = () => setZoom((z) => Math.max(50, z - 10));
  const zoomReset = () => setZoom(100);

  const insertItems = availableKeys.map((key) => ({
    icon: FIELD_META[key].icon,
    iconClass: FIELD_META[key].iconClass,
    label: t(FIELD_META[key].labelKey),
    onClick: () => addField(key),
  }));

  if (loading) return <Loading height="70vh" />;

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* ── Header — ixcham document-editor toolbar ─────────────── */}
      <div className="flex items-center gap-3 h-14 shrink-0 px-3 sm:px-4 border-b border-slate-200 bg-white">
        <IconButton color="black" variant="ghost" onClick={goBack} className="shrink-0">
          <HiArrowLeft className="text-lg" />
        </IconButton>

        <button
          type="button"
          onClick={() => setMobileSidebarOpen((v) => !v)}
          className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer shrink-0"
        >
          <HiSquares2X2 className="text-lg" />
        </button>

        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-slate-800 truncate">
            {t(isEdit ? "certificateTemplate.edit" : "certificateTemplate.create")}
          </span>
          {!isEdit && (
            <span className="text-[11px] text-slate-400 leading-tight">
              {t("certificateTemplate.limitLabel", { count: currentCount, max: limit })}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Preview/edit toggle */}
        <button
          type="button"
          onClick={() => setPreviewMode((v) => !v)}
          title={t(previewMode ? "certificateTemplate.editMode" : "certificateTemplate.previewMode")}
          className={`hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            previewMode ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          {previewMode ? <HiEyeSlash className="text-base" /> : <HiEye className="text-base" />}
          {t(previewMode ? "certificateTemplate.editMode" : "certificateTemplate.previewMode")}
        </button>

        {/* Zoom controls */}
        <div className="hidden sm:flex items-center gap-0.5 h-9 px-1 rounded-lg bg-slate-100">
          <IconButton
            variant="text"
            color="black"
            onClick={zoomOut}
            className="!min-w-8 !max-w-8 !min-h-8 !max-h-8"
          >
            <HiMagnifyingGlassMinus className="text-base" />
          </IconButton>
          <span className="w-11 text-center text-xs font-semibold text-slate-600 select-none">
            {zoom}%
          </span>
          <IconButton
            variant="text"
            color="black"
            onClick={zoomIn}
            className="!min-w-8 !max-w-8 !min-h-8 !max-h-8"
          >
            <HiMagnifyingGlassPlus className="text-base" />
          </IconButton>
          <IconButton
            variant="text"
            color="black"
            title={t("certificateTemplate.zoomReset")}
            onClick={zoomReset}
            className="!min-w-8 !max-w-8 !min-h-8 !max-h-8"
          >
            <HiArrowsPointingOut className="text-sm" />
          </IconButton>
        </div>
      </div>

      {/* ── Body: sidebar + canvas ───────────────────────────────── */}
      <div className="relative flex flex-1 min-h-0">
        {/* Left properties panel */}
        <div
          className={`${
            mobileSidebarOpen ? "flex" : "hidden"
          } lg:flex absolute lg:relative inset-0 lg:inset-auto z-20 lg:z-auto w-full sm:w-84 lg:w-76 shrink-0 flex-col gap-5 bg-slate-50 lg:bg-slate-50/70 border-r border-slate-200 overflow-y-auto p-4`}
        >
          {/* Hujjat */}
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t("certificateTemplate.sectionDocument")}
            </span>
            <Input
              label={t("certificateTemplate.nameLabel")}
              placeholder={t("certificateTemplate.namePlaceholder")}
              required
              variant="white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {/* Faqat bir nechta filiali bor Boshliqqa ko'rinadi — bitta
                filialda (yoki Resepshinda) tanlov shart emas, backend
                staff'ning o'z filialini majburan ishlatadi. */}
            {!isEdit && centers.length > 1 && (
              <Select
                label={t("center.title")}
                placeholder={t("center.title")}
                required
                variant="white"
                value={centerId}
                onChange={setCenterId}
                options={centers.map((c) => ({ value: c._id, label: c.name }))}
              />
            )}
          </div>

          {/* Fon */}
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t("certificateTemplate.sectionBackground")}
            </span>
            <div className="relative rounded-xl border border-slate-200 bg-white overflow-hidden group">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="w-full h-28 object-cover" />
              ) : (
                <div className="w-full h-28 flex flex-col items-center justify-center gap-1 text-slate-400 bg-slate-50">
                  <HiPhoto className="text-2xl" />
                  <span className="text-[11px] text-center px-3">
                    {t("certificateTemplate.backgroundHint")}
                  </span>
                </div>
              )}
              <label
                className={`absolute inset-0 flex items-end justify-center pb-2 cursor-pointer transition-opacity ${
                  previewUrl
                    ? "opacity-0 group-hover:opacity-100 bg-black/40"
                    : "opacity-100"
                }`}
              >
                <span
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${
                    previewUrl ? "bg-black/60 text-white" : "bg-slate-800/90 text-white"
                  }`}
                >
                  <HiArrowUpTray className="text-sm" />
                  {previewUrl ? t("certificateTemplate.changeImage") : t("certificateTemplate.uploadImage")}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={onPickBackground}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Elementlar */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {t("certificateTemplate.sectionElements")}
              </span>
            </div>

            {insertItems.length > 0 && (
              <DropMenu
                items={insertItems}
                trigger={
                  <div className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition-colors">
                    <HiPlus className="text-sm" />
                    {t("certificateTemplate.addElement")}
                  </div>
                }
              />
            )}

            <div className="flex flex-col gap-1">
              {fields.length === 0 && (
                <p className="text-xs text-slate-400 px-1 py-2">
                  {t("certificateTemplate.elementsEmpty")}
                </p>
              )}
              {fields.map((f) => {
                const meta = FIELD_META[f.key];
                const FieldIcon = meta.icon;
                const isSelected = f.id === selectedId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedId(f.id)}
                    className={`group flex items-center gap-2 w-full h-9 px-2 rounded-lg text-left cursor-pointer transition-colors ${
                      isSelected ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center w-6 h-6 rounded-md shrink-0 ${meta.iconClass}`}
                    >
                      <FieldIcon className="text-xs" />
                    </div>
                    <span className="flex-1 min-w-0 truncate text-xs font-medium">
                      {t(meta.labelKey)}
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeField(f.id);
                      }}
                      title={t("certificateTemplate.deleteElement")}
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0 transition-opacity"
                    >
                      <HiTrash className="text-xs" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Backdrop — mobil drawer ochiq bo'lganda canvas'ni bosib yopadi */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden absolute inset-0 z-10 bg-black/20"
          />
        )}

        {/* Center: contextual toolbar + document canvas */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Kontekst asboblar paneli — element tanlanganda Word uslubidagi
              formatting controls shu yerda chiqadi. */}
          <div className="shrink-0 border-b border-slate-200 bg-white px-3 sm:px-4 py-2 flex items-center gap-3 flex-nowrap overflow-x-auto">
            {selected ? (
              <>
                <div className="flex items-center gap-2 pr-3 border-r border-slate-200 shrink-0">
                  {(() => {
                    const SelIcon = FIELD_META[selected.key].icon;
                    return <SelIcon className="text-slate-400 text-sm" />;
                  })()}
                  <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                    {t(FIELD_META[selected.key].labelKey)}
                  </span>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0">
                  {t("certificateTemplate.fontSizeLabel")}
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={selected.fontSize}
                    onChange={(e) => updateField(selected.id, { fontSize: Number(e.target.value) })}
                    className="w-14 px-2 py-1 rounded-md border border-slate-200 text-xs outline-none focus:border-blue-500"
                  />
                </label>

                {selected.key !== "qr" && (
                  <>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500 shrink-0">
                      {t("certificateTemplate.colorLabel")}
                      <input
                        type="color"
                        value={selected.color}
                        onChange={(e) => updateField(selected.id, { color: e.target.value })}
                        className="w-7 h-7 rounded-md cursor-pointer border border-slate-200"
                      />
                    </label>

                    {/* Har bir yozuv uchun ALOHIDA shrift — Platform Admin
                        yuklagan `/fonts` ro'yxatidan tanlanadi. */}
                    <div className="w-36 shrink-0">
                      <Select
                        variant="white"
                        value={selected.fontFamily || ""}
                        onChange={(v) => updateField(selected.id, { fontFamily: v })}
                        options={[
                          { value: "", label: t("certificateTemplate.fontFamilyDefault") },
                          ...fonts.map((f) => ({
                            value: f.family,
                            // Shrift nomi AYNAN o'sha shrift bilan ko'rsatiladi —
                            // tanlashdan oldin qanday ko'rinishini bilish uchun.
                            label: <span style={{ fontFamily: f.family }}>{f.name}</span>,
                          })),
                        ]}
                      />
                    </div>

                    {/* Matn ichidagi joylashuv (chap/markaz/o'ng) —
                        ko'p qatorli matnlarda va anchor nuqtasiga
                        nisbatan chizilishda ishlatiladi (server PDF
                        generatsiyasi ham shu qiymatga qaraydi,
                        certificatePdf.util.js). */}
                    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 border border-slate-200 shrink-0">
                      {ALIGN_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          title={t(opt.labelKey)}
                          onClick={() => updateField(selected.id, { align: opt.value })}
                          className={`flex items-center justify-center w-7 h-7 rounded-md cursor-pointer transition-colors ${
                            (selected.align || "center") === opt.value
                              ? "bg-white text-blue-600 shadow-sm"
                              : "text-slate-400 hover:text-slate-600"
                          }`}
                        >
                          <opt.Icon className="text-sm" />
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex-1 min-w-2" />

                <button
                  type="button"
                  title={t("certificateTemplate.deleteElement")}
                  onClick={() => removeField(selected.id)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors shrink-0"
                >
                  <HiTrash className="text-base" />
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-400">
                {t("certificateTemplate.noElementSelected")}
              </span>
            )}
          </div>

          {selected?.key === "text" && (
            <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2.5">
              <Textarea
                label={t("certificateTemplate.fieldTextLabel")}
                variant="white"
                rows={2}
                className="!min-h-14 !max-h-28"
                value={selected.content}
                onChange={(e) => updateField(selected.id, { content: e.target.value })}
              />
            </div>
          )}

          {/* Hujjat canvas — neutral workspace o'rtasida "sahifa" */}
          <div className="flex-1 min-h-0 overflow-auto bg-slate-100 flex items-start justify-center p-6 lg:p-10">
            <div
              style={{
                width: PAGE_WIDTH,
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
              }}
              className="max-w-full shrink-0"
            >
              <div
                ref={canvasRef}
                onMouseDown={(e) => e.target === canvasRef.current && setSelectedId(null)}
                className="relative w-full aspect-[1.4/1] rounded-lg bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden select-none"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                    {t("certificateTemplate.backgroundHint")}
                  </div>
                )}

                {fields.map((f) => {
                  // Gorizontal ankraj nuqtasi `align`ga qarab o'zgaradi — jsPDF
                  // `doc.text(..., { align })` xuddi shu naqshda ishlaydi
                  // (left: matn `x`dan o'ngga, right: `x`dan chapga, center:
                  // `x` markazda o'sadi). QR uchun align tushunchasi yo'q,
                  // har doim markazlashtiriladi. Bu konstruktordagi joylashuv
                  // PDF'dagisi bilan AYNAN mos kelishi uchun shart — aks
                  // holda "left" tanlangan matn PDF'da konstruktordagidan
                  // farqli o'ringa (markazdan boshlab) chiqib qoladi.
                  const translateX =
                    f.key === "qr"
                      ? "-translate-x-1/2"
                      : f.align === "left"
                        ? "translate-x-0"
                        : f.align === "right"
                          ? "-translate-x-full"
                          : "-translate-x-1/2";
                  return (
                  <div
                    key={f.id}
                    onMouseDown={!previewMode ? startDrag(f.id) : undefined}
                    onTouchStart={!previewMode ? startDrag(f.id) : undefined}
                    style={{ left: `${f.xPct}%`, top: `${f.yPct}%` }}
                    className={`absolute ${translateX} -translate-y-1/2 flex items-center gap-1 group ${
                      previewMode ? "" : "cursor-move"
                    } ${f.id === selectedId ? "z-10" : ""}`}
                  >
                    {f.key === "qr" ? (
                      <div
                        style={{ width: f.fontSize, height: f.fontSize }}
                        className={`relative flex items-center justify-center rounded-md bg-white/80 text-slate-500 ${
                          previewMode
                            ? ""
                            : `border-2 border-dashed ${
                                f.id === selectedId ? "border-blue-500" : "border-slate-400"
                              }`
                        }`}
                      >
                        <HiQrCode className="text-xl" />
                        {!previewMode && f.id === selectedId && (
                          <div
                            onMouseDown={startResize(f.id)}
                            onTouchStart={startResize(f.id)}
                            title={t("certificateTemplate.fontSizeLabel")}
                            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white cursor-nwse-resize"
                          />
                        )}
                      </div>
                    ) : (
                      <span
                        style={{
                          color: f.color,
                          fontSize: Math.max(10, f.fontSize / 2),
                          textAlign: f.align,
                          // Maxsus shrift bo'lmasa PDF'dagi "helvetica" ga
                          // vizual yaqinroq bo'lishi uchun aniq stack
                          // beriladi — brauzerning ixtiyoriy standart
                          // shriftiga qoldirilmaydi (certificatePdf.util.js
                          // shu holatda `doc.setFont("helvetica","bold")`
                          // ishlatadi).
                          fontFamily: f.fontFamily || "Helvetica, Arial, sans-serif",
                          // PDF'da maxsus shrift "normal", standart shrift
                          // esa "bold" og'irlikda chiziladi
                          // (certificatePdf.util.js) — bir xil chiqishi
                          // uchun konstruktor ham AYNAN shu qoidaga amal
                          // qiladi (Tailwind'ning doimiy `font-semibold`i
                          // o'rniga).
                          fontWeight: f.fontFamily ? 400 : 700,
                        }}
                        // `padding`/`rounded`/fon FAQAT tahrirlash rejimida —
                        // haqiqiy PDF matnni HECH QANDAY padding'siz, aynan
                        // ankraj nuqtasidan chizadi (certificatePdf.util.js
                        // `doc.text(text, x, startY, ...)`). Preview rejimida
                        // (va shu bilan yakuniy sertifikatda) piksel-piksel
                        // bir xil chiqishi uchun bu yerda ham padding yo'q.
                        className={`relative whitespace-pre rounded ${
                          previewMode
                            ? ""
                            : `px-1.5 py-0.5 bg-white/70 border border-dashed ${
                                f.id === selectedId ? "border-blue-500" : "border-slate-400"
                              }`
                        }`}
                      >
                        {f.key === "text" ? f.content || t("certificateTemplate.fieldText") : FIELD_META[f.key].sample}
                        {!previewMode && f.id === selectedId && (
                          <div
                            onMouseDown={startResize(f.id)}
                            onTouchStart={startResize(f.id)}
                            title={t("certificateTemplate.fontSizeLabel")}
                            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white cursor-nwse-resize"
                          />
                        )}
                      </span>
                    )}
                    {!previewMode && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={() => removeField(f.id)}
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white shrink-0 transition-opacity"
                      >
                        <HiXMark className="text-xs" />
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom status/action bar ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 h-13 shrink-0 px-3 sm:px-4 border-t border-slate-200 bg-white">
        <p className="hidden sm:block text-xs text-slate-400 truncate">
          {t("certificateTemplate.dragHint")}
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <Button color="black" variant="text" onClick={goBack} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={submit}>
            {t(isEdit ? "common.update" : "common.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TemplateEditor;
