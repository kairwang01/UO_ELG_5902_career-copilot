import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

type ConfirmTone = 'primary' | 'danger';

interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  detail?: string;
  cancelLabel: string;
  confirmLabel: string;
  loadingLabel?: string;
  loading?: boolean;
  tone?: ConfirmTone;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const toneClass: Record<ConfirmTone, string> = {
  primary: 'bg-blue-700 hover:bg-blue-800 focus:ring-blue-400/40',
  danger: 'bg-rose-700 hover:bg-rose-800 focus:ring-rose-400/40',
};

export const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = ({
  open,
  title,
  description,
  detail,
  cancelLabel,
  confirmLabel,
  loadingLabel,
  loading = false,
  tone = 'primary',
  onOpenChange,
  onCancel,
  onConfirm,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent maxWidth="sm" className="p-6 sm:p-7">
      <DialogHeader className="text-left">
        <DialogTitle className="flex items-center gap-2">
          {tone === 'danger' && <AlertTriangle className="h-5 w-5 text-rose-600" aria-hidden="true" />}
          {title}
        </DialogTitle>
        <DialogDescription className="not-sr-only pt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {description}
        </DialogDescription>
      </DialogHeader>

      {detail && (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-800 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100">
          {detail}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${toneClass[tone]}`}
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {loading ? (loadingLabel ?? confirmLabel) : confirmLabel}
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

export default ConfirmActionDialog;
