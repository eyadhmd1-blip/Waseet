interface StatCardProps {
  icon:     string;
  label:    string;
  value:    string | number;
  sub?:     string;
  accent?:  boolean;
  danger?:  boolean;
}

export function StatCard({ icon, label, value, sub, accent, danger }: StatCardProps) {
  return (
    <div className={`rounded-2xl p-5 text-right border transition-all
      ${danger  ? 'bg-red-950/40 border-red-800/50' :
        accent  ? 'bg-amber-400/5 border-amber-400/20' :
                  'bg-slate-900 border-slate-800'}`}>
      <div className="text-2xl mb-3">{icon}</div>
      <div className={`text-3xl font-black mb-1 tabular-nums
        ${danger ? 'text-red-400' : accent ? 'text-amber-400' : 'text-slate-100'}`}>
        {typeof value === 'number' ? value.toLocaleString('ar-JO') : value}
      </div>
      <div className="text-sm text-slate-400 mb-1">{label}</div>
      {sub && <div className="text-xs text-slate-600">{sub}</div>}
    </div>
  );
}
