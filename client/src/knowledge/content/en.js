// Bilimlar bazasi — English. Format: knowledge/index.js.
export default {
  dashboard: {
    summary: "Your center's month at a glance: revenue, expenses, salaries, debt and today's lessons.",
    blocks: [
      { type: "h", text: "Main cards" },
      {
        type: "ul",
        items: [
          "**Monthly revenue** and **Monthly expenses** — for the selected month.",
          "**Teacher salaries** — the total salary accrued for this month.",
          "**Debt** — only debt from the current billing cycle. See the full debt history in [[Reports]] → Debtors tab.",
          "Small counters: active students, active and forming groups, staff, rooms, subjects.",
        ],
      },
      {
        type: "p",
        text: "At the top, choose the month and (if you have several centers) the center. The charts show payment status, revenue over the last 30 days and the breakdown of expenses. The [[All]] link in the **Revenue — who collected it** block opens the Revenue page.",
      },
      {
        type: "p",
        text: "The **Today's lessons** strip shows each lesson with its status: Ongoing, Finished or Upcoming. Click a card to open the group page.",
      },
      {
        type: "tip",
        text: "If a customer is sitting next to you or the screen is on a projector, hide all amounts with the eye button — your choice is remembered in this browser.",
      },
      {
        type: "p",
        text: "The data refreshes on its own a few seconds after a payment, expense, attendance mark or archiving — no need to reload the page.",
      },
    ],
  },

  "dashboard.teacher": {
    summary: "Your lessons for today, your groups and your salary on one page.",
    blocks: [
      { type: "h", text: "Cards at the top" },
      {
        type: "ul",
        items: [
          "**Remaining salary** — the amount still to be paid to you for this month.",
          "**Today's lessons** — whether a lesson is happening now or when the next one is.",
          "**Active groups**, **My students** and **My rooms**.",
        ],
      },
      {
        type: "p",
        text: "Click a lesson in the **Today's lessons** list to open the group page. In the **My groups** block, use [[Show all]] to open all your groups.",
      },
      {
        type: "p",
        text: "In the **Salary** panel, pick a month to see your accrued salary, bonus, advance, money taken upfront and penalties. Below is the transaction history.",
      },
      {
        type: "tip",
        text: "When a lesson starts, the [[Lesson]] section in the left menu opens that lesson automatically — mark attendance and grades right there.",
      },
      {
        type: "p",
        text: "Copy the **Students' bot** link in one click and send it to your students.",
      },
    ],
  },

  "dashboard.reception": {
    summary: "For everyday work: today's lessons, students with debt and quick actions.",
    blocks: [
      {
        type: "ul",
        items: [
          "Cards: **Active students**, **Today's lessons**, **Students with debt** and **Monthly revenue**.",
          "**Today's lessons** — subject, teacher, room, time and status. Click a row to open the group.",
          "**Students with debt** — the 5 people with the largest debt. [[View all]] opens the Students page filtered to debtors.",
          "**Quick actions** — jump to Students, Groups and Attendance in one click.",
        ],
      },
      {
        type: "tip",
        text: "Use the debtors list for phone calls during the day: click a student and take the payment from their page.",
      },
      {
        type: "p",
        text: "If a block shows **You do not have permission to view this**, ask management for the permission you need.",
      },
    ],
  },

  centers: {
    summary: "Your list of centers, statistics for each center and their settings.",
    blocks: [
      { type: "h", text: "Adding a center" },
      {
        type: "steps",
        items: [
          "Click the [[Add center]] button.",
          "Enter the **Center name** (required) and, if you like, add a slogan and a logo.",
          "Save. If you have reached the center limit of your plan, you can't add a new center.",
        ],
      },
      { type: "h", text: "Center page" },
      {
        type: "p",
        text: "[[Details]] on the card opens the center page: rooms, subjects, active students, staff, monthly revenue/expenses, charts and recent payments.",
      },
      { type: "h", text: "Center settings (⚙️)" },
      {
        type: "ul",
        items: [
          "**Group billing cycle** — **Date to date** (every month from the date the group started) or **Month start to month start** (the 1st of every month; the first month is charged partially).",
          "**Attendance settings** — move the payment for days a student missed to the next month (excused / unexcused / after 3 absences in a row).",
          "**Teacher salary** — deduct from the teacher's salary for days a student missed.",
          "**Late threshold (minutes)** — how many minutes after the lesson starts a QR check-in counts as late (0 — off).",
          "**Parent notifications** — attendance, end-of-lesson, payment and debt reminders sent to Telegram; you can also set quiet hours.",
        ],
      },
      {
        type: "warn",
        text: "Deleting a center **does not move it to the archive** and cannot be undone. A center blocked because of the plan limit keeps its data — reactivate it with [[Unblock]] once your plan allows it.",
      },
    ],
  },

  staff: {
    summary: "Add receptionists, teachers and teaching assistants, and set their permissions and salary.",
    blocks: [
      { type: "h", text: "Adding a staff member" },
      {
        type: "steps",
        items: [
          "Click the [[Add staff member]] button.",
          "Enter the **Full name**, **Login**, **Password**, **Center** and **Position** (Reception / Teacher / Teaching assistant).",
          "For a teacher, tick the **Subjects** they teach — they can only be assigned to groups of those subjects.",
          "Choose the **Salary calculation type**: **Percentage** (a % of student payments) or **Fixed** (a set amount).",
          "In the **Permissions** section, choose what the staff member can see and do, then save.",
        ],
      },
      {
        type: "tip",
        text: "After saving, the login details are downloaded automatically as a PDF, and you can also get them with the [[Copy]] button — give these details to the staff member.",
      },
      {
        type: "ul",
        items: [
          "Reception can be given **Unlimited** permissions. Teachers only get lesson-related permissions — no payment, salary or expense permissions.",
          "When editing, leave the password empty to keep it unchanged.",
          "[[Block]] — the staff member temporarily can't sign in; bring them back with [[Unblock]].",
        ],
      },
      { type: "h", text: "Staff member page" },
      {
        type: "p",
        text: "Opening [[Details]] shows the staff member's groups, salary breakdown (accrued, advance, taken upfront, bonus, penalty, remaining) and, for teachers, their performance. You can pay money from here with [[Payment/Penalty]].",
      },
      {
        type: "warn",
        text: "A staff member you [[Archive]] can't sign in, but their salary history is kept and they can be restored from the Archive section.",
      },
    ],
  },

  subjects: {
    summary: "The subjects taught at your center, with their default price and duration.",
    blocks: [
      { type: "h", text: "Adding a subject" },
      {
        type: "steps",
        items: [
          "Click the [[Add subject]] button.",
          "Enter the **Subject name**, **Default price** (monthly) and **Duration (months)**. If you have several centers, choose the center too.",
          "Save.",
        ],
      },
      {
        type: "p",
        text: "The **Default price** becomes the monthly fee of groups in this subject and the automatic price when a student is added. If needed, you can change the price for each student separately.",
      },
      {
        type: "tip",
        text: "[[Copy]] opens a pre-filled copy so you can quickly create a similar subject. Teachers can only be chosen for groups of the subjects ticked in their profile.",
      },
      {
        type: "p",
        text: "A subject you [[Archive]] doesn't affect existing groups and can be restored from the Archive section.",
      },
    ],
  },

  rooms: {
    summary: "Live room occupancy and each room's weekly schedule.",
    blocks: [
      {
        type: "p",
        text: "Each room card shows its status: **Lesson in progress**, **Soon** (a lesson within 60 minutes), **Free** or **Inactive**. Busy rooms are shown at the top.",
      },
      {
        type: "p",
        text: "[[Add room]] — the center and **Room name** are required, **Capacity** is optional.",
      },
      { type: "h", text: "Room page and schedule" },
      {
        type: "ul",
        items: [
          "**Weekly schedule**: columns are days, rows are hours. Click a block to open the group.",
          "Drag a block up or down to change the time, sideways to change the day; drag its edge to change the length. Changes are saved immediately.",
          "If the time clashes with another group, you'll see a message and the change is cancelled.",
          "**Groups without a schedule** — groups with no days or time set; they don't appear on the schedule.",
          "[[Add group]] opens a new group with this room already selected.",
        ],
      },
      {
        type: "tip",
        text: "To plan several rooms together, go to the Schedule page with the [[Edit schedule]] button.",
      },
    ],
  },

  groups: {
    summary: "Opening and activating groups, plus students, attendance, grades, homework and the syllabus.",
    blocks: [
      { type: "h", text: "Life of a group" },
      {
        type: "steps",
        items: [
          "[[Add group]] — the center and subject are required. A new group starts in the **Being formed** status: you gather students, but no fees are charged yet.",
          "Once enough students have joined, click [[Activate]]: the teacher, room, days, time and **Start date** are required. Lessons and monthly fees are counted from this date.",
          "When the course ends, use [[Finish the group]] — the group becomes **Finished** and its schedule no longer changes.",
        ],
      },
      { type: "h", text: "Group page" },
      {
        type: "ul",
        items: [
          "**Statistics** — revenue, payment status, a calendar of lesson days and overall attendance.",
          "**General** — the list of students, payment status and attendance. From the row menu you can add a payment, call, transfer to another group, remove from the group or archive.",
          "**Attendance** — a monthly table: click a cell to mark **Present / Absent / Excused**.",
          "**Grades** — grades from 1 to 10; you can't grade an absent student or a future date.",
          "**Homework** — an assignment for each lesson day; fill it from the syllabus with [[Take from syllabus]].",
          "**Plan** — the syllabus (modules and topics). Progress counts only days with attendance marked.",
        ],
      },
      {
        type: "p",
        text: "In the lesson-day calendar, click a day to mark it as a **Day off**: if no fee is taken, the day is left out of the count and the price is spread over the remaining days.",
      },
      {
        type: "tip",
        text: "With [[Import from Excel]] you can add students in one go by copying them from a spreadsheet or from an .xlsx file (up to 300). If something went wrong, you can [[Undo import]] within 24 hours — as long as no payments or attendance have been entered yet.",
      },
      {
        type: "warn",
        text: "Teachers can mark attendance only for today and yesterday. When a group is archived, its students are archived with it and their debt is removed from the total debt.",
      },
    ],
  },

  schedule: {
    summary: "Place all groups on a weekly schedule by room and time.",
    blocks: [
      { type: "h", text: "Placing a group" },
      {
        type: "steps",
        items: [
          "Choose a room in the left panel.",
          "Pick a group from the **Unplaced** list.",
          "Click an empty slot on the schedule — the days are filled in automatically (Mon·Wed·Fri or Tue·Thu·Sat).",
        ],
      },
      {
        type: "ul",
        items: [
          "Drag a lesson within the schedule to change its time, or onto another room card to change its room.",
          "Pencil icon — edit days and time. Trash icon — remove just one day.",
          "[[Remove from schedule]] — the group goes back entirely to the **Unplaced** list.",
          "If you click another lesson while a group is selected, you'll be offered [[Swap lesson]].",
        ],
      },
      {
        type: "tip",
        text: "There's no save button — every change is saved automatically. If you make a mistake, use [[Undo (Ctrl+Z)]] to cancel the last action.",
      },
      {
        type: "warn",
        text: "[[Rearrange]] clears the day, time and room of **all** groups in the current center and saves immediately. Only use it if you want to build the schedule from scratch.",
      },
      {
        type: "p",
        text: "On phones and tablets the schedule is view-only — editing is done on a computer.",
      },
    ],
  },

  calendar: {
    summary: "A monthly lesson calendar for the center, and marking days off.",
    blocks: [
      {
        type: "p",
        text: "Each day shows how many lessons it has. Days off are marked separately. On the right is a summary for the month: planned lessons, lesson days, days off and cancelled lessons.",
      },
      { type: "h", text: "Marking a day off" },
      {
        type: "steps",
        items: [
          "Click a day. For several days, hold **Shift** and select a range.",
          "Click the [[Mark as holiday]] button and, if needed, write the reason (for example, a public holiday).",
          "Confirm.",
        ],
      },
      {
        type: "warn",
        text: "A day off applies to **all groups** in the center: lessons, attendance and the plan are locked for that day, and the day is taken out of the fees (students get an automatic discount).",
      },
      {
        type: "p",
        text: "Remove a day marked by mistake from the list, or select several and click [[Remove selected]]. A day off for just one group is set from the calendar on the group page.",
      },
    ],
  },

  lesson: {
    summary: "Your lesson in progress — attendance, grades and homework in one place.",
    blocks: [
      {
        type: "p",
        text: "As soon as a lesson starts, this page shows that group automatically. If there's no lesson, you'll see **No lesson right now**.",
      },
      { type: "h", text: "During the lesson" },
      {
        type: "steps",
        items: [
          "In the **Attendance** tab, mark each student as **Present**, **Absent** or **Excused**.",
          "In the **Grades** tab, give students who came a grade from 1 to 10.",
          "In the **Homework** tab, write the assignment or click [[Take from syllabus]].",
        ],
      },
      {
        type: "p",
        text: "The **Today's lesson** card at the top shows today's topic from the syllabus. The **Plan** tab is view-only here.",
      },
      {
        type: "warn",
        text: "Attendance can only be marked for today and yesterday — don't put it off after the lesson, because student fees and salaries depend on attendance.",
      },
    ],
  },

  students: {
    summary: "All students, their groups, payments and debt.",
    blocks: [
      { type: "h", text: "Adding a student" },
      {
        type: "steps",
        items: [
          "Click the [[Add student]] button.",
          "Enter the center, group and **Phone number** (required), then the name and the parent's number.",
          "If the number is already in the system, the form suggests that student — don't create a new one, pick the existing one.",
          "The **Price** comes from the subject price; change it if needed. If the student has an earlier debt or prepayment, enter it by month in the **Previous debt** section.",
        ],
      },
      { type: "h", text: "Taking a payment" },
      {
        type: "steps",
        items: [
          "Click the 💵 button in the row (if the student is in several groups, choose the group).",
          "The amount is filled in automatically with the debt. Choose the payment type (Cash / Card / Mixed) and **For which month**.",
          "Save and, if needed, get a receipt with a QR code using [[Download receipt]].",
        ],
      },
      {
        type: "ul",
        items: [
          "Filter by debt, center, group and status. When you type in the search box, the other filters are ignored.",
          "The icons next to the phone number show whether the student and the parent have connected to the Telegram bot.",
          "Debt = all past unpaid months + the current month. No debt is counted in a group that is still being formed.",
        ],
      },
      { type: "h", text: "Student page" },
      {
        type: "p",
        text: "Each group membership has its own card: this month's payment, total debt (by month) and grades. In [[View payments]] you can download a receipt, change a payment's month or cancel a payment.",
      },
      {
        type: "warn",
        text: "[[Archive]] applies only to the membership in one group — the student keeps studying in their other groups. Payments are never deleted: a cancelled payment stays in the history and the amount goes back to debt.",
      },
      {
        type: "tip",
        text: "If a QR card is lost, issue a new one with [[QR card]] → [[Regenerate]]. Importing from Excel is on the group page.",
      },
    ],
  },

  leads: {
    summary: "Potential students interested in a course, and adding them to a group.",
    blocks: [
      { type: "h", text: "Adding a lead" },
      {
        type: "p",
        text: "[[Add lead]] — **Full name**, **Phone**, **Center** and **Subject** are required. Also note convenient days and times, level/age, where they heard about you and a comment — this helps later when forming groups.",
      },
      {
        type: "p",
        text: "The chips at the top show how many leads are waiting for each subject — click a chip to filter by that subject.",
      },
      { type: "h", text: "Statuses" },
      {
        type: "ul",
        items: [
          "**New** → **Contacted** (after a call) → **Enrolled** or **Declined**.",
          "The default filter is **Waiting** — leads not yet added to a group and not declined.",
          "A lead who declined can be brought back with [[Reopen]].",
        ],
      },
      { type: "h", text: "Adding to a group" },
      {
        type: "steps",
        items: [
          "Select leads for one subject and one center.",
          "Choose **New group** (teacher, room, time and start date — the group is activated right away) or **Existing group**.",
          "Confirm — the leads become students and the group page opens.",
        ],
      },
      {
        type: "tip",
        text: "The days of a new group are filled in automatically from the leads' convenient days. A lead who has been added to a group can no longer be edited.",
      },
    ],
  },

  "qr-attendance": {
    summary:
      "The student shows their permanent QR card — attendance is marked automatically.",
    blocks: [
      { type: "h", text: "How it works" },
      {
        type: "steps",
        items: [
          "Click the [[Start the scanner]] button and allow the browser to use the camera.",
          "The student holds their QR card up to the camera.",
          "The result appears on screen: **Attendance marked**, **Marked as present (late)** or **Already marked**.",
          "If the student has lessons in several groups today, pick the right group in the [[Choose a group]] window.",
        ],
      },
      { type: "h", text: "What's on the screen" },
      {
        type: "ul",
        items: [
          "The cards at the top count scans in this session: **Total scans**, **Present**, **Late**, **Error**.",
          "The [[Today's scans]] strip shows the last 20 scans: name, subject, time and method (Camera or Scanner).",
          "The system itself checks lateness, the lesson day and group membership.",
        ],
      },
      {
        type: "tip",
        text: "A USB or Bluetooth **barcode scanner** works on any page — you don't need to keep this page open. The result appears as a message in the corner of the screen.",
      },
      {
        type: "warn",
        text: "If a card is lost, create a new QR on the student or group page via [[QR card]] → [[Regenerate]]. The old printed card stops working immediately.",
      },
      {
        type: "p",
        text: "If the same card is scanned again within 3 seconds, the repeat scan is not counted.",
      },
    ],
  },

  salary: {
    summary:
      "Staff salaries in real time: accrued amount, money paid out, bonuses, penalties and the balance.",
    blocks: [
      { type: "h", text: "Reading the table" },
      {
        type: "ul",
        items: [
          "**Type** — a fixed salary or a percentage (for example 10%).",
          "**Accrued salary** — the amount accrued for the current month. For percentage-based staff it changes with student payments.",
          "**Paid out** — the total of advances and money taken upfront.",
          "**Remaining** = accrued salary − advance − taken upfront + bonus − penalty. A negative amount is shown in red.",
        ],
      },
      {
        type: "p",
        text: "At the top, choose the month and (if you have several centers) the center. You can't pick a future month.",
      },
      { type: "h", text: "Paying money or recording a penalty" },
      {
        type: "steps",
        items: [
          "In the staff member's row menu, choose [[Payment/Penalty]].",
          "Choose the transaction type: **Advance**, **Upfront withdrawal**, **Bonus** or **Penalty**.",
          "Enter the amount and, if needed, a comment, then click [[Add]].",
        ],
      },
      {
        type: "p",
        text: "The [[Transactions]] menu shows all of the staff member's records for this month. You can cancel a wrong record from there.",
      },
      {
        type: "warn",
        text: "Transactions are never deleted — they are only cancelled and stay crossed out in the history. **An advance that has been paid out cannot be cancelled**, because the money has already been handed over.",
      },
      {
        type: "tip",
        text: "Percentage-based managers and receptionists get a percentage of all payments, while teachers get it only from their own groups. The Advance and Bonus types appear if your plan includes them.",
      },
    ],
  },

  expenses: {
    summary: "Your center's monthly expenses: rent, utilities, equipment, marketing and more.",
    blocks: [
      { type: "h", text: "Adding an expense" },
      {
        type: "steps",
        items: [
          "Click the [[Add expense]] button.",
          "If you have several centers, choose the center (with just one it's set automatically).",
          "Enter the **Name** and **Amount**, and choose a category (the default is Other).",
          "Click [[Create]].",
        ],
      },
      { type: "h", text: "Viewing and filtering" },
      {
        type: "ul",
        items: [
          "Move between months with the month navigator — the current month is shown by default.",
          "Filter by search, center and category. The **Total** card shows the sum of the filtered results.",
          "You can download the list to Excel.",
        ],
      },
      {
        type: "warn",
        text: "Expenses are never deleted — you can only [[Cancel]] them. A cancelled record stays crossed out in the list and can no longer be edited.",
      },
      {
        type: "p",
        text: "The center can't be changed when editing — if the wrong center was chosen, cancel the record and enter a new one.",
      },
    ],
  },

  revenue: {
    summary: "All student payments received, and who collected each one.",
    blocks: [
      {
        type: "p",
        text: "This page is for the **Owner** only. The list updates itself as soon as a payment is taken at the front desk.",
      },
      { type: "h", text: "What you'll see" },
      {
        type: "ul",
        items: [
          "At the top: **Total revenue**, the number of **Transactions** and the **Average payment** — for the filtered results.",
          "For each payment: student, center, amount, payment type, which month it's for, who collected it and the date.",
          "Click a student's name to open their page.",
        ],
      },
      {
        type: "p",
        text: "Filter by date range, center, payment type (Cash / Card / Mixed) and **Collected by** — for example, to check each receptionist's cash at the end of the day.",
      },
      {
        type: "warn",
        text: "Only records with the **Paid** status count toward revenue. Cancelled and refunded payments stay crossed out in the list but are not included in the total.",
      },
      {
        type: "p",
        text: "If older payments have no collector information, they are shown as **Unknown**.",
      },
    ],
  },

  reports: {
    summary:
      "Reports for a chosen period on your center's finances, students, teachers and attendance.",
    blocks: [
      { type: "h", text: "Choosing the period" },
      {
        type: "p",
        text: "Choose [[Today]], [[Week]], [[Month]] or [[Range]]. For Range, set the date range. You can also choose the center and the grouping (Daily / Weekly / Monthly).",
      },
      { type: "h", text: "Key figures" },
      {
        type: "ul",
        items: [
          "**Revenue**, **Expenses**, **Net profit** — with the percentage change compared to the previous period.",
          "**Debt** — doesn't depend on the period; it always shows the current state.",
          "New and departed students, active groups, attendance and salaries paid out.",
          "In the **Trend** chart you can turn the revenue, expense and profit lines on and off separately.",
        ],
      },
      { type: "h", text: "Tabs" },
      {
        type: "ul",
        items: [
          "**Centers** — students, revenue, expenses, profit and debt for each center.",
          "**Teachers** — lessons, attendance, revenue and salary.",
          "**Collectors** — who collected how much money (cash/card). Handy when closing the till.",
          "**Groups** — revenue, debt, attendance and syllabus progress.",
          "**Debtors** — who owes, for which months and how much.",
          "**Attendance** — shares of present/absent/excused, groups with low attendance and students who miss the most.",
        ],
      },
      {
        type: "tip",
        text: "Every tab can be downloaded to Excel. Some tabs appear depending on your plan.",
      },
    ],
  },

  "reports/teacher-performance": {
    summary: "Teacher performance: groups, lessons, attendance, revenue and salary.",
    blocks: [
      {
        type: "p",
        text: "Choose the period ([[Today]] / [[Week]] / [[Month]] / [[Range]]) and the center — the table shows the results for each teacher.",
      },
      {
        type: "ul",
        items: [
          "**Groups** and **Students** — how many are assigned to the teacher.",
          "**Lessons held** — lessons in the period with attendance marked.",
          "**Attendance** — the students' attendance rate.",
          "**Revenue** and **Salary** — the money the teacher's groups brought in and the salary accrued to them.",
        ],
      },
      {
        type: "tip",
        text: "Compare the columns to quickly spot teachers with low attendance or few lessons. The page is available with the **Performance** feature of your plan.",
      },
    ],
  },

  "audit-log": {
    summary: "Who did what, and when — the history of every change in your center.",
    blocks: [
      {
        type: "p",
        text: "The audit log is for the **Owner** only — this permission can't be given to staff. Records can't be edited or deleted.",
      },
      { type: "h", text: "Searching" },
      {
        type: "ul",
        items: [
          "Filter by center, **Who** (staff member), **Action** type (for example, Student archived, Plan downgraded) and date range.",
          "Each row shows: who (Owner / Staff / Admin / System), the action, the object, the center and the date.",
        ],
      },
      { type: "h", text: "Details" },
      {
        type: "p",
        text: "The details button in a row opens the **Change details** window: it shows the **Before** and **After** values for each field.",
      },
      {
        type: "tip",
        text: "New records appear at the top of the list in real time — on page 1 with no filters applied.",
      },
    ],
  },

  subscription: {
    summary: "Your plan, days remaining, plan features and extending your subscription.",
    blocks: [
      {
        type: "p",
        text: "The banner at the top shows your current plan, the **days remaining** and the end date. A warning appears when 2 days or fewer are left.",
      },
      { type: "h", text: "Subscribing or extending" },
      {
        type: "steps",
        items: [
          "On the plan card you want, click [[Subscribe]] (on your current plan — [[Extend]]).",
          "Choose the period: 1, 3, 6, 9 months or 1 year — longer periods get a discount.",
          "Click [[Proceed to payment]] and pay on the payment page.",
          "When you come back, the result is checked automatically and the plan is activated.",
        ],
      },
      {
        type: "p",
        text: "Each plan card lists its limits (centers, teachers, receptionists, students) and its **Features**. If there's a free trial, it's given only once.",
      },
      {
        type: "warn",
        text: "When your subscription expires, the system switches to **read-only** mode: you can view data, but adding, editing and deleting are blocked. Everything comes back right after payment.",
      },
      { type: "h", text: "Downgrading your plan" },
      {
        type: "p",
        text: "If the new plan allows fewer centers, a window appears asking which centers stay active. The rest are **blocked, but not deleted** — they are reactivated if you upgrade your plan.",
      },
    ],
  },

  notifications: {
    summary: "System notifications, platform news and Telegram alerts.",
    blocks: [
      { type: "h", text: "Tabs" },
      {
        type: "ul",
        items: [
          "**Notifications** — lesson reminders and subscription expiry warnings. Clicking one marks it as read; ones about a group open the group page.",
          "**News** — new platform features and important announcements.",
          "The [[Unread]] filter and the [[Mark all as read]] button keep the list tidy.",
        ],
      },
      { type: "h", text: "Connecting Telegram" },
      {
        type: "steps",
        items: [
          "Click the [[Connect Telegram]] button — the bot opens.",
          "Press **Start** in Telegram.",
          "Come back to the page: the status becomes **Connected**. If needed, choose the **Message language**.",
        ],
      },
      {
        type: "p",
        text: "Every morning the owner gets the list of today's lessons, and after lessons an attendance and revenue report. Receptionists get the same report without financial data, and teachers get their own lessons plus a reminder 1 hour before each lesson starts.",
      },
      {
        type: "tip",
        text: "The Telegram card appears if your plan includes **Telegram notifications**. You can stop the messages with the [[Disconnect]] button.",
      },
    ],
  },

  profile: {
    summary: "Your personal details and changing your password.",
    blocks: [
      {
        type: "p",
        text: "In the **Personal details** section, edit your name and click [[Save]].",
      },
      { type: "h", text: "Changing your password" },
      {
        type: "steps",
        items: [
          "Enter your **Current password**.",
          "Enter the **New password**.",
          "Click [[Save]] — the new password is used the next time you sign in.",
        ],
      },
      {
        type: "warn",
        text: "Both fields must be filled in to change the password. If you've forgotten your current password, write to the support chat.",
      },
    ],
  },

  "profile.staff": {
    summary: "Personal details, password, Telegram connection and interface language.",
    blocks: [
      {
        type: "ul",
        items: [
          "**Personal details** — change your name and password, then click [[Save]].",
          "**Telegram** card — connect or disconnect the bot and choose the message language (if your plan allows it).",
          "**Interface language** — choose which language the app is shown in.",
        ],
      },
      {
        type: "p",
        text: "To change your password, enter your current and new password together.",
      },
      {
        type: "tip",
        text: "Your salary and transaction history are in the separate [[Finance]] section.",
      },
    ],
  },

  finance: {
    summary: "Your salary and transaction history — view only.",
    blocks: [
      { type: "h", text: "My salary" },
      {
        type: "ul",
        items: [
          "Choose the month you need with the month navigator.",
          "**Accrued salary** — the amount accrued for this month. If you're paid a percentage, it changes in real time with student payments.",
          "**Bonus**, **Advance**, **Taken upfront** and **Penalty** are shown separately.",
          "**Remaining** — the amount still to be paid to you.",
        ],
      },
      { type: "h", text: "My transactions" },
      {
        type: "p",
        text: "Every advance, upfront withdrawal, bonus and penalty for the selected month — with its amount and date. Cancelled ones appear faded and crossed out.",
      },
      {
        type: "tip",
        text: "To hide the amounts from others, click the eye button on the home page.",
      },
      {
        type: "p",
        text: "If you notice a mistake, contact management — nothing can be changed on this page.",
      },
    ],
  },

  certificates: {
    summary: "Create certificate templates and give students certificates that can be verified by QR.",
    blocks: [
      { type: "h", text: "Creating a template" },
      {
        type: "steps",
        items: [
          "Click the [[New template]] button.",
          "Write the **Template name** (for example, Math course diploma) and upload a background image (PNG/JPG, A4 proportions).",
          "Use [[Add element]] to add **Student name**, **Subject name**, **Group name**, **Issue date**, **QR code** and free **Text**.",
          "Drag elements into place and resize them by pulling a corner; set the size, color, font and alignment in the right panel.",
          "Save.",
        ],
      },
      {
        type: "p",
        text: "Check how the certificate will look in [[Preview]] mode. Each center can have at most **10** templates.",
      },
      { type: "h", text: "Issuing a certificate" },
      {
        type: "p",
        text: "Certificates are issued not on this page but on the **Student** or **Group** page, with the [[Issue certificate]] button. Choose the template and the group — the PDF downloads automatically. When issued to a group, every active student gets one.",
      },
      {
        type: "tip",
        text: "Anyone can scan the QR code on the certificate with their phone to check that it's genuine — no login required.",
      },
    ],
  },

  archive: {
    summary: "Archived groups, students, staff, rooms and subjects — view and restore them.",
    blocks: [
      {
        type: "p",
        text: "In the system, **deleting = archiving**: nothing is lost for good. Archived records are kept here and can be put back with the [[Restore]] button.",
      },
      { type: "h", text: "How students are archived" },
      {
        type: "ul",
        items: [
          "A student is not archived entirely — **only their membership in one group** is archived; they keep studying in their other groups.",
          "When a group is archived, its students move to the archive marked **With group** and come back together when the group is restored.",
          "Students archived manually (**Individually**) stay in the archive when the group is restored.",
        ],
      },
      {
        type: "warn",
        text: "While a group is still archived, you can't restore a student from it — restore the group first. If the group's old room or time has been taken in the meantime, a window opens for choosing a new schedule.",
      },
      { type: "h", text: "Debt" },
      {
        type: "p",
        text: "The **Debt in archive** card shows the debt of archived memberships. This amount is **not included** in the total debt on the Dashboard and in reports. Payments already received stay unchanged in revenue.",
      },
      {
        type: "tip",
        text: "An archived staff member can't sign in, but their salary history is kept. Only the owner can see the Staff tab.",
      },
    ],
  },
};
