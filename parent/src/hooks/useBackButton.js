import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { setBackButton } from "../lib/telegram";
import { useAuth } from "../contexts/auth";

const ROOT_PATHS = ["/", "/payments", "/notifications", "/settings"];

// Telegram BackButton: tab bar sahifalarida yashirin, ichki sahifalarda
// `fallback` (yoki history) ga qaytaradi.
export const useBackButton = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isStudent } = useAuth();
  useEffect(() => {
    const isRoot = ROOT_PATHS.includes(pathname);
    setBackButton(!isRoot, () => {
      if (pathname.startsWith("/child/")) {
        const parts = pathname.split("/");
        // /child/:sid/group/:eid/tab → /child/:sid ; /child/:sid → /
        // O'quvchida /child/:sid sahifasi yo'q — guruhdan to'g'ridan-to'g'ri bosh sahifaga
        navigate(parts.length > 3 && !isStudent ? `/child/${parts[2]}` : "/", { replace: true });
      } else navigate("/", { replace: true });
    });
    return () => setBackButton(false);
  }, [pathname, navigate, isStudent]);
};
