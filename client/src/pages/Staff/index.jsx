import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  HiAdjustmentsHorizontal,
  HiArchiveBox,
  HiEye,
  HiLockClosed,
  HiLockOpen,
  HiMagnifyingGlass,
  HiPencil,
  HiPlus,
  HiUsers,
  HiXMark,
} from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import DropMenu from "../../ui/DropMenu";
import StaffDialog, { ROLE_OPTIONS } from "./StaffDialog";
import ExportExcelButton from "../../ui/ExportExcelButton";
import useMediaQuery from "../../hooks/useMediaQuery";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import useQueryState from "../../hooks/useQueryState";

// Tailwind `sm` breakpoint — FilterBar bilan bir xil chegara.
const DESKTOP = "(min-width: 640px)";

function Staff() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  // Filtr/qidiruv/sahifa URL query-param'da (useQueryState) — Detail'ga kirib
  // "Orqaga" bilan qaytilganda list qayta mount bo'lsa ham joyida qoladi.
  const [page, setPage] = useQueryState("page", 1);
  const [search, setSearch] = useQueryState("search", "");
  const [filterCenter, setFilterCenter] = useQueryState("filterCenter", "");
  const [filterRole, setFilterRole] = useQueryState("filterRole", "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  // Hodim bir nechta filialda ishlashi mumkin — dialog va "Filial" ustuni uchun
  // BARCHA filiallar (ro'yxat va filtr esa faol filial bo'yicha).
  const [allCenters, setAllCenters] = useState([]);
  const centerMap = Object.fromEntries(allCenters.map((c) => [c._id, c.name]));
  const centerNamesOf = (row) =>
    (row.centers?.length ? row.centers : [row.center])
      .map((id) => centerMap[id])
      .filter(Boolean)
      .join(", ") || "—";
  const [subjects, setSubjects] = useState([]);
  // Bitta filialga biriktirilgan hodim (Staff) uchun Filial filtri ma'nosiz —
  // faqat bir nechta filial ko'rinadigan (Client Owner) hollarda chiqadi.
  const showCenterFilter = centers.length > 1;
  const activeFilterCount = [filterCenter, filterRole].filter(Boolean).length;
  const resetFilters = () => {
    setPage(1);
    setFilterCenter("");
    setFilterRole("");
  };
  const isDesktop = useMediaQuery(DESKTOP);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [blockingId, setBlockingId] = useState(null);

  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api.get("/staffs", {
        params: { page, search, center: filterCenter, role: filterRole },
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
  }, [page, search, filterCenter, filterRole]);

  const fetchCenters = useCallback(async () => {
    try {
      const [activeRes, allRes] = await Promise.all([
        api.get("/centers", { params: { page: 1 } }),
        api.get("/centers", { params: { page: 1, scope: "all" } }),
      ]);
      if (activeRes.data.ok) setCenters(activeRes.data.data || []);
      if (allRes.data.ok) setAllCenters(allRes.data.data || []);
    } catch {
      // markazlar ro'yxati faqat lookup uchun, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchStaff, 0);
    return () => clearTimeout(t);
  }, [fetchStaff]);

  useEffect(() => {
    const t = setTimeout(fetchCenters, 0);
    return () => clearTimeout(t);
  }, [fetchCenters]);

  const fetchSubjects = useCallback(async () => {
    try {
      // O'qituvchi/Yordamchi qo'shishda fan checkboxlari uchun — filial
      // bo'yicha filtr StaffDialog ichida (Group dialogidagi naqsh bilan bir xil).
      // Barcha filiallar fanlari (ko'p filialli o'qituvchi) — faol filial
      // headeri o'chiriladi, dialog tanlangan filiallar bo'yicha filtrlaydi.
      const res = await api.get("/subjects", { params: { page: 1 }, headers: { "x-center-id": "" } });
      const { ok, data } = res.data;
      if (ok) setSubjects(data || []);
    } catch {
      // lookup ro'yxati, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchSubjects, 0);
    return () => clearTimeout(t);
  }, [fetchSubjects]);

  const openCreate = () => {
    if (centers.length === 0) {
      errorMsg("staff.noCentersYet");
      return;
    }
    setSelected(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const openEdit = (staff) => {
    setSelected(staff);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  const toggleBlock = async (staff) => {
    try {
      setBlockingId(staff._id);
      const action = staff.blocked ? "unblock" : "block";
      const res = await api.patch(`/staffs/${staff._id}/${action}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      fetchStaff();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setBlockingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await api.delete(`/staffs/${deleteTarget._id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setDeleteTarget(null);
      fetchStaff();
    } catch (error) {
      errorMsg(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: t("staff.name"),
      render: (row) => (
        <span
          className="font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
          onClick={() => navigate(`/staff/${row._id}`)}
        >
          {row.name}
        </span>
      ),
    },
    { key: "login", header: t("staff.login") },
    {
      key: "center",
      header: t("staff.center"),
      render: (row) => centerNamesOf(row),
    },
    {
      key: "role",
      header: t("staff.role"),
      render: (row) => (
        <Chip value={t(`role.${row.role}`)} color="slate" variant="ghost" />
      ),
    },
    {
      key: "status",
      header: t("common.status"),
      render: (row) =>
        row.blocked ? (
          <Chip value={t("staff.statusBlocked")} color="red" />
        ) : (
          <Chip value={t("staff.active")} color="emerald" />
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end">
          <DropMenu
            items={[
              {
                label: t("common.detail"),
                icon: HiEye,
                iconClass: "bg-slate-50 dark:bg-night-800 text-slate-600 dark:text-slate-300",
                onClick: () => navigate(`/staff/${row._id}`),
              },
              {
                label: t("common.edit"),
                icon: HiPencil,
                iconClass: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400",
                onClick: () => openEdit(row),
              },
              {
                label: t(row.blocked ? "staff.unblock" : "staff.block"),
                icon: row.blocked ? HiLockOpen : HiLockClosed,
                iconClass: row.blocked
                  ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400",
                disabled: blockingId === row._id,
                onClick: () => toggleBlock(row),
              },
              // "O'chirish" endi ARXIVLASH — hodim hujjati va ish haqi
              // tarixi saqlanadi, Arxiv bo'limidan qaytariladi. `Bloklash`
              // esa alohida, mustaqil funksiya (API_CONTRACT_archive.md).
              {
                label: t("archive.archive"),
                icon: HiArchiveBox,
                iconClass: "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400",
                onClick: () => setDeleteTarget(row),
              },
            ]}
          />
        </div>
      ),
    },
  ];

  // Mobil karta — jadval tor ekranda gorizontal suriladi va lavozim/holat/⋮
  // ko'rinmay qolardi (/students bilan bir xil naqsh). Amallar menyusi
  // jadval ustunidagi bilan aynan bir xil.
  const renderActions = columns.at(-1).render;
  const renderCard = (row) => (
    <div className="flex flex-col gap-2.5 p-3.5 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 cursor-pointer" onClick={() => navigate(`/staff/${row._id}`)}>
          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{row.name}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{row.login}</p>
        </div>
        <div className="shrink-0">{renderActions(row)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip value={t(`role.${row.role}`)} color="slate" variant="ghost" />
        {row.blocked ? (
          <Chip value={t("staff.statusBlocked")} color="red" />
        ) : (
          <Chip value={t("staff.active")} color="emerald" />
        )}
      </div>
      <p className="pt-2.5 border-t border-slate-100 dark:border-night-700 text-sm text-slate-500 dark:text-slate-400 truncate">
        {centerNamesOf(row)}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col w-full h-full gap-4">
      {isDesktop ? (
        <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-sm dark:shadow-none shadow-slate-900/[0.02]">
          {/* Filtrlar bo'sh joyni to'ldiradi, amal tugmasi o'ng chekkaga
              tiraladi — avval `w-1/4` sobit bo'lgani uchun qator "Hodim
              qo'shish" da tugab, o'ngda bo'sh joy qolardi. */}
          <div className={showCenterFilter ? "flex-1 min-w-[200px]" : "flex-1"}>
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
            <div className="flex-1 min-w-[200px]">
              <Select
                placeholder={t("staff.center")}
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

          <div className="flex-1 min-w-[200px]">
            <Select
              placeholder={t("staff.role")}
              variant="slate"
              value={filterRole}
              onChange={(v) => {
                setPage(1);
                setFilterRole(v);
              }}
              options={[
                { value: "", label: t("common.all") },
                ...ROLE_OPTIONS.map((o) => ({
                  value: o.value,
                  label: t(o.label),
                })),
              ]}
            />
          </div>

          <div className="shrink-0">
            <Button
              variant="outlined"
              color="red"
              onClick={resetFilters}
              disabled={activeFilterCount === 0}
              className="gap-1.5"
            >
              <HiXMark className="text-base" />
              {t("common.resetFilters")}
            </Button>
          </div>

          <Button onClick={openCreate} className="gap-1.5 shrink-0 ml-auto">
            <HiPlus className="text-base" />
            {t("staff.create")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 shadow-sm dark:shadow-none shadow-slate-900/[0.02]">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
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

            <Button
              variant="outlined"
              color="slate"
              className="gap-1.5 shrink-0 !px-4"
              onClick={() => setFilterModalOpen(true)}
            >
              <HiAdjustmentsHorizontal className="text-base" />
              {t("common.filter")}
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-blue-500 text-white text-[11px]">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Button onClick={openCreate} className="gap-1.5 w-full">
                <HiPlus className="text-base" />
                {t("staff.create")}
              </Button>
            </div>
          </div>

          <Dialog
            open={filterModalOpen}
            onClose={() => setFilterModalOpen(false)}
            title={t("common.filter")}
            actions={
              <>
                <Button
                  variant="text"
                  color="red"
                  disabled={activeFilterCount === 0}
                  onClick={() => {
                    resetFilters();
                    setFilterModalOpen(false);
                  }}
                >
                  {t("common.resetFilters")}
                </Button>
                <Button onClick={() => setFilterModalOpen(false)}>{t("common.apply")}</Button>
              </>
            }
          >
            <div className="grid grid-cols-1 gap-3">
              {showCenterFilter && (
                <Select
                  placeholder={t("staff.center")}
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
              )}
              <Select
                placeholder={t("staff.role")}
                variant="slate"
                value={filterRole}
                onChange={(v) => {
                  setPage(1);
                  setFilterRole(v);
                }}
                options={[
                  { value: "", label: t("common.all") },
                  ...ROLE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: t(o.label),
                  })),
                ]}
              />
            </div>
          </Dialog>
        </div>
      )}

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400 dark:text-slate-500">
          <HiUsers className="text-4xl" />
          <p className="text-sm">{t("staff.loadError")}</p>
          <Button variant="outlined" onClick={fetchStaff}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <List
          columns={columns}
          rows={rows}
          loading={loading}
          view={isDesktop ? "table" : "grid"}
          renderItem={renderCard}
          gridClassName="grid grid-cols-1 gap-2 p-2"
          empty={t("staff.empty")}
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          showPagination
          toolbar={
            <ExportExcelButton
              endpoint="/staffs/export"
              params={{ search, center: filterCenter, role: filterRole }}
            />
          }
        />
      )}

      <StaffDialog
        key={dialogKey}
        open={dialogOpen}
        staff={selected}
        centers={allCenters}
        subjects={subjects}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchStaff}
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
        <p>{t("archive.archiveStaffConfirm", { name: deleteTarget?.name })}</p>
      </Dialog>
    </div>
  );
}

export default Staff;
