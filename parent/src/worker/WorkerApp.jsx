import { WorkerProvider } from "./WorkerProvider";
import { WorkerShell } from "./WorkerShell";

// Boshliq / Hodim paneli (docs/API_CONTRACT_worker_webapp.md §5).
// `initial` — POST /parent-auth/telegram javobidagi `worker` (§3.1 shakli).
export const WorkerApp = ({ initial }) => (
  <WorkerProvider initial={initial}>
    <WorkerShell />
  </WorkerProvider>
);
