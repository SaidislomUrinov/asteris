// "Davomat" skaneri belgisi: yarmi QR (chapda), yarmi yuz (o'ngda), atrofida
// skaner burchaklari. Heroicons (outline, 1.5) bilan bir xil chiziq qalinligi,
// `1em` o'lcham — react-icons kabi `className="text-xl"` bilan boshqariladi.
function ScanFaceIcon({ className = "", size = "1em", ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {/* skaner burchaklari */}
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      {/* QR yarmi */}
      <rect x="7" y="7.5" width="3" height="3" rx="0.6" />
      <rect x="7" y="13.5" width="3" height="3" rx="0.6" />
      <path d="M11.5 12h.01" />
      {/* yuz yarmi */}
      <path d="M14.5 9.5v.5M17.5 9.5v.5M13.8 14.2c.9 1.2 3 1.2 3.9 0" />
    </svg>
  );
}

export default ScanFaceIcon;
