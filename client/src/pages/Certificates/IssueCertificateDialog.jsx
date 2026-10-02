import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Select from "../../ui/Select";
import Loading from "../../ui/Loading";
import { api, API } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { downloadCertificatePdf } from "./certificatePdf.util";

/**
 * Sertifikat berish — bitta o'quvchiga (`studentId`) yoki butun guruhga
 * (`groupId`, bulk) ishlatiladi. Shablon tanlangach server'da `Certificate`
 * hujjati(lari) yaratiladi, so'ng har biri uchun PDF client-side generatsiya
 * qilinib avtomatik yuklab beriladi (server PDF faylini saqlamaydi).
 *
 * @param {"student"|"group"} mode
 * @param {Array} [groupOptions] - `mode="student"` uchun: o'quvchining FAOL
 *   guruhlari `[{ value, label }]` — bir nechta bo'lsa qaysi guruh uchun
 *   berilayotgani so'raladi (StudentDetail.jsx tayyorlab beradi).
 */
function IssueCertificateDialog({ open, onClose, mode, studentId, groupId, groupOptions = [] }) {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [studentGroupId, setStudentGroupId] = useState("");
  const [fonts, setFonts] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [issuing, setIssuing] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const [templatesRes, fontsRes] = await Promise.all([
        api.get("/certificate-templates"),
        api.get("/fonts"),
      ]);
      const { ok, data, msg } = templatesRes.data;
      if (!ok) throw new Error(msg);
      setTemplates(data || []);
      if (data?.length === 1) setTemplateId(data[0]._id);
      if (fontsRes.data.ok) setFonts(fontsRes.data.data || []);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(fetchTemplates, 0);
    return () => clearTimeout(id);
  }, [open, fetchTemplates]);

  // Dialog qayta ochilganda oldingi tanlov qolib ketmasin — yagona
  // guruh bo'lsa avtomatik tanlanadi.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setStudentGroupId(groupOptions.length === 1 ? groupOptions[0].value : "");
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    try {
      if (!templateId) throw new Error("certificate.chooseTemplate");
      if (mode === "student" && groupOptions.length > 1 && !studentGroupId) {
        throw new Error("certificate.chooseGroup");
      }
      setIssuing(true);
      const template = templates.find((t) => t._id === templateId);

      if (mode === "student") {
        const body = { templateId };
        if (studentGroupId) body.groupId = studentGroupId;
        const res = await api.post(`/certificates/student/${studentId}`, body);
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        await downloadCertificatePdf(template, data, API, fonts);
        successMsg(msg);
      } else {
        const res = await api.post(`/certificates/group/${groupId}`, { templateId });
        const { ok, data, msg } = res.data;
        if (!ok) throw new Error(msg);
        for (const certificate of data) {
          await downloadCertificatePdf(template, certificate, API, fonts);
        }
        successMsg(t("certificate.issuedBulk", { count: data.length }));
      }
      onClose();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(mode === "group" ? "certificate.issueToGroup" : "certificate.issue")}
      actions={
        <>
          <Button color="black" variant="text" onClick={onClose} disabled={issuing}>
            {t("common.cancel")}
          </Button>
          <Button loading={issuing} disabled={!templateId} onClick={submit}>
            {t("certificate.issue")}
          </Button>
        </>
      }
    >
      {loadingTemplates ? (
        <Loading height="10vh" />
      ) : templates.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">{t("certificateTemplate.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          <Select
            label={t("certificateTemplate.title")}
            placeholder={t("certificate.chooseTemplate")}
            variant="white"
            value={templateId}
            onChange={setTemplateId}
            options={templates.map((tpl) => ({ value: tpl._id, label: tpl.name }))}
          />
          {/* Qaysi guruh uchun berilayotgani — o'quvchi bir nechta faol
              guruhda bo'lsa ko'rsatiladi, bittasi bo'lsa avtomatik tanlanadi. */}
          {mode === "student" && groupOptions.length > 1 && (
            <Select
              label={t("certificate.groupLabel")}
              placeholder={t("certificate.chooseGroup")}
              required
              variant="white"
              value={studentGroupId}
              onChange={setStudentGroupId}
              options={groupOptions}
            />
          )}
        </div>
      )}
    </Dialog>
  );
}

export default IssueCertificateDialog;
