import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import Dialog from "../ui/Dialog";
import Button from "../ui/Button";
import { resetUser } from "../contexts/user";
import { api, getAuthType } from "../utils/fetching";
import socket from "../socket";

// Login turiga (Client Owner/Staff) mos signout endpointi chaqiriladi.
const SIGNOUT_ENDPOINT = {
  owner: "/client-auth/signout",
  staff: "/staff-auth/signout",
};

export default function Logout() {
  const { t } = useTranslation();
  const hashtag = useLocation().hash;
  const open = hashtag === "#logout";
  const nv = useNavigate();
  const dp = useDispatch();

  const close = () => nv("#");

  const submit = async () => {
    try {
      const endpoint = SIGNOUT_ENDPOINT[getAuthType()];
      if (endpoint) await api.post(endpoint);
    } catch {
      // serverga yetmasa ham lokal sessiya tozalanadi
    }
    socket.disconnect();
    localStorage.removeItem("access");
    localStorage.removeItem("authType");
    dp(resetUser());
    nv("/");
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("logout.title")}
      actions={
        <>
          <Button color="black" variant="text" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button color="red" onClick={submit}>
            {t("logout.btn")}
          </Button>
        </>
      }
    >
      <p>{t("logout.confirm")}</p>
    </Dialog>
  );
}
