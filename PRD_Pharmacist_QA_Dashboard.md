# PRD — Pharmacist QA Error Dashboard
**نوع المشروع:** لوحة تحليلات ويب (Web Analytics Dashboard) — بديل لتقرير Power BI الحالي
**الحالة:** جاهز للتنفيذ بواسطة Claude Code
**الإصدار:** v1.0

---

## 1. الخلفية والمشكلة

فيه ملف Excel (`ERROR.xlsx`) بيتحدث كل فترة، وفيه Sheet ثاني بيسجل أخطاء الصيادلة أثناء مراجعة ملفات المرضى (QA Log)، وموجود حاليًا تقرير Power BI (`27-6.pbix`) بيحلل الداتا دي على 3 صفحات:

1. **Overview**: كروت (Total Patients, Total Issues, Error Rate per 100 Patients, Avg Severity, Most Common Issue) + Line Chart لمعدل الأخطاء عبر الوقت + Donut لتوزيع الأخطاء على الصيادلة.
2. **Pharmacist Comparison**: مقارنة معدل خطأ كل صيدلي + عدد المرضى مقابل عدد الأخطاء + توزيع أنواع الأخطاء.
3. **Issue Analysis**: تحليل أنواع الأخطاء بالتفصيل مع فلاتر (يوم / صيدلي / نوع خطأ).

**الهدف:** بناء نفس الفكرة كتطبيق ويب متصل بـ Supabase، بتصميم أحدث وأفخم (Dark theme)، مع القدرة على استيراد ملفات Excel جديدة دوريًا بدل ما المدير يفتح Power BI.

---

## 2. نطاق المشروع (Scope) — v1

| ضمن النطاق | خارج النطاق (مستقبلاً) |
|---|---|
| لوحة تحليلات (View only) | فورم إدخال يدوي للأخطاء |
| رفع ملف Excel واستيراد تلقائي | تسجيل دخول متعدد المستخدمين/صلاحيات |
| Admin واحد بباسورد بسيط | ربط السكور بمكافآت/خصومات (Payroll) |
| استيراد الداتا التاريخية دفعة واحدة | تصدير تقارير PDF/Excel |
| Append-only (كل رفعة تُضاف فوق القديم) | Dedup / تحديث الصفوف المكررة |

---

## 3. المستخدمون

- **مستخدم واحد فقط (Admin/QA Lead)**، بدخول عبر **باسورد واحد مشترك** يحمي كل الموقع (مفيش نظام مستخدمين متعدد في v1).

---

## 4. مصادر الداتا وهيكلها

الملف اللي هيترفع كل فترة هو نفس هيكل `ERROR.xlsx` بالظبط: **Sheet واحد فيه Sheet1 لعدد المرضى، وSheet2 فيه لوج الأخطاء**. الأعمدة ثابتة دايمًا بنفس الترتيب.

### Sheet1 — عدد المرضى اليومي
| العمود | النوع | ملاحظات |
|---|---|---|
| DAY | Excel serial date (رقم صحيح، مثال: 46186) | لازم يتحول لـ Date حقيقي عند الاستيراد (`Excel epoch = 1899-12-30`) |
| NO OF PATIENT | Integer | ممكن يكون فاضي في آخر صفوف (يتجاهل لو فاضي) |

### Sheet2 — لوج الأخطاء
| العمود | النوع | ملاحظات |
|---|---|---|
| PHARMACIST NAME | Text | **الأسماء مش موحّدة** — لازم Mapping ثابت (جدول تحت) قبل التخزين عشان الصيدلي متتعدش مرتين |
| DAY | Excel serial date | نفس تحويل التاريخ |
| ID | Patient ID (رقم) | مش لازم يكون Unique — نفس المريض ممكن يتكرر لأخطاء مختلفة |
| ISSUE | Text (نوع الخطأ) | 11 نوع ظاهرين حاليًا في الداتا (مش Enum ثابت — استقبل أي نص جديد بمرونة) |
| SCORE | Integer (10 أو 20) | **ده مش ثابت لكل نوع خطأ** — لوحظ إن نفس نوع الخطأ ("wrong tag the patient") ظهر بـ 10 وبـ 20 في صفوف مختلفة. خزّن السكور زي ما هو مكتوب في كل صف، متحسبوش تلقائي بناءً على نوع الخطأ |
| ISSUE IN DETAILS | Text (طويل) | تفاصيل حرة |

### جدول توحيد أسماء الصيادلة (Pharmacist Name Mapping) — ثابت، الفريق 6 أشخاص بس

أي اسم بييجي في الملف يتقارن (trim + lowercase) مع العمود "الاسم الخام" تحت، ولو طابق يتحول لـ "الاسم الرسمي":

| الاسم الرسمي (يتخزن في الداتابيز) | الأسماء الخام المحتملة في الإكسيل (case-insensitive) |
|---|---|
| Aya Wahba | Aya Wahba, aya Wahba |
| Dina Raid | Dina Raid, Dina raid |
| Kholoud Elkholy | Kholoud Elkholy, kholoud Elkholy |
| Mohamed Nour | Mohamed Nour |
| Nadine | Nadine, nadine |
| Samaa Ahmed | Samaa Ahmed |

> القائمة دي **ثابتة (Hardcoded/Seed data)** في النظام — مش لازم مابينج ديناميكي. لو ظهر اسم صيدلي سابع مستقبلًا مش موجود في القائمة، النظام يضيفه زي ما هو (Title Case) ويظهر تنبيه في نتيجة الرفع "اسم صيدلي جديد مش في القائمة المعروفة: X — تأكد إنه مش خطأ كتابة".

### توحيد أنواع الأخطاء (Issue Type Normalization)

نفس المنطق: قبل التخزين، يتعمل `trim()` + `lowercase()` لعمود `ISSUE` للمقارنة والتجميع في كل الرسوم والفلاتر (عشان "missing to tag the patient" و"missing to Tag the patient" يتحسبوا نوع واحد). **الاسم المعروض في الواجهة** يكون بصيغة Title Case موحدة (مش بالضرورة نفس الحروف الأصلية من الإكسيل). ملف الأنواع مش Enum مغلق — أي نوع جديد بييجي في الإكسيل يتضاف تلقائي كنوع جديد بعد التطبيع، من غير ما يحتاج تعديل كود.

---

## 5. Data Model (Supabase / Postgres)

```sql
-- جدول عدد المرضى اليومي
create table daily_patients (
  id bigint generated always as identity primary key,
  day date not null,
  patient_count int not null,
  source_file text,          -- اسم ملف الإكسيل اللي اترفع منه
  uploaded_at timestamptz default now()
);

-- جدول أخطاء الصيادلة
create table qa_errors (
  id bigint generated always as identity primary key,
  pharmacist_name text not null,       -- بعد التطبيع (trim + title case)
  pharmacist_name_raw text,            -- الاسم الأصلي زي ما جه في الملف (للتتبع)
  day date not null,
  patient_id text not null,
  issue_type text not null,
  score int not null,
  issue_details text,
  source_file text,
  uploaded_at timestamptz default now()
);

-- لوج كل عملية رفع ملف (audit trail)
create table upload_batches (
  id bigint generated always as identity primary key,
  file_name text not null,
  rows_patients_inserted int,
  rows_errors_inserted int,
  uploaded_at timestamptz default now(),
  status text default 'success'  -- success | failed | partial
);
```

> فعّل Row Level Security بسيط: الوصول للقراءة/الكتابة بس عبر مفتاح الـ service role من السيرفر (مفيش وصول مباشر للـ client غير الـ authenticated session).

---

## 6. آلية الرفع والاستيراد

1. صفحة **"Upload Data"** فيها زرار رفع ملف `.xlsx` واحد.
2. السيرفر (API route) بيقرأ الملف بـ library زي `xlsx`/`exceljs`:
   - **Sheet1** → يحول عمود `DAY` من serial number لـ Date → يدخل صف في `daily_patients` لكل يوم.
   - **Sheet2** → يحول `DAY` لـ Date، يطبّع `PHARMACIST NAME`، ويدخل صف في `qa_errors` لكل سطر.
3. **Append-only**: كل الصفوف بتتضاف زي ما هي، من غير فحص تكرار أو حذف قديم (القرار اللي اتاخد).
4. لازم **Validation** قبل الإدخال: لو عمود أساسي فاضي (DAY, ISSUE, SCORE) في Sheet2 → يترفض السطر ده بس ويكمل الباقي، ويظهر تقرير في الآخر: "تم إدخال X صف، اترفض Y صف مع الأسباب".
5. بعد كل رفعة ناجحة، يتسجل صف في `upload_batches` ويظهر Toast/رسالة تأكيد.
6. **الرفعة الأولى (Import التاريخي)**: نفس الآلية بالظبط، تُستخدم لرفع `ERROR.xlsx` الحالي كأول Batch.

---

## 7. المقاييس (Metrics) المطلوب حسابها

| المقياس | الصيغة |
|---|---|
| Total Patients | `SUM(daily_patients.patient_count)` ضمن الفترة المختارة |
| Total Issues | `COUNT(qa_errors.id)` ضمن الفترة المختارة |
| Error Rate per 100 Patients | `(Total Issues / Total Patients) * 100` |
| Avg Severity | `AVG(qa_errors.score)` |
| Most Common Issue | `issue_type` بأعلى `COUNT` |
| Issue Type % | نسبة كل `issue_type` من إجمالي الأخطاء |
| Pharmacist Error Rate per 100 Patients | لكل صيدلي: `(عدد أخطائه / Total Patients في نفس الفترة) * 100` |

كل المقاييس دي لازم تتحسب **Dynamically** حسب الفلاتر المختارة (مش أرقام ثابتة).

---

## 8. الصفحات والتصميم

**التصميم العام:** Dark theme فخم، شكل SaaS حديث (زي Linear / Vercel Dashboard) — كروت بحواف ناعمة، ألوان مميزة للـ accent (مثلاً بنفسجي/سماوي متوهج فوق خلفية غامقة)، مش ألوان Power BI الافتراضية.

**لغة الواجهة:** إنجليزي بالكامل (كل العناوين، الكروت، القوائم، الفلاتر — Total Patients, Error Rate per 100 Patients, إلخ). البيانات الخام نفسها (أسماء صيادلة، تفاصيل الأخطاء) تتعرض زي ما هي.

### Global Controls (ظاهرة في كل الصفحات)
- **Toggle** لتجميع الداتا: **يومي / أسبوعي / شهري**
- فلتر نطاق تاريخ (Date range)
- فلتر صيدلي (Multi-select)
- فلتر نوع خطأ (Multi-select)

### صفحة 1 — Overview
- كروت: Total Patients, Total Issues, Error Rate per 100 Patients, Avg Severity, Most Common Issue
- Line Chart: Error Rate عبر الوقت (يستجيب لتوجل يومي/أسبوعي/شهري)
- Donut Chart: توزيع الأخطاء على الصيادلة

### صفحة 2 — Pharmacist Comparison
- Combo Chart: عدد المرضى مقابل عدد الأخطاء عبر الوقت
- Bar Chart: معدل خطأ كل صيدلي (Leaderboard - الأسوأ للأفضل)
- Donut: توزيع الأخطاء على الصيادلة
- Bar Chart: توزيع أنواع الأخطاء

### صفحة 3 — Issue Analysis
- Bar Chart: عدد كل نوع خطأ
- Line Chart: تطور معدل الأخطاء + نسبة كل نوع عبر الوقت

### صفحة 4 — Upload Data
- رفع ملف Excel + عرض نتيجة آخر عملية رفع + سجل بكل الرفعات السابقة (`upload_batches`)

---

## 9. المصادقة (Auth)

- شاشة Login بسيطة: **باسورد واحد** (Env variable على السيرفر)، بعد الدخول يتحط Session Cookie.
- كل الصفحات محمية، غير صفحة الـ Login.
- مفيش نظام مستخدمين متعدد أو صلاحيات في v1.

---

## 10. Tech Stack المقترح

| الطبقة | الاختيار |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Charts | Recharts أو Chart.js |
| Backend/DB | Supabase (Postgres + Storage لو احتجنا نخزن نسخة من الملفات المرفوعة) |
| Excel Parsing | `xlsx` (SheetJS) على السيرفر |
| Hosting | Vercel |
| Auth | Simple password + HTTP-only session cookie (مش Supabase Auth كامل، لأنه مستخدم واحد بس) |

---

## 11. حالات حرجة لازم تتغطى (Edge Cases)

1. أسماء الصيادلة بحروف مختلفة (Aya Wahba / aya Wahba) → تتوحد عبر جدول الـ Mapping الثابت (قسم 4) — النتيجة النهائية 6 صيادلة بالظبط، مش 10.
2. صفوف فاضية في نهاية Sheet1 (زي `46202`, `46203` من غير عدد مرضى) → تتجاهل.
3. أنواع أخطاء جديدة لسه ما ظهرتش في الداتا الحالية → النظام يستقبلها تلقائي من غير Hardcoding لقائمة الأنواع.
4. رفع نفس الملف مرتين بالغلط → هيتضاعف العدد (مقبول في v1 لأن القرار Append-only، بس يتعرض تحذير بسيط "الملف ده اسمه اترفع قبل كده، متأكد؟").
5. تحويل تاريخ Excel الصحيح (`serial - 25569` أيام من 1970-01-01، أو استخدام مكتبة `xlsx` اللي بتحوله جاهز).

---

## 12. معايير القبول (Acceptance Criteria)

- [ ] رفع `ERROR.xlsx` الحالي بنجاح ويظهر نفس الأرقام تقريبًا زي الـ PBI الحالي (Total Patients, Total Issues).
- [ ] كل الصيادلة الـ 6 (مش 10 بسبب اختلاف الحروف) ظاهرين موحدين.
- [ ] الفلاتر (يوم/صيدلي/نوع خطأ) شغالة وبتأثر على كل الكروت والرسومات لحظيًا.
- [ ] Toggle يومي/أسبوعي/شهري شغال على كل الـ Line/Combo Charts.
- [ ] رفع ملف جديد بيضيف بيانات من غير ما يمسح القديم.
- [ ] الموقع محمي بباسورد ومفيش وصول من غير تسجيل دخول.
- [ ] التصميم Dark theme متجاوب (Responsive) على الموبايل والديسكتوب.

---

## 13. للمرحلة القادمة (Roadmap — مش في v1)

- Export تقارير PDF/Excel
- فورم إدخال يدوي للأخطاء
- نظام مستخدمين متعدد بصلاحيات
- ربط السكور بمكافآت/خصومات
- Dedup ذكي عند رفع صف مكرر
