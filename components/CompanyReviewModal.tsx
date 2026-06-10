/**
 * CompanyReviewModal — 5-star rating + text review submission modal.
 *
 * Props:
 *   employerId   — Firestore employer uid
 *   companyLabel — display name (may be a generic fallback)
 *   t            — translation function
 *   onClose      — called when user dismisses the modal
 *   onSubmitted  — called after a successful submission
 *
 * Verification errors (failed-precondition) surface as an inline message;
 * other errors fall back to a generic toast.
 */

import React, { useState } from "react";
import { Star, X } from "lucide-react";
import { useToast } from "./Toast";
import { submitCompanyReview } from "../lib/companyReviewsData";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CompanyReviewModalProps {
  employerId: string;
  companyLabel: string;
  t: (key: string) => string;
  onClose: () => void;
  onSubmitted: () => void;
}

// ─── Star picker ───────────────────────────────────────────────────────────────

interface StarPickerProps {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}

const StarPicker: React.FC<StarPickerProps> = ({ value, onChange, disabled }) => {
  const [hovered, setHovered] = useState(0);

  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label="Rating"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
            aria-pressed={star === value}
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            className={`p-0.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                filled
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-none text-gray-300 dark:text-slate-600"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};

// ─── Modal ─────────────────────────────────────────────────────────────────────

const CompanyReviewModal: React.FC<CompanyReviewModalProps> = ({
  employerId,
  companyLabel,
  t,
  onClose,
  onSubmitted,
}) => {
  const { addToast } = useToast();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState(false);

  const charCount = text.trim().length;
  const canSubmit = rating >= 1 && charCount >= 20 && charCount <= 2000 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setVerifyError(false);

    try {
      await submitCompanyReview(employerId, rating, text.trim());
      addToast(t("review_submit_success"), "success");
      onSubmitted();
      onClose();
    } catch (err: unknown) {
      // Firebase callable errors carry a `code` field on the inner error.
      const code =
        (err as { code?: string })?.code ??
        ((err as { details?: { code?: string } })?.details?.code ?? "");
      if (code === "failed-precondition" || String(err).includes("failed-precondition")) {
        setVerifyError(true);
      } else {
        addToast(t("review_submit_error"), "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("review_modal_title")}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-gray-100 dark:border-slate-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-slate-700">
          <h2 className="font-bold text-base text-gray-900 dark:text-gray-100 leading-snug">
            {t("review_modal_title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Company name */}
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {companyLabel}
          </p>

          {/* Verified-employee note */}
          <p className="text-xs text-gray-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg px-3 py-2">
            {t("review_verified_note")}
          </p>

          {/* Star picker */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide">
              {t("review_rating_label")}
            </label>
            <StarPicker value={rating} onChange={setRating} disabled={submitting} />
          </div>

          {/* Text area */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide">
              {t("review_text_label")}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={submitting}
              rows={5}
              maxLength={2000}
              placeholder={t("review_text_ph")}
              className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 transition resize-none disabled:opacity-60"
            />
            {/* Char counter */}
            <div className="flex justify-end">
              <span
                className={`text-[11px] tabular-nums ${
                  charCount > 2000
                    ? "text-red-500"
                    : charCount < 20 && charCount > 0
                    ? "text-amber-500 dark:text-amber-400"
                    : "text-gray-400 dark:text-slate-500"
                }`}
              >
                {charCount} / 2000
              </span>
            </div>
          </div>

          {/* Verification error */}
          {verifyError && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              {t("review_not_verified")}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t("review_cancel")}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t("review_submitting") : t("review_submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyReviewModal;
