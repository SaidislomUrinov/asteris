import { useRef, useState, useEffect } from "react";
import { HiOutlinePhotograph } from "react-icons/hi";
import LazyImage from "./LazyImage";

function ImageInput({
  onChange = () => {},
  label = "",
  required = false,
  width = "",
  height = "",
  prev = "",
  className = "",
}) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 🔥 preview uchun
    const url = URL.createObjectURL(file);
    setPreview(url);

    // 📦 original file tashqariga
    onChange(file);

    // 🔄 same file qayta tanlash uchun
    e.target.value = "";
  };

  // 🧹 memory cleanup
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <label className="flex flex-col gap-2 cursor-pointer w-fit">
      {label && (
        <span className="text-sm text-slate-800">
          {label}
          {required && <span className="text-red-500">*</span>}
        </span>
      )}

      <div
        style={{ width, height }}
        className={`
          relative
          flex items-center justify-center
          rounded-xl
          bg-slate-100
          border border-slate-200
          overflow-hidden
          hover:bg-slate-200/60
          duration-200
          ${className}`}
      >
        {prev && !preview ? (
          <LazyImage className="w-full h-full object-cover" src={prev} />
        ) : preview ? (
          <img
            src={preview}
            alt="preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <HiOutlinePhotograph className="text-3xl text-slate-500" />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </label>
  );
}

export default ImageInput;
