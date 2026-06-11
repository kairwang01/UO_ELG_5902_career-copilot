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
const InclusivityModal: React.FC<{ suggestions: InclusivitySuggestion[]; onClose: () => void; t: (key: string) => string }> = ({ suggestions, onClose, t }) => {
    useModalBehavior(onClose);
    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={handleOverlayClick}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] animate-fade-scale" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">{t('job_form_inclusivity_results_title')}</h3>
                </div>
                <div className="flex-grow overflow-y-auto p-6 space-y-4">
                    {suggestions.length === 0 ? (
                        <div className="text-center p-6 bg-green-50 text-green-800 rounded-lg dark:bg-green-900/20 dark:text-green-300">
                            <p className="font-semibold">{t('job_form_inclusivity_pass_title')}</p>
                            <p>{t('job_form_inclusivity_pass_desc')}</p>
                        </div>
                    ) : (
                        suggestions.map((item, i) => (
                            <div key={i} className="text-sm p-3 border rounded-md bg-gray-50 border-gray-200 dark:bg-gray-900/60 dark:border-gray-700">
                                <p className="mb-2 text-gray-600 dark:text-gray-300"><strong>{t('job_form_original_label')}:</strong> <span className="line-through">{item.originalText}</span></p>
                                <p className="mb-2 text-green-700 dark:text-green-300"><strong>{t('job_form_suggestion_label')}:</strong> {item.suggestion}</p>
                                <p className="text-xs text-yellow-800 bg-yellow-50 p-2 rounded-md border border-yellow-200 dark:text-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"><strong>{t('job_form_reason_label')}:</strong> {item.explanation}</p>
                            </div>
                        ))
                    )}
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl text-right dark:border-gray-700 dark:bg-gray-900">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">{t('job_form_close')}</button>
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
    const isAiBusy = aiLoading !== null;

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
            setError(t('job_form_error_generate_required'));
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
            setError(err instanceof Error ? err.message : t('job_form_error_generate_failed'));
        } finally {
            setAiLoading(null);
        }
    };
    
    const handleFormatDescription = async () => {
        if (!jobDescription) {
            setError(t('job_form_error_format_required'));
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
            setError(err instanceof Error ? err.message : t('job_form_error_format_failed'));
        } finally {
            setAiLoading(null);
        }
    };

    const handleAnalyzeSalary = async () => {
        if (!jobTitle || !location) {
            setError(t('job_form_error_salary_required'));
            return;
        }
        setAiLoading('salary');
        setError('');
        setSalarySuggestion(null);
        try {
            const result = await analyzeSalary(jobTitle, location, jobDescription);
            setSalarySuggestion({ yearly: result.yearlySalary, monthly: result.monthlySalary });
        } catch (err) {
            setError(err instanceof Error ? err.message : t('job_form_error_salary_failed'));
        } finally {
            setAiLoading(null);
        }
    };
    
    const handleCheckInclusivity = async () => {
        if (!jobDescription) {
            setError(t('job_form_error_inclusivity_required'));
            return;
        }
        setAiLoading('inclusivity');
        setError('');
        try {
            const result = await checkInclusivity(jobDescription);
            setInclusivityResults(result.suggestions);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('job_form_error_inclusivity_failed'));
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

        } catch (err) {
            setError(err instanceof Error ? err.message : t('job_form_error_unknown'));
        } finally {
            setLoading(false);
        }
    };

    const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
    const inputClass = 'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-blue-900/40';
    const secondaryButtonClass = 'rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';
    const primaryButtonClass = 'rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400';

    // Shared form body — used in both embedded and modal modes
    const formBody = (
        <>
            {error && <p role="alert" className="text-red-600 bg-red-100 p-3 rounded-md text-sm dark:bg-red-900/20 dark:text-red-300">{error}</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="job-title" className={labelClass}>{t('job_form_title_label')}</label>
                    <input type="text" id="job-title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} required className={inputClass} />
                </div>
                <div>
                    <label htmlFor="location" className={labelClass}>{t('job_form_location_label')}</label>
                    <input type="text" id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder={t('job_form_location_placeholder')} required className={inputClass} />
                </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3 dark:bg-blue-950/30 dark:border-blue-900/60">
                <label htmlFor="key-responsibilities" className="block text-sm font-medium text-blue-900 dark:text-blue-200">{t('job_form_content_generation_label')}</label>
                <textarea id="key-responsibilities" value={keyResponsibilities} onChange={e => setKeyResponsibilities(e.target.value)} rows={4} className={inputClass} placeholder={t('job_form_key_points_placeholder')} />
                <button type="button" onClick={handleGenerateDescription} disabled={isAiBusy} className={`w-full sm:w-auto ${primaryButtonClass}`}>
                    {aiLoading === 'description' ? t('job_form_generating') : t('job_form_generate_button')}
                </button>
            </div>

            <div>
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        <button type="button" onClick={() => setEditorView('edit')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${editorView === 'edit' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'}`}>{t('job_form_write_tab')}</button>
                        <button type="button" onClick={() => setEditorView('preview')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${editorView === 'preview' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'}`}>{t('job_form_preview_tab')}</button>
                    </nav>
                </div>
                <div className="mt-4">
                    {editorView === 'edit' ? (
                        <div className="animate-fade-in">
                            <label htmlFor="job-description" className="sr-only">{t('job_form_description_label')}</label>
                            <textarea id="job-description" value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={15} required className={inputClass} placeholder={t('job_form_description_placeholder')} />
                            <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                <button type="button" onClick={handleFormatDescription} disabled={isAiBusy || !jobDescription} className={`flex-1 ${secondaryButtonClass}`}>{aiLoading === 'format' ? t('job_form_formatting') : t('job_form_format_button')}</button>
                                <button type="button" onClick={handleCheckInclusivity} disabled={isAiBusy || !jobDescription} className={`flex-1 ${secondaryButtonClass}`}>{aiLoading === 'inclusivity' ? t('job_form_checking') : t('job_form_inclusivity_button')}</button>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in p-4 border rounded-lg bg-gray-50 min-h-[350px] max-h-[calc(100vh-450px)] overflow-y-auto text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                            {jobDescription.trim() ? renderFormattedText(jobDescription) : <p className="text-gray-500 text-center dark:text-gray-400">{t('job_form_preview_empty')}</p>}
                        </div>
                    )}
                </div>
            </div>

            <div>
                <label htmlFor="salary" className={labelClass}>{t('job_form_salary_label')}</label>
                <div className="mt-1 flex gap-2">
                    <input type="text" id="salary" value={salaryRange} onChange={e => setSalaryRange(e.target.value)} placeholder={t('job_form_salary_placeholder')} className={inputClass} />
                    <button type="button" onClick={handleAnalyzeSalary} disabled={isAiBusy} className="flex-shrink-0 px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500">{aiLoading === 'salary' ? t('job_form_analyzing_short') : t('job_form_analyze_rate')}</button>
                </div>
                {salarySuggestion && (
                    <div className="mt-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200 dark:text-blue-100 dark:bg-blue-950/30 dark:border-blue-900/60">
                        <p className="font-semibold">{t('job_form_salary_suggestion')}</p>
                        <p><strong>{t('job_form_yearly_label')}:</strong> {salarySuggestion.yearly}</p>
                        <p><strong>{t('job_form_monthly_label')}:</strong> {salarySuggestion.monthly}</p>
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
                    <form id="job-post-form" onSubmit={handleSubmit} className="space-y-6" aria-busy={loading || isAiBusy}>
                        {formBody}
                    </form>
                    <div className="flex flex-col-reverse gap-3 pt-4 border-t border-gray-200 mt-6 sm:flex-row sm:items-center sm:justify-end dark:border-gray-700">
                        <button type="button" onClick={onClose} className={secondaryButtonClass}>{t('job_form_cancel')}</button>
                        <button type="submit" form="job-post-form" disabled={loading} className={primaryButtonClass}>
                            {loading ? (isEditing ? t('job_form_saving') : t('job_form_posting')) : (isEditing ? t('job_form_save_changes') : t('job_form_post_job'))}
                        </button>
                    </div>
                </div>
                {inclusivityResults && <InclusivityModal suggestions={inclusivityResults} onClose={() => setInclusivityResults(null)} t={t} />}
            </>
        );
    }

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={handleOverlayClick}>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-fade-scale" onClick={(e) => e.stopPropagation()}>
                    <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{isEditing ? t('job_form_edit_title') : t('job_form_create_title')}</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full p-1" aria-label={t('job_form_close')}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <form id="job-post-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-6" aria-busy={loading || isAiBusy}>
                        {formBody}
                    </form>
                    <div className="flex-shrink-0 flex justify-end items-center p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl space-x-3 dark:border-gray-700 dark:bg-gray-900">
                        <button type="button" onClick={onClose} className={secondaryButtonClass}>{t('job_form_cancel')}</button>
                        <button type="submit" form="job-post-form" disabled={loading} className={primaryButtonClass}>
                            {loading ? (isEditing ? t('job_form_saving') : t('job_form_posting')) : (isEditing ? t('job_form_save_changes') : t('job_form_post_job'))}
                        </button>
                    </div>
                </div>
            </div>
            {inclusivityResults && <InclusivityModal suggestions={inclusivityResults} onClose={() => setInclusivityResults(null)} t={t} />}
        </>
    );
};

export default JobPostForm;
