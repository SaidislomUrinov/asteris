import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  HiBanknotes,
  HiBookOpen,
  HiIdentification,
  HiKey,
  HiLockClosed,
  HiUser,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Switch from "../../ui/Switch";
import Checkbox from "../../ui/Checkbox";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { featureLabelKey } from "../Subscription/permissionLabels";
import { downloadStaffCredentialsPdf } from "./pdf.util";

// eslint-disable-next-line react-refresh/only-export-components
export const ROLE_OPTIONS = [
  { value: "reception", label: "role.reception" },
  { value: "teacher", label: "role.teacher" },
  // Yordamchi o'qituvchi — guruhga biriktiriladi (ixtiyoriy) va darsda
  // o'qituvchiga yordam beradi: davomat, baho, dars rejasini belgilash.
  { value: "assistant", label: "role.assistant" },
];

// MUHIM: Filial (Center) CRUD hech qachon Hodim ruxsatlari ro'yxatiga
// qo'shilmaydi — markazlarni faqat Client Owner boshqaradi, bu Staff
// permission doirasidan butunlay tashqarida. `dashboard:view` ham alohida
// ruxsat emas — Dashboard har doim ko'rinadi, faqat rolga qarab (Menejer/
// Resepshin -> markaz statistikasi, boshqa rollar -> o'z statistikasi)
// avtomatik moslashadi, alohida yoqib-o'chirish shart emas.
//
// Haqiqiy Hodim ruxsat doirasi — modul bo'yicha guruhlangan, har biri
// `{modul}:{amal}` (server/CLAUDE.md permission jadvali). Bu modullar
// (Guruh, O'quvchi, Fan, To'lov, Davomat, Dars rejasi) hali qurilmagan,
// lekin ruxsat tuzilmasi oldindan tayyorlanadi.
const PERMISSION_GROUPS = [
  {
    titleKey: "staff.groupModules",
    items: [
      { key: "group:view", labelKey: "staff.actionView" },
      { key: "group:create", labelKey: "common.create" },
      { key: "group:update", labelKey: "common.edit" },
      { key: "group:delete", labelKey: "common.delete" },
      { key: "group:addStudent", labelKey: "staff.actionAddStudent" },
      { key: "group:removeStudent", labelKey: "staff.actionRemoveStudent" },
    ],
  },
  {
    titleKey: "staff.groupStudents",
    items: [
      { key: "student:view", labelKey: "staff.actionView" },
      { key: "student:create", labelKey: "common.create" },
      { key: "student:update", labelKey: "common.edit" },
      // Faqat kontakt (ism/raqam/ota-ona raqami) — o'qituvchi/yordamchiga
      // beriladigan tor ruxsat (API_CONTRACT_student_contact_telegram.md §1).
      { key: "student:contact", labelKey: "staff.actionEditContact" },
      { key: "student:delete", labelKey: "common.delete" },
    ],
  },
  {
    titleKey: "staff.groupLeads",
    items: [
      { key: "lead:view", labelKey: "staff.actionView" },
      { key: "lead:create", labelKey: "common.create" },
      { key: "lead:update", labelKey: "common.edit" },
      { key: "lead:delete", labelKey: "common.delete" },
    ],
  },
  {
    titleKey: "staff.groupSubjects",
    items: [
      { key: "subject:view", labelKey: "staff.actionView" },
      { key: "subject:create", labelKey: "common.create" },
      { key: "subject:update", labelKey: "common.edit" },
      { key: "subject:delete", labelKey: "common.delete" },
    ],
  },
  {
    titleKey: "staff.groupPayments",
    items: [
      { key: "payment:view", labelKey: "staff.actionView" },
      { key: "payment:create", labelKey: "staff.actionCollect" },
    ],
  },
  {
    titleKey: "staff.groupAttendance",
    items: [
      { key: "attendance:view", labelKey: "staff.actionView" },
      { key: "attendance:create", labelKey: "staff.actionMark" },
      { key: "attendance:update", labelKey: "common.edit" },
    ],
  },
  {
    titleKey: "staff.groupLessons",
    items: [
      { key: "lesson:view", labelKey: "staff.actionView" },
      { key: "lesson:create", labelKey: "common.create" },
      { key: "lesson:update", labelKey: "common.edit" },
    ],
  },
  // Ko'p o'quv markazlarida o'qituvchilar ish haqi/avansni aynan
  // RESEPSHINDAN oladi — shuning uchun bu huquqni hodimga berish imkoni
  // bo'lishi kerak. Bu ruxsatlar backendda allaqachon
  // `requireTenantPermission("salary:...")` bilan himoyalangan edi, lekin
  // ularni BERISHNING iloji yo'q edi (ro'yxatda yo'q edi).
  {
    titleKey: "staff.groupSalary",
    items: [
      { key: "salary:view", labelKey: "staff.actionView" },
      { key: "salary:manage", labelKey: "staff.actionSalaryManage" },
      { key: "salary:advance", labelKey: "staff.actionSalaryAdvance" },
      { key: "salary:withdraw", labelKey: "staff.actionSalaryWithdraw" },
    ],
  },
  {
    titleKey: "staff.groupExpenses",
    items: [
      { key: "expense:view", labelKey: "staff.actionView" },
      { key: "expense:create", labelKey: "common.create" },
      { key: "expense:update", labelKey: "common.edit" },
    ],
  },
  {
    titleKey: "staff.groupCertificate",
    items: [
      { key: "certificate:view", labelKey: "staff.actionView" },
      { key: "certificate:create", labelKey: "staff.actionCertificateIssue" },
      { key: "certificate:update", labelKey: "common.edit" },
      { key: "certificate:delete", labelKey: "common.delete" },
    ],
  },
  // Markaz kalendari — /calendar sahifasi va "Dam olish kuni" belgilash.
  // Ilgari bu ruxsatlar (`calendar:view`/`calendar:manage`) faqat backend
  // route'larida (calendar.routes.js) va Navbar'da tekshirilardi, lekin
  // Hodim ruxsat formasida umuman ko'rsatilmagan edi — natijada
  // "Cheksiz kirish"siz Resepshin xodimiga kalendarni HECH QACHON berib
  // bo'lmasdi.
  {
    titleKey: "staff.groupCalendar",
    items: [
      { key: "calendar:view", labelKey: "staff.actionView" },
      { key: "calendar:manage", labelKey: "staff.actionCalendarManage" },
    ],
  },
  // Arxiv — API_CONTRACT_archive.md §4. ARXIVLASH huquqi alohida emas: u
  // o'sha modulning `*:delete` ruxsatidan kelib chiqadi (guruhni arxivlash
  // = `group:delete`). Bu yerdagi ikki ruxsat faqat Arxiv BO'LIMIGA
  // tegishli — ko'rish va qaytarish.
  {
    titleKey: "archive.permGroup",
    items: [
      { key: "archive:view", labelKey: "archive.permView" },
      { key: "archive:restore", labelKey: "archive.permRestore" },
    ],
  },
];

// O'qituvchi va yordamchi o'qituvchi FAQAT dars jarayoniga tegishli ishlarni
// bajaradi — to'lov olish, ish haqi tarqatish, xarajat, o'quvchi/guruh/fan
// CRUD Resepshin va Boshliqning ishi. Shu sabab bu rollar tanlanganda ruxsat
// ro'yxati quyidagi doiragacha qisqaradi va "Cheksiz kirish" umuman
// ko'rsatilmaydi (docs/teacher-scope-updates.md §1). Yakuniy tozalash
// backendda — `sanitizeStaffPermissions`.
const TEACHING_ROLES = ["teacher", "assistant"];
const TEACHING_ALLOWED_PERMISSIONS = [
  "group:view",
  "group:create",
  "group:update",
  "student:view",
  "student:create",
  "student:contact",
  "subject:view",
  "attendance:view",
  "attendance:create",
  "attendance:update",
  "lesson:view",
  "lesson:create",
  "lesson:update",
];

// Hodimning oylik hisoblash usuli — bittasi tanlanadi (bir vaqtda foizli VA
// qat'iy oylik bo'lishi mumkin emas). Menejer/Resepshin/O'qituvchi barchasiga
// tegishli (masalan o'quvchi to'lovidan: o'qituvchiga foiz, resepshinga foiz,
// menejerga foiz, qolgani markaz foydasi). Har biri Tariff.allowedPermissions
// orqali ochiladigan premium funksiya — joriy tarifda yo'q bo'lsa bloklanadi.
//
// "Avans"/"Bonus" bu yerda ruxsat sifatida BERILMAYDI — ular Boshliq
// tomonidan alohida, istalgan vaqtda qo'lda beriladigan bir martalik
// tranzaksiyalar (Ish haqi moduli qurilganda), doimiy "ruxsat" emas.
const SALARY_TYPE_OPTIONS = [
  "staff.salary.percentage",
  "staff.salary.fixed",
];

// Har bir oylik variantining qisqacha tushuntirishi — konteyner kartalarda
// nom ostida ko'rsatiladi.
const SALARY_DESCRIPTION_KEYS = {
  "staff.salary.percentage": "staff.salaryDescPercentage",
  "staff.salary.fixed": "staff.salaryDescFixed",
};

const EMPTY_FORM = {
  name: "",
  login: "",
  password: "",
  centerId: "",
  role: "reception",
  unlimited: false,
  permissions: [],
  subjects: [],
  salaryType: "",
  salaryValue: "",
};

// Create/Edit uchun bitta dialog — `staff` prop bo'lsa edit rejimi (PATCH),
// bo'lmasa create (POST). Centers/CenterDialog.jsx bilan bir xil naqsh: ota
// komponent `key={staff?._id || "new"}` bilan remount qiladi, shu sabab forma
// boshlang'ich holati useState lazy init orqali propsdan olinadi.
function StaffDialog({ open, onClose, staff, centers, subjects, onSaved }) {
  const { t } = useTranslation();
  const isEdit = !!staff?._id;

  const allowedTariffPermissions =
    useSelector((e) => e.user.subscription?.tariffSnapshot?.allowedPermissions) || [];
  // Hodimda allaqachon saqlangan oylik turi — tarif pasaygan bo'lsa ham
  // tahrirlashda saqlanib qoladi (backend ham o'zgarmagan turni o'tkazadi).
  const savedSalaryType =
    (isEdit &&
      Array.isArray(staff.permissions) &&
      staff.permissions.find((p) => SALARY_TYPE_OPTIONS.includes(p))) ||
    "";
  // `staff.salary.*` bu yerda TARIF FLAGI sifatida tekshiriladi (hodim oylik
  // turi bilan bir xil satr — server staffPermission.util.js izohiga qara).
  const isTariffAllowed = (perm) =>
    allowedTariffPermissions.includes(perm) || (!!perm && perm === savedSalaryType);
  // Tarifda yo'q oylik turlari umuman ko'rsatilmaydi.
  const visibleSalaryTypes = SALARY_TYPE_OPTIONS.filter(isTariffAllowed);

  const [form, setForm] = useState(() =>
    isEdit
      ? {
          name: staff.name || "",
          login: staff.login || "",
          password: "",
          centerId: staff.center || "",
          role: staff.role || "reception",
          unlimited: Array.isArray(staff.permissions)
            ? staff.permissions.includes("all")
            : false,
          permissions: Array.isArray(staff.permissions)
            ? staff.permissions.filter((p) => p !== "all")
            : [],
          subjects: Array.isArray(staff.subjects) ? staff.subjects : [],
          salaryType:
            (Array.isArray(staff.permissions) &&
              staff.permissions.find((p) => SALARY_TYPE_OPTIONS.includes(p))) ||
            "",
          salaryValue: staff.salaryValue ?? "",
        }
      : EMPTY_FORM,
  );
  const [disabled, setDisabled] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  const centerOptions = (centers || []).map((c) => ({
    value: c._id,
    label: c.name,
  }));

  // Faqat tanlangan filialga tegishli fanlar — GroupDialog'dagi
  // `centerSubjects` bilan bir xil naqsh.
  const centerSubjects = useMemo(
    () => (subjects || []).filter((s) => s.center === form.centerId),
    [subjects, form.centerId],
  );

  // Rol o'zgarganda ruxsat ro'yxati ham, formadagi tanlov ham darhol
  // doiraga moslashadi — aks holda resepshin uchun belgilangan "to'lov olish"
  // o'qituvchiga o'tib ketardi (backend baribir tashlab yuborardi, lekin
  // foydalanuvchi buni ko'rmasdi).
  const isTeachingRole = TEACHING_ROLES.includes(form.role);
  // Yordamchi o'qituvchi HECH QACHON guruh yarata OLMAYDI va guruh holatini
  // (activate/finish/jadval) o'zgartira OLMAYDI (faqat O'qituvchiga xos
  // imkoniyat) — shu sabab checkboxlar unga umuman ko'rsatilmaydi (backend
  // ham `group.routes.js`da qat'iy bloklaydi).
  const allowedForRole =
    form.role === "assistant"
      ? TEACHING_ALLOWED_PERMISSIONS.filter((p) => p !== "group:create" && p !== "group:update")
      : TEACHING_ALLOWED_PERMISSIONS;
  const permissionGroups = isTeachingRole
    ? PERMISSION_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((i) => allowedForRole.includes(i.key)),
      })).filter((group) => group.items.length)
    : PERMISSION_GROUPS;

  const changeRole = (role) => {
    const allowed =
      role === "assistant"
        ? TEACHING_ALLOWED_PERMISSIONS.filter((p) => p !== "group:create" && p !== "group:update")
        : TEACHING_ALLOWED_PERMISSIONS;
    setForm((prev) => ({
      ...prev,
      role,
      unlimited: TEACHING_ROLES.includes(role) ? false : prev.unlimited,
      permissions: TEACHING_ROLES.includes(role)
        ? prev.permissions.filter((p) => allowed.includes(p))
        : prev.permissions,
      // Resepshinda fan tanlovi ma'nosiz — rol o'zgarganda tozalanadi.
      subjects: TEACHING_ROLES.includes(role) ? prev.subjects : [],
    }));
  };

  const togglePermission = (perm) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const toggleSubject = (id) => {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(id)
        ? prev.subjects.filter((s) => s !== id)
        : [...prev.subjects, id],
    }));
  };

  const needsSalaryValue =
    form.salaryType === "staff.salary.percentage" ||
    form.salaryType === "staff.salary.fixed";

  const submit = async () => {
    try {
      if (
        !form.name.trim() ||
        !form.login.trim() ||
        !form.centerId ||
        (!isEdit && !form.password.trim())
      )
        throw new Error("staff.fillTheRows");

      if (needsSalaryValue && isTariffAllowed(form.salaryType)) {
        const val = Number(form.salaryValue);
        if (form.salaryValue === "" || Number.isNaN(val) || val < 0) {
          throw new Error("staff.fillTheRows");
        }
        if (form.salaryType === "staff.salary.percentage" && val > 100) {
          throw new Error("staff.invalidSalaryValue");
        }
      }
      setDisabled(true);

      // Barcha rollarga (Menejer/Resepshin/O'qituvchi) tegishli — Tariff
      // "staff.salary.*" flag'lari orqali cheklanadi, rol emas.
      const salaryPermissions =
        form.salaryType && isTariffAllowed(form.salaryType)
          ? [form.salaryType]
          : [];
      // `group:create`/`group:update` berilgan bo'lsa, guruh yaratish/tahrirlash
      // formasida fan tanlash SHART (subjectId majburiy) — shu sabab
      // `subject:view` ham avtomatik qo'shiladi, aks holda admin buni alohida
      // eslamasa fan ro'yxati bo'sh kelib, tugma ishlamay qoladi.
      const impliedPermissions =
        !form.unlimited &&
        (form.permissions.includes("group:create") || form.permissions.includes("group:update"))
          ? ["subject:view"]
          : [];
      let permissions = form.unlimited
        ? ["all", ...salaryPermissions]
        : [...new Set([...form.permissions, ...salaryPermissions, ...impliedPermissions])];
      // Yakuniy kafolat — Yordamchi o'qituvchida `group:create`/`group:update`
      // hech qachon qolmasin (checkboxlar allaqachon yashirin, bu shunchaki
      // ikkinchi to'siq).
      if (form.role === "assistant") {
        permissions = permissions.filter((p) => p !== "group:create" && p !== "group:update");
      }

      const body = {
        centerId: form.centerId,
        name: form.name.trim(),
        login: form.login.trim(),
        role: form.role,
        permissions,
        subjects: isTeachingRole ? form.subjects : [],
        salaryValue:
          needsSalaryValue && isTariffAllowed(form.salaryType)
            ? Number(form.salaryValue)
            : null,
      };
      if (form.password.trim()) body.password = form.password.trim();

      const res = isEdit
        ? await api.patch(`/staffs/${staff._id}`, body)
        : await api.post("/staffs", body);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);

      successMsg(msg);
      onSaved?.(data);

      if (!isEdit && data?.plainPassword) {
        downloadStaffCredentialsPdf({
          name: data.name,
          login: data.login,
          password: data.plainPassword,
        });
        setCredentials({ login: data.login, password: data.plainPassword });
      } else {
        onClose();
      }
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDisabled(false);
    }
  };

  const copyCredentials = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(
        `${t("staff.login")}: ${credentials.login}\n${t("staff.password")}: ${credentials.password}`,
      );
      setCopied(true);
      successMsg("staff.copied");
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      errorMsg(error.message);
    }
  };

  if (credentials) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={t("staff.credentialsTitle")}
        actions={
          <Button onClick={onClose}>{t("common.close")}</Button>
        }
      >
        <div className="flex flex-col gap-3 w-full">
          <div className="flex flex-col gap-1 p-3 rounded-xl bg-slate-100">
            <span className="text-xs text-slate-500">{t("staff.login")}</span>
            <span className="font-semibold text-slate-800">
              {credentials.login}
            </span>
          </div>
          <div className="flex flex-col gap-1 p-3 rounded-xl bg-slate-100">
            <span className="text-xs text-slate-500">
              {t("staff.password")}
            </span>
            <span className="font-semibold text-slate-800">
              {credentials.password}
            </span>
          </div>
          <Button variant="outlined" onClick={copyCredentials}>
            {copied ? t("staff.copied") : t("common.copy")}
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(isEdit ? "staff.edit" : "staff.create")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={disabled} onClick={submit}>
            {t(isEdit ? "common.update" : "common.create")}
          </Button>
        </>
      }
    >
      <div
        onKeyDown={(k) => k.key === "Enter" && submit()}
        className="flex flex-col gap-3 w-full"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={t("staff.name")}
            placeholder={t("staff.name")}
            required
            icon={<HiUser />}
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label={t("staff.login")}
            placeholder={t("staff.login")}
            required
            icon={<HiIdentification />}
            value={form.login}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, login: e.target.value }))
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Input
              label={t("staff.password")}
              placeholder={isEdit ? t("staff.passwordHint") : t("staff.password")}
              required={!isEdit}
              type="password"
              icon={<HiKey />}
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
            />
            {isEdit && (
              <p className="pl-2 text-xs text-slate-400">
                {t("staff.passwordHint")}
              </p>
            )}
          </div>
          <Select
            label={t("staff.center")}
            required
            placeholder={t("staff.center")}
            options={centerOptions}
            value={form.centerId}
            onChange={(v) => setForm((prev) => ({ ...prev, centerId: v }))}
          />
        </div>

        <Select
          label={t("staff.role")}
          required
          placeholder={t("staff.role")}
          options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
          value={form.role}
          onChange={changeRole}
        />

        {isTeachingRole && (
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <span className="pl-2 text-sm text-slate-800 flex items-center gap-1.5">
              <HiBookOpen className="text-base" />
              {t("staff.subjects")}
            </span>
            {!form.centerId ? (
              <p className="pl-2 text-xs text-slate-400">{t("staff.selectCenterFirst")}</p>
            ) : centerSubjects.length === 0 ? (
              <p className="pl-2 text-xs text-slate-400">{t("staff.noSubjectsInCenter")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2">
                {centerSubjects.map((s) => (
                  <Checkbox
                    key={s._id}
                    label={s.name}
                    checked={form.subjects.includes(s._id)}
                    onChange={() => toggleSubject(s._id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          <span className="pl-2 text-sm text-slate-800">
            {t("staff.salaryType")}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visibleSalaryTypes.length === 0 && (
              <span className="flex items-center gap-1.5 pl-2 text-xs text-slate-400 sm:col-span-2">
                <HiLockClosed className="text-sm" />
                {t("staff.salaryTypeNoneInTariff")}
              </span>
            )}
            {visibleSalaryTypes.map((perm) => {
              const inTariff = allowedTariffPermissions.includes(perm);
              const allowed = isTariffAllowed(perm);
              const selected = form.salaryType === perm;
              return (
                <div
                  key={perm}
                  onClick={() =>
                    allowed &&
                    setForm((prev) => ({ ...prev, salaryType: perm, salaryValue: "" }))
                  }
                  className={`flex items-start gap-2.5 p-3 rounded-xl border-2 duration-150 ${
                    allowed ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  } ${
                    selected
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                    <Checkbox
                      variant="circle"
                      color="blue"
                      disabled={!allowed}
                      checked={selected}
                      onChange={() =>
                        allowed &&
                        setForm((prev) => ({ ...prev, salaryType: perm }))
                      }
                    />
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-semibold text-slate-800">
                      {t(featureLabelKey(perm))}
                    </span>
                    <span className="text-xs text-slate-500 leading-snug">
                      {SALARY_DESCRIPTION_KEYS[perm] ? t(SALARY_DESCRIPTION_KEYS[perm]) : ""}
                    </span>
                    {!inTariff && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-600 pt-0.5">
                        <HiLockClosed className="text-xs" />
                        {t("staff.notInTariff")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {needsSalaryValue && isTariffAllowed(form.salaryType) && (
            <Input
              label={
                form.salaryType === "staff.salary.percentage"
                  ? t("staff.salaryPercentLabel")
                  : t("staff.salaryAmountLabel")
              }
              placeholder={
                form.salaryType === "staff.salary.percentage" ? "0-100" : "0"
              }
              type="number"
              required
              icon={<HiBanknotes />}
              value={form.salaryValue}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, salaryValue: e.target.value }))
              }
            />
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          <span className="pl-2 text-sm text-slate-800">
            {t("staff.permissions")}
          </span>
          {isTeachingRole ? (
            <p className="pl-2 text-xs text-slate-400 leading-snug">
              {t("staff.teachingScopeHint")}
            </p>
          ) : (
            <Switch
              label={t("staff.unlimitedAccess")}
              color="emerald"
              checked={form.unlimited}
              onChange={(v) => setForm((prev) => ({ ...prev, unlimited: v }))}
            />
          )}
          <div className="flex flex-col gap-3">
            {permissionGroups.map((group) => (
              <div key={group.titleKey} className="flex flex-col gap-1.5">
                <span className="pl-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t(group.titleKey)}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2">
                  {group.items.map((item) => (
                    <Checkbox
                      key={item.key}
                      label={t(item.labelKey)}
                      disabled={form.unlimited}
                      checked={form.unlimited || form.permissions.includes(item.key)}
                      onChange={() => togglePermission(item.key)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export default StaffDialog;
