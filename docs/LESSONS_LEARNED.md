# الدروس المستفادة — Waseet

دروس تقنية حقيقية اكتُشفت أثناء تطوير وإطلاق المشروع. هذا الملف **مرجع دائم** — أضِف أي درس جديد هنا عند اكتشافه.

> ملاحظة: تُحفَظ نسخة عمل حيّة من هذه الدروس في ذاكرة المساعد المحلية أيضاً؛ هذه النسخة في المستودع هي المرجع الرسمي المُتحكَّم بإصداره.

---

## 1. regression عند `CREATE OR REPLACE` لدالة
093 «أصلح» نافذة الـ7 أيام لكنه نسخ دالة `renotify_providers_for_stale_requests` من **046 القديمة** (لا من **088** التي كانت أصلحت bug الـ`p.city`) → أعاد الخطأ. أُصلح أخيراً في 107.
**القاعدة:** عند إعادة تعريف دالة، انسخ من **أحدث نسخة سليمة** في سلسلة الـ migrations، لا من الأصل. ابحث عن كل تعريفات الدالة قبل تعديلها.

## 2. أعمدة `users` لا توجد على `providers`
`providers.id` يشير إلى `users.id`، لكن **city / full_name / phone / email / avatar_url / role / phone_verified** كلها على **`users`** فقط. أي `providers.<عمود مستخدم>` أو `p.city` = خطأ runtime «column does not exist». للحصول على مدينة المزوّد: `JOIN users u ON u.id = p.id`.

## 3. `.insert().catch()` في supabase-js v2 = TypeError صامت
لا يوجد `.catch` على الـ query builder في v2 → استثناء قبل الإدراج. الصواب: `.then(()=>{}).catch(()=>{})`. (أدخله commit f28e265، عطّل 6 دوال إشعارات أسابيع).

## 4. صلاحيات service_role (SQLSTATE 42501)
كان service_role يفتقر لصلاحيات DML على جداول public → كل عمليات السيرفر تفشل بصمت. أُصلح في 106 (+ ALTER DEFAULT PRIVILEGES). تحقّق من الـ grants بعد أي migration كبير.

## 5. EXCEPTION في triggers يُخفي الأعطال
migration 105 يغلّف notification triggers بـ `EXCEPTION WHEN OTHERS THEN NULL` (لحماية حفظ الطلب من فشل الإشعار). مفيد للأمان لكنه **يبتلع الأخطاء بصمت**. راقب جدول `notifications` دورياً للتأكد أن الـ triggers تعمل فعلاً (`SELECT type, COUNT(*), MAX(created_at) FROM notifications GROUP BY type`).

## 6. أخطاء SQL لا يلتقطها tsc/Metro
دوال/triggers/cron قد تفشل فقط **وقت التشغيل** (عمود ناقص، صلاحية، نوع). الفحص الوقائي عبر `cron.job_run_details` ضروري قبل/بعد الإطلاق:
```sql
SELECT j.jobname, d.status, LEFT(d.return_message,120), d.start_time
FROM cron.job j LEFT JOIN LATERAL (
  SELECT status, return_message, start_time FROM cron.job_run_details
  WHERE jobid=j.jobid ORDER BY start_time DESC LIMIT 1) d ON true
ORDER BY (d.status='failed') DESC NULLS LAST;
```

## 7. الفحص الحيّ > الفحص الثابت
حالة Production الفعلية أصدق من قراءة الـ migrations (التي تُنسَخ/تُستبدَل عبر الإصدارات). عند تشخيص أي مشكلة، اقرأ الحالة الحيّة (`cron.job_run_details`، الجداول، الدوال الفعلية) لا الـ migration وحده.

## 8. درس QA — افحص الأثر لا الإجراء
كانت اختبارات الإشعارات تفحص «هل نجح الاستدعاء؟» لا «هل وصل الإشعار فعلاً؟». أُضيفت حالات NOTIF-DELIVERY تتحقق من صف فعلي في `notifications`. **القاعدة:** اختبر النتيجة النهائية المرئية، لا مجرد عدم رمي استثناء.

## 9. أسرار / keystore داخل مجلد المستودع = خطر أمني
وُضع مجلد فيه `waseet-release.jks` + مفتاح Firebase Admin SDK + base64 للأسرار **داخل** مجلد المشروع، فظهر في Source Control. لو حدث commit لتسرّبت في تاريخ git للأبد (لا يُمحى بحذف لاحق). **القاعدة:** لا تضع أبداً keystore / service-account keys / أسرار داخل مجلد المستودع — أبقها خارجه أو في `.gitignore`. الـ keystore **لا يُعوَّض**: فقدانه = عجز دائم عن تحديث التطبيق؛ احتفظ بنسخة احتياطية مشفّرة.

## 10. لا تفترض أن خطوة "Publishing" في CI ترفع للمتجر
workflow اسمه «Android Production → Google Play» لكنه فعلياً **أرسل الـ AAB بالبريد فقط** — لا يوجد بلوك `google_play` في codemagic.yaml، فاضطُررنا للرفع اليدوي. **القاعدة:** تحقّق مما تفعله خطوة النشر فعلياً (artifact مقابل store upload) من ملف الـ CI نفسه، لا من اسم الـ workflow.

## 11. أحرف Unicode خفية (RTL) تُفسد الحقول النصّية المنظّمة
عند كتابة العربية في Release notes بـ Google Play، تسرّب حرف `U+200F` (RTL mark) غير مرئي وكسر وسم `<en-US>` **حتى بعد حذف العربية المرئية** (خطأ «tag not closed / repeated» غامض). **القاعدة:** في الحقول المعتمِدة على وسوم/صيغة (release notes, JSON, ...)، إن ظهر خطأ صيغة غامض بعد إدخال نص ثنائي الاتجاه — **امسح الحقل بالكامل وأعد الكتابة يدوياً** (لا تكتفِ بحذف الجزء المرئي، ولا تلصق).

## ملاحظات تشغيلية لـ Google Play (مرجع سريع)
- **«opted-in» ≠ «installed»**: عدّاد المختبِرين يحتسب نقر «Become a tester» فقط؛ التثبيت + الـ push token يتطلّبان (تثبيت + دخول + قبول إذن الإشعارات) — لذا `push_tokens` < عدد المنضمّين عادةً.
- **«Shared» (Data Safety) ≠ «share with other users» (Content Rating)**: تعريفان مختلفان — الموقع «غير مُشارَك» مع أطراف ثالثة (Data Safety) لكنه «يُشارَك بين المستخدمين» في الدردشة (Rating). الإجابتان متّسقتان رغم تعارضهما الظاهري.

## 12. `ALTER DATABASE SET` و`ALTER ROLE SET` محجوبان على Supabase المستضاف
محاولة ضبط معاملات `app.settings.*` عبر `ALTER DATABASE postgres SET` أو `ALTER ROLE postgres SET` — سواء من SQL Editor أو عبر `supabase db query --linked` — تفشل بخطأ **42501 permission denied** على Supabase Hosted. الحل الوحيد: إنشاء جدول `_waseet_config` محمي + دالة getter بـ `SECURITY DEFINER` تقرأ منه، وتحديث كل دوال الـ cron لاستخدامها (تم في migration 103).
**القاعدة:** لا تحاول `ALTER DATABASE/ROLE SET` على Supabase Hosted — استخدم جدول config بديلاً.

## 13. ملفا migration بنفس الرقم البادئ يُفشل `db push`
وُجد `100_fix_duplicate_cron_job.sql` و`100_realtime_missing_tables.sql` معاً، فأخفق `db push` بخطأ: *"duplicate key value violates unique constraint schema_migrations_pkey"* بعد تطبيق الأول. الحل: إعادة تسمية الملفات قبل الدفع.
**القاعدة:** قبل كل `supabase db push` تحقّق من عدم تكرار الأرقام البادئة بـ: `ls supabase/migrations/ | cut -d_ -f1 | sort | uniq -d` — أي رقم يظهر = تعارض يجب حله أولاً.

## 14. أوامر Supabase CLI خاطئة شائعة (مرجع سريع)
| الخطأ | الصواب |
|-------|--------|
| `supabase db execute --linked --sql "..."` | `supabase db query --linked "..."` |
| `supabase functions deploy --all` | `supabase functions deploy` (بدون `--all` ينشر الكل تلقائياً) |

عند الشك في أي subcommand: شغّل `supabase <command> --help` أولاً.

## 15. Supabase المشاريع الجديدة (بعد 30 مايو 2026) لا تمنح صلاحيات الجداول تلقائياً
قبل 30 مايو 2026 كان Supabase يُضيف `GRANT ALL ON TABLES TO anon, authenticated` تلقائياً. بعده، المشاريع الجديدة لا تفعل ذلك — أي جدول جديد **غير متاح** لـ PostgREST/supabase-js افتراضياً.
**الحل:** أضِف migration `000_initial_grants.sql` يُشغَّل قبل أي migration آخر:
```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;
```
**القاعدة:** لأي مشروع Supabase جديد بعد مايو 2026، هذا الملف إلزامي وأول شيء يُشغَّل.

## 16. جداول Realtime لا تُفعَّل تلقائياً — يجب إضافتها صراحةً للـ publication
عند إنشاء مشروع Supabase جديد وتشغيل الـ migrations، الجداول لا تُضاف تلقائياً لـ `supabase_realtime` publication. الكود كان يشترك في 8 جداول لكن 5 منها (`messages`, `requests`, `bids`, `providers`, `notifications`) لم تكن في أي migration — يعني Realtime كان صامتاً يفشل بدون خطأ.
**الحل:** أضِف migration يستخدم `IF NOT EXISTS` لكل جدول:
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
  -- ... باقي الجداول
END $$;
```
**القاعدة:** لكل جدول تستخدم فيه `supabase.channel().on('postgres_changes', ...)` في الكود، تأكد أن له migration يضيفه لـ `supabase_realtime`.

## 17. وكلاء التحليل الساكن (Explore agents) يُبالغون في الإبلاغ عن الأخطاء
في جلسة QA، أنتج الـ agent 8 "أخطاء حرجة" — 7 منها كانت إيجابيات كاذبة (null crash غير موجود، double-submit محمي فعلاً، fire-and-forget مقصود، projectId الصحيح). الخطأ الوحيد الصحيح كان موثقاً مسبقاً.
**القاعدة:** لا تعتمد على نتائج agent التحليل الساكن مباشرة — تحقق يدوياً من كل "critical" بقراءة السطر المحدد في الملف الفعلي قبل أي إجراء.

## 18. `expo prebuild --clean` يمسح Firebase — يجب كتابة `google-services.json` قبله لا بعده
`--clean` يحذف مجلد `android/` بالكامل ويُعيد توليده من الصفر. إذا وُجدت خطوة "Write google-services.json" **بعد** `expo prebuild` في الـ CI، فإن Firebase **لا يُضمَّن** في المشروع المولَّد — مما يعني أن `getExpoPushTokenAsync` يعمل لكن الـ token غير مدعوم بـ FCM وتبقى `push_tokens` فارغة.
**القاعدة:** في أي workflow يستخدم `expo prebuild --clean`، يجب أن يكون `google-services.json` موجوداً في جذر `mobile/` **قبل** تنفيذ prebuild. كذلك يجب وجود `"googleServicesFile": "./google-services.json"` في `app.json`.
**ترتيب صحيح:** Install deps → Write .env.local → **Write google-services.json** → Expo prebuild → Build APK.

## 19. `notifications.insert` في Edge Functions يجب أن يسبق أي early-return مشروط
الخطأ الكلاسيكي: التحقق من وجود push token أولاً ثم الإعادة المبكرة، مما يُخطئ حفظ الإشعار الداخلي للمستخدمين الذين لا يملكون token.
```typescript
// ❌ خطأ — الإشعار الداخلي لا يُحفظ إذا لم يوجد token
if (!tokenRow?.token) return json({ sent: false });
await admin.from("notifications").insert({...});

// ✅ صواب — دائماً احفظ أولاً، ثم تحقق من الـ token
await admin.from("notifications").insert({...}).catch(() => {});
if (!tokenRow?.token) return json({ sent: false, inbox: true, reason: "no_push_token" });
// ...أرسل push...
return json({ sent, inbox: true });
```
أدى هذا الخطأ إلى أن إشعارات "عرض جديد" و"قبِل عميل عرضك" لم تظهر في صندوق الوارد الداخلي لأي مستخدم لا يملك push token. كُشف فقط عند التحقق من جدول `notifications` مباشرة.
**القاعدة:** في أي Edge Function تُرسل إشعاراً داخلياً + push، اجعل `notifications.insert` دائماً السطر الأول في منطق التنفيذ، مستقلاً عن أي شرط خارجي (token، صلاحية جهاز، إلخ).

## 20. قناة Supabase Realtime المتكررة (Stale Channel) تُصمت الـ subscription بدون خطأ
عند unmount وremount لمكوّن React Native يحتوي subscription، إذا لم تُنظَّف القناة القديمة صراحةً، تتراكم قنوات بنفس الاسم ويُهمَل الاشتراك الجديد بصمت.
```typescript
// ✅ النمط الصحيح للـ Realtime subscription في React Native
const setup = async () => {
  // نظّف القناة القديمة إذا وُجدت قبل إنشاء جديدة
  const stale = supabase.getChannels().find(ch => ch.topic === 'realtime:channel_name');
  if (stale) await supabase.removeChannel(stale);
  channel = supabase.channel('channel_name').on(...).subscribe();
};
// cleanup على unmount
return () => { if (channel) supabase.removeChannel(channel); };
```
**القاعدة:** كل subscription يجب أن يتحقق من وجود قناة قديمة بنفس الاسم ويحذفها أولاً. وتأكد دائماً أن جدول الـ subscription موجود في `supabase_realtime` publication (راجع الدرس 16).

## 21. دالة `t()` (i18n) لا تعمل في دوال module-level — مررها كمعامل
React hooks مثل `useLanguage()` لا يمكن استدعاؤها إلا داخل مكوّنات أو hooks مخصصة. الدوال المعرَّفة على مستوى الملف (خارج الـ component) لا يمكنها استخدام `t()` مباشرة.
اكتُشف في `notification-inbox.tsx` — دوال `relativeTime`، `dateGroupLabel`، `groupByDate` كانت تستخدم strings ثابتة فأُعيد تعريفها بمعامل `t: TFn`:
```typescript
type TFn = (key: string, opts?: Record<string, unknown>) => string;
function relativeTime(iso: string, locale: string, t: TFn): string { ... }
function groupByDate(items: NotifRow[], t: TFn): DataItem[] { ... }
```
ثم تُستدعى من داخل الـ component: `groupByDate(items, t)`.
**القاعدة:** إذا احتاجت دالة module-level إلى i18n أو theme أو أي hook — مرر القيمة كمعامل، لا تحاول استدعاء الـ hook مباشرة.

## 22. `Math.random()` غير مناسب للرموز الأمنية — استخدم `crypto.getRandomValues` في RN 0.81.5+
`Math.random()` ليس cryptographically secure — يمكن توقع قيمه. في Hermes (محرك React Native 0.81.5+) يتوفر `crypto.getRandomValues` بشكل أصلي بدون polyfill:
```typescript
const rnd = new Uint32Array(1);
crypto.getRandomValues(rnd);
const code = (100000 + (rnd[0] % 900000)).toString(); // 6 أرقام
```
كان `Math.random()` يُستخدم لتوليد رمز تأكيد إنجاز العمل في `(provider)/jobs.tsx`.
**القاعدة:** أي رمز مؤقت أو كود تحقق أو رقم عشوائي أمني في التطبيق → `crypto.getRandomValues` لا `Math.random()`.
