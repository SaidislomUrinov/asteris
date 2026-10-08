import { workerApi } from "./api";

// `GET /groups` 50 talik sahifalarda keladi (server PAGE_SIZE). Ro'yxat va
// qidiruv uchun barcha sahifalar ketma-ket olinadi (chegara — 20 sahifa).
const MAX_PAGES = 20;

export const loadAllGroups = async (params = {}) => {
  const first = await workerApi.groups({ ...params, page: 1 });
  const out = [...(first?.data || first || [])];
  const total = Math.min(first?.meta?.totalPages || 1, MAX_PAGES);
  for (let page = 2; page <= total; page += 1) {
    const res = await workerApi.groups({ ...params, page });
    out.push(...(res?.data || []));
  }
  return out;
};
