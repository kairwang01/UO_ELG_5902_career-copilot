

import React, { useState, useEffect, useCallback } from 'react';
import type { Database } from '../lib/supabaseClient';
import { supabase } from '../lib/supabaseClient';
import { analyzeCandidateMatch } from '../services/geminiService';
import type { UserProfile, CandidateMatchAnalysis } from '../types';
import FunnelChart from './FunnelChart';

type JobPosting = Database['public']['Tables']['job_postings']['Row'];

interface ApplicantFunnelProps {
  job: JobPosting;
  onBack: () => void;
  t: (key: string) => string;
}

interface Applicant extends UserProfile {
    application_date: string;
    compatibility_score?: number;
    match_analysis?: CandidateMatchAnalysis;
}

const ApplicantFunnel: React.FC<ApplicantFunnelProps> = ({ job, onBack, t }) => {
    const [loading, setLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Fetching applicants...');
    const [error, setError] = useState<string | null>(null);
    const [applicants, setApplicants] = useState<Applicant[]>([]);
    const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);

    const fetchApplicants = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const { data: applications, error: appError } = await supabase
                .from('job_applications')
                .select('candidate_id, application_date')
                .eq('job_id', job.id);

            if (appError) throw appError;
            if (!applications || applications.length === 0) {
                setApplicants([]);
                return;
            }

            setLoadingMessage(`Analyzing ${applications.length} applicant(s)...`);

            const candidateIds = applications.map(a => a.candidate_id);
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .in('id', candidateIds);

            if (profileError) throw profileError;
            
            const analyzedApplicants: Applicant[] = [];
            let count = 1;
            for (const profile of profiles) {
                setLoadingMessage(`Analyzing applicant ${count} of ${profiles.length}...`);
                const application = applications.find(a => a.candidate_id === profile.id);
                if (!application) continue; // Should not happen

                let analyzedProfile: Applicant;
                if (!profile.resume_text || !job.description) {
                    analyzedProfile = { ...profile, application_date: application.application_date, compatibility_score: 0 };
                } else {
                    try {
                        const analysis = await analyzeCandidateMatch(profile.resume_text, job.description);
                        analyzedProfile = { ...profile, application_date: application.application_date, compatibility_score: analysis.score, match_analysis: analysis };
                    } catch (e) {
                        console.error(`Failed to analyze applicant ${profile.id}:`, e);
                        analyzedProfile = { ...profile, application_date: application.application_date, compatibility_score: 0 };
                    }
                }
                analyzedApplicants.push(analyzedProfile);
                count++;
            }

            analyzedApplicants.sort((a, b) => (b.compatibility_score ?? 0) - (a.compatibility_score ?? 0));
            setApplicants(analyzedApplicants);
            
            if (analyzedApplicants.length > 0) {
                setSelectedApplicant(analyzedApplicants[0]);
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load applicant data.');
        } finally {
            setLoading(false);
            setLoadingMessage('');
        }
    }, [job.id, job.description]);

    useEffect(() => {
        fetchApplicants();
    }, [fetchApplicants]);
    
    // Mock data to demonstrate the funnel's potential with multiple stages
    const funnelData = [
      { stage: 'Applied', count: applicants.length },
      { stage: 'AI Screened (70%+)', count: applicants.filter(a => (a.compatibility_score ?? 0) >= 70).length },
      { stage: 'Reviewing', count: Math.floor(applicants.filter(a => (a.compatibility_score ?? 0) >= 70).length * 0.5) }, // Mocked
      { stage: 'Interviewing', count: Math.floor(applicants.filter(a => (a.compatibility_score ?? 0) >= 70).length * 0.2) }, // Mocked
    ];


    if (loading) {
        return (
            <div className="text-center p-8">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-lg text-gray-600">{loadingMessage}</p>
            </div>
        );
    }

    if (error) return <div className="text-red-600 bg-red-100 p-4 rounded-lg">{error}</div>;

    if (applicants.length === 0) {
        return (
            <div className="text-center p-8">
                <h3 className="text-xl font-semibold text-gray-800">No Applicants Yet</h3>
                <p className="mt-2 text-gray-500">Check back later to see candidates who have applied for this role.</p>
                 <button onClick={onBack} className="mt-6 bg-gray-200 text-gray-800 font-semibold py-2 px-6 rounded-lg shadow-sm border border-gray-300 hover:bg-gray-300 transition-all">
                    &larr; Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in space-y-6">
             <button onClick={onBack} className="text-sm text-blue-600 hover:underline font-semibold">
                &larr; Back to Dashboard
            </button>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Hiring Funnel for "{job.title}"</h3>
                <FunnelChart data={funnelData} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-gray-50 p-4 rounded-lg border border-gray-200 h-[70vh] overflow-y-auto">
                    <h3 className="font-bold text-lg text-gray-800 mb-3">Applicant List</h3>
                    <div className="space-y-2">
                        {applicants.map(applicant => (
                            <button key={applicant.id} onClick={() => setSelectedApplicant(applicant)} className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${selectedApplicant?.id === applicant.id ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-gray-900">{applicant.full_name || 'Unnamed Candidate'}</p>
                                    <p className={`font-bold text-lg ${applicant.compatibility_score && applicant.compatibility_score >= 75 ? 'text-green-600' : 'text-yellow-600'}`}>{applicant.compatibility_score}%</p>
                                </div>
                                <p className="text-xs text-gray-500">Applied: {new Date(applicant.application_date).toLocaleDateString()}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 p-4 h-[70vh] overflow-y-auto">
                    {selectedApplicant && selectedApplicant.match_analysis ? (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-gray-900">{selectedApplicant.full_name || 'Unnamed Candidate'}</h2>
                                <p className="text-lg font-bold text-blue-700 mt-1">Match Score: {selectedApplicant.match_analysis.score}%</p>
                                <p className="text-sm text-gray-600 mt-2 max-w-xl mx-auto">{selectedApplicant.match_analysis.summary}</p>
                            </div>
                            
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <h4 className="font-semibold text-green-800">✅ Strengths</h4>
                                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-green-900">{selectedApplicant.match_analysis.strengths.map((s,i) => <li key={i}>{s}</li>)}</ul>
                            </div>
                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <h4 className="font-semibold text-yellow-800">🔍 Potential Gaps</h4>
                                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-yellow-900">{selectedApplicant.match_analysis.potentialGaps.map((g,i) => <li key={i}>{g}</li>)}</ul>
                            </div>
                             <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <h4 className="font-semibold text-indigo-800">🎙️ Suggested Interview Questions</h4>
                                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-indigo-900">{selectedApplicant.match_analysis.suggestedQuestions.map((q,i) => <li key={i}>{q}</li>)}</ul>
                            </div>
                        </div>
                    ) : (
                         <div className="flex items-center justify-center h-full text-gray-500">Select an applicant to view their detailed analysis.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApplicantFunnel;
