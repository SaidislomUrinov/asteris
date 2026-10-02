import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  HiMagnifyingGlass,
  HiUser,
  HiPlus,
  HiPencilSquare,
  HiTrash,
  HiArrowDownTray,
  HiAdjustmentsHorizontal,
} from "react-icons/hi2";
import Input from "../../ui/Input";
import Select from "../../ui/Select";
import Textarea from "../../ui/Textarea";
import Checkbox from "../../ui/Checkbox";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import SearchSelect from "../../ui/SearchSelect";
import TimeInput from "../../ui/TimeInput";
import Dialog from "../../ui/Dialog";
import FilterBar from "../../ui/FilterBar";
import BadgeIcon from "../../ui/BadgeIcon";
import Navbar from "../../components/Navbar";
import Top from "../../components/Top";
import { updateUser } from "../../contexts/user";
import { BADGE_TYPES } from "../../utils/badges";

/**
 * UI Lab — form komponentlarining barcha holatlarini bitta sahifada ko'rish
 * uchun ishlab chiqish vositasi. Faqat DEV rejimida (`import.meta.env.DEV`)
 * ulanadi, shuning uchun prod bundlega tushmaydi va login ham talab qilmaydi.
 */

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {title}
      </h2>
      <div className="flex flex-col gap-4 p-5 rounded-2xl bg-white border border-slate-200">
        {children}
      </div>
    </section>
  );
}

// Navbar faqat tizimga kirgan foydalanuvchida render bo'ladi (permission va
// tarif flaglariga tayanadi). Lab DEV-only bo'lgani uchun store'ga soxta
// "boshliq" yozamiz — shunda barcha menyu bo'limlari ko'rinadi va panelni
// login qilmasdan ham ko'z bilan tekshirsa bo'ladi.
const MOCK_OWNER = {
  _id: "ui-lab",
  authType: "owner",
  name: "UI Lab",
  permissions: ["all"],
  subscription: {
    tariffSnapshot: {
      allowedPermissions: ["room.control", "finance.expense", "certificate.manage", "teacher.performance"],
    },
  },
};

const GROUPS = [
  { value: "a1", label: "Ingliz tili — A1" },
  { value: "m7", label: "Matematika — 7-sinf" },
  { value: "it", label: "IT boshlang'ich" },
];

function UiLab() {
  const [text, setText] = useState("Aliyev Sardor");
  const [group, setGroup] = useState("a1");
  const [note, setNote] = useState(
    "O'quvchi dekabr oyidan boshlab dars qoldirmoqda, ota-onasi bilan bog'lanildi.",
  );
  const [sms, setSms] = useState(true);
  const [archive, setArchive] = useState(false);
  const [all, setAll] = useState(true);
  const [debt, setDebt] = useState(false);
  const [time, setTime] = useState("09:30");
  const [open, setOpen] = useState(false);
  const [fbGroup, setFbGroup] = useState("a1");
  const [fbStatus, setFbStatus] = useState("");

  const dp = useDispatch();
  const navReady = useSelector((e) => e.user._id) === "ui-lab";
  const [showNav, setShowNav] = useState(false);

  // Navbar + Top yoqilganda lab ilovaning HAQIQIY qobig'ini takrorlaydi
  // (App.jsx dagi kabi: fixed sidebar + `lg:ml-62.5` kontent ustuni, uning
  // tepasida Top). Faqat shunda sidebar va Top chegarasining tutashuvini
  // ko'z bilan tekshirib bo'ladi.
  return (
    <div className={showNav ? "flex items-start justify-start w-full" : ""}>
      {/* Aktiv bo'limni ko'rish uchun lab'ni haqiqiy manzilda oching:
          `/groups?uilab=1` — Navbar `useLocation()` dan "/groups" ni o'qiydi
          va "Guruhlar" yonib turadi. */}
      {showNav && navReady && <Navbar />}
      <div className={`flex flex-col w-full min-h-screen ${showNav ? "lg:ml-62.5" : ""}`}>
        {showNav && navReady && <Top />}
        <div className="w-full flex-1 bg-[#f5f8fd] p-6 lg:p-10">
      <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        <header className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-600">
            <span className="size-1.5 rounded-full bg-blue-500" />
            UI Lab
          </span>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-slate-900">
            Form komponentlari
          </h1>
          <p className="text-sm text-slate-500">
            Yo'nalish A — yumshoq. Barcha holatlar haqiqiy komponentlardan
            render qilinadi.
          </p>
        </header>

        <Section title="Navbar">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => {
                dp(updateUser(MOCK_OWNER));
                setShowNav(true);
              }}
              disabled={showNav}
            >
              Navbar'ni ko'rsatish
            </Button>
            <span className="text-[11px] text-slate-400">
              Soxta &quot;boshliq&quot; bilan — barcha bo'limlar ko'rinadi
            </span>
          </div>
        </Section>

        <Section title="Input">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="F.I.SH"
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Input label="Telefon" prefix="+998" value="90 123 45 67" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Qidiruv"
              placeholder="Ism yoki telefon"
              icon={<HiMagnifyingGlass />}
            />
            <Input
              label="Oylik summa"
              required
              value="0"
              error
              hint="Summa 0 dan katta bo'lishi kerak"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Login"
              value="reception_01"
              disabled
              hint="Login yaratilgandan keyin o'zgarmaydi"
            />
            <Input label="Parol" type="password" value="12345678" />
          </div>
        </Section>

        <Section title="Select / SearchSelect / TimeInput">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Filial"
              value="ch"
              options={[{ value: "ch", label: "Chilonzor filiali" }]}
            />
            <Select
              label="Guruh"
              value={group}
              onChange={setGroup}
              options={GROUPS}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchSelect
              label="O'quvchi"
              placeholder="Qidiring..."
              options={[{ value: "1", label: "Aliyev Sardor" }]}
            />
            <TimeInput
              label="Dars vaqti"
              value={time}
              onChange={setTime}
              icon={<HiUser />}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="O'chirilgan" placeholder="Tanlang..." disabled options={[]} />
            <Select label="Bo'sh" placeholder="Tanlang..." options={GROUPS} />
          </div>
        </Section>

        <Section title="Textarea">
          <Textarea
            label="Izoh"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Section>

        <Section title="Checkbox">
          <div className="flex items-center gap-6 flex-wrap">
            <Checkbox label="SMS yuborilsin" checked={sms} onChange={setSms} variant="square" />
            <Checkbox label="Arxivni ko'rsatish" checked={archive} onChange={setArchive} variant="square" />
            <Checkbox label="Barchasi" checked={all} onChange={setAll} />
            <Checkbox label="Faqat qarzdorlar" checked={debt} onChange={setDebt} />
            <Checkbox label="Bloklangan" checked disabled />
          </div>
        </Section>

        <Section title="Button">
          <div className="flex items-center gap-3 flex-wrap">
            <Button>Saqlash</Button>
            <Button variant="outlined" color="slate">Bekor qilish</Button>
            <Button variant="ghost">Filtr</Button>
            <Button variant="text">Batafsil</Button>
            <Button color="red">O'chirish</Button>
            <Button disabled>Saqlash</Button>
            <Button loading>Saqlanmoqda</Button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button>
              <HiPlus className="text-base" />
              O'quvchi qo'shish
            </Button>
            <Button variant="outlined" color="emerald">
              <HiArrowDownTray className="text-base" />
              Excel yuklash
            </Button>
            <Button variant="ghost" color="slate">
              <HiAdjustmentsHorizontal className="text-base" />
              Filtrlar
            </Button>
          </div>
        </Section>

        <Section title="IconButton">
          <div className="flex items-center gap-3 flex-wrap">
            <IconButton><HiPlus /></IconButton>
            <IconButton variant="outlined" color="slate"><HiPencilSquare /></IconButton>
            <IconButton variant="ghost"><HiAdjustmentsHorizontal /></IconButton>
            <IconButton variant="ghost" color="red"><HiTrash /></IconButton>
            <IconButton variant="text" color="slate"><HiMagnifyingGlass /></IconButton>
            <IconButton loading />
            <IconButton disabled><HiPlus /></IconButton>
          </div>
        </Section>

        <Section title="Filtr qatori (haqiqiy holat)">
          <div className="flex items-end gap-3 flex-wrap">
            {/* Filtr qatori konvensiyasi: maydonlar `flex-1` (o'rab turgan
                div'da — `className` Input ichidagi <input>ga tushadi),
                amallar esa `ml-auto` bilan o'ngga suriladi. */}
            <div className="flex-1 min-w-50">
              <Input placeholder="Qidiruv" icon={<HiMagnifyingGlass />} />
            </div>
            <div className="w-45">
              <Select placeholder="Guruh" options={GROUPS} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outlined" color="emerald">
                <HiArrowDownTray className="text-base" />
                Excel
              </Button>
              <Button>
                <HiPlus className="text-base" />
                Qo'shish
              </Button>
            </div>
          </div>
        </Section>

        <Section title="FilterBar (yon panel)">
          <FilterBar
            activeCount={(fbGroup ? 1 : 0) + (fbStatus ? 1 : 0)}
            onReset={() => {
              setFbGroup("");
              setFbStatus("");
            }}
            search={<Input placeholder="Qidiruv" icon={<HiMagnifyingGlass />} variant="filter" />}
            actions={
              <>
                <Button variant="outlined" color="emerald">
                  <HiArrowDownTray className="text-base" />
                  Excel
                </Button>
                <Button>
                  <HiPlus className="text-base" />
                  Qo'shish
                </Button>
              </>
            }
          >
            <Select label="Guruh" placeholder="Guruh" variant="filter" options={GROUPS} value={fbGroup} onChange={setFbGroup} />
            <Select
              label="Holat"
              placeholder="Holat"
              variant="filter"
              options={[
                { value: "active", label: "Faol" },
                { value: "paused", label: "To'xtatilgan" },
              ]}
              value={fbStatus}
              onChange={setFbStatus}
            />
          </FilterBar>
        </Section>

        <Section title="Modal ichida">
          <div>
            <Button onClick={() => setOpen(true)}>Modalni ochish</Button>
          </div>
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            eyebrow="O'quvchi"
            title="Yangi o'quvchi qo'shish"
            description="O'quvchi ma'lumotlarini kiriting. Telefon raqam takrorlanmasligi kerak."
            actions={
              <>
                <Button variant="outlined" color="slate" onClick={() => setOpen(false)}>
                  Bekor qilish
                </Button>
                <Button onClick={() => setOpen(false)}>Saqlash</Button>
              </>
            }
          >
            <Input label="F.I.SH" required value="Aliyev Sardor" />
            <Input label="Telefon" prefix="+998" value="90 123 45 67" />
            <Select label="Guruh" value={group} onChange={setGroup} options={GROUPS} />
            <Checkbox label="SMS yuborilsin" checked={sms} onChange={setSms} variant="square" />
          </Dialog>
        </Section>

        <Section title="Yutuq nishonlari (Badge)">
          {[18, 40, 72].map((size) => (
            <div key={size} className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-slate-400">{size}px</span>
              <div className="flex flex-wrap items-end gap-4">
                {BADGE_TYPES.map((type) => (
                  <BadgeIcon key={`${type}-${size}-on`} type={type} size={size} count={size === 72 ? 3 : undefined} />
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-4">
                {BADGE_TYPES.map((type) => (
                  <BadgeIcon key={`${type}-${size}-off`} type={type} size={size} earned={false} animated={false} />
                ))}
              </div>
            </div>
          ))}
        </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UiLab;
