import { request } from "./http";

export const authTelegram = (initData) => request("post", "/parent-auth/telegram", { initData });

export const getMe = () => request("get", "/parent/me");
export const getChildren = () => request("get", "/parent/children");
export const getAttendance = (entryId, month) =>
  request("get", `/parent/entries/${entryId}/attendance`, null, { month });
export const getGrades = (entryId, month) =>
  request("get", `/parent/entries/${entryId}/grades`, null, { month });
export const getEntryPayments = (entryId) => request("get", `/parent/entries/${entryId}/payments`);
export const getPayments = () => request("get", "/parent/payments");
export const getNotifications = (page = 1, type) =>
  request("get", "/parent/notifications", null, { page, type: type || undefined });
export const readAllNotifications = () => request("patch", "/parent/notifications/read-all");
export const patchSettings = (body) => request("patch", "/parent/settings", body);
export const unlink = () => request("post", "/parent/unlink");
// O'quvchi roli (docs/API_CONTRACT_student_role_homework.md §3)
export const setRole = (role) => request("patch", "/parent/role", { role });
export const getRank = (entryId) => request("get", `/parent/entries/${entryId}/rank`);
export const getHomework = (entryId, month) =>
  request("get", `/parent/entries/${entryId}/homework`, null, { month });
// Yutuq nishonlari (docs/API_CONTRACT_badges_monthly_rank.md §C)
export const getBadges = (entryId) => request("get", `/parent/entries/${entryId}/badges`);
// Dars rejasi — o'tilgan/bugungi/keyingi mavzular (docs/API_CONTRACT_parent_lesson_plan.md)
export const getLessonPlan = (entryId) => request("get", `/parent/entries/${entryId}/lesson-plan`);
// QR davomat kartasi (docs/API_CONTRACT_parent_qr_card.md §1)
export const getQrCard = (entryId) => request("get", `/parent/entries/${entryId}/qr-card`);
export const sendQrCard = (entryId, blob) => {
  const fd = new FormData();
  fd.append("card", new File([blob], `qr-${entryId}.png`, { type: "image/png" }));
  return request("post", `/parent/entries/${entryId}/qr-card/send`, fd);
};

// WECOIN va filial do'koni (docs/API_CONTRACT_wecoin.md §4). `/parent/coins`
// tab bar, bosh sahifa va WECOIN sahifasida birga ishlatiladi — qisqa kesh
// (xarid/like'dan keyin `fresh` bilan yangilanadi).
let coinsCache = null;
export const getCoins = (fresh = false) => {
  if (!fresh && coinsCache && Date.now() - coinsCache.at < 30000) return coinsCache.promise;
  const promise = request("get", "/parent/coins").catch((e) => {
    coinsCache = null;
    throw e;
  });
  coinsCache = { at: Date.now(), promise };
  return promise;
};
export const invalidateCoins = () => {
  coinsCache = null;
};
export const getCoinShop = (studentId, centerId) => request("get", `/parent/coins/${studentId}/${centerId}/shop`);
export const buyProduct = (studentId, centerId, productId) =>
  request("post", `/parent/coins/${studentId}/${centerId}/shop/${productId}/buy`);
export const likeProduct = (studentId, centerId, productId) =>
  request("post", `/parent/coins/${studentId}/${centerId}/shop/${productId}/like`);
export const getCoinHistory = (studentId, centerId) => request("get", `/parent/coins/${studentId}/${centerId}/history`);

// Test (Quiz) — docs/API_CONTRACT_quiz.md "Endpoints — Parent/Student WebApp".
// `entryId` — Student.groups[] a'zolik context (parentAuth shu orqali tenant
// izolyatsiyasini qo'llaydi).
export const getQuizState = (entryId, quizId) => request("get", `/parent-quiz/${entryId}/${quizId}/state`);
export const startQuiz = (entryId, quizId) => request("post", `/parent-quiz/${entryId}/${quizId}/start`);
export const answerQuiz = (entryId, quizId, questionId, optionId) =>
  request("put", `/parent-quiz/${entryId}/${quizId}/answer`, { questionId, optionId });
export const finishQuiz = (entryId, quizId) => request("post", `/parent-quiz/${entryId}/${quizId}/finish`);
export const getQuizResult = (entryId, quizId) => request("get", `/parent-quiz/${entryId}/${quizId}/result`);
// Rol almashganda yo'qolib qolmasligi uchun — tugallanmagan urinishlar
// ro'yxati (docs/API_CONTRACT_profile_test_and_student_notify.md §1).
export const getActiveQuizzes = () => request("get", "/parent-quiz/active");
export const getQuizHistory = () => request("get", "/parent-quiz/history");
