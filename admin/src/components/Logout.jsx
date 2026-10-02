import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import Dialog from "../ui/Dialog";
import Button from "../ui/Button";
import { resetUser } from "../contexts/user";
import { api } from "../utils/fetching";
import socket from "../socket";

export default function Logout() {
  const { t } = useTranslation();
  const hashtag = useLocation().hash;
  const open = hashtag === "#logout";
  const nv = useNavigate();
  const dp = useDispatch();

  const close = () => nv("#");

  const submit = async () => {
    try {
      await api.post("/admin/signout");
    } catch {
      // serverga yetmasa ham lokal sessiya tozalanadi
    }
    socket.disconnect();
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
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
