import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlus, HiPencilSquare, HiTrash, HiHeart, HiPhoto, HiOutlineShoppingBag } from "react-icons/hi2";
import Button from "../../ui/Button";
import Dialog from "../../ui/Dialog";
import CoinAmount from "./CoinAmount";
import ProductDialog from "./ProductDialog";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { photoSrc } from "../../utils/studentPhoto";

/**
 * Filial do'koni mahsulotlari — kvadrat rasmli kartalar gridi.
 *
 * @param {Object} props
 * @param {string} props.centerId
 * @param {boolean} props.canManage - `coin:manage`
 */
function ProductsTab({ centerId, canManage }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(null); // null | "new" | product
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await api.get(`/shop/${centerId}/products`);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      setProducts(data);
    } catch (err) {
      errorMsg(err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  // Boshqa xodim o'zgartirsa yoki xarid qoldiq/sotilganni o'zgartirsa.
  useSocketEvent("shop:products", (p) => p?.centerId === centerId && load(), !!centerId);
  useSocketEvent("shop:order", (p) => p?.order?.centerId === centerId && load(), !!centerId);

  const onSaved = (item) =>
    setProducts((prev) => (prev.some((p) => p._id === item._id) ? prev.map((p) => (p._id === item._id ? item : p)) : [item, ...prev]));

  const remove = async () => {
    try {
      setBusy(true);
      const res = await api.delete(`/shop/${centerId}/products/${deleting._id}`);
      const { ok, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      setProducts((prev) => prev.filter((p) => p._id !== deleting._id));
      setDeleting(null);
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 flex-1">
      {canManage && (
        <div className="flex items-center">
          <div className="ml-auto max-sm:w-full">
            <Button className="max-sm:w-full" onClick={() => setEditing("new")}>
              <HiPlus className="text-base" />
              {t("coins.addProduct")}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-slate-100 dark:bg-night-800 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-sm text-slate-400 dark:text-slate-500">
          {t("common.error")}
          <Button variant="outlined" color="slate" onClick={load}>
            {t("common.retry")}
          </Button>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-14 text-slate-400 dark:text-slate-500">
          <HiOutlineShoppingBag className="text-3xl text-slate-300 dark:text-slate-600" />
          <span className="text-sm">{t("coins.productsEmpty")}</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {products.map((p) => {
            const soldOut = p.stock === 0;
            return (
              <div
                key={p._id}
                className={`flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-night-900 border border-slate-200/80 dark:border-night-700/80 ${
                  p.isActive ? "" : "opacity-60"
                }`}
              >
                <div className="relative aspect-square bg-slate-100 dark:bg-night-800 grid place-items-center">
                  {p.photo ? (
                    <img src={photoSrc(p.photo)} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <HiPhoto className="text-4xl text-slate-300 dark:text-slate-600" />
                  )}
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 dark:bg-night-900/90 text-[11px] font-semibold text-rose-500 tabular-nums">
                    <HiHeart className="text-xs" />
                    {p.likes}
                  </span>
                  {(soldOut || !p.isActive) && (
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-slate-900/80 text-[11px] font-semibold text-white">
                      {t(soldOut ? "coins.soldOut" : "coins.hidden")}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 p-3">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 min-h-10">{p.name}</span>
                  <CoinAmount value={p.price} size={18} className="text-lg" />
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] tabular-nums">
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400">
                      {t("coins.soldCount", { n: p.sold })}
                    </span>
                    {p.stock !== null && (
                      <span
                        className={`px-1.5 py-0.5 rounded-md ${
                          p.stock <= 3
                            ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "bg-slate-100 dark:bg-night-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {t("coins.stockLeft", { n: p.stock })}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-lg bg-slate-50 dark:bg-night-800 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-night-700 cursor-pointer"
                      >
                        <HiPencilSquare className="text-sm" />
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        title={t("common.delete")}
                        onClick={() => setDeleting(p)}
                        className="w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/15 cursor-pointer"
                      >
                        <HiTrash className="text-sm" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ProductDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          centerId={centerId}
          product={editing === "new" ? null : editing}
          onSaved={onSaved}
        />
      )}

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t("coins.deleteProduct")}
        widthClass="md:w-110"
        actions={
          <>
            <Button variant="ghost" color="slate" onClick={() => setDeleting(null)}>
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={busy} onClick={remove}>
              {t("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">{t("coins.deleteProductText", { name: deleting?.name || "" })}</p>
      </Dialog>
    </div>
  );
}

export default ProductsTab;
