import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiTrash } from "react-icons/hi2";
import Dialog from "../../ui/Dialog";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Switch from "../../ui/Switch";
import ImageInput from "../../ui/ImageInput";
import { api } from "../../utils/fetching";
import { errorMsg, successMsg } from "../../utils/alert";
import { downscaleImage, photoSrc } from "../../utils/studentPhoto";

const digits = (v) => String(v || "").replace(/\D/g, "").slice(0, 6);

/**
 * Mahsulot qo'shish/tahrirlash. Rasm ixtiyoriy — server kvadrat (512px webp)
 * qilib saqlaydi. Qoldiq bo'sh = cheklanmagan.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.centerId
 * @param {Object|null} props.product - tahrirlanayotgan mahsulot (null — yangi)
 * @param {(product: Object) => void} props.onSaved
 */
function ProductDialog({ open, onClose, centerId, product, onSaved }) {
  const { t } = useTranslation();
  const [name, setName] = useState(product?.name || "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(
    product && product.stock !== null && product.stock !== undefined ? String(product.stock) : "",
  );
  const [isActive, setIsActive] = useState(product ? product.isActive : true);
  const [file, setFile] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  // "Rasmni olib tashlash" — ImageInput ichki preview'ini tozalash uchun qayta mount.
  const [imageKey, setImageKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length > 0 && Number(price) >= 1;

  const save = async () => {
    if (!valid || saving) return;
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("price", String(Number(price)));
      fd.append("stock", stock === "" ? "" : String(Number(stock)));
      fd.append("isActive", isActive ? "true" : "false");
      if (file) fd.append("photo", await downscaleImage(file));
      else if (product?.photo && removePhoto) fd.append("removePhoto", "1");
      const res = product
        ? await api.patch(`/shop/${centerId}/products/${product._id}`, fd)
        : await api.post(`/shop/${centerId}/products`, fd);
      const { ok, data, msg } = res.data;
      if (!ok) throw new Error(msg);
      successMsg(msg);
      onSaved(data);
      onClose();
    } catch (err) {
      errorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const shownPhoto = removePhoto ? "" : product?.photo ? photoSrc(product.photo) : "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(product ? "coins.editProduct" : "coins.addProduct")}
      widthClass="md:w-120"
      actions={
        <>
          <Button variant="ghost" color="slate" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={saving} disabled={!valid} onClick={save}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex gap-4 max-sm:flex-col">
        <div className="flex flex-col gap-2 items-start">
          <ImageInput
            key={imageKey}
            label={t("coins.photo")}
            width={132}
            height={132}
            prev={shownPhoto}
            onChange={(f) => {
              setFile(f);
              setRemovePhoto(false);
            }}
          />
          {(file || shownPhoto) && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setRemovePhoto(true);
                setImageKey((k) => k + 1);
              }}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-red-500 hover:text-red-600 cursor-pointer"
            >
              <HiTrash className="text-sm" />
              {t("coins.removePhoto")}
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <Input label={t("coins.productName")} required value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("coins.priceCoins")}
              required
              type="tel"
              value={price}
              onChange={(e) => setPrice(digits(e.target.value))}
            />
            <Input
              label={t("coins.stock")}
              type="tel"
              placeholder={t("coins.stockUnlimited")}
              value={stock}
              onChange={(e) => setStock(digits(e.target.value))}
            />
          </div>
          <Switch checked={isActive} onChange={setIsActive} color="emerald" label={t("coins.showInShop")} />
        </div>
      </div>
    </Dialog>
  );
}

export default ProductDialog;
