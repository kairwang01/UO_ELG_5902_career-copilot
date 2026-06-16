
import React, { useState, useRef } from 'react';
import type { ResumeImage } from '../types';
import { SUPPORTED_MARKETS } from '../config';
import { extractTextFromUrl } from '../services/aiClient';
import { parseFile } from '../services/fileHelpers';
import ResumePreview from './ResumePreview';

interface UploadSectionProps {
  resumeText: string;
  setResumeText: (text: string) => void;
  resumeImages: ResumeImage[] | null;
  setResumeImages: (images: ResumeImage[] | null) => void;
  onInitiateAnalysis: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  market: string;
  setMarket: (market: string) => void;
  t: (key: string) => string;
  variant?: 'site' | 'workspace';
  /** Workspace only: persist the original uploaded file to Storage (logged-in candidate). */
  onResumeFileSelected?: (file: File) => void;
  /** The resume file already saved for this user, if any. */
  storedResumeFile?: { name: string | null; url: string; uploadedAt?: string | null } | null;
  onRemoveResumeFile?: () => void;
  isSavingResumeFile?: boolean;
}

const InputMethodButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-[var(--site-radius)] border px-3 py-2.5 text-sm font-semibold transition-all sm:min-h-12 sm:px-4 sm:py-3 ${
        active
          ? 'bg-[var(--site-action)] text-white border-[var(--site-action)]'
          : 'bg-[var(--site-surface)] text-[var(--site-text)] border-[var(--site-border)] hover:border-[var(--site-action)]/40'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 text-center leading-tight">{label}</span>
    </button>
);

const UploadSection: React.FC<UploadSectionProps> = ({
  resumeText,
  setResumeText,
  resumeImages,
  setResumeImages,
  onInitiateAnalysis,
  isLoading,
  error,
  setError,
  market,
  setMarket,
  t,
  onResumeFileSelected,
  storedResumeFile,
  onRemoveResumeFile,
  isSavingResumeFile,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'upload' | 'url'>('paste');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [isUrlProcessing, setIsUrlProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatMessage = (key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
      (message, [token, value]) => message.split(`{${token}}`).join(String(value)),
      t(key),
    );

  const clearInputs = () => {
    setResumeText('');
    setResumeImages(null);
    setUrlInput('');
    setError(null);
    setInfoMessage(null);
  };

  const handleTabChange = (tab: 'paste' | 'upload' | 'url') => {
    setActiveTab(tab);
  };

  const handleUrlImport = async () => {
    if (!urlInput.trim()) {
        setError(t('upload_url_required'));
        return;
    }

    setIsUrlProcessing(true);
    setResumeText('');
    setResumeImages(null);
    setError(null);
    setInfoMessage(t('upload_url_importing'));

    try {
        const { extractedText } = await extractTextFromUrl(urlInput);

        if (extractedText && extractedText.trim().length > 300) {
            setResumeText(extractedText);
            setActiveTab('paste');
            setInfoMessage(t('upload_url_import_success'));
        } else {
            setError(t('upload_url_import_insufficient'));
            setInfoMessage(null);
        }
    } catch (err) {
        // Some sites (e.g. LinkedIn) block automated import — always leave the user a way forward.
        const detail = err instanceof Error ? err.message : t('upload_url_unknown_error');
        setError(`${detail} ${t('upload_url_import_error_suffix')}`);
        setInfoMessage(null);
    } finally {
        setIsUrlProcessing(false);
    }
  };


  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    clearInputs();
    setIsParsing(true);
    setInfoMessage(formatMessage('upload_file_processing', { fileName: file.name }));

    try {
        const result = await parseFile(file);

        if (result.images && result.images.length > 0) {
            setResumeImages(result.images);
            setActiveTab('upload');
            setInfoMessage(formatMessage('upload_file_images_success', { count: result.images.length, fileName: file.name }));
        } else if (result.text) {
            setResumeText(result.text);
            setActiveTab('paste');
            setInfoMessage(formatMessage('upload_file_text_success', { fileName: file.name }));
        } else {
            throw new Error(t('upload_file_no_content'));
        }
        // Persist the original file to Storage (workspace + signed-in only). The
        // extracted text above is already feeding the tools; this keeps a
        // downloadable copy of exactly what the user submitted.
        onResumeFileSelected?.(file);
    } catch (parseError) {
        setError(parseError instanceof Error ? parseError.message : t('upload_file_parse_failed'));
        setInfoMessage(null);
    } finally {
        setIsParsing(false);
        if (e.target) e.target.value = '';
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResumeText(e.target.value);
    if(error) setError(null);
    if(infoMessage) setInfoMessage(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInitiateAnalysis(e);
  };

  const hasContent = !!resumeText.trim() || (!!resumeImages && resumeImages.length > 0);
  const analysisButtonDisabled = isLoading || isUrlProcessing || !hasContent;

  return (
    <div className="rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface)] p-6 sm:p-8 animate-slide-in-up">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-[var(--site-text)] tracking-tight">
          {t('upload_title')}
        </h2>
        <p className="mt-2 text-[var(--site-text-muted)] max-w-2xl mx-auto">
          {t('upload_subtitle')}
        </p>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6 max-w-3xl mx-auto">

        <div className="space-y-2">
            <label
              htmlFor="market-select"
              className="flex items-center justify-center gap-2 text-sm font-medium text-[var(--site-text)]"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m-9 9h18" />
                </svg>
                {t('upload_market_label')}
            </label>
            <select
                id="market-select"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="w-full max-w-xs mx-auto block bg-[var(--site-surface)] border border-[var(--site-border)] text-[var(--site-text)] text-base rounded-[var(--site-radius)] focus:ring-2 focus:ring-[var(--site-action)]/40 focus:border-[var(--site-action)] p-3 transition"
            >
                {SUPPORTED_MARKETS.map((marketName) => (
                    <option key={marketName} value={marketName}>{marketName}</option>
                ))}
            </select>
        </div>

        {(storedResumeFile || isSavingResumeFile) && (
          <div className="flex items-center gap-3 rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface-muted)] p-3 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 text-[var(--site-action)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
            {isSavingResumeFile ? (
              <span className="min-w-0 flex-1 text-[var(--site-text-muted)]">{t('resume_file_saving')}</span>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-[var(--site-text)]" title={storedResumeFile?.name ?? undefined}>
                  {storedResumeFile?.name || t('resume_file_stored_label')}
                </span>
                {storedResumeFile?.url && (
                  <a
                    href={storedResumeFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 font-semibold text-[var(--site-action)] hover:underline"
                  >
                    {t('resume_file_download')}
                  </a>
                )}
                {onRemoveResumeFile && (
                  <button
                    type="button"
                    onClick={onRemoveResumeFile}
                    className="shrink-0 text-[var(--site-text-muted)] hover:text-[var(--site-risk)] hover:underline"
                  >
                    {t('resume_file_remove')}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-2 rounded-[var(--site-radius)] bg-[var(--site-surface-muted)] p-1.5 sm:grid-cols-3 sm:gap-3">
            <InputMethodButton label={t('upload_tab_paste')} active={activeTab==='paste'} onClick={() => handleTabChange('paste')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 11-2 0V4H6v12a1 1 0 11-2 0V4zm5 2a1 1 0 00-1 1v6a1 1 0 102 0V7a1 1 0 00-1-1z" clipRule="evenodd" /></svg>} />
            <InputMethodButton label={t('upload_tab_upload')} active={activeTab==='upload'} onClick={() => handleTabChange('upload')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>} />
            <InputMethodButton label={t('upload_tab_url')} active={activeTab==='url'} onClick={() => handleTabChange('url')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0l-1.5-1.5a2 2 0 112.828-2.828l1.5 1.5a.5.5 0 00.707 0l.707-.707a2 2 0 00-2.828-2.828l-3 3a2 2 0 000 2.828l1.5 1.5a2 2 0 002.828 0l3-3a.5.5 0 000-.707l-.707-.707z" clipRule="evenodd" /></svg>} />
        </div>

        <div className="min-h-[250px]">
          {activeTab === 'paste' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                <div>
                    <label
                      htmlFor="resume-text"
                      className="block text-sm font-medium text-[var(--site-text)] mb-2"
                    >
                        {t('upload_resume_text_label')}
                    </label>
                    <textarea
                        id="resume-text"
                        className="w-full h-[260px] sm:h-[380px] bg-[var(--site-surface)] border border-[var(--site-border)] text-[var(--site-text)] text-base rounded-[var(--site-radius)] focus:ring-2 focus:ring-[var(--site-action)]/40 focus:border-[var(--site-action)] block p-4 transition placeholder:text-[var(--site-text-muted)] disabled:bg-[var(--site-surface-muted)] disabled:cursor-not-allowed"
                        placeholder={t('upload_resume_text_placeholder')}
                        value={resumeText}
                        onChange={handleTextChange}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--site-text)] mb-2">{t('upload_preview_label')}</label>
                    <ResumePreview resumeText={resumeText} market={market} t={t} />
                </div>
            </div>
          )}
            {activeTab === 'upload' && (
                <div className="w-full animate-fade-in space-y-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".txt,.png,.jpg,.jpeg,.pdf,.docx,.doc"
                      aria-label={t('upload_file_input_aria')}
                    />
                    {resumeImages && resumeImages.length > 0 ? (
                         <div className="text-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
                            <p className="text-green-700 dark:text-green-400 font-semibold">
                              {resumeImages.length > 1
                                ? formatMessage('upload_image_ready_pages', { count: resumeImages.length })
                                : t('upload_image_ready_single')}
                            </p>
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('upload_change_file')}</button>
                         </div>
                    ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isParsing}
                          aria-busy={isParsing}
                          className="w-full rounded-xl border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-blue-500 disabled:cursor-wait disabled:opacity-60 dark:border-gray-600"
                        >
                           <p className="mt-2 font-semibold">{isParsing ? t('upload_processing') : t('upload_click_upload')}</p>
                        </button>
                    )}
                </div>
            )}
            {activeTab === 'url' && (
                <div className="space-y-4 animate-fade-in">
                    <input
                        type="url"
                        className="w-full bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-600 rounded-xl p-4"
                        placeholder={t('upload_url_placeholder')}
                        value={urlInput}
                        onChange={(e) => { setUrlInput(e.target.value); setError(null); }}
                        disabled={isUrlProcessing}
                        aria-label={t('upload_url_input_aria')}
                    />
                    <button
                        type="button"
                        onClick={handleUrlImport}
                        disabled={isUrlProcessing || !urlInput.trim()}
                        aria-busy={isUrlProcessing}
                        className="w-full rounded-xl bg-gray-700 px-6 py-3 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                    >
                        {isUrlProcessing ? t('upload_importing') : t('upload_import_url')}
                    </button>
                </div>
            )}
        </div>

        {error && (
          <div className="bg-[var(--site-risk-bg)] text-[var(--site-risk)] p-4 rounded-[var(--site-radius)] border border-[var(--site-risk)]/20">
            <p>{error}</p>
          </div>
        )}
        {infoMessage && (
          <div className="bg-[var(--site-surface-muted)] text-[var(--site-text)] p-4 rounded-[var(--site-radius)] border border-[var(--site-border)]">
            <p>{infoMessage}</p>
          </div>
        )}

        <div className="text-center pt-4">
            <button
              type="submit"
              disabled={analysisButtonDisabled}
              aria-disabled={analysisButtonDisabled}
              className="w-full max-w-xs flex items-center justify-center bg-[var(--site-action)] hover:bg-[var(--site-action-hover)] disabled:cursor-not-allowed disabled:opacity-50 text-white font-semibold py-3.5 px-6 rounded-[var(--site-radius)] transition-all mx-auto"
            >
              {isLoading ? t('upload_analyzing') : t('upload_button_analyze')}
            </button>
        </div>
      </form>
    </div>
  );
};

export default UploadSection;
