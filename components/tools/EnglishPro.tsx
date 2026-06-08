
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { data, type AppSession as Session } from '../../lib/data';
import { analyzeEnglishProficiency, analyzeSpokenEnglish, analyzeEnglishReading, evaluateReadingComprehension, analyzeEnglishListening, generateReadingPracticePassage, generateSpeakingTopics, generateVocabularyFlashcards } from '../../services/geminiService';
import type { EnglishProResult, SpokenEnglishAnalysisResult, EnglishReadingAnalysisResult, ReadingEvaluation, EnglishListeningAnalysisResult, ReadingPracticePassage, VocabularyFlashcard, UserProfile, VocabularyItem, ComprehensionQuestion } from '../../types';
import LoadingSpinner from '../LoadingSpinner';

const ENGLISH_PRO_TOPICS = [
    "Write an email to a colleague asking for an update on a project.",
    "Write an email to your manager requesting a day off for a personal appointment.",
    "Write an email to a potential client introducing yourself and your company's services.",
    "Write a follow-up email after a job interview, thanking the interviewer.",
];

const LISTENING_CLIPS = [
    { text: "Good morning, this is Sarah from the marketing department. I'm calling to follow up on the proposal we sent over last week. Do you have a few minutes to discuss it?", id: 1 },
    { text: "The project deadline has been moved up to this Friday. We'll need all hands on deck to ensure we meet the new target.", id: 2 },
    { text: "Please review the attached document and provide your feedback by the end of the day. Your input is crucial for the next phase.", id: 3 }
];

const SUPPORTED_LANGUAGES = ['Vietnamese', 'Japanese', 'Other'];
const IELTS_BANDS = ['5.0', '5.5', '6.0', '6.5', '7.0', '7.5', '8.0', '8.5', '9.0'];

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

interface EnglishProProps {
    t: (key: string) => string;
    session: Session | null;
    profile: UserProfile | null;
    refreshProfile: () => void;
}

const isSameDay = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

const isYesterday = (date1: Date, date2: Date) => {
    const yesterday = new Date(date2);
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(date1, yesterday);
};

const shuffleArray = <T,>(array: T[]): T[] => [...array].sort(() => Math.random() - 0.5);

const EnglishPro: React.FC<EnglishProProps> = ({ t, session, profile, refreshProfile }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [practiceMode, setPracticeMode] = useState<'hub' | 'written' | 'spoken' | 'reading' | 'listening'>('hub');
    
    // Gamification State
    const [streakData, setStreakData] = useState({ count: 0, lastPracticeDate: '' });
    const [dailyGoalComplete, setDailyGoalComplete] = useState(false);

    // Goal Setting
    const [targetIeltsBand, setTargetIeltsBand] = useState('6.5');
    
    // Written Mode
    const [writtenResult, setWrittenResult] = useState<EnglishProResult | null>(null);
    const [writtenInput, setWrittenInput] = useState('');
    const [nativeLanguage, setNativeLanguage] = useState(SUPPORTED_LANGUAGES[0]);
    const [originalWrittenInput, setOriginalWrittenInput] = useState('');

    // Spoken Mode
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [spokenResult, setSpokenResult] = useState<SpokenEnglishAnalysisResult | null>(null);
    const recognitionRef = useRef<any>(null);
    const recordingStartTime = useRef<number | null>(null);
    const [speakingTopics, setSpeakingTopics] = useState<string[]>([]);
    const [currentTopic, setCurrentTopic] = useState<string | null>(null);
    const [isFetchingTopic, setIsFetchingTopic] = useState(false);

    // Reading Mode
    const [readingSubMode, setReadingSubMode] = useState<'select' | 'comprehension' | 'flashcards'>('select');
    const [readingComprehensionResult, setReadingComprehensionResult] = useState<EnglishReadingAnalysisResult | ReadingPracticePassage | null>(null);
    const [readingUserInput, setReadingUserInput] = useState('');
    const [userAnswers, setUserAnswers] = useState<string[]>([]);
    const [readingEvaluation, setReadingEvaluation] = useState<ReadingEvaluation[] | null>(null);
    const [flashcards, setFlashcards] = useState<VocabularyFlashcard[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [flashcardScore, setFlashcardScore] = useState(0);
    const [selectedFlashcardAnswer, setSelectedFlashcardAnswer] = useState<string | null>(null);
    const [isFlashcardAnswered, setIsFlashcardAnswered] = useState(false);

    // Listening Mode
    const [listeningResult, setListeningResult] = useState<EnglishListeningAnalysisResult | null>(null);
    const [currentClip, setCurrentClip] = useState(LISTENING_CLIPS[0]);
    const [userTranscription, setUserTranscription] = useState('');
    
    // --- Gamification Logic ---
    useEffect(() => {
        if (profile) {
            const today = new Date();
            const lastPracticeDateStr = profile.english_pro_last_practice;
            const currentStreak = profile.english_pro_streak || 0;

            if (lastPracticeDateStr) {
                const lastDate = new Date(lastPracticeDateStr);
                
                if (isSameDay(lastDate, today)) {
                    setStreakData({ count: currentStreak, lastPracticeDate: lastPracticeDateStr });
                    setDailyGoalComplete(true);
                } else if (isYesterday(lastDate, today)) {
                    setStreakData({ count: currentStreak, lastPracticeDate: lastPracticeDateStr });
                    setDailyGoalComplete(false);
                } else {
                    // Streak broken, UI will show 0 until next practice.
                    setStreakData({ count: 0, lastPracticeDate: '' });
                    setDailyGoalComplete(false);
                }
            } else {
                // No practice history in DB
                setStreakData({ count: 0, lastPracticeDate: '' });
                setDailyGoalComplete(false);
            }
        }
    }, [profile]);

    const handlePracticeCompletion = useCallback(async () => {
        if (!session?.user || !profile) return;

        // Prevent updating streak if goal is already complete for the day
        if (dailyGoalComplete) return;

        setDailyGoalComplete(true);
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        const lastPracticeDateStr = profile.english_pro_last_practice;
        const currentStreak = profile.english_pro_streak || 0;
        
        let newStreak = 1; // Default to 1 for a new or broken streak
        
        if (lastPracticeDateStr) {
            const lastDate = new Date(lastPracticeDateStr);
            if (isYesterday(lastDate, today)) {
                newStreak = currentStreak + 1;
            }
            // If it's not yesterday, the streak is broken, so it resets to 1 (the default).
            // If it's the same day, we wouldn't have reached here due to the initial check.
        }

        try {
            const { error } = await data.profiles.update(session.user.id, {
                english_pro_streak: newStreak,
                english_pro_last_practice: todayStr,
            });

            if (error) throw error;

            // Refresh the profile data in the app to reflect the change
            await refreshProfile();
        } catch (dbError) {
            console.error("Failed to update streak in database:", dbError);
            setError("Could not save your practice progress. Your analysis is still available.");
        }
    }, [session, profile, refreshProfile, dailyGoalComplete]);


    const handleStartNewPractice = () => {
        setLoading(false);
        setError(null);
        setPracticeMode('hub');
        // Reset all sub-modes and results
        setReadingSubMode('select');
        setWrittenResult(null);
        setSpokenResult(null);
        setReadingComprehensionResult(null);
        setReadingEvaluation(null);
        setListeningResult(null);
        setFlashcards([]);
    };
    
    // --- Tool API Calls ---
    
    // Written
    const runWrittenTool = async () => {
        if (!writtenInput.trim()) { setError(t('tool_english_pro_error_required')); return; }
        setLoading(true); setError(null); setOriginalWrittenInput(writtenInput);
        try {
            const res = await analyzeEnglishProficiency(writtenInput, nativeLanguage, targetIeltsBand);
            setWrittenResult(res);
            await handlePracticeCompletion();
        } catch (err) { setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { setLoading(false); }
    };
    
    // Spoken
    const runSpokenAnalysis = useCallback(async (finalTranscript: string, duration: number) => {
        if (!finalTranscript.trim()) { setError("No speech was detected."); return; }
        setLoading(true); setError(null); setTranscript(finalTranscript);
        try {
            const res = await analyzeSpokenEnglish(finalTranscript, duration, targetIeltsBand);
            setSpokenResult(res);
            await handlePracticeCompletion();
        } catch (err) { setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { setLoading(false); }
    }, [targetIeltsBand, handlePracticeCompletion]);

    // Speech recognition setup
    useEffect(() => {
        if (isSpeechSupported) {
            recognitionRef.current = new SpeechRecognition();
            const recognition = recognitionRef.current;
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                let transcript = '';
                for (let i = 0; i < event.results.length; i++) {
                    transcript += event.results[i][0].transcript;
                }
                setTranscript(transcript);
            };
            
            recognition.onerror = (event: any) => {
                console.error("Speech recognition error:", event.error);
                setError(`${t('tool_english_pro_speech_error')} ${event.error}`);
                setIsListening(false);
            };
        }
    }, [t]);

    const toggleListening = useCallback(() => {
        if (!isSpeechSupported) {
            setError("Speech recognition is not supported in this browser.");
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
            if (recordingStartTime.current) {
                const duration = (Date.now() - recordingStartTime.current) / 1000;
                runSpokenAnalysis(transcript, duration);
                recordingStartTime.current = null;
            }
        } else {
            setSpokenResult(null);
            setTranscript('');
            setError(null);
            recognitionRef.current.start();
            setIsListening(true);
            recordingStartTime.current = Date.now();
        }
    }, [isListening, transcript, runSpokenAnalysis]);
    
    const fetchNewSpeakingTopic = async () => {
        setIsFetchingTopic(true);
        try {
            const { topics } = await generateSpeakingTopics(targetIeltsBand);
            setSpeakingTopics(topics);
            setCurrentTopic(topics[0] || 'Tell me about your most recent project.');
        } catch (e) {
            setError("Could not fetch a new topic. Please try again.");
            setCurrentTopic('Tell me about your most recent project.');
        } finally {
            setIsFetchingTopic(false);
        }
    };

    // Reading
    const runReadingAnalysis = async () => {
        if (!readingUserInput.trim()) { setError("Please paste some text to analyze."); return; }
        setLoading(true); setError(null); setReadingEvaluation(null); setUserAnswers([]);
        try {
            const res = await analyzeEnglishReading(readingUserInput, targetIeltsBand);
            setReadingComprehensionResult(res);
            setReadingSubMode('comprehension');
            await handlePracticeCompletion();
        } catch(err) { setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { setLoading(false); }
    };

    const generateReadingPractice = async () => {
        setLoading(true); setError(null); setReadingEvaluation(null); setUserAnswers([]);
        try {
            const res = await generateReadingPracticePassage(targetIeltsBand);
            setReadingComprehensionResult(res);
            setReadingSubMode('comprehension');
        } catch(err) { setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { setLoading(false); }
    }

    const checkReadingAnswers = async () => {
        const res = readingComprehensionResult as EnglishReadingAnalysisResult;
        const textToUse = (res as any).passage || readingUserInput;
        if (!res || !res.comprehensionQuestions || userAnswers.length !== res.comprehensionQuestions.length) return;
        setLoading(true); setError(null);
        try {
            const evaluation = await evaluateReadingComprehension(textToUse, res.comprehensionQuestions, userAnswers);
            setReadingEvaluation(evaluation);
            await handlePracticeCompletion();
        } catch(err) { setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { setLoading(false); }
    };

    const generateFlashcards = async () => {
        setLoading(true); setError(null); setFlashcards([]);
        try {
            const { cards } = await generateVocabularyFlashcards(targetIeltsBand);
            setFlashcards(cards.map(c => ({...c, distractors: shuffleArray([...c.distractors, c.definition])})));
            setCurrentCardIndex(0);
            setFlashcardScore(0);
            setReadingSubMode('flashcards');
        } catch(err) { setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { setLoading(false); }
    };

    // Listening
    const runListeningAnalysis = async () => {
        if (!userTranscription.trim()) { setError("Please type what you heard."); return; }
        setLoading(true); setError(null);
        try {
            const res = await analyzeEnglishListening(currentClip.text, userTranscription, targetIeltsBand);
            setListeningResult(res);
            await handlePracticeCompletion();
        } catch(err) { setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { setLoading(false); }
    };
    
    // UI Renderers
    const renderResultCard = (title: string, content: React.ReactNode) => (
        <div className="p-4 border rounded-lg bg-white">
            <h5 className="font-bold text-gray-800">{title}</h5>
            <div className="mt-2 text-sm">{content}</div>
        </div>
    );
    
    const renderPracticeHub = () => (
        <div className="space-y-6">
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
                 <div className="flex justify-center items-center gap-4">
                    <div className="relative">
                        <svg className="w-16 h-16" viewBox="0 0 100 100">
                            <circle className="text-gray-200" strokeWidth="8" stroke="currentColor" fill="transparent" r="45" cx="50" cy="50"/>
                            <circle
                                className="text-amber-500"
                                strokeWidth="8"
                                strokeDasharray="283"
                                strokeDashoffset={283 - (streakData.count / 7) * 283}
                                strokeLinecap="round"
                                fill="transparent"
                                r="45"
                                cx="50"
                                cy="50"
                                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-amber-600">{streakData.count}</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800">Day Streak</h3>
                        <p className="text-gray-600">Keep practicing daily to build your streak!</p>
                    </div>
                </div>
                {dailyGoalComplete && <p className="text-green-600 font-semibold mt-3">Daily practice goal complete.</p>}
            </div>

            <div className="space-y-3">
                 <label htmlFor="ielts-band" className="block text-sm font-medium text-gray-700">{t('tool_english_pro_goal_setting_title')}</label>
                 <p className="text-xs text-gray-500">{t('tool_english_pro_goal_setting_desc')}</p>
                 <select id="ielts-band" value={targetIeltsBand} onChange={e => setTargetIeltsBand(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                    {IELTS_BANDS.map(band => <option key={band} value={band}>{band}</option>)}
                 </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => setPracticeMode('written')} className="p-6 bg-white border rounded-lg text-left hover:shadow-lg hover:border-blue-300">
                    <h4 className="font-bold text-lg">Written Practice</h4>
                    <p className="text-sm text-gray-600">Write professional emails and get instant feedback on grammar, tone, and vocabulary.</p>
                </button>
                 <button onClick={() => setPracticeMode('spoken')} className="p-6 bg-white border rounded-lg text-left hover:shadow-lg hover:border-blue-300">
                    <h4 className="font-bold text-lg">Spoken Practice</h4>
                    <p className="text-sm text-gray-600">Practice speaking on professional topics and get analyzed for clarity, pacing, and filler words.</p>
                </button>
                 <button onClick={() => setPracticeMode('reading')} className="p-6 bg-white border rounded-lg text-left hover:shadow-lg hover:border-blue-300">
                    <h4 className="font-bold text-lg">Reading Practice</h4>
                    <p className="text-sm text-gray-600">Test your comprehension with AI-generated passages and questions or practice vocabulary with flashcards.</p>
                </button>
                 <button onClick={() => setPracticeMode('listening')} className="p-6 bg-white border rounded-lg text-left hover:shadow-lg hover:border-blue-300">
                    <h4 className="font-bold text-lg">Listening Practice</h4>
                    <p className="text-sm text-gray-600">Listen to short audio clips and transcribe them to test your listening accuracy.</p>
                </button>
            </div>
        </div>
    );

    const renderWrittenMode = () => (
        <div className="space-y-4">
            {!writtenResult ? (
                <>
                    <div>
                        <label htmlFor="native-language" className="block text-sm font-medium text-gray-700">{t('tool_english_pro_lang_label')}</label>
                        <p className="text-xs text-gray-500">{t('tool_english_pro_lang_desc')}</p>
                        <select id="native-language" value={nativeLanguage} onChange={e => setNativeLanguage(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                            {SUPPORTED_LANGUAGES.map(lang => <option key={lang}>{lang}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="email-text" className="block text-sm font-medium text-gray-700">{t('tool_english_pro_prompt_label')}</label>
                         <p className="text-xs text-gray-500">{t('tool_english_pro_prompt_desc')}</p>
                        <div className="flex flex-wrap gap-2 my-2">{ENGLISH_PRO_TOPICS.map((topic, i) => <button key={i} onClick={() => setWrittenInput(t(`tool_english_pro_topic_${i + 1}`))} className="text-xs bg-gray-100 hover:bg-gray-200 p-2 rounded-md">{t(`tool_english_pro_topic_${i + 1}`)}</button>)}</div>
                        <textarea id="email-text" value={writtenInput} onChange={e => setWrittenInput(e.target.value)} rows={8} className="w-full border-gray-300 rounded-md shadow-sm" placeholder={t('tool_english_pro_placeholder')} />
                    </div>
                    <button onClick={runWrittenTool} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">{loading ? t('tool_english_pro_analyzing_button') : t('tool_english_pro_analyze_button')}</button>
                </>
            ) : (
                <div className="space-y-4">
                    <h4 className="font-bold text-lg text-center">{t('tool_english_pro_results_title')}</h4>
                    {renderResultCard(t('tool_english_pro_cefr_label'), <p className="font-bold text-blue-600 text-xl">{writtenResult.overallBand.level} <span className="text-sm font-normal text-gray-600">- {writtenResult.overallBand.description}</span></p>)}
                    {writtenResult.culturalTip && renderResultCard(t('tool_english_pro_cultural_tip'), <p>{writtenResult.culturalTip}</p>)}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderResultCard(t('tool_english_pro_original_label'), <p className="whitespace-pre-wrap">{originalWrittenInput}</p>)}
                        {renderResultCard(t('tool_english_pro_corrected_label'), <p className="whitespace-pre-wrap">{writtenResult.correctedEmail}</p>)}
                    </div>
                    {renderResultCard(t('tool_english_pro_feedback_label'), (
                        <ul className="space-y-3">{writtenResult.improvementAreas.map((area, i) => <li key={i}><strong>{area.category}:</strong> <span className="line-through text-red-600">{area.originalText}</span> &rarr; <span className="text-green-600">{area.suggestion}</span><br/><em className="text-xs text-gray-500">{area.explanation}</em></li>)}</ul>
                    ))}
                    <button onClick={() => setWrittenResult(null)} className="w-full text-sm py-2 px-4 border-2 border-dashed rounded-lg hover:bg-gray-200">{t('tool_english_pro_practice_again_button')}</button>
                </div>
            )}
            <button onClick={handleStartNewPractice} className="text-sm text-blue-600 hover:underline">&larr; Back to English Pro Hub</button>
        </div>
    );
    
    // ... other render functions
    
    // Main component return
    return (
        <div className="p-4 bg-gray-50 rounded-lg animate-fade-in">
            {error && <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm mb-4">{error}</div>}
            {practiceMode === 'hub' && renderPracticeHub()}
            {practiceMode === 'written' && renderWrittenMode()}
            {/* ... other mode renders */}
        </div>
    );
};

export default EnglishPro;
