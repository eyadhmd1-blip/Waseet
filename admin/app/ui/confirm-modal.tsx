'use client';

interface ConfirmModalProps {
  open:        boolean;
  title:       string;
  description: string;
  confirmLabel?: string;
  cancelLabel?:  string;
  danger?:     boolean;
  loading?:    boolean;
  onConfirm:   () => void;
  onCancel:    () => void;
}

export function ConfirmModal({
  open, title, description,
  confirmLabel = 'تأكيد',
  cancelLabel  = 'إلغاء',
  danger = false,
  loading = false,
  onConfirm, onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl text-right">
        <h3 className="text-lg font-bold text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">{description}</p>
        <div className="flex gap-3 justify-start flex-row-reverse">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed
              ${danger
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-900'
              }`}
          >
            {loading ? '...' : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
