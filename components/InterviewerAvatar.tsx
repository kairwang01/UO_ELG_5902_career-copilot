import React from 'react';

/**
 * InterviewerAvatar — the virtual interviewer's "face" for the timed mock
 * interview.
 *
 * LIP-SYNC NOTE (the 嘴形 question): true viseme-accurate lip-sync requires a
 * talking-head video service (HeyGen / D-ID) or a rigged WebGL model — both
 * heavy and per-minute-billed. The pragmatic pattern (used by most interview
 * sims) is APPROXIMATE speech cues synced to TTS lifecycle events instead:
 * while speechSynthesis is speaking we show an animated voice-bar "mouth" and
 * a pulsing ring, plus a subtle idle "breathing" scale. When a real portrait
 * is supplied later, pass `imageUrl` — the animation overlay works unchanged.
 * Upgrade path to real lip-sync: swap the <img> for a D-ID/HeyGen streamed
 * <video> keyed to the question text; the component API stays the same.
 */
interface InterviewerAvatarProps {
  speaking: boolean;
  /** Optional portrait; falls back to a built-in professional silhouette. */
  imageUrl?: string;
  name: string;
  roleLabel: string;
  compact?: boolean;
}

export const InterviewerAvatar: React.FC<InterviewerAvatarProps> = ({ speaking, imageUrl, name, roleLabel, compact = false }) => (
  <div className="flex flex-col items-center select-none">
    <div className="relative">
      {/* pulsing ring while speaking */}
      {speaking && (
        <>
          <span className="absolute inset-0 rounded-full bg-blue-400/30 animate-ping" aria-hidden="true" />
          <span className="absolute -inset-1.5 rounded-full border-2 border-blue-400/50 animate-pulse" aria-hidden="true" />
        </>
      )}
      <div
        className={`relative ${compact ? 'h-24 w-24' : 'h-32 w-32 sm:h-40 sm:w-40'} rounded-full overflow-hidden ring-4 shadow-xl transition-transform duration-700 ${
          speaking ? 'ring-blue-500 scale-[1.03]' : 'ring-slate-300 dark:ring-slate-600 scale-100'
        } bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          /* Built-in professional silhouette (until a portrait is provided) */
          <svg viewBox="0 0 100 100" className="h-full w-full text-slate-400 dark:text-slate-500" aria-hidden="true">
            <circle cx="50" cy="38" r="17" fill="currentColor" />
            <path d="M50 58c-17 0-29 9.5-32 24.5V100h64V82.5C79 67.5 67 58 50 58z" fill="currentColor" />
            {/* collar + tie to read as "interviewer" */}
            <path d="M50 62l-7 8 7 16 7-16z" className="text-blue-600 dark:text-blue-400" fill="currentColor" />
          </svg>
        )}

        {/* approximate "mouth" — animated voice bars over the lower face while speaking */}
        {speaking && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-[3px] h-4" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-white/90 dark:bg-blue-200/90 animate-pulse"
                style={{
                  height: `${[60, 100, 75, 95, 55][i]}%`,
                  animationDuration: `${[420, 320, 500, 360, 460][i]}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>

    <p className={`${compact ? 'mt-2 text-sm' : 'mt-3'} font-semibold text-gray-800 dark:text-gray-100`}>{name}</p>
    <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-center text-gray-500 dark:text-slate-400`}>{roleLabel}</p>
  </div>
);

export default InterviewerAvatar;
