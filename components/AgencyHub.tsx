import React, { useState, useCallback, useRef, useEffect } from "react";
import type { AppSession as Session } from "../lib/data";
import type { UserProfile, BulkAnalysisItem } from "../types";
import {
  analyzeResume,
  anonymizeResume,
  calculateCompatibility,
  generateClientPitchEmail,
  generateCandidatePrepKit,
  extractTextFromUrl,
} from "../services/aiClient";
import { parseFile } from "../services/fileHelpers";
import { SUPPORTED_MARKETS, DEFAULT_MARKET } from "../config";
import { DownloadButtons } from "./tools/ToolUtils";
import { listActiveEmployerJobs, type JobPosting } from "../lib/recruitingData";
import { useToast } from "./Toast";
import { useModalBehavior } from "../hooks/useModalBehavior";
import {
  CheckCircle2,
  Clock3,
  History,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";

interface AgencyHubProps {
  session: Session;
  profile: UserProfile;
  t: (key: string) => string;
}

// --- UI Sub-Components for the Redesign ---

interface HubSettings {
  autoOpenResult: boolean;
  focusCompletedAfterRun: boolean;
  denseTable: boolean;
}

type AgencyFilter = "all" | "complete" | "analyzing" | "error";
type TranslationFn = (key: string) => string;

interface AgencyFilterCounts {
  all: number;
  complete: number;
  analyzing: number;
  error: number;
}

const formatTranslation = (
  template: string,
  values: Record<string, string | number>,
) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );

const buildPostedJobBrief = (job: JobPosting, t: TranslationFn) => {
  const sections = [
    job.title,
    job.company_name ? `${t("agency_job_context_company")}: ${job.company_name}` : null,
    job.location ? `${t("agency_job_context_location")}: ${job.location}` : null,
    job.salary_range ? `${t("agency_job_context_salary")}: ${job.salary_range}` : null,
    job.description?.trim() ? `\n${job.description.trim()}` : null,
  ].filter(Boolean);

  return sections.join("\n");
};

const agencyStatusLabel = (
  status: BulkAnalysisItem["status"],
  t: TranslationFn,
) => {
  const labels: Record<BulkAnalysisItem["status"], string> = {
    queued: t("agency_status_queued"),
    parsing: t("agency_status_parsing"),
    analyzing: t("agency_status_analyzing"),
    complete: t("agency_status_complete"),
    error: t("agency_status_error"),
  };
  return labels[status];
};

const AgencyHeader = ({
  onOpenSettings,
  onOpenHistory,
  title,
  subtitle,
  iconColor,
  settingsLabel,
  historyLabel,
}: {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  title: string;
  subtitle: string;
  iconColor: string;
  settingsLabel: string;
  historyLabel: string;
}) => (
  <div className="bg-slate-900 text-white p-6 rounded-t-2xl flex flex-col sm:flex-row justify-between items-center shadow-lg gap-4">
    <div className="flex items-center gap-4 w-full sm:w-auto">
      <div className={`${iconColor} p-3 rounded-xl shadow-lg flex-shrink-0`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-wide">{title}</h2>
        <p className="text-slate-400 text-sm">{subtitle}</p>
      </div>
    </div>
    <div className="flex gap-3 w-full sm:w-auto justify-end">
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors border border-slate-700 text-slate-200"
        aria-label={settingsLabel}
      >
        <Settings className="h-5 w-5 text-blue-400" />
        <span className="font-medium text-sm hidden sm:inline">
          {settingsLabel}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenHistory}
        className="bg-green-600 hover:bg-green-700 p-2.5 rounded-full shadow-lg transition-colors border border-green-500"
        title={historyLabel}
        aria-label={historyLabel}
      >
        <History className="h-5 w-5 text-white" />
      </button>
    </div>
  </div>
);

const ToggleRow = ({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 cursor-pointer">
    <span>
      <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </span>
      <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {description}
      </span>
    </span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
    />
  </label>
);

const AgencySettingsModal = ({
  settings,
  onChange,
  onClose,
  t,
}: {
  settings: HubSettings;
  onChange: (settings: HubSettings) => void;
  onClose: () => void;
  t: TranslationFn;
}) => {
  useModalBehavior(onClose);
  const update = (patch: Partial<HubSettings>) =>
    onChange({ ...settings, ...patch });

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agency-settings-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-gray-50 dark:bg-slate-900 shadow-2xl animate-fade-scale"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 dark:border-slate-800 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-600 p-2 text-white">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="agency-settings-title"
                className="text-lg font-bold text-gray-900 dark:text-gray-100"
              >
                {t("agency_settings_title")}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("agency_settings_desc")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
            aria-label={t("agency_settings_close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <ToggleRow
            title={t("agency_setting_auto_open_title")}
            description={t("agency_setting_auto_open_desc")}
            checked={settings.autoOpenResult}
            onChange={(checked) => update({ autoOpenResult: checked })}
          />
          <ToggleRow
            title={t("agency_setting_focus_done_title")}
            description={t("agency_setting_focus_done_desc")}
            checked={settings.focusCompletedAfterRun}
            onChange={(checked) => update({ focusCompletedAfterRun: checked })}
          />
          <ToggleRow
            title={t("agency_setting_dense_rows_title")}
            description={t("agency_setting_dense_rows_desc")}
            checked={settings.denseTable}
            onChange={(checked) => update({ denseTable: checked })}
          />
        </div>
      </div>
    </div>
  );
};

const statusTone = (status: BulkAnalysisItem["status"]) => {
  if (status === "complete")
    return "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800";
  if (status === "error")
    return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800";
  if (status === "analyzing" || status === "parsing")
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800";
  return "bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700";
};

const AgencyHistoryModal = ({
  files,
  mode,
  onClose,
  t,
}: {
  files: BulkAnalysisItem[];
  mode: "general" | "matching";
  onClose: () => void;
  t: TranslationFn;
}) => {
  useModalBehavior(onClose);
  const recent = [...files].reverse();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agency-history-title"
    >
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl animate-fade-scale"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 dark:border-slate-800 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-green-600 p-2 text-white">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="agency-history-title"
                className="text-lg font-bold text-gray-900 dark:text-gray-100"
              >
                {t("agency_history_title")}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {formatTranslation(t("agency_history_desc"), {
                  mode:
                    mode === "matching"
                      ? t("agency_history_mode_matching")
                      : t("agency_history_mode_general"),
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
            aria-label={t("agency_history_close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          {recent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-slate-700 p-8 text-center">
              <Clock3 className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t("agency_history_empty_title")}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("agency_history_empty_desc")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((file) => {
                const score =
                  mode === "matching" ? file.matchScore : file.result?.score;
                return (
                  <div
                    key={file.id}
                    className="rounded-xl border border-gray-200 dark:border-slate-700 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {file.candidateName || file.fileName}
                        </p>
                        <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                          {file.fileName}
                        </p>
                        {(file.matchSummary ||
                          file.result?.summary ||
                          file.error) && (
                          <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
                            {file.error ||
                              file.matchSummary ||
                              file.result?.summary}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {typeof score === "number" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {score}
                          </span>
                        )}
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(file.status)}`}
                        >
                          {agencyStatusLabel(file.status, t)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const FilterTabs = ({
  currentFilter,
  setFilter,
  counts,
  t,
}: {
  currentFilter: AgencyFilter;
  setFilter: (f: AgencyFilter) => void;
  counts: AgencyFilterCounts;
  t: TranslationFn;
}) => (
  <div className="flex flex-wrap gap-2 px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
    {[
      { id: "all" as const, label: t("agency_filter_all"), count: counts.all },
      {
        id: "complete" as const,
        label: t("agency_filter_done"),
        count: counts.complete,
        color: "text-green-600",
      },
      {
        id: "analyzing" as const,
        label: t("agency_filter_in_progress"),
        count: counts.analyzing,
        color: "text-blue-600",
      },
      {
        id: "error" as const,
        label: t("agency_filter_attention"),
        count: counts.error,
        color: "text-red-600",
      },
    ].map((tab) => (
      <button
        key={tab.id}
        type="button"
        onClick={() => setFilter(tab.id)}
        aria-pressed={currentFilter === tab.id}
        className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
          currentFilter === tab.id
            ? "bg-slate-900 dark:bg-slate-600 text-white shadow-md"
            : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
        }`}
      >
        {tab.label}{" "}
        <span
          className={`ml-1 ${currentFilter === tab.id ? "text-slate-300" : tab.color || "text-gray-500"}`}
        >
          ({tab.count})
        </span>
      </button>
    ))}
  </div>
);

const AnalysisResultModal = ({
  file,
  onClose,
  t,
}: {
  file: BulkAnalysisItem;
  onClose: () => void;
  t: TranslationFn;
}) => {
  useModalBehavior(onClose);
  if (!file.result) return null;
  const { score, summary, strengths, improvements, keywords } = file.result;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agency-analysis-title"
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-fade-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-4">
            <CandidateAvatar name={file.fileName} />
            <div>
              <h3
                id="agency-analysis-title"
                className="text-xl font-bold text-gray-900 dark:text-gray-100"
              >
                {file.fileName}
              </h3>
              <p className="text-sm text-gray-500">
                {t("agency_analysis_report_subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("job_form_close")}
            className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {/* Score Section */}
          <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
            <div className="text-center min-w-[80px]">
              <div
                className={`text-3xl font-extrabold ${score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600"}`}
              >
                {score}
              </div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t("agency_table_score")}
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
              {summary}
            </p>
          </div>

          {/* Strengths */}
          <div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <span className="text-green-500">✓</span>{" "}
              {t("agency_analysis_strengths")}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {strengths.map((s, i) => (
                <div
                  key={i}
                  className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-200"
                >
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Improvements */}
          <div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-yellow-500"
                aria-hidden="true"
              />
              {t("agency_analysis_improvements")}
            </h4>
            <div className="space-y-3">
              {improvements.map((imp, i) => (
                <div
                  key={i}
                  className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg"
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-200 mb-1">
                    {imp.area}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {imp.suggestion}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
              {t("agency_analysis_keywords")}
            </h4>
            <div className="flex flex-wrap gap-2">
              {keywords.map((k, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-medium"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 rounded-b-2xl text-right">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
          >
            {t("agency_analysis_close_report")}
          </button>
        </div>
      </div>
    </div>
  );
};

const CandidateAvatar: React.FC<{ name: string }> = ({ name }) => {
  const initials =
    (name || "?")
      .split(" ")
      .map((n) => n[0] ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  // Deterministic color based on name length
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-purple-100 text-purple-700",
    "bg-yellow-100 text-yellow-700",
    "bg-pink-100 text-pink-700",
    "bg-indigo-100 text-indigo-700",
  ];
  const colorClass = colors[(name || "").length % colors.length];

  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${colorClass} border border-white shadow-sm flex-shrink-0`}
    >
      {initials}
    </div>
  );
};

const ScoreBar: React.FC<{ score: number }> = ({ score }) => {
  let colorClass = "bg-red-500";
  if (score >= 80) colorClass = "bg-green-500";
  else if (score >= 60) colorClass = "bg-yellow-500";

  return (
    <div className="w-full max-w-[100px]">
      <div className="flex justify-between text-xs mb-1">
        <span
          className={`font-bold ${score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600"}`}
        >
          {score}%
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full ${colorClass} transition-all duration-1000`}
          style={{ width: `${score}%` }}
        ></div>
      </div>
    </div>
  );
};

const TableSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-4 p-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center space-x-4">
        <div className="rounded-full bg-gray-200 dark:bg-slate-700 h-10 w-10"></div>
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
        </div>
      </div>
    ))}
  </div>
);

const BatchInsights: React.FC<{
  files: BulkAnalysisItem[];
  mode: "general" | "matching";
  t: TranslationFn;
}> = ({ files, mode, t }) => {
  const completed = files.filter((f) => f.status === "complete");
  if (completed.length === 0) return null;

  const getScore = (f: BulkAnalysisItem) =>
    mode === "matching" ? f.matchScore || 0 : f.result?.score || 0;

  const avgScore = Math.round(
    completed.reduce((acc, curr) => acc + getScore(curr), 0) / completed.length,
  );
  const highMatches = completed.filter((f) => getScore(f) >= 80).length;

  // Sort to find top candidate
  const topCandidate = [...completed].sort(
    (a, b) => getScore(b) - getScore(a),
  )[0];
  const topName =
    mode === "matching"
      ? topCandidate?.candidateName || topCandidate?.fileName
      : topCandidate?.fileName;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {t("agency_insights_candidates")}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {files.length}
          </p>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {t("agency_insights_top_tier")}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {highMatches}
          </p>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {t("agency_insights_avg_score")}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {avgScore}%
          </p>
        </div>
      </div>
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 rounded-xl border border-blue-500 shadow-sm text-white relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-xs text-blue-200 font-medium uppercase tracking-wider">
            {t("agency_insights_top_performer")}
          </p>
          <p className="text-lg font-bold truncate mt-1">
            {topName || t("agency_status_analyzing")}
          </p>
          <p className="text-sm text-blue-100">
            {formatTranslation(t("agency_insights_points"), {
              score: getScore(topCandidate),
            })}
          </p>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-2 translate-y-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-24 w-24"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
};

const PitchModal: React.FC<{
  file: BulkAnalysisItem;
  onClose: () => void;
  t: (key: string) => string;
}> = ({ file, onClose, t }) => {
  const { addToast } = useToast();
  useModalBehavior(onClose);
  if (!file.pitchEmail) return null;

  const copyToClipboard = async () => {
    const text = `${t("outreach_subject_copy_prefix")}: ${file.pitchEmail!.subject}\n\n${file.pitchEmail!.body}`;
    try {
      await navigator.clipboard.writeText(text);
      addToast(t("agency_pitch_copied"), "success");
    } catch {
      addToast(t("agency_pitch_copy_failed"), "error");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agency-pitch-title"
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-fade-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h3
            id="agency-pitch-title"
            className="text-xl font-bold text-gray-800 dark:text-gray-100"
          >
            {t("agency_pitch_modal_title")}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("job_form_close")}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="flex-grow overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("outreach_subject_label")}
            </label>
            <input
              readOnly
              value={file.pitchEmail.subject}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 rounded-md p-2 shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("outreach_body_label")}
            </label>
            <textarea
              readOnly
              value={file.pitchEmail.body}
              rows={10}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 rounded-md p-2 shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
          </div>
        </div>
        <div className="flex-shrink-0 flex justify-end items-center p-4 border-t border-gray-200 dark:border-slate-700 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-slate-600"
          >
            {t("job_form_close")}
          </button>
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
          >
            {t("outreach_copy")}
          </button>
        </div>
      </div>
    </div>
  );
};

const PrepKitModal: React.FC<{
  file: BulkAnalysisItem;
  onClose: () => void;
  t: TranslationFn;
}> = ({ file, onClose, t }) => {
  useModalBehavior(onClose);
  if (!file.prepKit) return null;

  const {
    weakSpots = [],
    keyProjects = [],
    predictedQuestions = [],
  } = file.prepKit;
  const candidateName = file.candidateName || file.fileName;

  const formatForDownload = () => {
    let content = `# ${formatTranslation(t("agency_prep_download_title"), { name: candidateName })}\n\n`;
    content += `## ${t("agency_prep_weak_spots")}\n`;
    weakSpots.forEach((item) => (content += `* ${item}\n`));
    content += `\n## ${t("agency_prep_projects")}\n`;
    keyProjects.forEach((item) => (content += `* ${item}\n`));
    content += `\n## ${t("agency_prep_questions")}\n`;
    predictedQuestions.forEach((item) => (content += `* ${item}\n`));
    return content;
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agency-prep-title"
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-fade-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h3
            id="agency-prep-title"
            className="text-xl font-bold text-gray-800 dark:text-gray-100"
          >
            {formatTranslation(t("agency_prep_modal_title"), {
              name: candidateName,
            })}
          </h3>
          <div className="flex items-center gap-3">
            <DownloadButtons
              textContent={formatForDownload()}
              baseFilename={`prep_kit_${candidateName.replace(/\s+/g, "_")}`}
            />
            <button
              onClick={onClose}
              aria-label={t("job_form_close")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-lg">
            <h4 className="font-bold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-yellow-500"
                aria-hidden="true"
              />
              {t("agency_prep_weak_spots")}
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-yellow-900 dark:text-yellow-100">
              {weakSpots.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg">
            <h4 className="font-bold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-green-500"
                aria-hidden="true"
              />
              {t("agency_prep_projects")}
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-green-900 dark:text-green-100">
              {keyProjects.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg">
            <h4 className="font-bold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-blue-500"
                aria-hidden="true"
              />
              {t("agency_prep_questions")}
            </h4>
            <ul className="list-decimal list-inside space-y-1 text-sm text-blue-900 dark:text-blue-100">
              {predictedQuestions.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const BlindResumeModal: React.FC<{
  file: BulkAnalysisItem;
  onClose: () => void;
  t: TranslationFn;
}> = ({ file, onClose, t }) => {
  useModalBehavior(onClose);
  if (!file.blindResumeText) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="agency-blind-title"
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-fade-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h3
            id="agency-blind-title"
            className="text-xl font-bold text-gray-800 dark:text-gray-100"
          >
            {formatTranslation(t("agency_blind_modal_title"), {
              name: file.fileName,
            })}
          </h3>
          <div className="flex items-center gap-3">
            <DownloadButtons
              textContent={file.blindResumeText}
              baseFilename={`blind_resume_${file.fileName.replace(/\s+/g, "_")}`}
            />
            <button
              onClick={onClose}
              aria-label={t("job_form_close")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-grow overflow-y-auto p-6">
          <div className="p-6 border rounded-lg bg-gray-50 dark:bg-slate-900/50 font-serif text-sm whitespace-pre-wrap dark:text-gray-300">
            {file.blindResumeText}
          </div>
        </div>
      </div>
    </div>
  );
};

const AgencyHub: React.FC<AgencyHubProps> = ({ session, profile, t }) => {
  const { addToast } = useToast();
  const [mode, setMode] = useState<"general" | "matching">("general");
  const [files, setFiles] = useState<BulkAnalysisItem[]>([]);
  const [market, setMarket] = useState<string>(DEFAULT_MARKET);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<AgencyFilter>("all");
  const [showDetailModal, setShowDetailModal] =
    useState<BulkAnalysisItem | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [hubSettings, setHubSettings] = useState<HubSettings>({
    autoOpenResult: true,
    focusCompletedAfterRun: true,
    denseTable: false,
  });

  // JD Input State
  const [jdSource, setJdSource] = useState<"paste" | "url" | "select">("paste");
  const [jobDescription, setJobDescription] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [isExtractingJd, setIsExtractingJd] = useState(false);
  const [internalJobs, setInternalJobs] = useState<JobPosting[]>([]);
  const [selectedInternalJobId, setSelectedInternalJobId] =
    useState<string>("");

  const [viewPitchId, setViewPitchId] = useState<string | null>(null);
  const [viewPrepKitId, setViewPrepKitId] = useState<string | null>(null);
  const [viewBlindResumeId, setViewBlindResumeId] = useState<string | null>(
    null,
  );
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [jobsFetchError, setJobsFetchError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInternalJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    setJobsFetchError(false);
    try {
      const jobs = await listActiveEmployerJobs(session.user.id);
      setInternalJobs(jobs);
    } catch {
      setInternalJobs([]);
      setJobsFetchError(true);
    } finally {
      setIsLoadingJobs(false);
    }
  }, [session.user.id]);

  // Preload active postings as soon as the recruiter enters JD matching. The
  // selector should feel ready, not like a hidden second step after tab switch.
  useEffect(() => {
    if (mode === "matching") {
      void fetchInternalJobs();
    }
  }, [mode, fetchInternalJobs]);

  const handleJdUrlImport = async () => {
    if (!jdUrl.trim()) return;
    setIsExtractingJd(true);
    try {
      const result = await extractTextFromUrl(jdUrl);
      if (result.extractedText) {
        setSelectedInternalJobId("");
        setJobDescription(result.extractedText);
        setJdSource("paste"); // Switch to paste mode to show result
        addToast(t("agency_jd_import_success"), "success");
      }
    } catch {
      addToast(t("agency_jd_import_failed"), "error");
    } finally {
      setIsExtractingJd(false);
    }
  };

  const handleInternalJobSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const jobId = e.target.value;
    setSelectedInternalJobId(jobId);
    if (!jobId) {
      setJobDescription("");
      return;
    }
    const job = internalJobs.find((j) => j.id === jobId);
    if (job) {
      setJobDescription(buildPostedJobBrief(job, t));
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processNewFiles = (newFileList: FileList | File[]) => {
    const newItems: BulkAnalysisItem[] = Array.from(newFileList).map(
      (file) =>
        ({
          id: Math.random().toString(36).substr(2, 9),
          fileName: file.name,
          status: "queued",
          fileObj: file, // Temporary property to hold the file for processing
        }) as any,
    );

    setFiles((prev) => [...prev, ...newItems]);
    addToast(
      formatTranslation(t("agency_files_added"), { count: newItems.length }),
      "info",
    );
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processNewFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processNewFiles(e.target.files);
    }
  };

  const runBulkAnalysis = async () => {
    if (mode === "matching" && !jobDescription.trim()) {
      addToast(t("agency_jd_required"), "error");
      return;
    }

    setIsAnalyzing(true);
    const queue = files.filter(
      (f) => f.status === "queued" || f.status === "error",
    );

    if (queue.length === 0) {
      addToast(t("agency_no_new_files"), "info");
      setIsAnalyzing(false);
      return;
    }

    // Update UI to show parsing state
    setFiles((prev) =>
      prev.map((f) =>
        queue.find((q) => q.id === f.id) ? { ...f, status: "parsing" } : f,
      ),
    );

    const processFile = async (item: BulkAnalysisItem & { fileObj: File }) => {
      try {
        // 1. Parse File
        const parsed = await parseFile(item.fileObj);
        const resumeText = parsed.text || "";

        // 2. Update UI to analyzing state
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: "analyzing", text: resumeText }
              : f,
          ),
        );

        // 3. Analyze based on mode
        if (mode === "general") {
          const result = await analyzeResume(
            resumeText,
            parsed.images || null,
            market,
          );
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, status: "complete", result } : f,
            ),
          );
          if (hubSettings.autoOpenResult && queue.length === 1) {
            setShowDetailModal({
              ...item,
              status: "complete",
              result,
            } as BulkAnalysisItem);
          }
        } else {
          // Matching Mode
          const matchResult = await calculateCompatibility(
            resumeText,
            jobDescription,
          );
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    status: "complete",
                    matchScore: matchResult.compatibilityScore,
                    matchSummary: matchResult.summary,
                    candidateName: matchResult.candidateName || item.fileName,
                  }
                : f,
            ),
          );
        }
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? {
                  ...f,
                  status: "error",
                  error: t("agency_file_process_failed"),
                }
              : f,
          ),
        );
      }
    };

    // Execute sequentially to avoid rate limiting
    for (const item of queue) {
      await processFile(item as any);
    }

    setIsAnalyzing(false);
    if (hubSettings.focusCompletedAfterRun) setCurrentFilter("complete");
    addToast(t("agency_analysis_complete"), "success");
  };

  const handleAnonymize = async (id: string) => {
    const file = files.find((f) => f.id === id);
    if (!file || !file.text) return;

    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isAnonymizing: true } : f)),
    );

    try {
      const result = await anonymizeResume(
        file.text,
        profile.company_name || "Agency",
      );
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                isAnonymizing: false,
                blindResumeText: result.anonymizedText,
              }
            : f,
        ),
      );
      setViewBlindResumeId(id);
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                isAnonymizing: false,
                error: t("agency_blind_resume_failed"),
              }
            : f,
        ),
      );
      addToast(t("agency_blind_resume_failed"), "error");
    }
  };

  const handleGeneratePitch = async (id: string) => {
    const file = files.find((f) => f.id === id);
    if (!file || !file.text) return;

    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isPitching: true } : f)),
    );

    try {
      const name = file.candidateName || file.fileName;
      const jd = mode === "matching" ? jobDescription : undefined;
      const result = await generateClientPitchEmail(file.text, name, jd);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, isPitching: false, pitchEmail: result } : f,
        ),
      );
      setViewPitchId(id);
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, isPitching: false, error: t("agency_pitch_failed") }
            : f,
        ),
      );
      addToast(t("agency_pitch_failed"), "error");
    }
  };

  const handleGeneratePrepKit = async (id: string) => {
    const file = files.find((f) => f.id === id);
    if (!file || !file.text || !jobDescription) return;

    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isPrepping: true } : f)),
    );

    try {
      const result = await generateCandidatePrepKit(file.text, jobDescription);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, isPrepping: false, prepKit: result } : f,
        ),
      );
      setViewPrepKitId(id);
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, isPrepping: false, error: t("agency_prep_kit_failed") }
            : f,
        ),
      );
      addToast(t("agency_prep_kit_failed"), "error");
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Helper to extract score regardless of mode
  const getScore = (f: BulkAnalysisItem) =>
    mode === "matching" ? f.matchScore || 0 : f.result?.score || 0;

  // Unified sorting logic for both modes
  const sortedFiles = [...files].sort((a, b) => getScore(b) - getScore(a));

  // Filtered + sorted display list
  const displayFiles = sortedFiles.filter(
    (f) => currentFilter === "all" || f.status === currentFilter,
  );

  const counts: AgencyFilterCounts = {
    all: files.length,
    complete: files.filter((f) => f.status === "complete").length,
    analyzing: files.filter(
      (f) => f.status === "analyzing" || f.status === "parsing",
    ).length,
    error: files.filter((f) => f.status === "error").length,
  };

  const activePitchFile = viewPitchId
    ? files.find((f) => f.id === viewPitchId)
    : null;
  const activePrepKitFile = viewPrepKitId
    ? files.find((f) => f.id === viewPrepKitId)
    : null;
  const activeBlindResumeFile = viewBlindResumeId
    ? files.find((f) => f.id === viewBlindResumeId)
    : null;
  const selectedInternalJob = selectedInternalJobId
    ? internalJobs.find((job) => job.id === selectedInternalJobId) ?? null
    : null;
  const hasJobDescription = jobDescription.trim().length > 0;

  const activeHeader =
    mode === "general"
      ? {
          title: t("agency_mode_general_title"),
          subtitle: t("agency_mode_general_subtitle"),
          color: "bg-orange-500",
        }
      : {
          title: t("agency_mode_matching_title"),
          subtitle: t("agency_mode_matching_subtitle"),
          color: "bg-blue-600",
        };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {activePitchFile && (
        <PitchModal
          file={activePitchFile}
          onClose={() => setViewPitchId(null)}
          t={t}
        />
      )}
      {activePrepKitFile && (
        <PrepKitModal
          file={activePrepKitFile}
          onClose={() => setViewPrepKitId(null)}
          t={t}
        />
      )}
      {activeBlindResumeFile && (
        <BlindResumeModal
          file={activeBlindResumeFile}
          onClose={() => setViewBlindResumeId(null)}
          t={t}
        />
      )}
      {showDetailModal && (
        <AnalysisResultModal
          file={showDetailModal}
          onClose={() => setShowDetailModal(null)}
          t={t}
        />
      )}
      {showSettingsModal && (
        <AgencySettingsModal
          settings={hubSettings}
          onChange={setHubSettings}
          onClose={() => setShowSettingsModal(false)}
          t={t}
        />
      )}
      {showHistoryModal && (
        <AgencyHistoryModal
          files={files}
          mode={mode}
          onClose={() => setShowHistoryModal(false)}
          t={t}
        />
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
            {t("portal_nav_agency_hub")}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t("agency_page_subtitle")}
          </p>
        </div>
        {mode === "general" && (
          <div className="flex items-center gap-3">
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              {SUPPORTED_MARKETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Mode Switcher */}
      <div className="flex justify-center mb-6">
        <div className="bg-gray-100 dark:bg-slate-800/50 p-1 rounded-lg inline-flex">
          <button
            onClick={() => {
              setMode("general");
            }}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
              mode === "general"
                ? "bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            {t("agency_mode_general_title")}
          </button>
          <button
            onClick={() => {
              setMode("matching");
            }}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
              mode === "matching"
                ? "bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            {t("agency_mode_matching_title")}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-gray-50 dark:bg-slate-900/50 p-2 rounded-2xl">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
          <AgencyHeader
            onOpenSettings={() => setShowSettingsModal(true)}
            onOpenHistory={() => setShowHistoryModal(true)}
            title={activeHeader.title}
            subtitle={activeHeader.subtitle}
            iconColor={activeHeader.color}
            settingsLabel={t("agency_header_settings")}
            historyLabel={t("agency_header_history")}
          />
          <FilterTabs
            currentFilter={currentFilter}
            setFilter={setCurrentFilter}
            counts={counts}
            t={t}
          />

          <div className="p-6 space-y-6">
            {/* JD Input for Matching Mode */}
            {mode === "matching" && (
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-6 animate-fade-in">
                <label className="block text-sm font-bold text-blue-900 dark:text-blue-100 mb-3">
                  {t("agency_jd_step_label")}
                </label>

                {/* JD Source Tabs */}
                <div className="flex flex-wrap gap-2 mb-4 border-b border-blue-200 dark:border-blue-800 pb-2">
                  <button
                    onClick={() => setJdSource("paste")}
                    className={`px-3 py-1 text-sm font-medium rounded-t-md transition-colors ${jdSource === "paste" ? "text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
                    aria-pressed={jdSource === "paste"}
                  >
                    {t("agency_jd_tab_paste")}
                  </button>
                  <button
                    onClick={() => setJdSource("url")}
                    className={`px-3 py-1 text-sm font-medium rounded-t-md transition-colors ${jdSource === "url" ? "text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
                    aria-pressed={jdSource === "url"}
                  >
                    {t("agency_jd_tab_url")}
                  </button>
                  <button
                    onClick={() => setJdSource("select")}
                    className={`px-3 py-1 text-sm font-medium rounded-t-md transition-colors ${jdSource === "select" ? "text-blue-700 dark:text-blue-400 border-b-2 border-blue-700 dark:border-blue-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
                    aria-pressed={jdSource === "select"}
                  >
                    {t("agency_jd_tab_posted")}
                  </button>
                  {mode === "matching" && internalJobs.length > 0 && (
                    <span className="ml-auto inline-flex items-center rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300">
                      {formatTranslation(t("agency_active_jobs_count"), {
                        count: internalJobs.length,
                      })}
                    </span>
                  )}
                </div>

                {/* Inputs based on source */}
                {jdSource === "paste" && (
                  <textarea
                    value={jobDescription}
                    onChange={(e) => {
                      setSelectedInternalJobId("");
                      setJobDescription(e.target.value);
                    }}
                    placeholder={t("agency_jd_paste_placeholder")}
                    className="w-full h-32 bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {jdSource === "url" && (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={jdUrl}
                      onChange={(e) => setJdUrl(e.target.value)}
                      placeholder="https://company.com/careers/job-123"
                      className="flex-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleJdUrlImport}
                      disabled={isExtractingJd || !jdUrl.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isExtractingJd && (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {isExtractingJd
                        ? t("agency_jd_importing")
                        : t("agency_jd_import")}
                    </button>
                  </div>
                )}

                {jdSource === "select" &&
                  (isLoadingJobs ? (
                    <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 py-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      {t("agency_loading_posted_jobs")}
                    </div>
                  ) : jobsFetchError ? (
                    <div className="flex items-center justify-between gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                      <span>{t("agency_jobs_load_failed")}</span>
                      <button
                        onClick={fetchInternalJobs}
                        className="text-xs font-semibold underline hover:no-underline"
                      >
                        {t("agency_retry")}
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedInternalJobId}
                      onChange={handleInternalJobSelect}
                      className="w-full bg-white dark:bg-slate-800 border border-blue-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">
                        {t("agency_select_job_placeholder")}
                      </option>
                      {internalJobs.length === 0 && (
                        <option disabled value="">
                          {t("agency_no_active_jobs")}
                        </option>
                      )}
                      {internalJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title}{job.location ? ` — ${job.location}` : ""}
                        </option>
                      ))}
                    </select>
                  ))}

                {selectedInternalJob && (
                  <div className="mt-4 animate-panel-expand rounded-xl border border-blue-200 bg-white p-4 text-sm shadow-sm dark:border-blue-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          {t("agency_selected_job_label")}
                        </p>
                        <p className="mt-1 truncate text-base font-bold text-gray-900 dark:text-gray-100">
                          {selectedInternalJob.title}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <span>{selectedInternalJob.location || t("talent_location_remote")}</span>
                          {selectedInternalJob.salary_range && (
                            <span>{selectedInternalJob.salary_range}</span>
                          )}
                          {!selectedInternalJob.description?.trim() && (
                            <span className="font-semibold text-amber-700 dark:text-amber-300">
                              {t("agency_selected_job_missing_description")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                          {t("agency_selected_job_ready")}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInternalJobId("");
                            setJobDescription("");
                          }}
                          className="text-xs font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                        >
                          {t("agency_selected_job_clear")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2 text-xs text-blue-800 dark:text-blue-200 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {selectedInternalJob
                      ? t("agency_jd_helper_posted")
                      : t("agency_jd_helper_manual")}
                  </span>
                  <span>
                    {formatTranslation(t("agency_jd_length"), {
                      count: jobDescription.trim().length,
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* File Drop Area */}
            {files.length === 0 ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label={t("agency_drop_title")}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-slate-700/30"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  onChange={handleFileInput}
                  accept=".pdf,.docx,.txt,.png,.jpg"
                />
                <div className="bg-white dark:bg-slate-700 p-4 rounded-full inline-block shadow-sm mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 text-blue-600 dark:text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <p className="text-xl font-medium text-gray-900 dark:text-gray-100">
                  {t("agency_drop_title")}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {mode === "matching"
                    ? t("agency_drop_rank_hint")
                    : t("agency_drop_browse_hint")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Actions Toolbar */}
                <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg border border-gray-200 dark:border-slate-600">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    {t("agency_add_more")}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    onChange={handleFileInput}
                    accept=".pdf,.docx,.txt,.png,.jpg"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => setFiles([])}
                      className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isAnalyzing}
                    >
                      {t("agency_clear_all")}
                    </button>
                    <button
                      onClick={runBulkAnalysis}
                      disabled={
                        isAnalyzing ||
                        files.every((f) => f.status === "complete") ||
                        (mode === "matching" && !hasJobDescription)
                      }
                      className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                    >
                      {isAnalyzing && (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {isAnalyzing
                        ? t("agency_processing")
                        : mode === "matching"
                          ? t("agency_rank_candidates")
                          : t("agency_analyze_queue")}
                    </button>
                  </div>
                </div>
                {mode === "matching" && !hasJobDescription && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100">
                    {t("agency_matching_empty_jd_hint")}
                  </div>
                )}

                {/* Batch Insights */}
                <BatchInsights files={files} mode={mode} t={t} />

                {/* Error file list — shown when filter is 'error' */}
                {currentFilter === "error" &&
                  displayFiles.some((f) => f.status === "error") && (
                    <div className="space-y-2 animate-fade-in">
                      {displayFiles
                        .filter((f) => f.status === "error")
                        .map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <CandidateAvatar name={file.fileName} />
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                  {file.fileName}
                                </p>
                                <p className="text-xs text-red-600 dark:text-red-400 truncate">
                                  {file.error || t("agency_analysis_failed")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                              <button
                                onClick={() =>
                                  setFiles((prev) =>
                                    prev.map((f) =>
                                      f.id === file.id
                                        ? {
                                            ...f,
                                            status: "queued",
                                            error: undefined,
                                          }
                                        : f,
                                    ),
                                  )
                                }
                                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {t("agency_retry")}
                              </button>
                              <button
                                onClick={() => removeFile(file.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full"
                                title={t("agency_action_remove")}
                                aria-label={t("agency_action_remove")}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                {/* Queued-but-not-started empty state */}
                {!isAnalyzing &&
                  !files.some((f) => f.status === "complete") &&
                  currentFilter !== "error" && (
                    <div className="text-center py-10 text-gray-400 dark:text-gray-500 animate-fade-in">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-10 w-10 mx-auto mb-3 opacity-40"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      <p className="text-sm font-medium">
                        {formatTranslation(t("agency_files_queued"), {
                          action:
                            mode === "matching"
                              ? t("agency_rank_candidates")
                              : t("agency_analyze_queue"),
                        })}
                      </p>
                    </div>
                  )}

                {/* Unified Leaderboard Table */}
                {files.some((f) => f.status === "complete") && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden animate-fade-in">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[640px]">
                        <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-200 uppercase text-xs font-semibold">
                          <tr>
                            <th className="px-6 py-4">
                              {t("agency_table_rank")}
                            </th>
                            <th className="px-6 py-4">
                              {t("agency_table_candidate")}
                            </th>
                            <th className="px-6 py-4 w-32">
                              {t("agency_table_score")}
                            </th>
                            <th className="px-6 py-4">
                              {t("agency_table_summary")}
                            </th>
                            <th className="px-6 py-4 text-right">
                              {t("agency_table_actions")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                          {displayFiles.filter((f) => f.status === "complete")
                            .length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500"
                              >
                                {t("agency_no_completed_results")}
                              </td>
                            </tr>
                          ) : (
                            displayFiles
                              .filter((f) => f.status === "complete")
                              .map((file, index) => {
                                const rankBadge = (
                                  <span
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                                      index < 3
                                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800"
                                        : "bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-slate-600"
                                    }`}
                                  >
                                    {index + 1}
                                  </span>
                                );

                                const score = getScore(file);
                                const summary =
                                  mode === "matching"
                                    ? file.matchSummary
                                    : file.result?.summary;
                                const name =
                                  file.candidateName || file.fileName;

                                return (
                                  <tr
                                    key={file.id}
                                    className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                                  >
                                    <td
                                      className={`px-6 ${hubSettings.denseTable ? "py-3" : "py-4"} whitespace-nowrap font-medium text-center w-16`}
                                    >
                                      {rankBadge}
                                    </td>
                                    <td
                                      className={`px-6 ${hubSettings.denseTable ? "py-3" : "py-4"}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <CandidateAvatar name={name} />
                                        <div>
                                          <p className="font-bold text-gray-900 dark:text-gray-100">
                                            {name}
                                          </p>
                                          <p className="text-xs text-gray-500 truncate max-w-[150px]">
                                            {file.fileName}
                                          </p>
                                        </div>
                                      </div>
                                    </td>
                                    <td
                                      className={`px-6 ${hubSettings.denseTable ? "py-3" : "py-4"} align-middle`}
                                    >
                                      <ScoreBar score={score} />
                                    </td>
                                    <td
                                      className={`px-6 ${hubSettings.denseTable ? "py-3" : "py-4"}`}
                                    >
                                      <p
                                        className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2"
                                        title={summary}
                                      >
                                        {summary ||
                                          t("agency_analysis_pending")}
                                      </p>
                                    </td>
                                    <td
                                      className={`px-6 ${hubSettings.denseTable ? "py-3" : "py-4"} text-right`}
                                    >
                                      <div className="flex items-center justify-end gap-2">
                                        {mode === "general" && (
                                          <button
                                            onClick={() =>
                                              setShowDetailModal(file)
                                            }
                                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                                            title={t(
                                              "agency_action_view_analysis",
                                            )}
                                            aria-label={t(
                                              "agency_action_view_analysis",
                                            )}
                                          >
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              className="h-4 w-4"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                              />
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                              />
                                            </svg>
                                          </button>
                                        )}
                                        <button
                                          onClick={() =>
                                            file.blindResumeText
                                              ? setViewBlindResumeId(file.id)
                                              : handleAnonymize(file.id)
                                          }
                                          disabled={file.isAnonymizing}
                                          className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${file.blindResumeText ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/40" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"}`}
                                          title={
                                            file.isAnonymizing
                                              ? t("agency_action_anonymizing")
                                              : t("agency_action_blind_resume")
                                          }
                                          aria-label={
                                            file.isAnonymizing
                                              ? t("agency_action_anonymizing")
                                              : t("agency_action_blind_resume")
                                          }
                                        >
                                          {file.isAnonymizing ? (
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              className="h-4 w-4"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                              />
                                            </svg>
                                          )}
                                        </button>
                                        {mode === "matching" && (
                                          <button
                                            onClick={() =>
                                              file.prepKit
                                                ? setViewPrepKitId(file.id)
                                                : handleGeneratePrepKit(file.id)
                                            }
                                            disabled={file.isPrepping}
                                            className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${file.prepKit ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800/40" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"}`}
                                            title={
                                              file.isPrepping
                                                ? t(
                                                    "agency_action_generating_prep",
                                                  )
                                                : t("agency_action_prep_kit")
                                            }
                                            aria-label={
                                              file.isPrepping
                                                ? t(
                                                    "agency_action_generating_prep",
                                                  )
                                                : t("agency_action_prep_kit")
                                            }
                                          >
                                            {file.isPrepping ? (
                                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                              <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                                />
                                              </svg>
                                            )}
                                          </button>
                                        )}
                                        <button
                                          onClick={() =>
                                            file.pitchEmail
                                              ? setViewPitchId(file.id)
                                              : handleGeneratePitch(file.id)
                                          }
                                          disabled={file.isPitching}
                                          className={`p-2 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${file.pitchEmail ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-800/40" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"}`}
                                          title={
                                            file.isPitching
                                              ? t(
                                                  "agency_action_generating_pitch",
                                                )
                                              : t(
                                                  "agency_action_generate_pitch",
                                                )
                                          }
                                          aria-label={
                                            file.isPitching
                                              ? t(
                                                  "agency_action_generating_pitch",
                                                )
                                              : t(
                                                  "agency_action_generate_pitch",
                                                )
                                          }
                                        >
                                          {file.isPitching ? (
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              className="h-4 w-4"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                              />
                                            </svg>
                                          )}
                                        </button>
                                        <button
                                          onClick={() => removeFile(file.id)}
                                          className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                                          title={t("agency_action_remove")}
                                          aria-label={t("agency_action_remove")}
                                        >
                                          <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-4 w-4"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Skeleton Loading State */}
                {isAnalyzing && !files.some((f) => f.status === "complete") && (
                  <TableSkeleton />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgencyHub;
