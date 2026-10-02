import { api } from "../utils/fetching";

// Admin tomon — docs/API_CONTRACT_news.md §2.

export const fetchNewsList = (params = {}) => api.get("/admin/news", { params });

export const fetchNewsItem = (id) => api.get(`/admin/news/${id}`);

export const createNews = (body) => api.post("/admin/news", body);

export const updateNews = (id, body) => api.patch(`/admin/news/${id}`, body);

export const publishNews = (id) => api.post(`/admin/news/${id}/publish`);

export const deleteNews = (id) => api.delete(`/admin/news/${id}`);

// multipart `file` — rasm ≤ 10 MB, video ≤ 100 MB. `onProgress(0..100)`.
export const uploadNewsMedia = (file, onProgress = () => {}) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/admin/news/media", fd, {
    onUploadProgress: (e) => {
      if (!e.total) return;
      onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
};
