
import React, { useState, useEffect } from 'react';
import { PenLine } from 'lucide-react';
import { generateCoverLetter } from '../../services/aiClient';
import type { CoverLetter } from '../../types';
import StagedLoader from '../StagedLoader';
import { DownloadButtons } from './ToolUtils';
import { useApiStatus } from '../../contexts/ApiStatusContext';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';

interface CoverLetterGeneratorProps {
  resumeText: string;
  market: string;
  initialInput: string;
  t: (key: string) => string;
}

const COVER_LETTER_TEMPLATE = `[Your Name]
[Your Address] | [Your Email] | [Your Phone Number]

[Date]

[Hiring Manager Name] (If known, otherwise use title)
[Hiring Manager Title]
[Company Name]
[Company Address]

Dear [Mr./Ms./Mx. Last Name],

I am writing to express my enthusiastic interest in the [Job Title] position at [Company Name], which I discovered through [Platform where you saw the ad, e.g., LinkedIn, company website]. Having followed [Company Name]'s impressive work in [Industry], I am confident that my skills and experience in [mention 1-2 key skills from your resume, e.g., project management and data analysis] align perfectly with the requirements of this role.

In my previous position at [Previous Company], I was responsible for [mention a key responsibility]. I successfully [mention a key achievement that relates to the job description, quantifying it if possible, e.g., increased user engagement by 15% by redesigning the onboarding flow]. This experience has equipped me with a strong foundation in [relevant skill], which I am eager to bring to your team.

I am particularly drawn to [Company Name]'s commitment to [mention a company value, project, or mission statement you admire]. My own professional values are centered on [mention your own values, e.g., collaboration, innovation, and user-centric design], and I believe I would be a great cultural fit.

Thank you for considering my application. I have attached my resume for your review and welcome the opportunity to discuss how my background and passion for [Industry] can contribute to [Company Name].

Sincerely,
[Your Name]`;

const CoverLetterGenerator: React.FC<CoverLetterGeneratorProps> = ({ resumeText, market, initialInput, t }) => {
  const { loading, begin, end, cancel } = useCancellableLoading();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoverLetter | null>(null);
  const [jobDescription, setJobDescription] = useState(initialInput);
  const [editableResult, setEditableResult] = useState('');

  const { apiStatus } = useApiStatus();

  useEffect(() => {
    setJobDescription(initialInput);
    if (initialInput) {
        runTool(initialInput);
    }
  }, [initialInput]);

  const runTool = async (input: string) => {
    if (apiStatus !== 'online') {
        setError("The AI is currently unavailable. Please try again later.");
        return;
    }
    if (!input) {
        setError(t('tool_cover_letter_error_required'));
        return;
    }
    const alive = begin();
    setError(null);
    setResult(null);
    try {
      const apiResult = await generateCoverLetter(resumeText, input, market);
      if (!alive()) return;
      setResult(apiResult);
      setEditableResult(apiResult.letter);
    } catch (err) {
      if (alive()) setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      if (alive()) end();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runTool(jobDescription);
  };

  const renderFallback = () => (
    <div className="space-y-4">
        <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400">
            <h4 className="font-bold text-yellow-800">AI Not Available</h4>
            <p className="text-sm text-yellow-700 mt-1">The AI service is currently unavailable. You can use this professional template to get started on your cover letter.</p>
        </div>
        <textarea
          value={COVER_LETTER_TEMPLATE}
          onChange={(e) => setEditableResult(e.target.value)}
          className="w-full h-96 p-4 border rounded-lg bg-white font-serif text-sm"
        />
        <DownloadButtons textContent={editableResult || COVER_LETTER_TEMPLATE} baseFilename="cover_letter_template" />
    </div>
  );

  const renderInput = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        className="w-full h-40 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
        placeholder={t('tool_cover_letter_placeholder')}
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        required
      />
      <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
        {loading ? t('tool_cover_letter_generating_button') : t('tool_cover_letter_generate_button')}
      </button>
    </form>
  );

  const renderResult = () => {
    if (loading) return (
      <StagedLoader
        title="Writing your cover letter"
        steps={[
          'Reading your resume…',
          'Understanding the job description…',
          `Tailoring for the ${market} market…`,
          'Drafting & polishing…',
        ]}
        intervalMs={1800}
        onCancel={cancel}
        icon={<PenLine />}
        accent="lime"
      />
    );
    if (error && apiStatus === 'online') return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;
    if (!result) return apiStatus !== 'online' ? renderFallback() : renderInput();

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-bold">{t('tool_cover_letter_results_title')}</h4>
          <DownloadButtons textContent={editableResult} baseFilename="cover_letter" />
        </div>
        <textarea
          value={editableResult}
          onChange={(e) => setEditableResult(e.target.value)}
          className="w-full h-96 p-4 border rounded-lg bg-white font-serif text-sm"
        />
      </div>
    );
  };

  return apiStatus !== 'online' && !result ? renderFallback() : (result ? renderResult() : renderInput());
};

export default CoverLetterGenerator;
