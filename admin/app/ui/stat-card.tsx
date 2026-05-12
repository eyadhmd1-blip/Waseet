interface StatCardProps {
  icon:        string;
  iconBg?:     string;   // e.g. "bg-blue-500/15 text-blue-400"
  label:       string;
  value:       string | number;
  sub?:        string;
  trend?:      string;
  trendUp?:    boolean;
  accent?:     boolean;  // legacy compat
  danger?:     boolean;
  sparkData?:  number[];
  sparkColor?: string;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const H = 30, W = 72;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 6) - 3}`)
    .join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
    </svg>
  );
}

export function StatCard({
  icon, iconBg = 'bg-violet-500/15 text-violet-300',
  label, value, sub,
  trend, trendUp,
  accent, danger,
  sparkData, sparkColor = '#F59E0B',
}: StatCardProps) {
  const isRed = danger;

  return (
    <div
      className={`rounded-2xl p-5 text-right transition-all group pk-card-hover
        ${isRed ? 'border-red-500/20' : ''}`}
      style={isRed
        ? { background: 'rgba(127,29,29,0.18)', borderColor: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.18)' }
        : { background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '1rem' }}
    >
      {/* Top row: trend badge + icon */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col items-end gap-1">
          {trend && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg
              ${trendUp
                ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                : 'text-red-400 bg-red-500/10 border border-red-500/20'
              }`}>
              {trendUp ? '↑' : '↓'} {trend}
            </span>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl
          transition-transform duration-200 group-hover:scale-110 shrink-0 ${
          isRed ? 'bg-red-500/15 text-red-400' : iconBg
        }`}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div className={`text-[2rem] font-black mb-0.5 tabular-nums leading-none
        ${isRed ? 'text-red-400' : 'text-white'}`}>
        {typeof value === 'number' ? value.toLocaleString('ar-JO') : value}
      </div>

      {/* Label */}
      <div className="text-sm text-slate-400 mt-1">{label}</div>

      {/* Sub */}
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}

      {/* Sparkline */}
      {sparkData && (
        <div className="mt-3 flex justify-end">
          <MiniSparkline data={sparkData} color={isRed ? '#F87171' : sparkColor} />
        </div>
      )}
    </div>
  );
}
