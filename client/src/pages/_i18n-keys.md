# Yangi i18n kalitlari (AuditLog · Reports · Downgrade · Centers)

> Bu fayl faqat **ro'yxat**. Kalitlar `client/src/lang/uz.json` (keyin `ru.json`, `en.json`) ga
> integratsiya paytida qo'shiladi. Interpolatsiya o'zgaruvchilari `{{...}}` bilan ko'rsatilgan.

---

## `nav.*` (navSections uchun)

| Kalit | Uzbek |
|---|---|
| `nav.auditLog` | Amallar tarixi |
| `nav.reports` | Hisobotlar |

---

## `audit.*` — `pages/AuditLog/`

| Kalit | Uzbek |
|---|---|
| `audit.title` | Amallar tarixi |
| `audit.actor` | Xodim |
| `audit.action` | Amal |
| `audit.entity` | Obyekt |
| `audit.center` | Filial |
| `audit.date` | Vaqt |
| `audit.changes` | O'zgarishlar |
| `audit.changesCount` | {{count}} ta o'zgarish |
| `audit.noChanges` | O'zgargan maydon yo'q |
| `audit.field` | Maydon |
| `audit.from` | Edi |
| `audit.to` | Bo'ldi |
| `audit.emptyValue` | (bo'sh) |
| `audit.detailTitle` | Amal tafsiloti |
| `audit.empty` | Hozircha amallar tarixi bo'sh |
| `audit.loadError` | Amallar tarixini yuklab bo'lmadi |

### `audit.kinds.*` (actor.kind)

| Kalit | Uzbek |
|---|---|
| `audit.kinds.admin` | Administrator |
| `audit.kinds.client` | Direktor |
| `audit.kinds.staff` | Hodim |

### `audit.roles.*` (actor.role — staff roli)

| Kalit | Uzbek |
|---|---|
| `audit.roles.owner` | Direktor |
| `audit.roles.reception` | Resepshin |
| `audit.roles.teacher` | O'qituvchi |
| `audit.roles.assistant` | Yordamchi |

### `audit.entities.*` (entity.type)

| Kalit | Uzbek |
|---|---|
| `audit.entities.Student` | O'quvchi |
| `audit.entities.Group` | Guruh |
| `audit.entities.Staff` | Hodim |
| `audit.entities.Payment` | To'lov |
| `audit.entities.Expense` | Xarajat |
| `audit.entities.Salary` | Ish haqi |
| `audit.entities.Center` | Filial |
| `audit.entities.Room` | Xona |
| `audit.entities.Subject` | Fan |
| `audit.entities.Attendance` | Davomat |
| `audit.entities.Subscription` | Obuna |
| `audit.entities.Setting` | Sozlama |

### `audit.actions.*` (docs/API_CONTRACT.md §1.3 dagi to'liq ro'yxat)

| Kalit | Uzbek |
|---|---|
| `audit.actions.student:create` | O'quvchi qo'shildi |
| `audit.actions.student:update` | O'quvchi tahrirlandi |
| `audit.actions.student:delete` | O'quvchi o'chirildi |
| `audit.actions.student:leftGroup` | Guruhdan chiqarildi |
| `audit.actions.student:transfer` | Boshqa guruhga o'tkazildi |
| `audit.actions.group:create` | Guruh yaratildi |
| `audit.actions.group:update` | Guruh tahrirlandi |
| `audit.actions.group:delete` | Guruh o'chirildi |
| `audit.actions.group:activate` | Guruh faollashtirildi |
| `audit.actions.staff:create` | Hodim qo'shildi |
| `audit.actions.staff:update` | Hodim tahrirlandi |
| `audit.actions.staff:delete` | Hodim o'chirildi |
| `audit.actions.staff:permissions` | Hodim ruxsatlari o'zgardi |
| `audit.actions.payment:create` | To'lov qabul qilindi |
| `audit.actions.payment:refund` | To'lov qaytarildi |
| `audit.actions.payment:cancel` | To'lov bekor qilindi |
| `audit.actions.expense:create` | Xarajat qo'shildi |
| `audit.actions.expense:update` | Xarajat tahrirlandi |
| `audit.actions.expense:cancel` | Xarajat bekor qilindi |
| `audit.actions.salary:advance` | Avans berildi |
| `audit.actions.salary:withdraw` | Oldindan pul olindi |
| `audit.actions.salary:bonus` | Bonus qo'shildi |
| `audit.actions.salary:penalty` | Jarima yozildi |
| `audit.actions.salary:pay` | Oylik to'landi |
| `audit.actions.center:create` | Filial yaratildi |
| `audit.actions.center:update` | Filial tahrirlandi |
| `audit.actions.center:delete` | Filial o'chirildi |
| `audit.actions.center:blocked` | Filial bloklandi |
| `audit.actions.center:unblocked` | Filial faollashtirildi |
| `audit.actions.room:create` | Xona yaratildi |
| `audit.actions.room:update` | Xona tahrirlandi |
| `audit.actions.room:delete` | Xona o'chirildi |
| `audit.actions.subject:create` | Fan yaratildi |
| `audit.actions.subject:update` | Fan tahrirlandi |
| `audit.actions.subject:delete` | Fan o'chirildi |
| `audit.actions.attendance:update` | Davomat o'zgartirildi |
| `audit.actions.subscription:create` | Obuna rasmiylashtirildi |
| `audit.actions.subscription:downgrade` | Tarif pasaytirildi |
| `audit.actions.auth:signin` | Tizimga kirdi |
| `audit.actions.auth:signout` | Tizimdan chiqdi |
| `audit.actions.auth:failed` | Kirish urinishi muvaffaqiyatsiz |
| `audit.actions.settings:update` | Sozlamalar o'zgardi |
| `audit.actions.billingSetting:update` | To'lov sozlamasi o'zgardi |
| `audit.actions.attendanceSetting:update` | Davomat sozlamasi o'zgardi |

### `audit.fields.*` (changes jadvalidagi maydon nomlari — kerak bo'lganda to'ldiriladi)

> Kod `t("audit.fields.<field>", { defaultValue: field })` bilan chaqiradi, ya'ni tarjima
> bo'lmasa maydon nomi xom holda ko'rinadi — to'ldirish majburiy emas. Eng ko'p uchraydiganlari:

| Kalit | Uzbek |
|---|---|
| `audit.fields.fullName` | To'liq ism |
| `audit.fields.phone` | Telefon |
| `audit.fields.parentPhone` | Ota-ona telefoni |
| `audit.fields.price` | Narx |
| `audit.fields.amount` | Summa |
| `audit.fields.status` | Holat |
| `audit.fields.name` | Nomi |
| `audit.fields.role` | Rol |
| `audit.fields.permissions` | Ruxsatlar |
| `audit.fields.salary` | Ish haqi |
| `audit.fields.teacher` | O'qituvchi |
| `audit.fields.room` | Xona |
| `audit.fields.schedule` | Jadval |

---

## `report.*` — `pages/Reports/`

| Kalit | Uzbek |
|---|---|
| `report.title` | Hisobotlar |
| `report.revenue` | Tushum |
| `report.expense` | Xarajat |
| `report.profit` | Foyda |
| `report.debt` | Qarzdorlik |
| `report.debtHint` | Yig'ilmagan to'lovlar |
| `report.salaryPaid` | To'langan oylik |
| `report.newStudents` | Yangi o'quvchilar |
| `report.leftStudents` | Ketgan o'quvchilar |
| `report.activeStudents` | Faol o'quvchilar |
| `report.activeGroups` | Faol guruhlar |
| `report.attendanceRate` | Davomat |
| `report.vsPrevious` | o'tgan davrga nisbatan |
| `report.center` | Filial |
| `report.students` | O'quvchilar |
| `report.groups` | Guruhlar |
| `report.teacher` | O'qituvchi |
| `report.lessonsHeld` | O'tilgan darslar |
| `report.revenueGenerated` | Keltirgan tushum |
| `report.salaryEarned` | Hisoblangan oylik |
| `report.collector` | Qabul qildi |
| `report.paymentsCount` | To'lovlar soni |
| `report.collected` | Yig'ilgan summa |
| `report.cash` | Naqd |
| `report.card` | Karta |
| `report.refunded` | Qaytarilgan |
| `report.group` | Guruh |
| `report.syllabusProgress` | Dastur bajarilishi |
| `report.student` | O'quvchi |
| `report.debtMonths` | Qarz oylari |
| `report.totalDebt` | Umumiy qarzdorlik |
| `report.noDebtors` | Qarzdorlar yo'q |
| `report.groupBy` | Guruhlash |
| `report.customRange` | Sana oralig'i |
| `report.pickRange` | Hisobotni ko'rish uchun sana oralig'ini tanlang |
| `report.timelineTitle` | Dinamika |
| `report.timelineEmpty` | Tanlangan davr uchun ma'lumot yo'q |
| `report.empty` | Ma'lumot topilmadi |
| `report.loadError` | Hisobotni yuklab bo'lmadi |

### `report.periods.*`

| Kalit | Uzbek |
|---|---|
| `report.periods.daily` | Kunlik |
| `report.periods.weekly` | Haftalik |
| `report.periods.monthly` | Oylik |
| `report.periods.custom` | Oraliq |

### `report.groupByOptions.*`

| Kalit | Uzbek |
|---|---|
| `report.groupByOptions.day` | Kun bo'yicha |
| `report.groupByOptions.week` | Hafta bo'yicha |
| `report.groupByOptions.month` | Oy bo'yicha |

### `report.tab*`

| Kalit | Uzbek |
|---|---|
| `report.tabCenter` | Filiallar |
| `report.tabTeacher` | O'qituvchilar |
| `report.tabCollector` | Kassa |
| `report.tabGroup` | Guruhlar |
| `report.tabDebtors` | Qarzdorlar |

---

## `downgrade.*` — `pages/Subscription/DowngradeModal.jsx`

| Kalit | Uzbek |
|---|---|
| `downgrade.title` | Tarif o'zgardi |
| `downgrade.description` | Yangi tarifingiz {{limit}} ta filialga ruxsat beradi. Sizda {{activeCount}} ta faol filial bor. Qaysi {{limit}} tasi ishlashda davom etsin? |
| `downgrade.pickCenters` | Qoladigan filiallarni tanlang |
| `downgrade.selectedCount` | Tanlandi: {{count}} / {{limit}} |
| `downgrade.students` | {{count}} o'quvchi |
| `downgrade.groups` | {{count}} guruh |
| `downgrade.staff` | {{count}} hodim |
| `downgrade.warning` | {{count}} ta filial bloklanadi. Ma'lumotlar o'chmaydi — tarifni ko'tarsangiz qayta ochiladi. |
| `downgrade.confirm` | Tasdiqlash |
| `downgrade.upgrade` | Tarifni ko'tarish |
| `downgrade.saving` | Saqlanmoqda... |
| `downgrade.saved` | Filiallar holati yangilandi |

---

## `center.*` — `pages/Centers/index.jsx` (yangi qo'shilganlari)

| Kalit | Uzbek |
|---|---|
| `center.blocked` | Bloklangan |
| `center.blockedHint` | Bu filial tarif limiti tufayli bloklangan. Ma'lumotlar saqlanib turibdi. |
| `center.unblock` | Faollashtirish |
| `center.unblockConfirm` | "{{name}}" filiali qayta faollashtirilsinmi? |
| `center.unblockLimit` | Tarif limiti to'lgan — avval boshqa filialni bloklang yoki tarifni ko'taring. |

---

## Allaqachon mavjud deb hisoblangan kalitlar (tekshirib chiqilsin)

`common.search`, `common.all`, `common.retry`, `common.cancel`, `common.delete`, `common.edit`,
`common.detail`, `common.status`, `common.filter`, `common.resetFilters`, `common.apply`,
`common.exportExcel`, `common.exportSuccess`, `common.exportError`, `common.yes`, `common.no`,
`common.dateRange`, `common.datePresets.*`, `student.somSuffix`, `revenue.collectorUnknown`.

> `common.yes` / `common.no` — `AuditLog/ChangesDialog.jsx` da mantiqiy qiymatlar uchun
> ishlatiladi; agar `uz.json` da bo'lmasa qo'shilishi kerak ("Ha" / "Yo'q").
