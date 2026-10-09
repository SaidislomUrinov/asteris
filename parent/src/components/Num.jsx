// Matn ichidagi raqam qismini JetBrains Mono'da ko'rsatadi, qolgani SN Pro.
// text — tayyor matn ("Qarz 450 000 so'm"), v — shu matn ichidagi raqam ("450 000").
export const Num = ({ text, v }) => {
  const s = String(text ?? "");
  const n = String(v ?? "");
  const i = n ? s.indexOf(n) : -1;
  if (i < 0) return s;
  return (
    <>
      {s.slice(0, i)}
      <span className="tabular">{n}</span>
      {s.slice(i + n.length)}
    </>
  );
};
