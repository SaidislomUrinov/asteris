import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { HiCheckBadge, HiXCircle } from "react-icons/hi2";
import Loading from "../../ui/Loading";
import { api } from "../../utils/fetching";

/**
 * Ochiq (login talab qilmaydigan) sahifa — sertifikatdagi QR shu yerga
 * ishora qiladi. `App.jsx`da autentifikatsiya tekshiruvidan OLDIN
 * render qilinadi (bypass), chunki foydalanuvchi login qilmagan bo'lishi
 * mumkin (`/api/certificate-verify/:code` ham auth talab qilmaydi).
 */
function CertificateVerify() {
  const { t } = useTranslation();
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/certificate-verify/${code}`);
        const { ok, data } = res.data;
        if (!ok) throw new Error();
        setData(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-slate-50 p-4">
      <div className="flex flex-col items-center gap-5 w-full max-w-md p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <p className="text-lg font-space font-bold text-slate-900">
          <span className="text-blue-500">WE</span>NET
        </p>

        {loading ? (
          <Loading height="20vh" />
        ) : notFound ? (
          <>
            <HiXCircle className="text-5xl text-red-400" />
            <p className="text-base font-semibold text-slate-700">{t("certificate.verifyInvalid")}</p>
          </>
        ) : (
          <>
            <HiCheckBadge className="text-5xl text-emerald-500" />
            <p className="text-base font-semibold text-emerald-600">{t("certificate.verifyValid")}</p>

            <div className="flex flex-col gap-3 w-full pt-2">
              {[
                { label: t("certificate.verifyStudent"), value: data.studentName },
                { label: t("certificate.verifySubject"), value: data.subjectName },
                { label: t("certificate.verifyCenter"), value: data.centerName },
                { label: t("certificate.verifyDate"), value: data.date },
              ]
                .filter((row) => row.value)
                .map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-sm text-slate-400">{row.label}</span>
                    <span className="text-sm font-semibold text-slate-800 text-right">{row.value}</span>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CertificateVerify;
