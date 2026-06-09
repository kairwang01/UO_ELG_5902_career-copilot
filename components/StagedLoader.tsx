import React, { useState, useEffect, useRef } from 'react';

interface StagedLoaderProps {
  /** Ordered list of human-readable status messages. The last step is held
   *  indefinitely — the component never self-advances past it. The parent
   *  unmounts this component when the real result arrives. */
  steps: string[];
  /** Optional heading shown above the current step text. */
  title?: string;
  /** Extra Tailwind classes applied to the outermost container. */
  className?: string;
  /** Milliseconds between step advances (default 1800). */
  intervalMs?: number;
}

/**
 * StagedLoader — a tasteful, time-based progress indicator for long AI ops.
 *
 * Design notes:
 * - Cycles through `steps` every `intervalMs`, then HOLDS on the last step.
 * - Never claims "done" or reaches 100% — the parent unmounts it on completion.
 * - A slim progress bar eases toward ~88% max and holds there; it never snaps
 *   to 100% so there is no misleading "complete" signal.
 * - Smooth fade-in/fade-out transition between step labels via CSS keyframes
 *   injected once into the document head.
 */
const StagedLoader: React.FC<StagedLoaderProps> = ({
  steps,
  title,
  className = '',
  intervalMs = 1800,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inject fade keyframes once.
  useEffect(() => {
    const id = 'staged-loader-keyframes';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        @keyframes sl-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sl-progress-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.7; }
        }
        .sl-fade-in { animation: sl-fade-in 0.35s ease-out both; }
        .sl-progress-pulse { animation: sl-progress-pulse 2s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Advance through steps, hold on last.
  useEffect(() => {
    if (stepIndex >= steps.length - 1) return; // Hold on last step.

    // Fade out current label, then advance and fade in new one.
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setStepIndex((i) => Math.min(i + 1, steps.length - 1));
        setVisible(true);
      }, 200); // matches fade-out duration
    }, intervalMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stepIndex, steps.length, intervalMs]);

  // Progress bar target: spread across steps, cap at ~88% to avoid false "done".
  const progressPct = steps.length <= 1
    ? 60
    : Math.min(10 + (stepIndex / (steps.length - 1)) * 78, 88);

  const currentStep = steps[stepIndex] ?? '';
  const dotCount = steps.length;

  return (
    <div
      className={`flex flex-col items-center justify-center space-y-6 my-24 animate-fade-in ${className}`}
      role="status"
      aria-live="polite"
      aria-label={title ?? 'Loading'}
    >
      {/* Spinner */}
      <div className="relative w-20 h-20">
        {/* Outer ring — static track */}
        <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900/40" />
        {/* Inner spinning arc */}
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 dark:border-t-blue-400 animate-spin" />
        {/* Centre dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-400 sl-progress-pulse" />
        </div>
      </div>

      {/* Title */}
      {title && (
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight text-center">
          {title}
        </h2>
      )}

      {/* Step label with fade transition */}
      <div className="h-7 flex items-center justify-center px-4">
        <p
          key={stepIndex}
          className={`text-base font-medium text-gray-600 dark:text-gray-300 text-center transition-opacity duration-200 sl-fade-in ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {currentStep}
        </p>
      </div>

      {/* Step dot indicators */}
      {dotCount > 1 && (
        <div className="flex items-center gap-2" aria-hidden="true">
          {Array.from({ length: dotCount }).map((_, i) => (
            <span
              key={i}
              className={`block rounded-full transition-all duration-300 ${
                i < stepIndex
                  ? 'w-2 h-2 bg-blue-400 dark:bg-blue-500 opacity-70'
                  : i === stepIndex
                  ? 'w-3 h-3 bg-blue-600 dark:bg-blue-400'
                  : 'w-2 h-2 bg-gray-200 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>
      )}

      {/* Slim indeterminate-style progress bar */}
      <div className="w-64 sm:w-80 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-[1200ms] ease-out sl-progress-pulse"
          style={{ width: `${progressPct}%` }}
          aria-hidden="true"
        />
      </div>

      {/* Step counter */}
      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium tabular-nums">
        Step {stepIndex + 1} of {dotCount}
      </p>
    </div>
  );
};

export default StagedLoader;
