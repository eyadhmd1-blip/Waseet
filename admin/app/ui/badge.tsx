interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'muted';
}

const VARIANTS: Record<string, string> = {
  default: 'bg-slate-800 text-slate-300',
  success: 'bg-emerald-900/60 text-emerald-400',
  warning: 'bg-amber-900/60 text-amber-300',
  danger:  'bg-red-900/60 text-red-400',
  info:    'bg-sky-900/60 text-sky-300',
  violet:  'bg-violet-900/60 text-violet-300',
  muted:   'bg-slate-900 text-slate-600',
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}
