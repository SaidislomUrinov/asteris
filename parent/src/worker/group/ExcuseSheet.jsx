import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/Button";
import { BottomSheet } from "../components/BottomSheet";

// "Sababli" — sabab matni (client GroupDetail excuse dialogi bilan bir xil:
// POST /attendance/:groupId/mark { status: "excused", reason }).
export const ExcuseSheet = ({ name, initial = "", busy, onSave, onClose }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState(initial);
  return (
    <BottomSheet
      open
      onClose={onClose}
      busy={busy}
      title={t("worker.group.att.excuseTitle")}
      subtitle={name}
      footer={
        <Button onClick={() => onSave(reason.trim())} loading={busy}>
          {t("worker.group.att.excuseSave")}
        </Button>
      }
    >
      <textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        rows={3}
        placeholder={t("worker.group.att.reasonPh")}
        className="rounded-2xl border border-line px-3.5 py-2.5 bg-transparent outline-none text-[15px] text-ink placeholder:text-hint/70 focus:border-accent resize-none"
      />
    </BottomSheet>
  );
};
