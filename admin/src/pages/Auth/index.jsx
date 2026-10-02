import { useState } from "react";
import { errorMsg, successMsg } from "../../utils/alert";
import { api } from "../../utils/fetching";
import { useDispatch } from "react-redux";
import { updateUser } from "../../contexts/user";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import UpdateLang from "../../components/UpdateLang";
import Input from "../../ui/Input";
import { HiAtSymbol, HiEye, HiEyeSlash } from "react-icons/hi2";
import Button from "../../ui/Button";

function Auth() {
  const [form, setForm] = useState({ username: "", password: "" });
  const [disabled, setDisabled] = useState(false);
  const dp = useDispatch();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const submit = async () => {
    try {
      if (!form.username || !form.password) throw new Error("auth.fillTheRows");
      setDisabled(true);

      const res = await api.post("/admin/signin", form);
      const { ok, data, access, refresh, msg } = res.data;
      if (!ok) throw new Error(msg);
      localStorage.setItem("access", access);
      localStorage.setItem("refresh", refresh || "");
      successMsg(msg);
      setTimeout(() => {
        dp(updateUser(data));
        navigate("/dashboard");
      }, 500);
    } catch (error) {
      errorMsg(error.message);
      setDisabled(false);
    }
  };

  const [showPass, setShowPass] = useState(false);
  return (
    <div
      onKeyDown={(k) => k.key === "Enter" && submit()}
      className="flex items-center flex-col justify-center w-full h-screen"
    >
      <p className="text-[52px] font-space font-semibold">
        <span className="font-space text-emerald-500">A</span>steris
      </p>
      <div className="flex flex-col items-start bg-white border border-slate-200 rounded-xl p-2 w-[calc(100%-32px)] sm:w-130 justify-start">
        <div className="flex items-center justify-between w-full">
          <p className="font-semibold font-space text-[22px]">
            {t("auth.title")}
          </p>
          <UpdateLang />
        </div>
        <p className="text-zinc-500">{t("auth.desc")}</p>
        <div className="flex items-center justify-center flex-col w-full gap-2 my-2">
          <Input
            label={t(`auth.username`)}
            placeholder="shoxrux"
            required
            icon={<HiAtSymbol />}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                username: e.target.value.trim().toLowerCase(),
              }))
            }
            value={form.username}
          />
          <Input
            label={t(`auth.password`)}
            placeholder="******"
            required
            type={showPass ? "text" : "password"}
            icon={
              !showPass ? (
                <HiEyeSlash
                  onClick={() => setShowPass((prev) => !prev)}
                  className="cursor-pointer"
                />
              ) : (
                <HiEye
                  onClick={() => setShowPass((prev) => !prev)}
                  className="cursor-pointer"
                />
              )
            }
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                password: e.target.value.trim(),
              }))
            }
            value={form.password}
          />
        </div>
        <Button fullWith loading={disabled} onClick={submit}>
          {t("common.confirm")}
        </Button>
      </div>
    </div>
  );
}

export default Auth;
