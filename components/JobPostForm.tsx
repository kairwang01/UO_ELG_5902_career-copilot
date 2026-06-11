import React, { useState, useEffect } from 'react';
import type { AppSession as Session } from '../lib/data';
import { generateJobDescription, analyzeSalary, checkInclusivity, formatJobDescription } from '../services/aiClient';
import type { InclusivitySuggestion, UserProfile } from '../types';
import { saveJobPosting, type JobPosting } from '../lib/recruitingData';
import { renderFormattedText } from './tools/ToolUtils';
import { useModalBehavior } from '../hooks/useModalBehavior';

interface JobPostFormProps {
    session: Session;
    profile: UserProfile;
    onClose: () => void;
    onPostCreated: () => void;
    existingJob?: JobPosting | null;
    t: (key: string) => string;
    /** When true, renders as an in-flow container rather than a fixed modal overlay. */
    embedded?: boolean;
}

// Simple modal component for inclusivity results
const InclusivityModal: React.FC<{ suggestions: InclusivitySuggestion[]; onClose: () => void }> = ({ suggestions, onClose }) => {
    useModalBehavior(onClose);
    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={handleOverlayClick}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-800">Inclusivity Check Results</h3>
                </div>
                <div className="flex-grow overflow-y-auto p-6 space-y-4">
                    {suggestions.length === 0 ? (
                        <div className="text-center p-6 bg-green-50 text-green-800 rounded-lg">
                            <p className="font-semibold">Great job!</p>
                            <p>No major inclusivity issues were found in your job description.</p>
                        </div>
                    ) : (
                        suggestions.map((item, i) => (
                            <div key={i} className="text-sm p-3 border rounded-md bg-gray-50">
                                <p className="mb-2 text-gray-600"><strong>Original:</strong> <span className="line-through">{item.originalText}</span></p>
                                <p className="mb-2 text-green-700"><strong>Suggestion:</strong> {item.suggestion}</p>
                                <p className="text-xs text-yellow-800 bg-yellow-50 p-2 rounded-md border border-yellow-200"><strong>Reason:</strong> {item.explanation}</p>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-4 border-t bg-gray-50 rounded-b-xl text-right">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Close</button>
                </div>
            </div>
        </div>
    );
};


const JobPostForm: React.FC<JobPostFormProps> = ({ session, profile, onClose, onPostCreated, existingJob, t, embedded = false }) => {
    // Main form state
    const [jobTitle, setJobTitle] = useState('');
    const [location, setLocation] = useState('');
    const [salaryRange, setSalaryRange] = useState('');
    const [keyResponsibilities, setKeyResponsibilities] = useState('');
    const [jobDescription, setJobDescription] = useState('');

    // UI/Loading state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [aiLoading, setAiLoading] = useState<null | 'description' | 'salary' | 'inclusivity' | 'format'>(null);
    const [inclusivityResults, setInclusivityResults] = useState<InclusivitySuggestion[] | null>(null);
    // While the nested InclusivityModal is open, Escape should close that layer, not the form.
    useModalBehavior(onClose, !embedded && !inclusivityResults);
    const [salarySuggestion, setSalarySuggestion] = useState<{ yearly: string; monthly: string; } | null>(null);
    const [editorView, setEditorView] = useState<'edit' | 'preview'>('edit');


    const isEditing = !!existingJob;

    useEffect(() => {
        if (existingJob) {
            setJobTitle(existingJob.title);
            setLocation(existingJob.location || '');
            setSalaryRange(existingJob.salary_range || '');
            setJobDescription(existingJob.description || '');
            // Key responsibilities are not saved, so they will be blank on edit.
        }
    }, [existingJob]);

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    
    const handleGenerateDescription = async () => {
        if (!jobTitle || !keyResponsibilities) {
            setError("Please provide a Job Title and Key Responsibilities to generate a description.");
            return;
        }
        setAiLoading('description');
        setError('');
        try {
            const { company_name, company_description } = profile;
            const result = await generateJobDescription(jobTitle, keyResponsibilities, company_name || '', company_description || '');
            setJobDescription(result.jobDescription);
            setEditorView('preview');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate description.");
        } finally {
            setAiLoading(null);
        }
    };
    
    const handleFormatDescription = async () => {
        if (!jobDescription) {
            setError("There is no description to format.");
            return;
        }
        setAiLoading('format');
        setError('');
        try {
            const result = await formatJobDescription(jobDescription);
            setJobDescription(result.formattedDescription);
            if (result.jobTitle && !jobTitle) {
                setJobTitle(result.jobTitle);
            }
            if (result.location && !location) {
                setLocation(result.location);
            }
            setEditorView('preview');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to format description.");
        } finally {
            setAiLoading(null);
        }
    };

    const handleAnalyzeSalary = async () => {
        if (!jobTitle || !location) {
            setError("Please provide a Job Title and Location to analyze the market rate.");
            return;
        }
        setAiLoading('salary');
        setError('');
        setSalarySuggestion(null);
        try {
            const result = await analyzeSalary(jobTitle, location, jobDescription);
            setSalarySuggestion({ yearly: result.yearlySalary, monthly: result.monthlySalary });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to analyze salary.");
        } finally {
            setAiLoading(null);
        }
    };
    
    const handleCheckInclusivity = async () => {
        if (!jobDescription) {
            setError("Please generate or write a job description before checking it.");
            return;
        }
        setAiLoading('inclusivity');
        setError('');
        try {
            const result = await checkInclusivity(jobDescription);
            setInclusivityResults(result.suggestions);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to check inclusivity.");
        } finally {
            setAiLoading(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const jobData = {
                title: jobTitle,
                location,
                description: jobDescription,
                salary_range: salaryRange,
                // Snapshot company name at create time; profile.company_name is
                // trusted (read from server-provisioned user doc, not user input).
                company_name: profile.company_name ?? null,
            };

            await saveJobPosting(session.user.id, jobData, isEditing ? existingJob.id : undefined);

            onPostCreated();
            onClose();

        } catch (err: any) {
            setError(err.message || 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };

    // Shared form body — used in both embedded and modal modes
    const formBody = (
        <>
            {error && <p className="text-red-600 bg-red-100 p-3 rounded-md text-sm">{error}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="job-title" className="block text-sm font-medium text-gray-700">Job Title</label>
                    <input type="text" id="job-title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                </div>
                <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location</label>
                    <input type="text" id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g., Toronto, ON or Remote" required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <label htmlFor="key-responsibilities" className="block text-sm font-medium text-blue-900">AI Content Generation</label>
                <textarea id="key-responsibilities" value={keyResponsibilities} onChange={e => setKeyResponsibilities(e.target.value)} rows={4} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="Enter 3-5 bullet points or a short paragraph of the main tasks for the AI to expand upon." />
                <button type="button" onClick={handleGenerateDescription} disabled={aiLoading === 'description'} className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-400">
                    {aiLoading === 'description' ? 'Generating...' : 'Generate from Key Points'}
                </button>
            </div>

            <div>
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        <button type="button" onClick={() => setEditorView('edit')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${editorView === 'edit' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Write Description</button>
                        <button type="button" onClick={() => setEditorView('preview')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${editorView === 'preview' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Preview</button>
                    </nav>
                </div>
                <div className="mt-4">
                    {editorView === 'edit' ? (
                        <div className="animate-fade-in">
                            <label htmlFor="job-description" className="sr-only">Job Description</label>
                            <textarea id="job-description" value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={15} required className="block w-full border-gray-300 rounded-md shadow-sm" />
                            <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                <button type="button" onClick={handleFormatDescription} disabled={aiLoading === 'format' || !jobDescription} className="flex-1 text-sm py-2 px-4 border rounded-md hover:bg-gray-100 disabled:opacity-50">{aiLoading === 'format' ? 'Formatting...' : 'Format with AI'}</button>
                                <button type="button" onClick={handleCheckInclusivity} disabled={aiLoading === 'inclusivity' || !jobDescription} className="flex-1 text-sm py-2 px-4 border rounded-md hover:bg-gray-100 disabled:opacity-50">{aiLoading === 'inclusivity' ? 'Checking...' : 'Check for Inclusivity'}</button>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in p-4 border rounded-md bg-gray-50 min-h-[350px] max-h-[calc(100vh-450px)] overflow-y-auto text-sm">
                            {jobDescription.trim() ? renderFormattedText(jobDescription) : <p className="text-gray-500 text-center">The preview will appear here.</p>}
                        </div>
                    )}
                </div>
            </div>

            <div>
                <label htmlFor="salary" className="block text-sm font-medium text-gray-700">Salary Range (Optional)</label>
                <div className="mt-1 flex gap-2">
                    <input type="text" id="salary" value={salaryRange} onChange={e => setSalaryRange(e.target.value)} placeholder="e.g., 80000 - 100000 CAD" className="block w-full border-gray-300 rounded-md shadow-sm" />
                    <button type="button" onClick={handleAnalyzeSalary} disabled={aiLoading === 'salary'} className="flex-shrink-0 px-4 py-2 bg-gray-600 text-white font-semibold rounded-md shadow-sm hover:bg-gray-700 disabled:bg-gray-400">{aiLoading === 'salary' ? '...' : 'Analyze Rate'}</button>
                </div>
                {salarySuggestion && (
                    <div className="mt-2 text-sm text-gray-600 bg-blue-50 p-2 rounded-md border border-blue-200">
                        <p className="font-semibold">Suggestion:</p>
                        <p><strong>Yearly:</strong> {salarySuggestion.yearly}</p>
                        <p><strong>Monthly:</strong> {salarySuggestion.monthly}</p>
                    </div>
                )}
            </div>
        </>
    );

    if (embedded) {
        // Render as a plain page section — no backdrop or fixed positioning
        return (
            <>
                <div className="max-w-[1088px] mx-auto p-6">
                    <form id="job-post-form" onSubmit={handleSubmit} className="space-y-6">
                        {formBody}
                    </form>
                    <div className="flex justify-end items-center pt-4 border-t border-gray-200 mt-6 space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Cancel</button>
                        <button type="submit" form="job-post-form" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-400">
                            {loading ? (isEditing ? 'Saving...' : 'Posting...') : (isEditing ? 'Save Changes' : 'Post Job')}
                        </button>
                    </div>
                </div>
                {inclusivityResults && <InclusivityModal suggestions={inclusivityResults} onClose={() => setInclusivityResults(null)} />}
            </>
        );
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={handleOverlayClick}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                    <div className="flex-shrink-0 flex items-center justify-between p-4 border-b">
                        <h3 className="text-xl font-bold text-gray-800">{isEditing ? 'Edit Job Posting' : 'Create a New Job Posting'}</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1" aria-label="Close modal">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <form id="job-post-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-6">
                        {formBody}
                    </form>
                    <div className="flex-shrink-0 flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-xl space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Cancel</button>
                        <button type="submit" form="job-post-form" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-400">
                            {loading ? (isEditing ? 'Saving...' : 'Posting...') : (isEditing ? 'Save Changes' : 'Post Job')}
                        </button>
                    </div>
                </div>
            </div>
            {inclusivityResults && <InclusivityModal suggestions={inclusivityResults} onClose={() => setInclusivityResults(null)} />}
        </>
    );
};

export default JobPostForm;
