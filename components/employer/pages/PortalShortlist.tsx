import React, { useCallback, useEffect, useState } from 'react';
import {
  BookmarkCheck,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Loader2,
  MailCheck,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react';
import { PortalTopBar } from '../PortalTopBar';
import type { AppSession as Session } from '../../../lib/data';
import {
  listShortlist,
  removeFromShortlist,
  updateShortlistEntry,
  type ShortlistEntry,
  type ShortlistStatus,
} from '../../../lib/shortlistData';
import { useToast as useSharedToast } from '../../Toast';

interface PortalShortlistProps {
  session: Session;
  darkMode: boolean;
  t: (key: string) => string;
}

// ---- helpers ----------------------------------------------------------------

function escapeCSVField(value: string): string {
  const s = String(value ?? '');
  // If the value contains a comma, double-quote, or newline, wrap in quotes
  // and double any inner quotes.
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportCSV(entries: ShortlistEntry[]): void {
  const headers = [
    'Candidate Name',
    'Current Role',
    'Skills',
    'Match Score',
    'Match Reasons',
    'Associated Job',
    'Status',
    'Notes',
    'Saved At',
  ];

  const rows = entries.map((e) => [
    escapeCSVField(e.candidate_name),
    escapeCSVField(e.candidate_snapshot.current_role ?? ''),
    escapeCSVField((e.candidate_snapshot.skills ?? []).join('; ')),
    escapeCSVField(String(e.match_score)),
    escapeCSVField(e.match_reasons.join('; ')),
    escapeCSVField(e.job_title),
    escapeCSVField(e.status),
    escapeCSVField(e.notes),
    escapeCSVField(new Date(e.saved_at).toLocaleString()),
  ]);

  const csvContent = [headers.map(escapeCSVField).join(','), ...rows.map((r) => r.join(','))].join(
    '\n',
  );
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'shortlist.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function buildOutreachMessage(entry: ShortlistEntry): string {
  const role = entry.candidate_snapshot.current_role
    ? `, currently working as ${entry.candidate_snapshot.current_role},`
    : '';
  const skills =
    (entry.candidate_snapshot.skills ?? []).length > 0
      ? `Your background in ${entry.candidate_snapshot.skills!.slice(0, 3).join(', ')} stood out to us. `
      : '';
  return `Hi ${entry.candidate_name},

I came across your profile and wanted to reach out regarding an opportunity for the ${entry.job_title} role at our company. Your profile${role} impressed us with a ${entry.match_score}% match to our requirements. ${skills}

We'd love to learn more about your experience and discuss whether this could be a great fit. Would you be open to a quick 30-minute conversation this week?

Best regards`;
}

// ---- Status chip ------------------------------------------------------------

const STATUS_STYLES: Record<ShortlistStatus, string> = {
  saved: 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
  contacted:
    'bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700',
  rejected:
    'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700',
};

function StatusChip({ status, t }: { status: ShortlistStatus; t: (key: string) => string }) {
  const label = t(`shortlist_status_${status}`);
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {label}
    </span>
  );
}

// ---- Main component ---------------------------------------------------------

export function PortalShortlist({ session, darkMode, t }: PortalShortlistProps) {
  const dm = darkMode;
  const employerUid = session.user.id;

  const [entries, setEntries] = useState<ShortlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // inline notes editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);

  const { addToast } = useSharedToast();

  // ---- data fetch -----------------------------------------------------------
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listShortlist(employerUid);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shortlist_load_error'));
    } finally {
      setLoading(false);
    }
  }, [employerUid, t]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ---- actions --------------------------------------------------------------
  const handleRemove = async (id: string) => {
    if (busyEntryId) return;
    setBusyEntryId(id);
    try {
      await removeFromShortlist(employerUid, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      addToast(t('shortlist_removed'), 'success');
    } catch {
      addToast(t('shortlist_action_error'), 'error');
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleMarkContacted = async (entry: ShortlistEntry) => {
    if (entry.status === 'contacted' || busyEntryId) return;
    setBusyEntryId(entry.id);
    try {
      await updateShortlistEntry(employerUid, entry.id, { status: 'contacted' });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: 'contacted' } : e)));
      addToast(t('shortlist_marked_contacted'), 'success');
    } catch {
      addToast(t('shortlist_action_error'), 'error');
    } finally {
      setBusyEntryId(null);
    }
  };

  const handleCopyOutreach = (entry: ShortlistEntry) => {
    const msg = buildOutreachMessage(entry);
    navigator.clipboard.writeText(msg).then(
      () => addToast(t('shortlist_outreach_copied'), 'success'),
      () => addToast(t('shortlist_action_error'), 'error'),
    );
  };

  const handleStartEditNotes = (entry: ShortlistEntry) => {
    setEditingId(entry.id);
    setEditNotes(entry.notes);
  };

  const handleSaveNotes = async (id: string) => {
    if (busyEntryId) return;
    setBusyEntryId(id);
    try {
      await updateShortlistEntry(employerUid, id, { notes: editNotes });
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, notes: editNotes } : e)));
      addToast(t('shortlist_notes_saved'), 'success');
    } catch {
      addToast(t('shortlist_action_error'), 'error');
    } finally {
      setEditingId(null);
      setBusyEntryId(null);
    }
  };

  // ---- render ---------------------------------------------------------------
  const card = dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  return (
    <>
      <PortalTopBar title={t('shortlist_page_title')} darkMode={dm} />

      <div className="max-w-[1088px] mx-auto p-8 animate-view-fade">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>
              {t('shortlist_page_title')}
            </h1>
            <p className={`text-sm mt-1 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('shortlist_page_desc')}
            </p>
          </div>
          {entries.length > 0 && (
            <button
              onClick={() => exportCSV(entries)}
              aria-label={t('shortlist_export_csv')}
              className="flex items-center gap-2 px-4 py-2 bg-[#1d4ed8] text-white rounded-lg text-sm font-medium hover:bg-[#1a45c9] transition-colors"
            >
              <Download className="w-4 h-4" />
              {t('shortlist_export_csv')}
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className={`w-8 h-8 animate-spin ${dm ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-sm">{error}</div>
        )}

        {/* Empty state */}
        {!loading && !error && entries.length === 0 && (
          <div
            className={`rounded-xl border p-12 text-center ${card}`}
          >
            <BookmarkCheck className={`w-12 h-12 mx-auto mb-4 ${dm ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={`text-lg font-semibold mb-2 ${dm ? 'text-white' : 'text-gray-900'}`}>
              {t('shortlist_empty_title')}
            </p>
            <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
              {t('shortlist_empty_desc')}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && entries.length > 0 && (
          <div className={`rounded-xl border overflow-hidden ${card}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b ${dm ? 'border-gray-700 bg-gray-700/50' : 'border-gray-200 bg-gray-50'}`}>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t('shortlist_col_candidate')}
                    </th>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t('shortlist_col_job')}
                    </th>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t('shortlist_col_score')}
                    </th>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t('shortlist_col_status')}
                    </th>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t('shortlist_col_saved')}
                    </th>
                    <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t('shortlist_col_notes')}
                    </th>
                    <th className={`px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                      {t('shortlist_col_actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit">
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        dm
                          ? 'border-gray-700 hover:bg-gray-700/40'
                          : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      {/* Candidate */}
                      <td className="px-5 py-4 min-w-[180px]">
                        <p className={`font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>
                          {entry.candidate_name}
                        </p>
                        {entry.candidate_snapshot.current_role && (
                          <p className={`text-xs mt-0.5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                            {entry.candidate_snapshot.current_role}
                          </p>
                        )}
                        {/* Skills chips */}
                        {(entry.candidate_snapshot.skills ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(entry.candidate_snapshot.skills ?? []).slice(0, 5).map((skill) => (
                              <span
                                key={skill}
                                className={`px-1.5 py-0.5 rounded text-xs ${
                                  dm
                                    ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Match reasons */}
                        {entry.match_reasons.length > 0 && (
                          <ul className={`mt-2 space-y-0.5 text-xs ${dm ? 'text-green-400' : 'text-green-700'}`}>
                            {entry.match_reasons.slice(0, 3).map((r, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        )}
                        {/* Missing requirements */}
                        {(entry.missing_requirements ?? []).length > 0 && (
                          <ul className={`mt-1 space-y-0.5 text-xs ${dm ? 'text-red-400' : 'text-red-600'}`}>
                            {(entry.missing_requirements ?? []).slice(0, 2).map((r, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>

                      {/* Job */}
                      <td className={`px-5 py-4 min-w-[140px] ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
                        {entry.job_title}
                      </td>

                      {/* Score */}
                      <td className="px-5 py-4">
                        <span
                          className={`text-lg font-bold ${
                            entry.match_score >= 80
                              ? dm ? 'text-green-400' : 'text-green-600'
                              : entry.match_score >= 60
                              ? dm ? 'text-yellow-400' : 'text-yellow-600'
                              : dm ? 'text-red-400' : 'text-red-600'
                          }`}
                        >
                          {entry.match_score}%
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusChip status={entry.status} t={t} />
                      </td>

                      {/* Saved at */}
                      <td className={`px-5 py-4 whitespace-nowrap text-xs ${dm ? 'text-gray-400' : 'text-gray-500'}`}>
                        {new Date(entry.saved_at).toLocaleDateString()}
                      </td>

                      {/* Notes inline edit */}
                      <td className="px-5 py-4 min-w-[200px]">
                        {editingId === entry.id ? (
                          <div className="flex flex-col gap-1">
                            <textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              rows={3}
                              maxLength={2000}
                              className={`text-xs rounded border px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                dm
                                  ? 'bg-gray-700 border-gray-600 text-gray-100'
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleSaveNotes(entry.id)}
                                disabled={busyEntryId === entry.id}
                                className="text-xs px-2 py-0.5 bg-[#1d4ed8] text-white rounded hover:bg-[#1a45c9] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {busyEntryId === entry.id ? t('shortlist_saving_notes') : t('shortlist_save_notes')}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                disabled={busyEntryId === entry.id}
                                className={`text-xs px-2 py-0.5 rounded border ${
                                  dm ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-600'
                                }`}
                              >
                                {t('shortlist_cancel')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-1 group">
                            <span className={`text-xs flex-1 ${dm ? 'text-gray-300' : 'text-gray-600'}`}>
                              {entry.notes || <span className={dm ? 'text-gray-600' : 'text-gray-400'}>{t('shortlist_no_notes')}</span>}
                            </span>
                            <button
                              onClick={() => handleStartEditNotes(entry)}
                              aria-label={t('shortlist_edit_notes')}
                              className={`opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded ${
                                dm ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                              }`}
                              title={t('shortlist_edit_notes')}
                            >
                              <Pencil className={`w-3 h-3 ${dm ? 'text-gray-400' : 'text-gray-500'}`} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Mark as contacted */}
                          <button
                            onClick={() => handleMarkContacted(entry)}
                            disabled={entry.status === 'contacted' || busyEntryId === entry.id}
                            title={t('shortlist_mark_contacted')}
                            aria-label={t('shortlist_mark_contacted')}
                            className={`p-1.5 rounded transition-colors ${
                              entry.status === 'contacted' || busyEntryId === entry.id
                                ? dm ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                                : dm
                                ? 'text-teal-400 hover:bg-teal-900/30'
                                : 'text-teal-600 hover:bg-teal-50'
                            }`}
                          >
                            <MailCheck className="w-4 h-4" />
                          </button>

                          {/* Copy outreach */}
                          <button
                            onClick={() => handleCopyOutreach(entry)}
                            title={t('shortlist_copy_outreach')}
                            aria-label={t('shortlist_copy_outreach')}
                            className={`p-1.5 rounded transition-colors ${
                              dm ? 'text-blue-400 hover:bg-blue-900/30' : 'text-blue-600 hover:bg-blue-50'
                            }`}
                          >
                            <ClipboardCopy className="w-4 h-4" />
                          </button>

                          {/* Remove */}
                          <button
                            onClick={() => handleRemove(entry.id)}
                            title={t('shortlist_remove')}
                            aria-label={t('shortlist_remove')}
                            disabled={busyEntryId === entry.id}
                            className={`p-1.5 rounded transition-colors ${
                              busyEntryId === entry.id
                                ? dm ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed'
                                : dm ? 'text-red-400 hover:bg-red-900/30' : 'text-red-500 hover:bg-red-50'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`px-5 py-3 border-t text-xs ${dm ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
              {entries.length} {t('shortlist_total_entries')}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
