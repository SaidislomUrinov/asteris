import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlus, HiTrash } from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";

// Telegram chat ID ro'yxati (qo'shish/o'chirish) — ogohlantirish va lead
// chatlari uchun umumiy.
export default function ChatIdList({ label, hint, value, onChange }) {
  const { t } = useTranslation();
  const [newChatId, setNewChatId] = useState("");

  const addChatId = () => {
    const id = newChatId.trim();
    if (!id || value.includes(id)) return;
    onChange([...value, id]);
    setNewChatId("");
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="pl-2 text-sm text-slate-800">{label}</span>
      <span className="pl-2 text-[11px] text-slate-400 -mt-1">{hint}</span>

      <div className="flex items-end gap-2 w-full">
        <Input
          placeholder="123456789"
          value={newChatId}
          onChange={(e) => setNewChatId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addChatId();
            }
          }}
        />
        <Button color="slate" variant="ghost" onClick={addChatId}>
          <HiPlus className="text-base" />
          {t("common.add")}
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="flex items-center justify-center w-full h-16 text-slate-400 text-[12px] border border-dashed border-slate-200 rounded-xl">
          {t("systemSettings.telegram.noChatIds")}
        </div>
      ) : (
        <div className="flex flex-col gap-1 w-full">
          {value.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between gap-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            >
              <span className="text-[13px] text-slate-700 font-medium truncate">
                {id}
              </span>
              <IconButton
                color="red"
                variant="ghost"
                onClick={() => onChange(value.filter((x) => x !== id))}
              >
                <HiTrash />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
