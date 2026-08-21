import { toast } from "sonner";
import i18n from "./i18n";

export const successMsg = (msg = "success") => {
  return toast.success(i18n.t(msg));
};
export const errorMsg = (msg = "error", options) => {
  return toast.error(i18n.t(msg, options));
};
