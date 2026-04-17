'use client';

import { useState } from 'react';
import { updateSettings } from './actions';

interface SettingField {
  key:         string;
  label:       string;
  description: string;
  type:        'number' | 'boolean' | 'percent';
  value:       string;
}

interface SettingsFormProps {
  fields: SettingField[];
}

export function SettingsForm({ fields }: SettingsFormProps) {
  const [values,  setValues]  = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, f.value])),
  );
  const [loading, setLoading] = useState(false);
  const [saved,   setSaved]   = useState(false);

  function setValue(key: string, val: string) {
    setValues(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  async function handleSave() {
    setLoading(true);
    setSaved(false);
    const updates = fields.map(f => ({ key: f.key, value: values[f.key] ?? f.value, label: f.label }));
    await updateSettings(updates);
    setLoading(false);
    setSaved(true);
  }

  return (
    <div className="space-y-4">
      {fields.map(f => (
        <div key={f.key} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {f.type === 'boolean' ? (
                <button
                  onClick={() => setValue(f.key, values[f.key] === 'true' ? 'false' : 'true')}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    values[f.key] === 'true' ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      values[f.key] === 'true' ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={values[f.key]}
                    onChange={e => setValue(f.key, e.target.value)}
                    min={0}
                    max={f.type === 'percent' ? 100 : undefined}
                    className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-amber-400 font-bold outline-none focus:border-amber-400/60 text-center"
                  />
                  {f.type === 'percent' && <span className="text-slate-500 text-sm">%</span>}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-slate-200 font-medium text-sm">{f.label}</div>
              <div className="text-slate-500 text-xs mt-0.5">{f.description}</div>
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2">
        {saved && (
          <span className="text-emerald-400 text-sm">تم الحفظ بنجاح ✓</span>
        )}
        {!saved && <span />}
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-colors disabled:opacity-40"
        >
          {loading ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  );
}
