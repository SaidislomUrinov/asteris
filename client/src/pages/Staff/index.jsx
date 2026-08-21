import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  HiEye,
  HiLockClosed,
  HiLockOpen,
  HiMagnifyingGlass,
  HiPencil,
  HiPlus,
  HiTrash,
  HiUsers,
} from "react-icons/hi2";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import Chip from "../../ui/Chip";
import List from "../../ui/List";
import Select from "../../ui/Select";
import FilterBar from "../../ui/FilterBar";
import DropMenu from "../../ui/DropMenu";
import StaffDialog, { ROLE_OPTIONS } from "./StaffDialog";
import ExportExcelButton from "../../ui/ExportExcelButton";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";

function Staff() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCenter, setFilterCenter] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [centers, setCenters] = useState([]);
  const centerMap = Object.fromEntries(centers.map((c) => [c._id, c.name]));
  const [subjects, setSubjects] = useState([]);

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
      const res = await api.get("/centers", { params: { page: 1 } });
      const { ok, data } = res.data;
      if (ok) setCenters(data || []);
    } catch {
      // markazlar ro'yxati faqat lookup uchun, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  const fetchSubjects = useCallback(async () => {
    try {
      // O'qituvchi/Yordamchi qo'shishda fan checkboxlari uchun — filial
      // bo'yicha filtr StaffDialog ichida (Group dialogidagi naqsh bilan bir xil).
      const res = await api.get("/subjects", { params: { page: 1 } });
      const { ok, data } = res.data;
      if (ok) setSubjects(data || []);
    } catch {
      // lookup ro'yxati, xato bo'lsa jim o'tkazamiz
    }
  }, []);

  useEffect(() => {
    fetchSubjects();
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
          className="font-semibold text-slate-800 hover:text-blue-600 cursor-pointer transition-colors"
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
      render: (row) => centerMap[row.center] || "—",
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
                iconClass: "bg-slate-50 text-slate-600",
                onClick: () => navigate(`/staff/${row._id}`),
              },
              {
                label: t("common.edit"),
                icon: HiPencil,
                iconClass: "bg-blue-50 text-blue-600",
                onClick: () => openEdit(row),
              },
              {
                label: t(row.blocked ? "staff.unblock" : "staff.block"),
                icon: row.blocked ? HiLockOpen : HiLockClosed,
                iconClass: row.blocked
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-orange-50 text-orange-600",
                disabled: blockingId === row._id,
                onClick: () => toggleBlock(row),
              },
              {
                label: t("common.delete"),
                icon: HiTrash,
                iconClass: "bg-red-50 text-red-600",
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
      <FilterBar
        cols={2}
        activeCount={[filterCenter, filterRole].filter(Boolean).length}
        onReset={() => {
          setPage(1);
          setFilterCenter("");
          setFilterRole("");
        }}
        search={
          <Input
            placeholder={t("common.search")}
            icon={<HiMagnifyingGlass />}
            variant="white"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        }
        actions={
          <Button onClick={openCreate} className="gap-1.5">
            <HiPlus className="text-base" />
            {t("staff.create")}
          </Button>
        }
      >
        <Select
          placeholder={t("staff.center")}
          variant="white"
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
        <Select
          placeholder={t("staff.role")}
          variant="white"
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
      </FilterBar>

      {error ? (
        <div className="flex flex-col items-center justify-center w-full flex-1 gap-3 text-slate-400">
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
        centers={centers}
        subjects={subjects}
        onClose={() => setDialogOpen(false)}
        onSaved={fetchStaff}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("staff.delete")}
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
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p>{t("staff.deleteConfirm", { name: deleteTarget?.name })}</p>
      </Dialog>
    </div>
  );
}

export default Staff;
