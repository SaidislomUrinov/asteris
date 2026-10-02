import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiCheckCircle,
  HiClock,
  HiExclamationTriangle,
  HiHome,
  HiUserGroup,
  HiUsers,
  HiBanknotes,
} from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Input from "../../ui/Input";
import TimeInput from "../../ui/TimeInput";
import Select from "../../ui/Select";
import Button from "../../ui/Button";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { DAYS, suggestDays } from "./leadOptions";

const todayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Tanlangan lidlarni yangi (darhol aktiv) yoki mavjud guruhga qo'shish —
// API_CONTRACT_student_leads.md §2.6. `mode` sahifadagi tugmadan keladi.
function EnrollDialog({ open, onClose, mode, leads = [], subject, center, teachers = [], assistants = [], rooms = [], onDone }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    teacher: "",
    assistant: "",
    room: "",
    days: suggestDays(leads),
    startTime: "",
    endTime: "",
    startDate: todayDateString(),
    maxStudents: "",
    group: "",
    price: "",
  }));
  const [groups, setGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const centerTeachers = useMemo(
    () => teachers.filter((s) => s.center === center?._id && (!s.subjects?.length || s.subjects.includes(subject?._id))),
    [teachers, center, subject],
  );
  const centerAssistants = useMemo(
    () => assistants.filter((s) => s.center === center?._id && (!s.subjects?.length || s.subjects.includes(subject?._id))),
    [assistants, center, subject],
  );
  const centerRooms = useMemo(() => rooms.filter((r) => r.center === center?._id), [rooms, center]);

  // Mavjud guruhlar: server `search` rejimi fan nomi bo'yicha sahifalashsiz
  // qaytaradi, keyin aniq fan ID va tugamaganlari bo'yicha qisqartiriladi.
  useEffect(() => {
    if (mode !== "existing" || !subject || !center) return;
    const load = async () => {
      try {
        const res = await api.get("/groups", { params: { search: subject.name, center: center._id } });
        if (!res.data.ok) throw new Error(res.data.msg);
        setGroups((res.data.data || []).filter((g) => g.subject === subject._id && g.status !== "finished"));
      } catch (error) {
        errorMsg(error.message);
      }
    };
    load();
  }, [mode, subject, center]);

  const groupLabel = (g) => {
    const num = g.status === "pending" ? g.pendingId : g.activeId;
    const days = (g.days || []).map((d) => t(`group.dayShort.${d}`)).join("-");
    const time = g.startTime ? `${g.startTime}–${g.endTime}` : "";
    const name = g.name || `${subject?.name} - ${num}`;
    return [name, days, time, `${g.studentsCount} ${t("lead.peopleShort")}`].filter(Boolean).join(" · ");
  };

  const toggleDay = (day) =>
    set("days", form.days.includes(day) ? form.days.filter((d) => d !== day) : [...form.days, day]);

  const submit = async () => {
    try {
      const body = {
        leadIds: leads.map((l) => l._id),
        target: mode,
        price: form.price === "" ? undefined : Number(form.price),
      };
      if (mode === "new") {
        if (!form.teacher || !form.room || !form.days.length || !form.startTime || !form.endTime) {
          throw new Error("group.activationIncomplete");
        }
        body.group = {
          teacherId: form.teacher,
          assistantId: form.assistant || undefined,
          roomId: form.room,
          days: form.days,
          startTime: form.startTime,
          endTime: form.endTime,
          startDate: form.startDate,
          maxStudents: form.maxStudents === "" ? null : Number(form.maxStudents),
        };
      } else {
        if (!form.group) throw new Error("lead.chooseGroup");
        body.groupId = form.group;
      }

      setSaving(true);
      const res = await api.post("/student-leads/enroll", body);
      const { ok, data, msg, conflict } = res.data;
      if (!ok) {
        if (conflict) {
          errorMsg(msg, {
            room: conflict.room,
            day: t(`group.day.${conflict.day}`),
            start: conflict.startTime,
            end: conflict.endTime,
            label: conflict.label,
          });
          return;
        }
        throw new Error(msg);
      }
      onDone?.(data);
      if (data.failed.length) {
        setResult(data);
      } else {
        successMsg(t("lead.enrolledCount", { count: data.enrolled.length }));
        onClose(data);
      }
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Dialog
        open={open}
        onClose={() => onClose(result)}
        title={t("lead.resultTitle")}
        actions={<Button onClick={() => onClose(result)}>{t("lead.openGroup")}</Button>}
      >
        <div className="flex flex-col gap-3 w-full">
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <HiCheckCircle className="text-lg shrink-0" />
            {t("lead.enrolledCount", { count: result.enrolled.length })}
          </p>
          <div className="flex flex-col gap-1.5 rounded-xl bg-red-50 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <HiExclamationTriangle className="text-lg shrink-0" />
              {t("lead.failedCount", { count: result.failed.length })}
            </p>
            {result.failed.map((f) => (
              <p key={f.leadId} className="pl-7 text-sm text-red-600">
                {f.fullName} — {t(f.msg)}
              </p>
            ))}
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={() => onClose()}
      eyebrow={`${subject?.name || ""}${center ? ` · ${center.name}` : ""}`}
      title={mode === "new" ? t("lead.enrollNewTitle") : t("lead.enrollExistingTitle")}
      description={mode === "new" ? t("lead.enrollNewDesc") : t("lead.enrollExistingDesc")}
      actions={
        <>
          <Button color="black" variant="text" onClick={() => onClose()}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} onClick={submit}>
            {mode === "new"
              ? t("lead.createAndActivate", { count: leads.length })
              : t("lead.addToGroup", { count: leads.length })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-wrap gap-1.5">
          {leads.map((l) => (
            <span key={l._id} className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-medium text-slate-700">
              {l.fullName}
            </span>
          ))}
        </div>

        {mode === "new" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label={t("group.teacher")}
                placeholder={t("group.teacher")}
                required
                icon={<HiUsers />}
                value={form.teacher}
                onChange={(v) => set("teacher", v)}
                options={centerTeachers.map((s) => ({ value: s._id, label: s.name }))}
              />
              <Select
                label={t("group.room")}
                placeholder={t("group.room")}
                required
                icon={<HiHome />}
                value={form.room}
                onChange={(v) => set("room", v)}
                options={centerRooms.map((r) => ({ value: r._id, label: r.name }))}
              />
            </div>
            <Select
              label={t("group.assistant")}
              placeholder={t("group.assistantEmpty")}
              icon={<HiUsers />}
              value={form.assistant}
              onChange={(v) => set("assistant", v)}
              options={[
                { value: "", label: t("group.assistantEmpty") },
                ...centerAssistants.map((s) => ({ value: s._id, label: s.name })),
              ]}
            />
            <div className="flex flex-col gap-1.5">
              <span className="pl-2 text-sm text-slate-800">
                {t("group.days")} <span className="text-red-500">*</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day) => {
                  const selected = form.days.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold duration-150 cursor-pointer border ${
                        selected
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "bg-white border-slate-200 text-slate-500 hover:border-blue-300"
                      }`}
                    >
                      {t(`group.dayShort.${day}`)}
                    </button>
                  );
                })}
              </div>
              {suggestDays(leads).length > 0 && (
                <span className="pl-2 text-xs text-slate-400">{t("lead.daysSuggested")}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TimeInput
                label={t("group.startTime")}
                icon={<HiClock />}
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
              />
              <TimeInput
                label={t("group.endTime")}
                icon={<HiClock />}
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="date"
                label={t("lead.startDate")}
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
              <Input
                type="number"
                label={t("group.maxStudents")}
                placeholder={t("group.maxStudents")}
                icon={<HiUserGroup />}
                value={form.maxStudents}
                onChange={(e) => set("maxStudents", e.target.value)}
              />
            </div>
          </>
        ) : (
          <Select
            label={t("lead.group")}
            placeholder={groups.length ? t("lead.chooseGroup") : t("lead.noGroupsForSubject")}
            required
            disabled={!groups.length}
            icon={<HiUserGroup />}
            value={form.group}
            onChange={(v) => set("group", v)}
            options={groups.map((g) => ({ value: g._id, label: groupLabel(g) }))}
          />
        )}

        <Input
          type="number"
          label={t("lead.price")}
          placeholder={subject?.price != null ? String(subject.price) : ""}
          icon={<HiBanknotes />}
          value={form.price}
          onChange={(e) => set("price", e.target.value)}
        />
      </div>
    </Dialog>
  );
}

export default EnrollDialog;
