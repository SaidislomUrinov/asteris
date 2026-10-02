import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiArchiveBox,
  HiBookOpen,
  HiDocumentDuplicate,
  HiMagnifyingGlass,
  HiPencil,
  HiPlus,
} from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import List from "../../ui/List";
import Select from "../../ui/Select";
import DropMenu from "../../ui/DropMenu";
import SubjectDialog from "./SubjectDialog";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

function Subjects() {
  const { t } = useTranslation();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCenter, setFilterCenter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  // Hodim (Staff) bitta filialga biriktirilgan — backend `/centers`ni ham
  // o'sha bitta filial bilan cheklaydi, demak tanlov qolmaydi.
  const showCenterFilter = centers.length > 1;
  const centerMap = Object.fromEntries(centers.map((c) => [c._id, c.name]));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSubjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/subjects", {
        params: { page, search, center: filterCenter },
      });
      const { ok, data, meta: m, msg } = res.data;
      if (!ok) throw new Error(msg);
      setRows(data || []);
      setMeta(m || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      setError(true);
      errorMsg(error.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCenter]);

  const fetchCenters = useCallback(async () => {
    try {
      const res = await api.get("/centers", { params: { page: 1 } });
      const { ok, data } = res.data;
      if (ok) setCenters(data || []);
    } catch {
      // markazlar ro'yxati faqat lookup uchun, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchSubjects, 0);
    return () => clearTimeout(t);
  }, [fetchSubjects]);

  useEffect(() => {
    const t = setTimeout(fetchCenters, 0);
    return () => clearTimeout(t);
  }, [fetchCenters]);

  const openCreate = () => {
    setSelected(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const openEdit = (subject) => {
    setSelected(subject);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const openDuplicate = (subject) => {
    setSelected({ ...subject, _id: undefined });
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await api.delete(`/subjects/${deleteTarget._id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setDeleteTarget(null);
      fetchSubjects();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: t("subject.name"),
      render: (row) => (
        <span className="font-semibold text-slate-800">{row.name}</span>
      ),
    },
    {
      key: "price",
      header: t("subject.price"),
      render: (row) =>
        `${Number(row.price || 0).toLocaleString("uz-UZ")} ${t("subscription.somSuffix")}`,
    },
    {
      key: "durationMonths",
      header: t("subject.durationMonths"),
      render: (row) => t("subject.months", { count: row.durationMonths }),
    },
    {
      key: "center",
      header: t("subject.center"),
      render: (row) => centerMap[row.center] || "—",
    },
    { key: "date", header: t("center.date") },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end">
          <DropMenu
            items={[
              {
                label: t("common.edit"),
                icon: HiPencil,
                iconClass: "bg-blue-50 text-blue-600",
                onClick: () => openEdit(row),
              },
              {
                label: t("common.copy"),
                icon: HiDocumentDuplicate,
                iconClass: "bg-slate-100 text-slate-600",
                onClick: () => openDuplicate(row),
              },
              // "O'chirish" endi ARXIVLASH — fan yo'qolmaydi, Arxiv
              // bo'limidan qaytariladi (API_CONTRACT_archive.md).
              {
                label: t("archive.archive"),
                icon: HiArchiveBox,
                iconClass: "bg-amber-50 text-amber-600",
                onClick: () => setDeleteTarget(row),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col w-full h-full gap-4">
      <div className="flex flex-col sm:flex-row gap-2.5 p-3 rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
        <div className="flex gap-2.5 sm:contents">
          <div className={`flex-1 min-w-0 ${showCenterFilter ? "sm:w-[40%]" : "sm:flex-1"}`}>
            <Input
              placeholder={t("common.search")}
              icon={<HiMagnifyingGlass />}
              variant="slate"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>

          {showCenterFilter && (
            <div className="flex-1 min-w-0 sm:w-[40%]">
              <Select
                placeholder={t("subject.center")}
                variant="slate"
                value={filterCenter}
                onChange={(v) => {
                  setPage(1);
                  setFilterCenter(v);
                }}
                options={[
                  { value: "", label: t("common.all") },
                  ...centers.map((c) => ({ value: c._id, label: c.name })),
                ]}
              />
            </div>
          )}
        </div>

        <Button onClick={openCreate} className="gap-1.5 w-full sm:w-auto">
          <HiPlus className="text-base" />
          {t("subject.create")}
        </Button>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
          <HiBookOpen className="text-4xl" />
          <p className="text-sm">{t("subject.loadError")}</p>
          <Button variant="outlined" onClick={fetchSubjects}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <List
          columns={columns}
          rows={rows}
          loading={loading}
          empty={t("subject.empty")}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
          toolbar={<ExportExcelButton endpoint="/subjects/export" params={{ search, center: filterCenter }} />}
        />
      )}

      <SubjectDialog
        key={dialogKey}
        open={dialogOpen}
        subject={selected}
        centers={centers}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchSubjects}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("archive.archiveTitle")}
        actions={
          <>
            <Button
              color="black"
              variant="text"
              onClick={() => setDeleteTarget(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={deleting} onClick={confirmDelete}>
              {t("archive.archive")}
            </Button>
          </>
        }
      >
        <p>{t("archive.archiveSubjectConfirm", { name: deleteTarget?.name })}</p>
      </Dialog>
    </div>
  );
}

export default Subjects;
