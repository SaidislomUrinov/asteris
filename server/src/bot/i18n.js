// Shaxsiy Telegram xabarlari uchun YENGIL i18n — frontend'dagi kabi to'liq
// i18next emas (server bunday narsaga muhtoj emas, atigi bir nechta xabar
// shabloni bor). Xabar QABUL QILUVCHI TILIDA (Client/Staff.telegram.lang)
// TO'LIQ tayyor matn sifatida yuboriladi — frontend'dagi in-app
// bildirishnomalar kabi tarjima kaliti emas (Telegram'da renderlovchi UI yo'q).
const DICT = {
  uz: {
    linkConfirmOwner:
      "✅ Telegram muvaffaqiyatli ulandi!\n\nEndi shu yerga quyidagilarni olasiz:\n• Har kuni ertalab 6–7 orasida: bugungi darslar, kutilayotgan o'quvchilar, xonalar va o'qituvchilar ro'yxati\n• Har filialning kunlik darslari tugagach: yakuniy hisobot (davomat, tushum, o'tgan darslar)\n\nTilni istalgan payt ilovadagi \"Bildirishnomalar\" bo'limidan o'zgartirishingiz mumkin.",
    linkConfirmReception:
      "✅ Telegram muvaffaqiyatli ulandi!\n\nEndi shu yerga quyidagilarni olasiz:\n• Har kuni ertalab 6–7 orasida: bugungi darslar, kutilayotgan o'quvchilar, xonalar va o'qituvchilar ro'yxati\n• Kunlik darslar tugagach: yakuniy hisobot (davomat, o'tgan darslar — moliyaviy ma'lumotsiz)\n\nTilni istalgan payt ilovadagi \"Bildirishnomalar\" bo'limidan o'zgartirishingiz mumkin.",
    linkConfirmTeacher:
      "✅ Telegram muvaffaqiyatli ulandi!\n\nEndi shu yerga quyidagilarni olasiz:\n• Har kuni ertalab 6–7 orasida: bugungi darslaringiz ro'yxati (xona, fan/guruh, vaqt)\n• Har dars boshlanishiga 1 soat qolganda: eslatma (vaqt, xona, mavzu — bo'lsa)\n\nTilni istalgan payt ilovadagi \"Bildirishnomalar\" bo'limidan o'zgartirishingiz mumkin.",
    linkConfirmGeneric:
      "✅ Telegram muvaffaqiyatli ulandi! Endi tegishli bildirishnomalarni shu yerda olasiz.",
    linkExpired: "❌ Havola eskirgan yoki noto'g'ri. Ilovadan qaytadan \"Telegramni ulash\" tugmasini bosing.",
    morningHeader: "☀️ Xayrli tong",
    morningLessonsToday: "Bugungi darslar",
    morningStudentsExpected: "Kutilayotgan o'quvchilar",
    morningRooms: "Band xonalar",
    morningTeachers: "Darsli o'qituvchilar",
    morningNoLessons: "Bugun dars yo'q.",
    morningMyLessons: "Bugungi darslaringiz",
    morningNoLessonsMine: "Bugun sizda dars yo'q.",
    eveningHeader: "🌙 Kunlik yakuniy hisobot",
    eveningPresent: "Keldi",
    eveningAbsent: "Kelmadi",
    eveningExcused: "Sababli",
    eveningUnmarked: "Belgilanmagan",
    eveningRevenue: "Bugungi tushum",
    eveningLessons: "O'tgan darslar",
    reminderHeader: "⏰ Darsingizga 1 soat qoldi",
    reminderNoTopic: "Mavzu biriktirilmagan",
  },
  ru: {
    linkConfirmOwner:
      "✅ Telegram успешно подключён!\n\nТеперь сюда будут приходить:\n• Каждое утро в 6–7: сегодняшние уроки, ожидаемые ученики, кабинеты и преподаватели\n• После завершения всех уроков филиала за день: итоговый отчёт (посещаемость, выручка, проведённые уроки)\n\nЯзык можно изменить в разделе \"Уведомления\" в приложении.",
    linkConfirmReception:
      "✅ Telegram успешно подключён!\n\nТеперь сюда будут приходить:\n• Каждое утро в 6–7: сегодняшние уроки, ожидаемые ученики, кабинеты и преподаватели\n• После завершения уроков за день: итоговый отчёт (посещаемость, проведённые уроки — без финансов)\n\nЯзык можно изменить в разделе \"Уведомления\" в приложении.",
    linkConfirmTeacher:
      "✅ Telegram успешно подключён!\n\nТеперь сюда будут приходить:\n• Каждое утро в 6–7: список ваших сегодняшних уроков (кабинет, предмет/группа, время)\n• За 1 час до начала урока: напоминание (время, кабинет, тема — если есть)\n\nЯзык можно изменить в разделе \"Уведомления\" в приложении.",
    linkConfirmGeneric: "✅ Telegram успешно подключён! Теперь вы будете получать уведомления здесь.",
    linkExpired: "❌ Ссылка устарела или неверна. Нажмите \"Подключить Telegram\" в приложении заново.",
    morningHeader: "☀️ Доброе утро",
    morningLessonsToday: "Уроков сегодня",
    morningStudentsExpected: "Ожидается учеников",
    morningRooms: "Занятые кабинеты",
    morningTeachers: "Преподаватели с уроками",
    morningNoLessons: "Сегодня уроков нет.",
    morningMyLessons: "Ваши сегодняшние уроки",
    morningNoLessonsMine: "Сегодня у вас нет уроков.",
    eveningHeader: "🌙 Итоговый отчёт за день",
    eveningPresent: "Пришли",
    eveningAbsent: "Не пришли",
    eveningExcused: "По причине",
    eveningUnmarked: "Не отмечено",
    eveningRevenue: "Выручка за сегодня",
    eveningLessons: "Проведённые уроки",
    reminderHeader: "⏰ До урока остался 1 час",
    reminderNoTopic: "Тема не назначена",
  },
  en: {
    linkConfirmOwner:
      "✅ Telegram connected!\n\nYou'll now receive here:\n• Every morning 6–7 AM: today's lessons, expected students, rooms and teachers\n• After all of a branch's lessons finish for the day: a final report (attendance, revenue, lessons held)\n\nYou can change the language anytime in the \"Notifications\" section of the app.",
    linkConfirmReception:
      "✅ Telegram connected!\n\nYou'll now receive here:\n• Every morning 6–7 AM: today's lessons, expected students, rooms and teachers\n• After lessons finish for the day: a final report (attendance, lessons held — no financial data)\n\nYou can change the language anytime in the \"Notifications\" section of the app.",
    linkConfirmTeacher:
      "✅ Telegram connected!\n\nYou'll now receive here:\n• Every morning 6–7 AM: your list of today's lessons (room, subject/group, time)\n• 1 hour before each lesson starts: a reminder (time, room, topic — if set)\n\nYou can change the language anytime in the \"Notifications\" section of the app.",
    linkConfirmGeneric: "✅ Telegram connected! You'll now receive relevant notifications here.",
    linkExpired: "❌ This link expired or is invalid. Tap \"Connect Telegram\" in the app again.",
    morningHeader: "☀️ Good morning",
    morningLessonsToday: "Lessons today",
    morningStudentsExpected: "Students expected",
    morningRooms: "Rooms in use",
    morningTeachers: "Teachers with lessons",
    morningNoLessons: "No lessons today.",
    morningMyLessons: "Your lessons today",
    morningNoLessonsMine: "You have no lessons today.",
    eveningHeader: "🌙 Daily final report",
    eveningPresent: "Present",
    eveningAbsent: "Absent",
    eveningExcused: "Excused",
    eveningUnmarked: "Unmarked",
    eveningRevenue: "Today's revenue",
    eveningLessons: "Lessons held",
    reminderHeader: "⏰ 1 hour until your lesson",
    reminderNoTopic: "No topic assigned",
  },
};

// `lang` noto'g'ri/noma'lum bo'lsa "uz"ga tushadi (Client/Staff.telegram.lang
// default'i ham shu).
const t = (lang, key) => (DICT[lang] || DICT.uz)[key] || DICT.uz[key] || key;

module.exports = { t };
