# Waseet — Claude Project Instructions

## قبل أي عمل على قاعدة البيانات (إلزامي)
قبل تعديل/إنشاء أي **migration أو دالة SQL أو trigger أو cron**، أو كتابة كود يُدرج في Supabase:
1. **اقرأ ملف الدروس المستفادة**: [docs/LESSONS_LEARNED.md](docs/LESSONS_LEARNED.md) (ونسخة العمل الحيّة في ذاكرة المساعد `lessons_learned.md`) — يحتوي 22 درساً من أخطاء متكرّرة حقيقية يجب عدم تكرارها.
2. **اقرأ تعريف `CREATE TABLE` الفعلي** للأعمدة/الـ enums قبل الإشارة إليها (لا تخمّن).
3. عند `CREATE OR REPLACE` لدالة موجودة: ابحث عن **كل** تعريفاتها السابقة وانسخ من **أحدث نسخة سليمة**، لا من الأصل (تفادياً للـ regression — حدث فعلاً في migration 093).

## حقائق سكيمة حرجة
- `providers.id` = `users.id` (FK). أعمدة **city / full_name / phone / email / avatar_url / role / phone_verified** على **`users` فقط** — وليست على `providers`. للوصول لمدينة المزوّد: `JOIN users u ON u.id = p.id`.
- في supabase-js v2 **لا يوجد `.catch` على الـ query builder** → استخدم `.then(()=>{}).catch(()=>{})` لا `.insert(...).catch()`.

## الفحص الوقائي
- أخطاء SQL (عمود ناقص، صلاحية، نوع) **لا يلتقطها tsc/Metro** — تظهر وقت التشغيل فقط. افحص `cron.job_run_details` للحالة الحيّة.
- triggers الإشعارات مغلّفة بـ EXCEPTION (migration 105) → تبتلع الأخطاء بصمت. راقب جدول `notifications` للتأكد أنها تعمل.

## قواعد عمل عامة
- **لا تعديل/إصلاح/نشر على Production قبل موافقة صريحة** (Supabase, Vercel, Google Play, main). شخّص → اقترح → توقّف وانتظر → نفّذ.
- **لا دمج مباشر في main** — دائماً عبر PR.
- شغّل `tsc` + Metro bundle export قبل أي commit يمسّ تطبيق الموبايل (صفر أخطاء جديدة).
- أضِف حالات الاختبار الجديدة إلى `QA_Test_Cases_Report.md` في جذر المشروع.
