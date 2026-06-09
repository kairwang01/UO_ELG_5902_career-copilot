import React, { useState } from 'react';
import type { UserProfile } from '../types';
import ResumePreview from './ResumePreview';
import OutreachModal from './OutreachModal';

interface MatchedCandidate extends UserProfile {
    compatibilityScore: number;
    summary: string;
}

interface EngageCandidateModalProps {
    candidate: MatchedCandidate & { index: number };
    jobDescription: string;
    employerProfile: UserProfile;
    onClose: () => void;
    t: (key: string) => string;
}

const EngageCandidateModal: React.FC<EngageCandidateModalProps> = ({ candidate, jobDescription, employerProfile, onClose, t }) => {
    const [isOutreachModalOpen, setIsOutreachModalOpen] = useState(false);
    
    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={handleOverlayClick}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <div className="flex-shrink-0 flex items-center justify-between p-4 border-b dark:border-slate-700">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Candidate Profile #{candidate.index + 1}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full p-1" aria-label="Close modal">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                    <div className="text-center p-4 bg-gray-50 dark:bg-slate-700 rounded-lg border dark:border-slate-600">
                        <p className="text-4xl font-extrabold text-green-600">{candidate.compatibilityScore}%</p>
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Match Score</p>
                        <p className="text-gray-700 dark:text-gray-300 mt-3">{candidate.summary}</p>
                    </div>
                     {candidate.wallet_address && (
                        <div>
                            <h4 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Web3 Identity</h4>
                            <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border dark:border-slate-600 flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                <div>
                                    <p className="text-xs text-gray-500">Verified Wallet Address</p>
                                    <a href={`https://etherscan.io/address/${candidate.wallet_address}`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-blue-600 hover:underline break-all">
                                        {candidate.wallet_address}
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}
                    <div>
                        <h4 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Candidate's Full Resume</h4>
                        <div className="h-[40vh]">
                            <ResumePreview resumeText={candidate.resume_text || 'No resume text available.'} market="" t={t} />
                        </div>
                    </div>
                </div>
                <div className="flex-shrink-0 flex justify-between items-center p-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 rounded-b-xl">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Candidate contact information is kept private.</p>
                    <button 
                        onClick={() => setIsOutreachModalOpen(true)}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
                    >
                        Draft Outreach Message with AI
                    </button>
                </div>
            </div>
            {isOutreachModalOpen && (
                <OutreachModal
                    candidate={candidate}
                    jobDescription={jobDescription}
                    employerProfile={employerProfile}
                    onClose={() => setIsOutreachModalOpen(false)}
                    t={t}
                />
            )}
        </div>
    );
};

export default EngageCandidateModal;