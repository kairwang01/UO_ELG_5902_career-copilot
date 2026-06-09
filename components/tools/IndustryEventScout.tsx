import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { findIndustryEvents } from '../../services/aiClient';
import type { EventScoutResult } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';

interface IndustryEventScoutProps {
  t: (key: string) => string;
}

type EventFilter = 'all' | 'job_fair' | 'conference' | 'meetup';

const eventTypeConfig: { [key in EventFilter]: { label: string; color: string; } } = {
    all: { label: 'All', color: ''},
    job_fair: { label: 'Hiring Event', color: 'bg-green-100 text-green-800' },
    conference: { label: 'Conference', color: 'bg-blue-100 text-blue-800' },
    meetup: { label: 'Meetup', color: 'bg-purple-100 text-purple-800' },
};

const IndustryEventScout: React.FC<IndustryEventScoutProps> = ({ t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EventScoutResult | null>(null);
  const [field, setField] = useState('');
  const [location, setLocation] = useState('');
  const [activeFilter, setActiveFilter] = useState<EventFilter>('all');

  const runTool = async () => {
    if (!field.trim() || !location.trim()) {
      setError('Please provide your field of interest and a location.');
      return;
    }
    const alive = begin();
    setError(null);
    try {
      const apiResult = await findIndustryEvents(field, location);
      if (!alive()) return;
      setResult(apiResult);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const renderInput = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">Discover relevant industry conferences, job fairs, and meetups to expand your network and knowledge.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="field-of-interest" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Field of Interest</label>
            <input type="text" id="field-of-interest" value={field} onChange={e => setField(e.target.value)} required className="mt-1 block w-full border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm" placeholder="e.g., Artificial Intelligence"/>
          </div>
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
            <input type="text" id="location" value={location} onChange={e => setLocation(e.target.value)} required className="mt-1 block w-full border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm" placeholder="e.g., London, UK or Online"/>
          </div>
      </div>
      <button onClick={runTool} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
        {loading ? 'Searching...' : 'Find Events'}
      </button>
    </div>
  );

  const renderResult = () => {
    // FIX 4: loading guard moved to the top-level return so StagedLoader shows
    // even on first run when result===null (renderInput would otherwise render).
    if (error) return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;
    if (!result) return null;

    const filteredEvents = result.events.filter(event => 
        activeFilter === 'all' || event.eventType === activeFilter
    );

    return (
      <div className="space-y-4">
        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Found {filteredEvents.length} Events</h4>

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
                const typeInfo = eventTypeConfig[event.eventType] || { label: 'Event', color: 'bg-gray-100 text-gray-800' };
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
                        <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block">Visit Event Page &rarr;</a>
                    </div>
                )
            })}
            {result.events.length > 0 && filteredEvents.length === 0 && (
                <p className="text-gray-600 dark:text-gray-400 text-center py-4">No events found for the selected filter. Try selecting "All".</p>
            )}
            {result.events.length === 0 && <p className="text-gray-600 dark:text-gray-400">No events found for your query. Try broadening your search (e.g., use "Online" as the location).</p>}
        </div>
        {result.groundingChunks && result.groundingChunks.length > 0 && (
            <div className="pt-2 border-t dark:border-slate-700 text-xs text-gray-500 dark:text-gray-400">
            <p className="font-semibold mb-1">Sources:</p>
            <ul className="list-disc list-inside">
                {result.groundingChunks.filter((chunk: any) => chunk.web).map((chunk: any, i: number) => (
                <li key={i}><a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="hover:underline text-blue-600 dark:text-blue-400">{chunk.web.title}</a></li>
                ))}
            </ul>
            </div>
        )}
        <button onClick={() => setResult(null)} className="w-full text-sm py-2 px-4 border-2 border-dashed dark:border-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300">&larr; New Search</button>
      </div>
    );
  };

  // FIX 4: check loading first — on first run result===null so without this
  // guard renderInput() would render instead of the StagedLoader.
  if (loading) return <StagedLoader title="Finding events" steps={["Understanding your field…","Searching for events…","Curating the best matches…"]} onCancel={cancel} icon={<CalendarDays />} accent="amber" />;
  return result ? renderResult() : renderInput();
};

export default IndustryEventScout;