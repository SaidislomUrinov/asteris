import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HiOutlineShoppingBag } from "react-icons/hi2";
import { ProductCard } from "./ProductCard";
import { BuySuccess } from "./BuySuccess";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { EmptyState, ErrorState } from "../../components/States";
import { Skeleton } from "../../components/Skeleton";
import { buyProduct, likeProduct } from "../../api/parent";
import { haptic } from "../../lib/telegram";

// Filial do'koni. Sotib olish faqat o'quvchi rolida (`canBuy`); ota-ona
// mahsulot va narxlarni ko'radi (farzandi nimaga intilayotganini biladi).
export const ShopTab = ({ wallet, shop, canBuy, onBought }) => {
  const { t } = useTranslation();
  const sid = wallet.student._id;
  const cid = wallet.center._id;
  const { data, loading, error, reload, mutate } = shop;
  const [confirm, setConfirm] = useState(null);
  const [buying, setBuying] = useState(false);
  const [success, setSuccess] = useState(null);

  const buy = async () => {
    try {
      setBuying(true);
      const res = await buyProduct(sid, cid, confirm._id);
      haptic("success");
      setConfirm(null);
      setSuccess(res.order);
      onBought(res.balance);
      reload(true);
    } catch (e) {
      haptic("error");
      toast.error(t(e.code, { defaultValue: t("error.unknown") }));
      setConfirm(null);
      reload(true);
    } finally {
      setBuying(false);
    }
  };

  const like = async (p) => {
    haptic("light");
    // Optimistik — server javobi bilan aniqlashtiriladi.
    mutate((list) => list.map((x) => (x._id === p._id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x)));
    try {
      const res = await likeProduct(sid, cid, p._id);
      mutate((list) => list.map((x) => (x._id === p._id ? { ...x, ...res } : x)));
    } catch (e) {
      toast.error(t(e.code, { defaultValue: t("error.unknown") }));
      reload(true);
    }
  };

  if (loading)
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    );
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data?.length) return <EmptyState icon={HiOutlineShoppingBag} title={t("coins.shopEmpty")} text={t("coins.shopEmptyText")} />;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {[...data]
          .sort((a, b) => (a.stock === 0) - (b.stock === 0) || (a.price > wallet.balance) - (b.price > wallet.balance) || a.price - b.price)
          .map((p) => (
          <ProductCard
            key={p._id}
            p={p}
            balance={wallet.balance}
            canBuy={canBuy}
            onBuy={(x) => {
              haptic("medium");
              setConfirm(x);
            }}
            onLike={like}
          />
        ))}
      </div>
      <ConfirmDialog
        open={!!confirm}
        title={t("coins.confirmTitle", { name: confirm?.name || "" })}
        text={t("coins.confirmText", { price: confirm?.price || 0, left: wallet.balance - (confirm?.price || 0) })}
        confirmText={t("coins.buy")}
        cancelText={t("common.cancel")}
        loading={buying}
        onConfirm={buy}
        onClose={() => setConfirm(null)}
      />
      <BuySuccess order={success} onClose={() => setSuccess(null)} />
    </>
  );
};
