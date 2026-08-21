# Yangi i18n kalitlari — `admin/src/lang/*.json`

> Bu fayl **faqat ro'yxat**. Kalitlar `uz.json` (keyin `ru.json` / `en.json`) ga qo'lda
> ko'chiriladi. Manba sahifalar: `pages/AuditLog`, `pages/Monitoring`, `pages/Settings`.

---

## 1. `nav.*` (Navbar uchun)

| Kalit | uz |
|---|---|
| `nav.auditLog` | Audit jurnali |
| `nav.monitoring` | Monitoring |
| `nav.systemSettings` | Tizim sozlamalari |

## 2. `common.*` (yangi qo'shiladiganlar — mavjudlari o'zgarmaydi)

| Kalit | uz |
|---|---|
| `common.close` | Yopish |
| `common.save` | Saqlash |
| `common.add` | Qo'shish |
| `common.reset` | Tozalash |
| `common.retry` | Qayta urinish |
| `common.refresh` | Yangilash |
| `common.export` | Eksport |
| `common.filters` | Filtrlar |

> Allaqachon mavjud va ishlatilgan: `common.actions`, `common.select`, `common.search`,
> `common.searching`, `common.noResults`, `common.typeToSearch`.

---

## 3. `audit.*` — Audit jurnali

| Kalit | uz |
|---|---|
| `audit.title` | Audit jurnali |
| `audit.empty` | Audit yozuvlari topilmadi |
| `audit.loadError` | Audit jurnalini yuklab bo'lmadi |
| `audit.exported` | Fayl yuklab olindi |
| `audit.searchPlaceholder` | Aktyor, obyekt yoki amal bo'yicha qidirish... |
| `audit.detailTitle` | Audit yozuvi |
| `audit.action` | Amal |
| `audit.actor` | Kim |
| `audit.actorKind` | Aktyor turi |
| `audit.entity` | Obyekt |
| `audit.client` | Mijoz |
| `audit.center` | Filial |
| `audit.date` | Sana |
| `audit.from` | Dan |
| `audit.to` | Gacha |
| `audit.changes` | O'zgarishlar |
| `audit.changesCount` | `{{count}} ta o'zgarish` |
| `audit.noChanges` | Bu amalda maydon o'zgarishi yo'q |
| `audit.field` | Maydon |
| `audit.emptyValue` | — |
| `audit.platformLevel` | Platforma darajasi |
| `audit.allClients` | Barcha mijozlar |
| `audit.searchClient` | Mijozni qidirish... |
| `audit.allActors` | Barcha aktyorlar |
| `audit.allActorKinds` | Barcha turlar |
| `audit.allActions` | Barcha amallar |
| `audit.allEntityTypes` | Barcha obyekt turlari |

### `audit.kinds.*`

| Kalit | uz |
|---|---|
| `audit.kinds.admin` | Platforma admini |
| `audit.kinds.client` | Mijoz (egasi) |
| `audit.kinds.staff` | Hodim |

### `audit.actions.*` (fallback bor — kalit topilmasa `action` string'ining o'zi chiqadi)

| Kalit | uz |
|---|---|
| `audit.actions.student:create` | O'quvchi yaratildi |
| `audit.actions.student:update` | O'quvchi tahrirlandi |
| `audit.actions.student:delete` | O'quvchi o'chirildi |
| `audit.actions.student:leftGroup` | O'quvchi guruhdan chiqdi |
| `audit.actions.student:transfer` | O'quvchi ko'chirildi |
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
| `audit.actions.salary:bonus` | Bonus berildi |
| `audit.actions.salary:penalty` | Jarima solindi |
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
| `audit.actions.subscription:create` | Obuna yaratildi |
| `audit.actions.subscription:downgrade` | Tarif pasaytirildi |
| `audit.actions.auth:signin` | Tizimga kirdi |
| `audit.actions.auth:signout` | Tizimdan chiqdi |
| `audit.actions.auth:failed` | Kirish urinishi muvaffaqiyatsiz |
| `audit.actions.settings:update` | Sozlamalar o'zgartirildi |
| `audit.actions.billingSetting:update` | Hisob-kitob sozlamalari o'zgartirildi |
| `audit.actions.attendanceSetting:update` | Davomat sozlamalari o'zgartirildi |

### `audit.entities.*`

| Kalit | uz |
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
| `audit.entities.Client` | Mijoz |
| `audit.entities.Setting` | Sozlama |

### `audit.fields.*` (diff jadvalidagi maydon nomlari — fallback bor)

| Kalit | uz |
|---|---|
| `audit.fields.fullName` | To'liq ism |
| `audit.fields.name` | Nomi |
| `audit.fields.phone` | Telefon |
| `audit.fields.parentPhone` | Ota-ona telefoni |
| `audit.fields.price` | Narx |
| `audit.fields.amount` | Summa |
| `audit.fields.status` | Holat |
| `audit.fields.role` | Rol |
| `audit.fields.permissions` | Ruxsatlar |
| `audit.fields.center` | Filial |
| `audit.fields.group` | Guruh |
| `audit.fields.teacher` | O'qituvchi |
| `audit.fields.room` | Xona |
| `audit.fields.subject` | Fan |
| `audit.fields.startTime` | Boshlanish vaqti |
| `audit.fields.endTime` | Tugash vaqti |
| `audit.fields.days` | Kunlar |
| `audit.fields.salaryType` | Oylik turi |
| `audit.fields.salaryValue` | Oylik qiymati |
| `audit.fields.comment` | Izoh |

---

## 4. `monitoring.*` — Monitoring

| Kalit | uz |
|---|---|
| `monitoring.title` | Monitoring |
| `monitoring.empty` | Monitoring ma'lumoti yo'q |
| `monitoring.loadError` | Monitoring ma'lumotini yuklab bo'lmadi |
| `monitoring.autoRefresh` | Har 10 soniyada yangilanadi |
| `monitoring.charts` | Grafiklar |
| `monitoring.noHistory` | Tarix ma'lumoti yetarli emas |
| `monitoring.lastHours` | `Oxirgi {{count}} soat` |
| `monitoring.latency` | Kechikish |
| `monitoring.mongo` | MongoDB |
| `monitoring.redis` | Redis |
| `monitoring.socket` | Socket |
| `monitoring.storage` | Fayl xotirasi |
| `monitoring.dbName` | Baza nomi |
| `monitoring.collections` | Kolleksiyalar |
| `monitoring.dataSize` | Ma'lumot hajmi |
| `monitoring.indexSize` | Indeks hajmi |
| `monitoring.connections` | Ulanishlar |
| `monitoring.usedMemory` | Band xotira |
| `monitoring.keys` | Kalitlar |
| `monitoring.hitRate` | Kesh samarasi |
| `monitoring.evictedKeys` | Chiqarib tashlangan kalitlar |
| `monitoring.connectedSockets` | Ulangan socketlar |
| `monitoring.rooms` | Xonalar |
| `monitoring.adapter` | Adapter |
| `monitoring.path` | Yo'l |
| `monitoring.used` | Band |
| `monitoring.free` | Bo'sh |
| `monitoring.total` | Jami |
| `monitoring.filesCount` | Fayllar soni |
| `monitoring.process` | Jarayon |
| `monitoring.api` | API |
| `monitoring.tenants` | Mijozlar |
| `monitoring.uptime` | Ishlash vaqti |
| `monitoring.version` | Versiya |
| `monitoring.nodeVersion` | Node versiyasi |
| `monitoring.workers` | Workerlar |
| `monitoring.cpu` | CPU |
| `monitoring.memory` | Xotira |
| `monitoring.heap` | Heap |
| `monitoring.loadAvg` | O'rtacha yuk |
| `monitoring.rpm` | Daqiqasiga so'rov |
| `monitoring.rps` | Sekundiga so'rov |
| `monitoring.avgLatency` | O'rtacha kechikish |
| `monitoring.errorRate` | Xatolik ulushi |
| `monitoring.clients` | Mijozlar |
| `monitoring.activeSubscriptions` | Faol obunalar |
| `monitoring.expiringSoon` | Tugayotgan obunalar |
| `monitoring.blockedCenters` | Bloklangan filiallar |
| `monitoring.unitDay` | k |
| `monitoring.unitHour` | s |
| `monitoring.unitMin` | d |

### `monitoring.status.*`

| Kalit | uz |
|---|---|
| `monitoring.status.healthy` | Sog'lom |
| `monitoring.status.ok` | Sog'lom |
| `monitoring.status.up` | Ishlayapti |
| `monitoring.status.degraded` | Sekinlashgan |
| `monitoring.status.slow` | Sekin |
| `monitoring.status.down` | Ishlamayapti |
| `monitoring.status.error` | Xatolik |

---

## 5. `systemSettings.*` — Tizim sozlamalari

| Kalit | uz |
|---|---|
| `systemSettings.title` | Tizim sozlamalari |
| `systemSettings.empty` | Sozlamalar topilmadi |
| `systemSettings.loadError` | Sozlamalarni yuklab bo'lmadi |
| `systemSettings.saved` | Sozlamalar saqlandi |
| `systemSettings.test` | Sinab ko'rish |
| `systemSettings.testSending` | Yuborilmoqda... |
| `systemSettings.testFailed` | Sinov muvaffaqiyatsiz tugadi |
| `systemSettings.smtpTestSuccess` | Sinov xati yuborildi |
| `systemSettings.telegramTestSuccess` | Sinov xabari yuborildi |
| `systemSettings.enabledOn` | Yoqilgan |
| `systemSettings.enabledOff` | O'chirilgan |
| `systemSettings.secretSetHint` | Saqlangan qiymat mavjud. Bo'sh qoldirsangiz o'zgarmaydi. |
| `systemSettings.secretEmptyHint` | Hali kiritilmagan. Bo'sh qoldirsangiz o'zgarmaydi. |

### `systemSettings.tabs.*`

| Kalit | uz |
|---|---|
| `systemSettings.tabs.smtp` | SMTP |
| `systemSettings.tabs.telegram` | Telegram |
| `systemSettings.tabs.storage` | Fayl xotirasi |
| `systemSettings.tabs.backup` | Zaxira nusxa |

### `systemSettings.smtp.*`

| Kalit | uz |
|---|---|
| `systemSettings.smtp.title` | SMTP (email) sozlamalari |
| `systemSettings.smtp.description` | Obuna eslatmalari va tizim xatlari shu server orqali yuboriladi. |
| `systemSettings.smtp.enabled` | Email yuborish yoqilgan |
| `systemSettings.smtp.host` | Host |
| `systemSettings.smtp.port` | Port |
| `systemSettings.smtp.secure` | SSL/TLS (secure) |
| `systemSettings.smtp.user` | Foydalanuvchi |
| `systemSettings.smtp.pass` | Parol |
| `systemSettings.smtp.fromName` | Jo'natuvchi nomi |
| `systemSettings.smtp.fromEmail` | Jo'natuvchi email |
| `systemSettings.smtp.testTitle` | SMTP sinovi |
| `systemSettings.smtp.testDescription` | Ko'rsatilgan manzilga sinov xati yuboriladi. |
| `systemSettings.smtp.testTo` | Qaysi manzilga |

### `systemSettings.telegram.*`

| Kalit | uz |
|---|---|
| `systemSettings.telegram.title` | Telegram bot |
| `systemSettings.telegram.description` | Platforma darajasidagi texnik ogohlantirishlar shu bot orqali yuboriladi. |
| `systemSettings.telegram.enabled` | Telegram ogohlantirishlari yoqilgan |
| `systemSettings.telegram.botToken` | Bot tokeni |
| `systemSettings.telegram.chatIds` | Ogohlantirish chatlari |
| `systemSettings.telegram.chatIdsHint` | Chat ID ni botning `/chatid` buyrug'i orqali bilib olasiz. |
| `systemSettings.telegram.noChatIds` | Hali chat qo'shilmagan |
| `systemSettings.telegram.chatCount` | `{{count}} ta chat` |
| `systemSettings.telegram.alerts` | Qaysi hodisada xabar yuborilsin |
| `systemSettings.telegram.testTitle` | Telegram sinovi |
| `systemSettings.telegram.testDescription` | Barcha ogohlantirish chatlariga sinov xabari yuboriladi. |
| `systemSettings.telegram.alertTypes.serverError` | Server xatosi (5xx) |
| `systemSettings.telegram.alertTypes.healthDegraded` | Mongo/Redis ishlamay qolganda |
| `systemSettings.telegram.alertTypes.subscriptionExpiring` | Obuna tugashiga 2 kun qolganda |
| `systemSettings.telegram.alertTypes.newLead` | Yangi lead kelganda |

### `systemSettings.storage.*`

| Kalit | uz |
|---|---|
| `systemSettings.storage.title` | Fayl xotirasi |
| `systemSettings.storage.description` | Rasm va hujjatlar qayerda saqlanishini belgilaydi. |
| `systemSettings.storage.driver` | Saqlash turi |
| `systemSettings.storage.drivers.local` | Serverda (local) |
| `systemSettings.storage.drivers.s3` | S3 (bulut) |
| `systemSettings.storage.baseUrl` | Bazaviy URL |
| `systemSettings.storage.maxFileMb` | Maksimal fayl hajmi (MB) |
| `systemSettings.storage.hint` | Bazaviy URL bo'sh bo'lsa fayllar server manzilidan beriladi. |

### `systemSettings.backup.*`

| Kalit | uz |
|---|---|
| `systemSettings.backup.title` | Zaxira nusxa (backup) |
| `systemSettings.backup.description` | Baza avtomatik zaxiralanadi va eski nusxalar tozalanadi. |
| `systemSettings.backup.enabled` | Avtomatik zaxiralash yoqilgan |
| `systemSettings.backup.cron` | Jadval (cron) |
| `systemSettings.backup.cronHint` | Masalan `0 3 * * *` — har kuni soat 03:00 da. |
| `systemSettings.backup.keepDays` | Necha kun saqlansin |
| `systemSettings.backup.runNow` | Hozir bajarish |
| `systemSettings.backup.running` | Zaxira nusxa olinmoqda... |
| `systemSettings.backup.success` | `Zaxira nusxa tayyor: {{file}} ({{size}} MB)` |
| `systemSettings.backup.failed` | Zaxira nusxa olishda xatolik |
| `systemSettings.backup.lastRun` | Oxirgi bajarilgan |
| `systemSettings.backup.statuses.success` | Muvaffaqiyatli |
| `systemSettings.backup.statuses.failed` | Xatolik |
| `systemSettings.backup.listTitle` | Zaxira fayllar |
| `systemSettings.backup.empty` | Zaxira fayllar yo'q |
| `systemSettings.backup.file` | Fayl |
| `systemSettings.backup.size` | Hajmi |
| `systemSettings.backup.createdAt` | Yaratilgan |

---

## 6. Backenddan kutilayotgan qo'shimcha DTO maydonlari

Frontend quyidagilarga tayanadi (kontraktda aniq yozilmagan, lekin UI shularsiz "—" ko'rsatadi):

- `GET /admin/settings` → `smtp.hasPassword: Boolean`, `telegram.hasBotToken: Boolean`
  (maxfiy qiymat o'rniga bayroq).
- `GET /admin/settings/backup/list` → har elementda `date` (formatlangan matn) bo'lsa
  ishlatiladi, bo'lmasa xom `createdAt` chiqadi.
- `SystemSettingDTO.backup.lastRunText` — formatlangan sana (bo'lmasa `lastRunAt` chiqadi).
- `GET /admin/audit-logs/filters` `clientId` query'sini qabul qiladi (tanlangan mijozning
  aktyorlari ro'yxati uchun).
