import React, { useState, useEffect } from 'react';
import { generateOutreachEmail } from '../services/aiClient';
import type { ProfessionalEmailResult, UserProfile } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { DEFAULT_MARKET } from '../config';
import { useToast } from './Toast';
import { useModalBehavior } from '../hooks/useModalBehavior';

interface MatchedCandidate extends UserProfile {
    compatibilityScore: number;
    summary: string;
}

interface OutreachModalProps {
    candidate: MatchedCandidate & { index: number };
    jobDescription: string;
    employerProfile: UserProfile;
    onClose: () => void;
    t: (key: string) => string;
}

const OutreachModal: React.FC<OutreachModalProps> = ({ candidate, jobDescription, employerProfile, onClose, t }) => {
    useModalBehavior(onClose);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ProfessionalEmailResult | null>(null);
    const [editableBody, setEditableBody] = useState('');
    const [editableSubject, setEditableSubject] = useState('');
    const { addToast } = useToast();


    useEffect(() => {
        const runTool = async () => {
            setLoading(true);
            setError(null);
            try {
                if (!candidate.resume_text) {
                    throw new Error("Candidate resume is not available.");
                }
                const apiResult = await generateOutreachEmail(candidate.resume_text, jobDescription, employerProfile, DEFAULT_MARKET);
                setResult(apiResult);
                setEditableBody(apiResult.body);
                setEditableSubject(apiResult.subject);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            } finally {
                setLoading(false);
            }
        };
        runTool();
    }, [candidate, jobDescription, employerProfile]);

    const handleCopy = () => {
        if (result) {
            navigator.clipboard.writeText(`Subject: ${editableSubject}\n\n${editableBody}`);
            addToast('Email subject and body copied to clipboard!', 'success');
        }
    };
    
    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={handleOverlayClick}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-slate-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Draft Outreach Message for Candidate #{candidate.index + 1}</h3>
                </div>
                <div className="flex-grow overflow-y-auto p-6 space-y-4">
                    {loading && <LoadingSpinner />}
                    {error && <div className="text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400 p-4 rounded-lg">{error}</div>}
                    {result && (
                        <div className="space-y-4">
                             <div>
                                <label htmlFor="outreach-subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Subject</label>
                                <input type="text" id="outreach-subject" value={editableSubject} onChange={e => setEditableSubject(e.target.value)} className="mt-1 w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm dark:text-gray-100"/>
                             </div>
                             <div>
                                 <label htmlFor="outreach-body" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Body</label>
                                 <textarea id="outreach-body" value={editableBody} onChange={e => setEditableBody(e.target.value)} rows={15} className="mt-1 w-full border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 dark:text-gray-100"/>
                             </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 rounded-b-xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-slate-600">Cancel</button>
                    <button onClick={handleCopy} disabled={!result} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-300">Copy to Clipboard</button>
                </div>
            </div>
        </div>
    );
};

export default OutreachModal;