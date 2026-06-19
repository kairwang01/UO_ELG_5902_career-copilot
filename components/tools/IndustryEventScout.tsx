import React, { useState, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import { findIndustryEvents } from '../../services/aiClient';
import type { EventScoutResult } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';
import { useToolResults } from '../../contexts/ToolResultsContext';
import { DownloadButtons, SavedResultBar } from './ToolUtils';

// (b) sample constants
const SAMPLE_FIELD = 'Artificial Intelligence';
const SAMPLE_LOCATION = 'Toronto, Canada';

interface IndustryEventScoutProps {
  t: (key: string) => string;
}

type EventFilter = 'all' | 'job_fair' | 'conference' | 'meetup';

const eventTypeConfig: { [key in EventFilter]: { label: string; color: string; } } = {
    all: { label: 'All', color: ''},
    job_fair: { label: 'Hiring Event', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' },
    conference: { label: 'Conference', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' },
    meetup: { label: 'Meetup', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' },
};

const IndustryEventScout: React.FC<IndustryEventScoutProps> = ({ t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EventScoutResult | null>(null);
  const { canSave, saved, persist } = useToolResults<EventScoutResult>();
  const [fromSaved, setFromSaved] = useState(false);
  const [field, setField] = useState('');
  const [location, setLocation] = useState('');
  const [activeFilter, setActiveFilter] = useState<EventFilter>('all');

  useEffect(() => { if (saved && !result) { setResult(saved.result); setFromSaved(true); } }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const runTool = async () => {
    if (!field.trim() || !location.trim()) {
      setError(t('tool_event_scout_error_required'));
      return;
    }
    const alive = begin();
    setError(null);
    try {
      const apiResult = await findIndustryEvents(field, location);
      if (!alive()) return;
      setResult(apiResult);
      setFromSaved(false);
      persist(apiResult);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const renderInput = () => (
    <div className="space-y-4">
      {/* (a) INTRO CARD */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 space-y-0.5">
        <p className="font-semibold text-slate-800 dark:text-slate-100">{t('tool_event_scout_intro_title')}</p>
        <p>{t('tool_event_scout_intro_desc')}</p>
      </div>

      {/* (b) SAMPLE FILL */}
      <div className="text-right">
        <button
          type="button"
          onClick={() => { setField(SAMPLE_FIELD); setLocation(SAMPLE_LOCATION); }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('tool_try_example')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="field-of-interest" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_event_scout_field_label')}</label>
            <input type="text" id="field-of-interest" value={field} onChange={e => setField(e.target.value)} required className="mt-1 block w-full border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder={t('tool_event_scout_field_placeholder')} />
          </div>
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_event_scout_location_label')}</label>
            <input type="text" id="location" value={location} onChange={e => setLocation(e.target.value)} required className="mt-1 block w-full border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder={t('tool_event_scout_location_placeholder')} />
          </div>
      </div>
      <button onClick={runTool} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
        {loading ? t('tool_event_scout_searching_button') : t('tool_event_scout_find_button')}
      </button>
    </div>
  );

  const renderResult = () => {
    // (e) ERROR RETRY
    if (error) return (
      <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <button
          type="button"
          onClick={runTool}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          {t('tool_try_again')}
        </button>
      </div>
    );
    if (!result) return null;

    const filteredEvents = result.events.filter(event =>
        activeFilter === 'all' || event.eventType === activeFilter
    );

    // (d) Build downloadable text from events
    const downloadText = result.events.map(e =>
      `## ${e.eventName}\n${e.date} | ${e.location} | ${eventTypeConfig[e.eventType as EventFilter]?.label ?? e.eventType}\n${e.summary}\n${e.url}`
    ).join('\n\n');

    return (
      <div className="space-y-4 animate-fade-in">
        <SavedResultBar t={t} canSave={canSave} isSaved={fromSaved} savedAt={saved?.savedAt ?? null} onTryNext={() => { setResult(null); setFromSaved(false); setError(null); }} />
        {/* (d) RESULT ACTIONS — download + new search */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('tool_event_scout_results_title').replace('{count}', String(filteredEvents.length))}</h4>
          <DownloadButtons textContent={downloadText} baseFilename="industry_events" />
        </div>

        <div className="flex flex-wrap gap-2 p-2 bg-gray-100 dark:bg-slate-800 rounded-lg">
            {(['all', 'job_fair', 'conference', 'meetup'] as EventFilter[]).map(filterKey => (
                 <button
                    key={filterKey}
                    onClick={() => setActiveFilter(filterKey)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeFilter === filterKey ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
                 >
                    {eventTypeConfig[filterKey].label}
                </button>
            ))}
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {filteredEvents.map((event, i) => {
                const typeInfo = eventTypeConfig[event.eventType as EventFilter] || { label: 'Event', color: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200' };
                return (
                    <div key={i} className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                        <div className="flex justify-between items-start">
                             <h5 className="font-bold text-blue-800 dark:text-blue-300 pr-4">{event.eventName}</h5>
                             <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${typeInfo.color}`}>
                                {typeInfo.label}
                             </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-semibold mt-1">{event.date} &bull; {event.location}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{event.summary}</p>
                        <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">{t('tool_event_scout_visit_link')} &rarr;</a>
                    </div>
                )
            })}
            {result.events.length > 0 && filteredEvents.length === 0 && (
                <p className="text-gray-600 dark:text-gray-400 text-center py-4">{t('tool_event_scout_no_filter_results')}</p>
            )}
            {result.events.length === 0 && <p className="text-gray-600 dark:text-gray-400">{t('tool_event_scout_no_results')}</p>}
        </div>
        {result.groundingChunks && result.groundingChunks.length > 0 && (
            <div className="pt-2 border-t dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400">
            <p className="font-semibold mb-1">{t('tool_event_scout_sources_label')}:</p>
            <ul className="list-disc list-inside">
                {result.groundingChunks.filter((chunk: any) => chunk.web).map((chunk: any, i: number) => (
                <li key={i}><a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 dark:text-blue-400">{chunk.web.title}</a></li>
                ))}
            </ul>
            </div>
        )}
        <button onClick={() => setResult(null)} className="w-full text-sm py-2 px-4 border-2 border-dashed dark:border-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300">&larr; {t('tool_event_scout_new_search_button')}</button>
      </div>
    );
  };

  // (c) StagedLoader already has onCancel + icon + accent — preserved as-is
  if (loading) return <StagedLoader title="Finding events" steps={["Understanding your field…","Searching for events…","Curating the best matches…"]} onCancel={cancel} icon={<CalendarDays />} accent="amber" />;
  return result ? renderResult() : renderInput();
};

export default IndustryEventScout;
