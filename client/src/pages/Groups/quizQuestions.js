import { errorMsg, successMsg } from "../../utils/alert";

// Test (Quiz) savollari uchun umumiy konstanta/yordamchi funksiyalar —
// `SendQuizDialog.jsx`, `QuestionsEditor.jsx` va `QuizTemplateDialog.jsx`
// orasida ulashiladi. Komponent bo'lmagan narsalar shu faylda (react-refresh
// qoidasi — bitta fayl faqat komponent eksport qilsin).

export const OPTION_IDS = ["a", "b", "c", "d", "e", "f"];

export const newKey = () => Math.random().toString(36).slice(2);

export const emptyQuestion = () => ({
  key: newKey(),
  text: "",
  options: [
    { id: "a", text: "" },
    { id: "b", text: "" },
    { id: "c", text: "" },
    { id: "d", text: "" },
  ],
  correctOptionId: "a",
});

export const isBlankQuestion = (q) => !q.text.trim() && q.options.every((o) => !o.text.trim());

// JSON namunasi — AI'ga ham, qo'lda yozishga ham bir xil sodda shakl.
export const SAMPLE_JSON = `[
  {
    "text": "2 + 2 nechiga teng?",
    "options": ["3", "4", "5", "6"],
    "correct": "B"
  },
  {
    "text": "O'zbekiston poytaxti qaysi shahar?",
    "options": ["Toshkent", "Samarqand", "Buxoro", "Xiva"],
    "correct": "A"
  }
]`;

export const SAMPLE_ROWS = [
  ["2 + 2 nechiga teng?", "3", "4", "5", "6", "B"],
  ["O'zbekiston poytaxti?", "Toshkent", "Samarqand", "Buxoro", "Xiva", "A"],
];

// `navigator.clipboard` faqat secure context'da bor — bo'lmasa eski usul.
export const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    successMsg("quiz.send.copied");
  } catch {
    errorMsg("common.error");
  }
};

export const excelColumns = (t) => [
  t("quiz.send.cols.question"),
  `${t("quiz.send.cols.option")} A`,
  `${t("quiz.send.cols.option")} B`,
  `${t("quiz.send.cols.option")} C`,
  `${t("quiz.send.cols.option")} D`,
  t("quiz.send.cols.correct"),
];
