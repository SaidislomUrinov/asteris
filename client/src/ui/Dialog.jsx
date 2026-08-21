import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HiXMark } from "react-icons/hi2";
import IconButton from "./IconButton";
import { dialogClosed, dialogOpened } from "../utils/dialogState";

function Dialog({
  children,
  open = false,
  onClose = () => {},
  title = "Dialog",
  className = "",
  actions,
  zIndex = "z-30",
}) {
  // phase: "closed" -> hech narsa render qilinmaydi, "open" -> kirish animatsiyasi,
  // "closing" -> chiqish animatsiyasi (tugagach "closed"ga o'tadi)
  const [phase, setPhase] = useState(open ? "open" : "closed");
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    setPhase(open ? "open" : "closing");
  }

  // Ochiq modallar sonini global hisoblagichda yuritamiz — apparat QR skaner
  // modal ochiq turganda tinglashni to'xtatishi kerak (utils/dialogState.js).
  useEffect(() => {
    if (!open) return;
    dialogOpened();
    return dialogClosed;
  }, [open]);

  if (phase === "closed") return null;

  const closing = phase === "closing";

  return createPortal(
    <Fragment>
      <div
        className={`fixed w-full h-full inset-0 bg-black/50 backdrop-blur-sm ${zIndex} ${
          closing ? "animate-overlay-out" : "animate-overlay-in"
        }`}
      ></div>

      <div
        className={`fixed inset-0 flex items-center justify-center ${zIndex} p-4`}
      >
        <div
          className={`bg-white rounded-xl shadow-lg w-full md:w-150 relative ${
            closing ? "animate-dialog-out" : "animate-dialog-in"
          } ${className}`}
          onClick={(e) => e.stopPropagation()}
          onAnimationEnd={() => closing && setPhase("closed")}
        >
          {/* Title & Close button */}
          <div className="flex border-b border-slate-200 pb-2 justify-between items-center p-4">
            <h3 className="text-[22px] text-slate-800 font-semibold">
              {title}
            </h3>
            <div className="flex items-center justify-center min-w-max">
              <IconButton color="black" variant="ghost" onClick={onClose}>
                <HiXMark className="text-[22px]" />
              </IconButton>
            </div>
          </div>

          <div className="flex flex-col w-full p-4 gap-2 max-h-[70vh] overflow-y-auto">
            {children}
          </div>
          {actions ? (
            <div className="flex items-center h-12.5 bg-zinc-100 rounded-b-xl justify-end w-full px-4 gap-2">
              {actions}
            </div>
          ) : (
            ""
          )}
        </div>
      </div>
    </Fragment>,
    document.body,
  );
}

export default Dialog;
