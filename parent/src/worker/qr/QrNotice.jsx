// QR sahifasidagi bir xil uslubdagi ogohlantirish: Telegram'siz / eski versiya /
// ruxsat yo'q. `mark` — chapdagi ikonka elementi.
export const QrNotice = ({ mark, title, text }) => (
  <div className="flex items-start gap-3 rounded-2xl bg-warn-bg text-warn px-3.5 py-3">
    <span className="shrink-0 mt-px [&>svg]:w-5 [&>svg]:h-5">{mark}</span>
    <div className="min-w-0">
      <div className="text-sm font-extrabold leading-snug">{title}</div>
      {text && <div className="text-[13px] opacity-90 mt-0.5">{text}</div>}
    </div>
  </div>
);
