import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { HiDocumentText, HiPencil, HiPlus, HiTrash } from "react-icons/hi2";
import Button from "../../ui/Button";
import IconButton from "../../ui/IconButton";
import Dialog from "../../ui/Dialog";
import Loading from "../../ui/Loading";
import Chip from "../../ui/Chip";
import { api, API } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import useCan from "../../hooks/useCan";

/**
 * Sertifikat shablonlari ro'yxati — har filial (Center) uchun MAX 10 ta
 * (server tomonda ham qat'iy tekshiriladi, `certificateTemplate.service.js`).
 * Boshliq va Resepshin ikkalasi ham `certificate:*` ruxsati bo'lsa ko'radi.
 */
function Certificates() {
  const { t } = useTranslation();
  const can = useCan();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/certificate-templates");
      const { ok, data, limit, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
      if (limit) setLimit(limit);
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(fetchTemplates, 0);
    return () => clearTimeout(id);
  }, [fetchTemplates]);

  const openCreate = () => navigate("/certificates/template/new");
  const openEdit = (template) => navigate(`/certificates/template/${template._id}`);

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const res = await api.delete(`/certificate-templates/${deleteTarget._id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setDeleteTarget(null);
      fetchTemplates();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const atLimit = rows.length >= limit;

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Chip
            value={t("certificateTemplate.limitLabel", { count: rows.length, max: limit })}
            color={atLimit ? "orange" : "slate"}
            variant="ghost"
          />
          {can("certificate:create") && (
            <Button
              className="gap-1.5"
              disabled={atLimit}
              title={atLimit ? t("certificateTemplate.limitReached") : ""}
              onClick={openCreate}
            >
              <HiPlus className="text-base" />
              {t("certificateTemplate.create")}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Loading height="40vh" />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 flex-1 min-h-60 text-center">
          <HiDocumentText className="text-4xl text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500">{t("certificateTemplate.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {rows.map((tpl) => (
            <div
              key={tpl._id}
              className="flex flex-col gap-1.5 rounded-lg border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 overflow-hidden group"
            >
              <div className="relative w-full aspect-[1.4/1] bg-slate-100 dark:bg-night-800 overflow-hidden">
                <img
                  src={`${API}${tpl.backgroundUrl}`}
                  alt={tpl.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 group-hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-150">
                  {can("certificate:update") && (
                    <IconButton
                      color="slate"
                      className="!min-w-8 !max-w-8 !min-h-8 !max-h-8 text-sm"
                      onClick={() => openEdit(tpl)}
                    >
                      <HiPencil />
                    </IconButton>
                  )}
                  {can("certificate:delete") && (
                    <IconButton
                      color="red"
                      className="!min-w-8 !max-w-8 !min-h-8 !max-h-8 text-sm"
                      onClick={() => setDeleteTarget(tpl)}
                    >
                      <HiTrash />
                    </IconButton>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-0.5 px-2 pb-2">
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{tpl.name}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{tpl.date}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={t("certificateTemplate.edit")}
        actions={
          <>
            <Button color="black" variant="text" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t("common.cancel")}
            </Button>
            <Button color="red" onClick={confirmDelete} loading={deleting}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("certificateTemplate.deleteConfirm")}</p>
      </Dialog>
    </div>
  );
}

export default Certificates;
