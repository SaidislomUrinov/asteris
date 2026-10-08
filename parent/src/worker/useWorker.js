import { useContext } from "react";
import { WorkerCtx } from "./workerContext";

// me + helperlar: can(perm), hasFeature(key), readOnly, role, tick (jonli
// yangilanish hisoblagichi), openSheet(), unread...
export const useWorker = () => useContext(WorkerCtx);
