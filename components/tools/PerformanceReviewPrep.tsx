import React, { useState } from 'react';
import { generatePerformanceReviewPrep } from '../../services/aiClient';
import type { PerformanceReviewResult } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';

interface PerformanceReviewPrepProps {
  resumeText: string;
  t: (key: string) => string;
}

const PerformanceReviewPrep: React.FC<PerformanceReviewPrepProps> = ({ resumeText, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PerformanceReviewResult | null>(null);
  const [accomplishments, setAccomplishments] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  const runTool = async () => {
    if (!accomplishments.trim() || !jobTitle.trim()) {
      setError('Please provide your job title and key accomplishments.');
      return;
    }
    const alive = begin();
    setError(null);
    try {
      const apiResult = await generatePerformanceReviewPrep(resumeText, accomplishments, jobTitle);
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
      <p className="text-sm text-gray-600">Get ready for your performance review. Provide your current job title and list your key accomplishments for this review period.</p>
      <div>
        <label htmlFor="job-title" className="block text-sm font-medium text-gray-700">Your Current Job Title</label>
        <input type="text" id="job-title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
      </div>
      <div>
        <label htmlFor="accomplishments" className="block text-sm font-medium text-gray-700">Key Accomplishments</label>
        <textarea
          id="accomplishments"
          value={accomplishments}
          onChange={(e) => setAccomplishments(e.target.value)}
          rows={8}
          className="mt-1 w-full border-gray-300 rounded-md shadow-sm"
          placeholder="e.g., - Led the Project Phoenix launch, resulting in a 15% increase in user engagement.
- Mentored two junior developers.
- Refactored the legacy payment module, reducing server costs by 5%."
          required
        />
      </div>
      <button onClick={runTool} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
        {loading ? 'Generating...' : 'Generate Prep Guide'}
      </button>
    </div>
  );

  const renderResult = () => {
    if (loading) return <StagedLoader title="Preparing your review" steps={["Reading your accomplishments…","Structuring talking points…","Building STAR examples…"]} onCancel={cancel} icon="📈" accent="indigo" />;
    if (error) return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;
    if (!result) return null;
    return (
      <div className="space-y-6">
        <h4 className="text-lg font-bold">Your Performance Review Prep Guide</h4>
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500">
            <h5 className="font-semibold text-blue-900">Opening Statement Idea</h5>
            <p className="text-sm text-blue-800 mt-1">{result.summary}</p>
        </div>
        <div className="p-4 border rounded-lg bg-white">
            <h5 className="font-bold text-gray-800">Key Strengths to Highlight</h5>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">{result.strengthsToHighlight.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div className="p-4 border rounded-lg bg-white">
            <h5 className="font-bold text-gray-800">STAR Method Talking Points</h5>
            <div className="space-y-3 mt-2">
                {result.talkingPoints.map((tp, i) => (
                    <div key={i} className="text-sm p-3 bg-gray-50 rounded-md border">
                        <p className="font-semibold">{tp.accomplishment}</p>
                        <p className="mt-1">{tp.starMethodPoint}</p>
                    </div>
                ))}
            </div>
        </div>
         <div className="p-4 border rounded-lg bg-white">
            <h5 className="font-bold text-gray-800">Growth Area Discussion Points</h5>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">{result.growthAreaDiscussionPoints.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <button onClick={() => setResult(null)} className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200">&larr; Start Over</button>
      </div>
    );
  };

  return result ? renderResult() : renderInput();
};

export default PerformanceReviewPrep;
