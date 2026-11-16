import { api } from "../utils/fetching";

// Test (Quiz) moduli — docs/API_CONTRACT_quiz.md "Endpoints — Staff".
// Boshqa api/*.js fayllar bilan bir xil konvensiya: funksiyalar xom axios
// promise qaytaradi, `{ok,data,msg}` ochish chaqiruvchi tomonda.

export const getQuizzes = (groupId) => api.get(`/quiz/${groupId}`);

export const getQuiz = (groupId, quizId) => api.get(`/quiz/${groupId}/${quizId}`);

// Body: { title?, startAt /* "HH:mm" */, questions:[{text,options:[{id,text}],correctOptionId,timeLimitSec}] }
export const sendQuiz = (groupId, body) => api.post(`/quiz/${groupId}`, body);

// Excel (multipart `file`) yoki JSON `{questions:[...]}` — faqat parse qilib
// qaytaradi, saqlamaydi (frontend natijani `sendQuiz`ga startAt bilan yuboradi).
export const importQuizFile = (groupId, file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post(`/quiz/${groupId}/import`, fd);
};
export const importQuizJson = (groupId, questions) =>
  api.post(`/quiz/${groupId}/import`, { questions });

export const updateQuiz = (groupId, quizId, body) => api.put(`/quiz/${groupId}/${quizId}`, body);

export const deleteQuiz = (groupId, quizId) => api.delete(`/quiz/${groupId}/${quizId}`);

export const setAttemptScore = (groupId, quizId, studentId, score) =>
  api.put(`/quiz/${groupId}/${quizId}/attempts/${studentId}/score`, { score });

// Test shablonlari (QuizTemplate) — docs/API_CONTRACT_quiz_templates.md.
// Guruh/darsga bog'lanmagan, fanga bog'langan; o'qituvchining o'zi
// yaratadi/tahrirlaydi, keyin istalgan guruhiga yuboradi.

export const listQuizTemplates = (subjectId) =>
  api.get("/quiz-templates", { params: subjectId ? { subject: subjectId } : {} });

export const getQuizTemplate = (id) => api.get(`/quiz-templates/${id}`);

// Body: { title, subject, questions, defaultDurationMin? }
export const createQuizTemplate = (body) => api.post("/quiz-templates", body);

export const updateQuizTemplate = (id, body) => api.put(`/quiz-templates/${id}`, body);

export const deleteQuizTemplate = (id) => api.delete(`/quiz-templates/${id}`);

// Body: { groupId, startAt, durationMin } — shablondan nusxalab yangi Quiz yaratadi.
export const sendQuizTemplate = (id, body) => api.post(`/quiz-templates/${id}/send`, body);
