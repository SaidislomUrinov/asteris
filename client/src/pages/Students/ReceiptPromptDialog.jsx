import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheckCircle, HiOutlineDocumentArrowDown } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import { downloadPaymentReceiptPdf } from "./receiptPdf.util";
import { errorMsg } from "../../utils/alert";

// To'lov saqlangach ochiladigan tasdiqlash — "Chek yuklansinmi?".
// "Yuklash" bosilsa PDF chek generatsiya qilinadi (QR kod uchun async),
// "Yo'q" bosilsa shunchaki yopiladi.
function ReceiptPromptDialog({ open, onClose, receipt }) {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!receipt) return onClose();
    try {
      setDownloading(true);
      await downloadPaymentReceiptPdf(receipt, t);
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("student.paymentDoneTitle")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose}>
            {t("common.no")}
          </Button>
          <Button color="blue" className="gap-1.5" loading={downloading} onClick={download}>
            <HiOutlineDocumentArrowDown className="text-base" />
            {t("student.downloadReceipt")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <HiCheckCircle className="text-4xl text-emerald-500" />
        <p className="text-slate-600 dark:text-slate-300">{t("student.receiptPrompt")}</p>
      </div>
    </Dialog>
  );
}

export default ReceiptPromptDialog;
