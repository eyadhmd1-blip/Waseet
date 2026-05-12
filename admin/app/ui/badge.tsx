interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'muted';
}

const VARIANTS: Record<string, string> = {
  default: 'bg-slate-800/80 text-slate-300 border border-slate-700/60',
  success: 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25',
  warning: 'bg-amber-500/12 text-amber-300 border border-amber-500/25',
  danger:  'bg-red-500/12 text-red-400 border border-red-500/25',
  info:    'bg-sky-500/12 text-sky-300 border border-sky-500/25',
  violet:  'bg-violet-500/12 text-violet-300 border border-violet-500/25',
  muted:   'bg-slate-800/40 text-slate-600 border border-slate-800',
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}
