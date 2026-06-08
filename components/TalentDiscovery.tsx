
import React, { useState, useEffect } from 'react';
import { calculateCompatibility } from '../services/geminiService';
import type { UserProfile } from '../types';
import EngageCandidateModal from './EngageCandidateModal';
import UnlockTalentModal from './UnlockTalentModal';
import { listCandidateProfilesWithResume } from '../lib/recruitingData';

interface MatchedCandidate extends UserProfile {
    compatibilityScore: number;
    summary: string;
}

interface TalentDiscoveryProps {
    t: (key: string) => string;
    profile: UserProfile;
    navigateToBusinessPricing: () => void;
}

const TalentDiscovery: React.FC<TalentDiscoveryProps> = ({ t, profile, navigateToBusinessPricing }) => {
    const [jobDescription, setJobDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [verifiedResults, setVerifiedResults] = useState<MatchedCandidate[]>([]);
    const [regularResults, setRegularResults] = useState<MatchedCandidate[] | null>(null);

    const [candidateToUnlock, setCandidateToUnlock] = useState<(MatchedCandidate & { index: number }) | null>(null);
    const [candidateToEngage, setCandidateToEngage] = useState<(MatchedCandidate & { index: number }) | null>(null);
    
    // Pre-fetch verified talent on component mount
    useEffect(() => {
        const fetchVerifiedTalent = async () => {
            setLoading(true);
            try {
                const candidates = (await listCandidateProfilesWithResume(50))
                    .filter((candidate) => candidate.nft_staked)
                    .slice(0, 10);

                // Simulate a generic match score for display before a specific search
                const pseudoMatched = candidates.map(c => ({
                    ...c,
                    compatibilityScore: 0,
                    summary: "This candidate's skills are verified and staked in the talent vault."
                }));
                setVerifiedResults(pseudoMatched);

            } catch (err) {
                 setError(err instanceof Error ? err.message : 'Could not load verified talent.');
            } finally {
                setLoading(false);
            }
        };
        fetchVerifiedTalent();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!jobDescription.trim()) {
            setError('Please provide a job description to search for talent.');
            return;
        }
        setLoading(true);
        setError(null);
        setRegularResults(null);
        try {
            const candidates = await listCandidateProfilesWithResume(50);
            if (candidates.length === 0) {
                setRegularResults([]);
                setVerifiedResults([]);
                return;
            }
            
            const allMatched: MatchedCandidate[] = [];
            for (const candidate of candidates) {
                if (!candidate.resume_text) {
                    continue;
                }
                try {
                    const matchResult = await calculateCompatibility(candidate.resume_text, jobDescription);
                    allMatched.push({ ...candidate, ...matchResult });
                } catch (e) {
                    console.error(`Error matching candidate ${candidate.id}:`, e);
                    // Don't add to results if matching fails
                }
            }
            
            allMatched.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

            setVerifiedResults(allMatched.filter(c => c.nft_staked));
            setRegularResults(allMatched.filter(c => !c.nft_staked && c.compatibilityScore >= 70));

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during the search.');
        } finally {
            setLoading(false);
        }
    };
    
    const canUnlock = profile.subscription_status === 'job_pack';
    
    return (
        <div className="p-4 animate-fade-in">
            {/* Verified Talent Section */}
            <div className="p-6 bg-gradient-to-br from-gray-700 via-gray-800 to-black rounded-xl text-white shadow-lg mb-8">
                 <h2 className="text-2xl font-bold mb-2">{t('discover_verified_title')}</h2>
                 <p className="text-gray-300 mb-6 max-w-3xl">{t('discover_verified_desc')}</p>
                 {verifiedResults.length === 0 && !loading && (
                    <p className="text-center py-4 text-gray-400">{t('discover_no_verified_talent')}</p>
                 )}
                 <div className="space-y-3">
                    {verifiedResults.map((candidate, index) => (
                        <div key={candidate.id} className="p-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-bold text-white">Candidate #{index + 1}</p>
                                <p className="text-sm text-gray-300 mt-1">{candidate.summary}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {candidate.compatibilityScore > 0 && (
                                    <div className="text-right ml-4">
                                        <p className="text-2xl font-bold text-green-400">{candidate.compatibilityScore}%</p>
                                        <p className="text-xs text-gray-300">Match</p>
                                    </div>
                                )}
                                <button
                                    onClick={() => setCandidateToUnlock({ ...candidate, index })}
                                    className="px-4 py-2 bg-white text-gray-900 font-semibold text-sm rounded-lg hover:bg-gray-200"
                                >
                                    {t('discover_unlock_engage_button')}
                                </button>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('discover_regular_title')}</h2>
            <p className="text-gray-600 mb-6">Paste a job description to proactively find matching candidates from the Career CoPilot talent pool.</p>
            
            <form onSubmit={handleSearch} className="space-y-4">
                <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={8}
                    className="w-full bg-white border border-gray-300 rounded-lg shadow-sm p-4 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Paste the full job description here..."
                />
                 {error && <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm">{error}</div>}
                 <button type="submit" disabled={loading} className="w-full sm:w-auto px-8 py-3 bg-blue-700 text-white font-bold rounded-lg shadow-md hover:bg-blue-800 disabled:bg-blue-400">
                    {loading ? 'Searching...' : 'Find Matching Candidates'}
                </button>
            </form>
            
            {loading && (
                <div className="text-center mt-8">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mx-auto"></div>
                    <p className="mt-3 text-gray-600">Analyzing talent pool...</p>
                </div>
            )}

            {regularResults && (
                <div className="mt-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                        {regularResults.length > 0 ? `Found ${regularResults.length} other match(es)` : 'No other strong matches found'}
                    </h3>
                    <div className="space-y-4">
                        {regularResults.map((candidate, index) => (
                            <div key={candidate.id} className="p-4 bg-white border rounded-lg shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-gray-800">Candidate</p>
                                    <p className="text-sm text-gray-600 mt-1">{candidate.summary}</p>
                                </div>
                                <div className="text-right ml-4">
                                     <p className="text-2xl font-bold text-green-600">{candidate.compatibilityScore}%</p>
                                     <p className="text-sm text-gray-500">Match</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {candidateToUnlock && (
                <UnlockTalentModal
                    candidate={candidateToUnlock}
                    canUnlock={canUnlock}
                    onClose={() => setCandidateToUnlock(null)}
                    onUnlocked={(c) => {
                        setCandidateToUnlock(null);
                        setCandidateToEngage(c);
                    }}
                    navigateToBusinessPricing={navigateToBusinessPricing}
                    t={t}
                />
            )}

            {candidateToEngage && (
                <EngageCandidateModal
                    candidate={candidateToEngage}
                    jobDescription={jobDescription}
                    employerProfile={profile}
                    onClose={() => setCandidateToEngage(null)}
                    t={t}
                />
            )}
        </div>
    );
};

export default TalentDiscovery;
