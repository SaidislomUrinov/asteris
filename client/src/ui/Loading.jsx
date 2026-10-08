import { CgSpinner } from "react-icons/cg";

function Loading({ height = "10vh" }) {
  return (
    <div className="flex items-center justify-center w-full" style={{ height }}>
      <CgSpinner className="text-[24px] animate-spin text-black dark:text-slate-100" />
    </div>
  );
}

export default Loading;
