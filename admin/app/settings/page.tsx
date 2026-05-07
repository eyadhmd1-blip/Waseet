import { supabaseAdmin } from '../lib/supabase';
import { SettingsForm } from './settings-form';

export const dynamic = 'force-dynamic';

// Default values if not in DB yet
const DEFAULTS: Record<string, { label: string; description: string; type: 'number' | 'boolean' | 'percent'; default: string }> = {
  urgent_premium_pct: {
    label:       'رسوم الطلبات الطارئة',
    description: 'نسبة إضافية تُضاف على الطلبات المصنّفة طارئة',
    type:        'percent',
    default:     '20',
  },
  urgent_window_hours: {
    label:       'نافذة الاستجابة للطلبات الطارئة',
    description: 'عدد الساعات التي يُعتبر فيها الطلب الطارئ نشطاً قبل الإلغاء التلقائي',
    type:        'number',
    default:     '4',
  },
  max_bids_per_request: {
    label:       'الحد الأقصى للعروض لكل طلب',
    description: 'أقصى عدد من المزودين يمكنهم تقديم عروض على طلب واحد',
    type:        'number',
    default:     '10',
  },
  auto_close_days: {
    label:       'الإغلاق التلقائي للطلبات الراكدة',
    description: 'عدد الأيام التي يُغلق بعدها الطلب المفتوح تلقائياً إذا لم تكن هناك عروض',
    type:        'number',
    default:     '7',
  },
  loyalty_cashback_pct: {
    label:       'نسبة كاش باك الولاء',
    description: 'نسبة من قيمة الطلب تُردّ كنقاط ولاء للعميل عند الإتمام',
    type:        'percent',
    default:     '5',
  },
  maintenance_mode: {
    label:       'وضع الصيانة',
    description: 'عند التفعيل، تعرض التطبيقات رسالة صيانة ولا يمكن تسجيل الدخول',
    type:        'boolean',
    default:     'false',
  },
  new_registrations_open: {
    label:       'فتح التسجيلات الجديدة',
    description: 'عند الإيقاف، لا يمكن إنشاء حسابات جديدة في التطبيق',
    type:        'boolean',
    default:     'true',
  },
  provider_verification_required: {
    label:       'التحقق الإلزامي للمزودين',
    description: 'عند التفعيل، لا يمكن للمزودين تقديم عروض قبل اجتياز التحقق',
    type:        'boolean',
    default:     'false',
  },
};

async function getSettings() {
  const { data } = await supabaseAdmin
    .from('platform_settings')
    .select('key, value, label, description');

  const map: Record<string, string> = {};
  for (const row of (data ?? [])) {
    map[row.key] = row.value;
  }
  return map;
}

export default async function SettingsPage() {
  const saved = await getSettings();

  const fields = Object.entries(DEFAULTS).map(([key, meta]) => ({
    key,
    label:       meta.label,
    description: meta.description,
    type:        meta.type,
    value:       saved[key] ?? meta.default,
  }));

  // Split into groups
  const financialKeys = ['urgent_premium_pct', 'loyalty_cashback_pct'];
  const operationalKeys = ['urgent_window_hours', 'max_bids_per_request', 'auto_close_days'];
  const systemKeys = ['maintenance_mode', 'new_registrations_open', 'provider_verification_required'];

  const group = (keys: string[]) => fields.filter(f => keys.includes(f.key));

  return (
    <div className="p-6 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">إعدادات المنصة</h1>
        <p className="text-slate-500 text-sm mt-0.5">التحكم في سلوك المنصة وإعداداتها العامة</p>
      </div>

      {/* System / critical */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">النظام</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>
        <SettingsForm fields={group(systemKeys)} />
      </section>

      {/* Financial */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">المالية</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>
        <SettingsForm fields={group(financialKeys)} />
      </section>

      {/* Operational */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">التشغيل</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>
        <SettingsForm fields={group(operationalKeys)} />
      </section>

    </div>
  );
}
