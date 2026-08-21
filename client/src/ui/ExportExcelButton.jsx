import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiTableCells } from "react-icons/hi2";
import Button from "./Button";
import IconButton from "./IconButton";
import { api } from "../utils/fetching";
import { errorMsg, successMsg } from "../utils/alert";

/**
 * Excel export tugmasi — sahifaning pagination joylashgan qismiga
 * qo'yiladi (List komponenti ustida), joriy filtrlarni so'rovga qo'shib
 * yuboradi. Tarifda "excel.export" mavjud bo'lmasa server xato qaytaradi,
 * shu holatda aniq tushunarli xato ko'rsatiladi.
 *
 * @param {Object} props
 * @param {string} props.endpoint - Masalan "/students/export"
 * @param {Object} [props.params] - Joriy filtrlar (search/center/... )
 * @param {"button"|"icon"} [props.variant="button"] - To'liq tugma yoki faqat icon
 */
function ExportExcelButton({ endpoint, params = {}, variant = "button", className = "" }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const download = async () => {
    try {
      setLoading(true);
      const res = await api.get(endpoint, { params, responseType: "blob" });

      // Server xato bo'lsa ham 200 bilan JSON qaytaradi ({ok:false,msg}) —
      // blob turi orqali fayl/xato farqlanadi.
      const isJsonError = res.data?.type === "application/json";
      if (isJsonError) {
        const text = await res.data.text();
        const parsed = JSON.parse(text);
        throw new Error(parsed.msg || "common.exportError");
      }

      const disposition = res.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? decodeURIComponent(match[1]) : "export.xlsx";

      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      successMsg("common.exportSuccess");
    } catch (error) {
      errorMsg(error.message || "common.exportError");
    } finally {
      setLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <IconButton
        color="emerald"
        variant="ghost"
        title={t("common.exportExcel")}
        loading={loading}
        onClick={download}
        className={className}
      >
        <HiTableCells />
      </IconButton>
    );
  }

  return (
    <Button
      color="emerald"
      variant="outlined"
      loading={loading}
      onClick={download}
      className={`gap-1.5 ${className}`}
    >
      <HiTableCells className="text-base" />
      {t("common.exportExcel")}
    </Button>
  );
}

export default ExportExcelButton;
