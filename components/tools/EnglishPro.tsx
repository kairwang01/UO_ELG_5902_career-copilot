
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Languages } from 'lucide-react';
import { data, type AppSession as Session } from '../../lib/data';
import { analyzeEnglishProficiency, analyzeSpokenEnglish, analyzeEnglishReading, evaluateReadingComprehension, analyzeEnglishListening, generateReadingPracticePassage, generateSpeakingTopics, generateVocabularyFlashcards } from '../../services/aiClient';
import type { EnglishProResult, SpokenEnglishAnalysisResult, EnglishReadingAnalysisResult, ReadingEvaluation, EnglishListeningAnalysisResult, ReadingPracticePassage, VocabularyFlashcard, UserProfile, VocabularyItem, ComprehensionQuestion } from '../../types';
import StagedLoader from '../StagedLoader';
import { useCancellableLoading } from '../../hooks/useCancellableLoading';

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

/** Prefer a clear English voice; voices load async so fall back gracefully. */
const pickEnglishVoice = (): SpeechSynthesisVoice | null => {
    try {
        const voices = window.speechSynthesis.getVoices();
        return voices.find((v) => v.lang === 'en-US') ?? voices.find((v) => v.lang.startsWith('en')) ?? null;
    } catch { return null; }
};

const EnglishPro: React.FC<EnglishProProps> = ({ t, session, profile, refreshProfile }) => {
    const { loading, begin, end, cancel } = useCancellableLoading();
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
    const [isPlaying, setIsPlaying] = useState(false);
    // Mirrors of state read inside the speech-recognition onend handler (which is
    // bound once and cannot see fresh state directly).
    const isListeningRef = useRef(false);
    const transcriptRef = useRef('');
    const runSpokenAnalysisRef = useRef<(finalTranscript: string, duration: number) => void>(() => {});
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

    // FIX 5: accept an optional alive guard so that a cancelled run cannot pop
    // a streak/error update after the component has already moved on.
    const handlePracticeCompletion = useCallback(async (alive?: () => boolean) => {
        if (!session?.user || !profile) return;

        // Prevent updating streak if goal is already complete for the day
        if (dailyGoalComplete) return;

        // Guard: if the caller was cancelled before we reach state updates, bail.
        if (alive && !alive()) return;

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
            // Only surface the error if the run was not cancelled.
            if (!alive || alive()) setError("Could not save your practice progress. Your analysis is still available.");
        }
    }, [session, profile, refreshProfile, dailyGoalComplete]);


    const handleStartNewPractice = () => {
        cancel();
        // Stop any live mic + narration before returning to the hub.
        try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
        setIsListening(false);
        setIsPlaying(false);
        recordingStartTime.current = null;
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
        const alive = begin(); setError(null); setOriginalWrittenInput(writtenInput);
        try {
            const res = await analyzeEnglishProficiency(writtenInput, nativeLanguage, targetIeltsBand);
            if (!alive()) return;
            setWrittenResult(res);
            await handlePracticeCompletion(alive);
        } catch (err) { if (alive()) setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { if (alive()) end(); }
    };
    
    // Spoken
    const runSpokenAnalysis = useCallback(async (finalTranscript: string, duration: number) => {
        if (!finalTranscript.trim()) { setError("No speech was detected."); return; }
        const alive = begin(); setError(null); setTranscript(finalTranscript);
        try {
            const res = await analyzeSpokenEnglish(finalTranscript, duration, targetIeltsBand);
            if (!alive()) return;
            setSpokenResult(res);
            await handlePracticeCompletion(alive);
        } catch (err) { if (alive()) setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { if (alive()) end(); }
    }, [targetIeltsBand, handlePracticeCompletion, begin, end]);

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
                recordingStartTime.current = null;
            };

            recognition.onend = () => {
                // The engine can stop on its own (silence gap / network blip /
                // ~60s timeout even with continuous=true). If we still think we're
                // recording, finalize: flip the UI off so the mic never gets stuck
                // on "Recording…", and analyse whatever speech was captured.
                if (!isListeningRef.current) return;
                setIsListening(false);
                const t0 = recordingStartTime.current;
                const duration = t0 ? (Date.now() - t0) / 1000 : 0;
                recordingStartTime.current = null;
                const finalT = transcriptRef.current;
                if (finalT.trim()) runSpokenAnalysisRef.current(finalT, duration);
            };
        }
    }, [t]);

    // Keep the refs the onend handler reads in sync with current state.
    useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
    useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
    useEffect(() => { runSpokenAnalysisRef.current = runSpokenAnalysis; }, [runSpokenAnalysis]);

    // Pre-load TTS voices so the first listening clip uses the intended voice
    // instead of a glitchy default (getVoices() is empty until voiceschanged).
    useEffect(() => {
        const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
        if (!synth) return;
        synth.getVoices();
        const onVoices = () => { synth.getVoices(); };
        synth.addEventListener?.('voiceschanged', onVoices);
        return () => synth.removeEventListener?.('voiceschanged', onVoices);
    }, []);

    // Tear down the mic and any narration when the tool unmounts, so the
    // microphone never stays live and audio never keeps playing after leaving.
    useEffect(() => () => {
        try { recognitionRef.current?.abort?.(); } catch { /* noop */ }
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    }, []);

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
        const alive = begin(); setError(null); setReadingEvaluation(null); setUserAnswers([]);
        try {
            const res = await analyzeEnglishReading(readingUserInput, targetIeltsBand);
            if (!alive()) return;
            setReadingComprehensionResult(res);
            setReadingSubMode('comprehension');
            await handlePracticeCompletion(alive);
        } catch(err) { if (alive()) setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { if (alive()) end(); }
    };

    const generateReadingPractice = async () => {
        const alive = begin(); setError(null); setReadingEvaluation(null); setUserAnswers([]);
        try {
            const res = await generateReadingPracticePassage(targetIeltsBand);
            if (!alive()) return;
            setReadingComprehensionResult(res);
            setReadingSubMode('comprehension');
        } catch(err) { if (alive()) setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { if (alive()) end(); }
    };

    const checkReadingAnswers = async () => {
        const res = readingComprehensionResult as EnglishReadingAnalysisResult;
        const textToUse = (res as any).passage || readingUserInput;
        if (!res || !res.comprehensionQuestions || userAnswers.length !== res.comprehensionQuestions.length) return;
        const alive = begin(); setError(null);
        try {
            const evaluation = await evaluateReadingComprehension(textToUse, res.comprehensionQuestions, userAnswers);
            if (!alive()) return;
            setReadingEvaluation(evaluation);
            await handlePracticeCompletion(alive);
        } catch(err) { if (alive()) setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { if (alive()) end(); }
    };

    const generateFlashcards = async () => {
        const alive = begin(); setError(null); setFlashcards([]);
        try {
            const { cards } = await generateVocabularyFlashcards(targetIeltsBand);
            if (!alive()) return;
            setFlashcards(cards.map(c => ({...c, distractors: shuffleArray([...c.distractors, c.definition])})));
            setCurrentCardIndex(0);
            setFlashcardScore(0);
            setReadingSubMode('flashcards');
        } catch(err) { if (alive()) setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { if (alive()) end(); }
    };

    // Listening
    const runListeningAnalysis = async () => {
        if (!userTranscription.trim()) { setError("Please type what you heard."); return; }
        const alive = begin(); setError(null);
        try {
            const res = await analyzeEnglishListening(currentClip.text, userTranscription, targetIeltsBand);
            if (!alive()) return;
            setListeningResult(res);
            await handlePracticeCompletion(alive);
        } catch(err) { if (alive()) setError(err instanceof Error ? err.message : 'An error occurred.'); }
        finally { if (alive()) end(); }
    };
    
    // UI Renderers
    const renderResultCard = (title: string, content: React.ReactNode) => (
        <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            <h5 className="font-bold text-gray-800 dark:text-gray-100">{title}</h5>
            <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{content}</div>
        </div>
    );
    
    const renderPracticeHub = () => (
        <div className="space-y-6">
            <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/60 rounded-lg text-center">
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
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('tool_english_pro_streak_title')}</h3>
                        <p className="text-gray-600 dark:text-gray-300">{t('tool_english_pro_streak_desc')}</p>
                    </div>
                </div>
                {dailyGoalComplete && <p className="text-green-600 font-semibold mt-3">{t('tool_english_pro_daily_complete')}</p>}
            </div>

            <div className="space-y-3">
                 <label htmlFor="ielts-band" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_english_pro_goal_setting_title')}</label>
                 <p className="text-xs text-gray-500 dark:text-gray-400">{t('tool_english_pro_goal_setting_desc')}</p>
                 <select id="ielts-band" value={targetIeltsBand} onChange={e => setTargetIeltsBand(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                    {IELTS_BANDS.map(band => <option key={band} value={band}>{band}</option>)}
                 </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => setPracticeMode('written')} className="p-6 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500">
                    <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t('tool_english_pro_written_title')}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t('tool_english_pro_written_desc')}</p>
                </button>
                 <button onClick={() => setPracticeMode('spoken')} className="p-6 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500">
                    <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t('tool_english_pro_spoken_title')}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t('tool_english_pro_spoken_desc')}</p>
                </button>
                 <button onClick={() => setPracticeMode('reading')} className="p-6 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500">
                    <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t('tool_english_pro_reading_title')}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t('tool_english_pro_reading_desc')}</p>
                </button>
                 <button onClick={() => setPracticeMode('listening')} className="p-6 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500">
                    <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t('tool_english_pro_listening_title')}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{t('tool_english_pro_listening_desc')}</p>
                </button>
            </div>
        </div>
    );

    const renderWrittenMode = () => (
        <div className="space-y-4">
            {!writtenResult ? (
                <>
                    <div>
                        <label htmlFor="native-language" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_english_pro_lang_label')}</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('tool_english_pro_lang_desc')}</p>
                        <select id="native-language" value={nativeLanguage} onChange={e => setNativeLanguage(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
                            {SUPPORTED_LANGUAGES.map(lang => <option key={lang}>{lang}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="email-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('tool_english_pro_prompt_label')}</label>
                         <p className="text-xs text-gray-500 dark:text-gray-400">{t('tool_english_pro_prompt_desc')}</p>
                        <div className="flex flex-wrap gap-2 my-2">{ENGLISH_PRO_TOPICS.map((topic, i) => <button key={i} onClick={() => setWrittenInput(t(`tool_english_pro_topic_${i + 1}`))} className="text-xs bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 p-2 rounded-md">{t(`tool_english_pro_topic_${i + 1}`)}</button>)}</div>
                        <textarea id="email-text" value={writtenInput} onChange={e => setWrittenInput(e.target.value)} rows={8} className="w-full border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm" placeholder={t('tool_english_pro_placeholder')} />
                    </div>
                    <button onClick={runWrittenTool} disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">{loading ? t('tool_english_pro_analyzing_button') : t('tool_english_pro_analyze_button')}</button>
                </>
            ) : (
                <div className="space-y-4">
                    <h4 className="font-bold text-lg text-center text-gray-900 dark:text-gray-100">{t('tool_english_pro_results_title')}</h4>
                    {renderResultCard(t('tool_english_pro_cefr_label'), <p className="font-bold text-blue-600 dark:text-blue-400 text-xl">{writtenResult.overallBand.level} <span className="text-sm font-normal text-gray-600 dark:text-gray-400">- {writtenResult.overallBand.description}</span></p>)}
                    {writtenResult.culturalTip && renderResultCard(t('tool_english_pro_cultural_tip'), <p>{writtenResult.culturalTip}</p>)}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderResultCard(t('tool_english_pro_original_label'), <p className="whitespace-pre-wrap">{originalWrittenInput}</p>)}
                        {renderResultCard(t('tool_english_pro_corrected_label'), <p className="whitespace-pre-wrap">{writtenResult.correctedEmail}</p>)}
                    </div>
                    {renderResultCard(t('tool_english_pro_feedback_label'), (
                        <ul className="space-y-3">{writtenResult.improvementAreas.map((area, i) => <li key={i}><strong>{area.category}:</strong> <span className="line-through text-red-600">{area.originalText}</span> &rarr; <span className="text-green-600">{area.suggestion}</span><br/><em className="text-xs text-gray-500 dark:text-gray-400">{area.explanation}</em></li>)}</ul>
                    ))}
                    <button onClick={() => setWrittenResult(null)} className="w-full text-sm py-2 px-4 border-2 border-dashed dark:border-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300">{t('tool_english_pro_practice_again_button')}</button>
                </div>
            )}
            <button onClick={handleStartNewPractice} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">&larr; Back to English Pro Hub</button>
        </div>
    );
    
    // --- Spoken Mode ---
    const renderSpokenMode = () => (
        <div className="space-y-4">
            {!spokenResult ? (
                <>
                    {/* Topic card */}
                    <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                        <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2">Speaking Topic</h4>
                        {currentTopic ? (
                            <p className="text-gray-700 dark:text-gray-300 text-sm italic">"{currentTopic}"</p>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Press the button below to get an IELTS-style speaking topic.</p>
                        )}
                        <button
                            onClick={fetchNewSpeakingTopic}
                            disabled={isFetchingTopic}
                            className="mt-3 text-sm bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 py-1.5 px-3 rounded-md disabled:opacity-50 flex items-center gap-2"
                        >
                            {isFetchingTopic && (
                                <svg className="animate-spin h-3.5 w-3.5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                </svg>
                            )}
                            {currentTopic ? t('tool_english_pro_spoken_new_topic') : t('tool_english_pro_spoken_get_topic')}
                        </button>
                    </div>

                    {/* Mic section */}
                    {!isSpeechSupported ? (
                        <div className="p-4 border border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
                            {t('tool_english_pro_spoken_not_supported')}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <button
                                onClick={toggleListening}
                                className={`w-20 h-20 rounded-full font-bold text-white text-sm flex flex-col items-center justify-center gap-1 transition-all shadow-lg focus:outline-none focus:ring-4 ${
                                    isListening
                                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-300 animate-pulse'
                                        : 'bg-blue-700 hover:bg-blue-800 focus:ring-blue-300'
                                }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                <span className="text-xs">{isListening ? t('tool_english_pro_spoken_stop_mic') : t('tool_english_pro_spoken_start_mic')}</span>
                            </button>
                            {isListening && (
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium animate-pulse">Recording… speak now</p>
                            )}
                        </div>
                    )}

                    {/* Live transcript */}
                    {(transcript || isListening) && (
                        <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{t('tool_english_pro_spoken_live_transcript')}</h5>
                            <p className="text-sm text-gray-700 dark:text-gray-300 min-h-[3rem]">{transcript || <span className="italic text-gray-400">Listening…</span>}</p>
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-4">
                    <h4 className="font-bold text-lg text-center text-gray-900 dark:text-gray-100">{t('tool_english_pro_spoken_results_title')}</h4>

                    {/* Scores row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderResultCard(t('tool_english_pro_spoken_clarity_score'), (
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                {spokenResult.clarityScore}<span className="text-base font-normal text-gray-500 dark:text-gray-400">/100</span>
                            </p>
                        ))}
                        {renderResultCard(t('tool_english_pro_spoken_pacing'), (
                            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                {spokenResult.pacingWPM}<span className="text-base font-normal text-gray-500 dark:text-gray-400"> {t('tool_english_pro_spoken_wpm')}</span>
                            </p>
                        ))}
                    </div>

                    {/* Filler words */}
                    {spokenResult.fillerWords.length > 0 && renderResultCard(t('tool_english_pro_spoken_filler_words'), (
                        <div className="flex flex-wrap gap-2 mt-1">
                            {spokenResult.fillerWords.map((fw, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-medium px-2.5 py-1 rounded-full">
                                    "{fw.word}" <span className="font-bold">×{fw.count}</span>
                                </span>
                            ))}
                        </div>
                    ))}

                    {/* Feedback & suggestions */}
                    {renderResultCard(t('tool_english_pro_spoken_feedback'), <p>{spokenResult.feedbackSummary}</p>)}
                    {spokenResult.improvementSuggestions.length > 0 && renderResultCard(t('tool_english_pro_spoken_suggestions'), (
                        <ul className="space-y-1 list-disc list-inside">
                            {spokenResult.improvementSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                    ))}

                    <button
                        onClick={() => { setSpokenResult(null); setTranscript(''); }}
                        className="w-full text-sm py-2 px-4 border-2 border-dashed dark:border-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                    >
                        {t('tool_english_pro_practice_again_button')}
                    </button>
                </div>
            )}
            <button onClick={handleStartNewPractice} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('tool_english_pro_back_to_hub')}</button>
        </div>
    );

    // --- Reading Mode ---
    const renderReadingMode = () => {
        const practiceResult = readingComprehensionResult as (EnglishReadingAnalysisResult & { passage?: string }) | null;
        const questions: ComprehensionQuestion[] = practiceResult?.comprehensionQuestions ?? [];

        const renderComprehensionSubMode = () => (
            <div className="space-y-4">
                {!readingComprehensionResult ? (
                    <>
                        {/* Generate or paste */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 space-y-3">
                                <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_english_pro_reading_generate_practice')}</h5>
                                <p className="text-xs text-gray-500 dark:text-gray-400">AI will generate a reading passage matched to your target IELTS band.</p>
                                <button
                                    onClick={generateReadingPractice}
                                    disabled={loading}
                                    className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded-lg text-sm"
                                >
                                    {loading ? t('tool_english_pro_generating_button') : t('tool_english_pro_reading_generate_button')}
                                </button>
                            </div>
                            <div className="p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 space-y-3">
                                <h5 className="font-bold text-gray-800 dark:text-gray-100">{t('tool_english_pro_reading_paste_text')}</h5>
                                <textarea
                                    value={readingUserInput}
                                    onChange={e => setReadingUserInput(e.target.value)}
                                    rows={4}
                                    className="w-full border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm text-sm"
                                    placeholder={t('tool_english_pro_reading_placeholder')}
                                />
                                <button
                                    onClick={runReadingAnalysis}
                                    disabled={loading || !readingUserInput.trim()}
                                    className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2 px-4 rounded-lg text-sm"
                                >
                                    {loading ? t('tool_english_pro_analyzing_button') : t('tool_english_pro_reading_analyze_button')}
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                        {/* Passage */}
                        {renderResultCard(t('tool_english_pro_reading_passage'), (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                {practiceResult?.passage ?? readingUserInput}
                            </p>
                        ))}

                        {/* Vocabulary list (only on analyzed user text) */}
                        {!practiceResult?.passage && (practiceResult as EnglishReadingAnalysisResult | null)?.vocabularyList?.length ? renderResultCard('Key Vocabulary', (
                            <table className="w-full text-xs">
                                <thead><tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-slate-600"><th className="pb-1 pr-2">Word</th><th className="pb-1 pr-2">Definition</th><th className="pb-1">Example</th></tr></thead>
                                <tbody>
                                    {(practiceResult as EnglishReadingAnalysisResult).vocabularyList.map((v, i) => (
                                        <tr key={i} className="border-b dark:border-slate-700 last:border-0">
                                            <td className="py-1 pr-2 font-semibold text-blue-600 dark:text-blue-400">{v.word}</td>
                                            <td className="py-1 pr-2">{v.definition}</td>
                                            <td className="py-1 italic text-gray-500 dark:text-gray-400">{v.example}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )) : null}

                        {/* Summary (analyzed text only) */}
                        {!practiceResult?.passage && (practiceResult as EnglishReadingAnalysisResult | null)?.summary
                            ? renderResultCard('Summary', <p>{(practiceResult as EnglishReadingAnalysisResult).summary}</p>)
                            : null
                        }

                        {/* Questions */}
                        {questions.length > 0 && renderResultCard(t('tool_english_pro_reading_questions'), (
                            <ol className="space-y-4 mt-1">
                                {questions.map((q, i) => (
                                    <li key={i} className="space-y-1">
                                        <p className="font-medium text-gray-800 dark:text-gray-100">{i + 1}. {q.question}</p>
                                        {!readingEvaluation ? (
                                            <input
                                                type="text"
                                                value={userAnswers[i] ?? ''}
                                                onChange={e => {
                                                    const next = [...userAnswers];
                                                    next[i] = e.target.value;
                                                    setUserAnswers(next);
                                                }}
                                                placeholder={t('tool_english_pro_reading_your_answer')}
                                                className="w-full border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm text-sm px-3 py-1.5"
                                            />
                                        ) : (
                                            <div className={`p-3 rounded-md text-sm ${readingEvaluation[i]?.isCorrect ? 'bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700'}`}>
                                                <p className="font-semibold">{readingEvaluation[i]?.isCorrect ? '✓ Correct' : '✗ Incorrect'}</p>
                                                <p className="text-gray-600 dark:text-gray-300">{readingEvaluation[i]?.feedback}</p>
                                                {!readingEvaluation[i]?.isCorrect && (
                                                    <p className="mt-1"><span className="font-medium">{t('tool_english_pro_reading_correct_answer')}:</span> {q.answer}</p>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        ))}

                        {/* Check / practice again */}
                        {!readingEvaluation ? (
                            <button
                                onClick={checkReadingAnswers}
                                disabled={loading || userAnswers.filter(Boolean).length !== questions.length}
                                className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg"
                            >
                                {loading ? t('tool_english_pro_checking_button') : t('tool_english_pro_reading_check_answers')}
                            </button>
                        ) : (
                            <>
                                {readingEvaluation && (
                                    <p className="text-center text-sm text-gray-600 dark:text-gray-300">
                                        {t('tool_english_pro_reading_results_summary')
                                            .replace('{correct}', String(readingEvaluation.filter(e => e.isCorrect).length))
                                            .replace('{total}', String(readingEvaluation.length))}
                                    </p>
                                )}
                                <button
                                    onClick={() => { setReadingComprehensionResult(null); setReadingEvaluation(null); setUserAnswers([]); setReadingUserInput(''); }}
                                    className="w-full text-sm py-2 px-4 border-2 border-dashed dark:border-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                                >
                                    {t('tool_english_pro_reading_practice_again')}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        );

        const renderFlashcardsSubMode = () => {
            if (loading && flashcards.length === 0) {
                return <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">{t('tool_english_pro_generating_button')}</p>;
            }
            if (flashcards.length === 0) {
                return <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">No flashcards loaded.</p>;
            }

            const isComplete = currentCardIndex >= flashcards.length;

            if (isComplete) {
                return (
                    <div className="p-6 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-center space-y-3">
                        <h4 className="font-bold text-xl text-gray-900 dark:text-gray-100">{t('tool_english_pro_flashcard_complete')}</h4>
                        <p className="text-gray-600 dark:text-gray-300">
                            {t('tool_english_pro_flashcard_final_score')
                                .replace('{score}', String(flashcardScore))
                                .replace('{total}', String(flashcards.length))}
                        </p>
                        <button
                            onClick={() => { setFlashcards([]); setCurrentCardIndex(0); setFlashcardScore(0); setReadingSubMode('select'); }}
                            className="w-full text-sm py-2 px-4 border-2 border-dashed dark:border-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                        >
                            {t('tool_english_pro_reading_practice_again')}
                        </button>
                    </div>
                );
            }

            const card = flashcards[currentCardIndex];
            // distractors already shuffled by generateFlashcards (includes definition as one option)
            const options = card.distractors;

            return (
                <div className="space-y-4">
                    {/* Score */}
                    <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
                        <span>{t('tool_english_pro_flashcard_score')}: <strong className="text-gray-800 dark:text-gray-100">{flashcardScore}</strong></span>
                        <span>{currentCardIndex + 1} / {flashcards.length}</span>
                    </div>

                    {/* Card */}
                    <div className="p-6 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{t('tool_english_pro_flashcard_question')}</p>
                        <h4 className="text-3xl font-bold text-blue-600 dark:text-blue-400">{card.word}</h4>
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                        {options.map((opt, i) => {
                            const isSelected = selectedFlashcardAnswer === opt;
                            const isCorrect = opt === card.definition;
                            let btnClass = 'w-full text-left py-3 px-4 rounded-lg border text-sm font-medium transition-colors ';
                            if (!isFlashcardAnswered) {
                                btnClass += 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200';
                            } else if (isCorrect) {
                                btnClass += 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300';
                            } else if (isSelected && !isCorrect) {
                                btnClass += 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300';
                            } else {
                                btnClass += 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 opacity-60';
                            }
                            return (
                                <button
                                    key={i}
                                    disabled={isFlashcardAnswered}
                                    onClick={() => {
                                        setSelectedFlashcardAnswer(opt);
                                        setIsFlashcardAnswered(true);
                                        if (opt === card.definition) setFlashcardScore(s => s + 1);
                                    }}
                                    className={btnClass}
                                >
                                    {opt}
                                </button>
                            );
                        })}
                    </div>

                    {/* Next */}
                    {isFlashcardAnswered && (
                        <button
                            onClick={() => { setCurrentCardIndex(i => i + 1); setSelectedFlashcardAnswer(null); setIsFlashcardAnswered(false); }}
                            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 px-4 rounded-lg"
                        >
                            {t('tool_english_pro_flashcard_next')}
                        </button>
                    )}
                </div>
            );
        };

        return (
            <div className="space-y-4">
                {readingSubMode === 'select' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => setReadingSubMode('comprehension')}
                            className="p-6 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500"
                        >
                            <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t('tool_english_pro_reading_comprehension_title')}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t('tool_english_pro_reading_comprehension_desc')}</p>
                        </button>
                        <button
                            onClick={generateFlashcards}
                            disabled={loading}
                            className="p-6 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-500 disabled:opacity-60"
                        >
                            <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t('tool_english_pro_reading_flashcards_title')}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t('tool_english_pro_reading_flashcards_desc')}</p>
                            {loading && <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">{t('tool_english_pro_generating_button')}</p>}
                        </button>
                    </div>
                )}
                {readingSubMode === 'comprehension' && renderComprehensionSubMode()}
                {readingSubMode === 'flashcards' && renderFlashcardsSubMode()}

                {readingSubMode !== 'select' && (
                    <button
                        onClick={() => { setReadingSubMode('select'); setReadingComprehensionResult(null); setReadingEvaluation(null); setUserAnswers([]); setReadingUserInput(''); setFlashcards([]); }}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        ← Back to Reading Options
                    </button>
                )}
                <button onClick={handleStartNewPractice} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('tool_english_pro_back_to_hub')}</button>
            </div>
        );
    };

    // --- Listening Mode ---
    const stopClip = () => {
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
        setIsPlaying(false);
    };
    const playClip = () => {
        const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
        if (!synth) return;
        try {
            const start = () => {
                const u = new SpeechSynthesisUtterance(currentClip.text);
                u.lang = 'en-US';
                u.rate = 0.95;
                const v = pickEnglishVoice();
                if (v) u.voice = v;
                u.onstart = () => setIsPlaying(true);
                u.onend = () => setIsPlaying(false);
                u.onerror = () => setIsPlaying(false);
                synth.speak(u);
            };
            // Avoid the synchronous cancel()→speak() race that tears the first clip.
            if (synth.speaking || synth.pending) { synth.cancel(); window.setTimeout(start, 120); }
            else start();
        } catch { setIsPlaying(false); }
    };

    const renderListeningMode = () => {
        const clipIndex = LISTENING_CLIPS.findIndex(c => c.id === currentClip.id);
        const isSpeechSynthesisSupported = 'speechSynthesis' in window;

        return (
            <div className="space-y-4">
                {/* Clip indicator */}
                <div className="flex items-center justify-between p-4 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('tool_english_pro_listening_clip_label')} {clipIndex + 1} {t('tool_english_pro_listening_of')} {LISTENING_CLIPS.length}
                    </span>
                    {!listeningResult && (
                        <button
                            onClick={() => {
                                const nextIndex = (clipIndex + 1) % LISTENING_CLIPS.length;
                                setCurrentClip(LISTENING_CLIPS[nextIndex]);
                                setUserTranscription('');
                                setListeningResult(null);
                            }}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            {t('tool_english_pro_listening_try_another')}
                        </button>
                    )}
                </div>

                {!listeningResult ? (
                    <>
                        {/* Play button */}
                        <div className="flex justify-center">
                            <button
                                onClick={isPlaying ? stopClip : playClip}
                                disabled={!isSpeechSynthesisSupported}
                                title={isSpeechSynthesisSupported ? undefined : 'Speech synthesis not supported in this browser'}
                                className={`flex items-center gap-2 ${isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'} disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-colors`}
                            >
                                {isPlaying ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="6" y="6" width="12" height="12" rx="1.5" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z"/>
                                    </svg>
                                )}
                                {isPlaying ? t('tool_english_pro_listening_stop') : t('tool_english_pro_listening_play_audio')}
                            </button>
                        </div>
                        {!isSpeechSynthesisSupported && (
                            <p className="text-xs text-center text-yellow-700 dark:text-yellow-400">Audio playback is not supported in this browser.</p>
                        )}

                        {/* Transcription input */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('tool_english_pro_listening_desc')}</label>
                            <textarea
                                value={userTranscription}
                                onChange={e => setUserTranscription(e.target.value)}
                                rows={4}
                                className="w-full border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm"
                                placeholder={t('tool_english_pro_listening_placeholder')}
                            />
                        </div>

                        <button
                            onClick={runListeningAnalysis}
                            disabled={loading || !userTranscription.trim()}
                            className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg"
                        >
                            {loading ? t('tool_english_pro_analyzing_button') : t('tool_english_pro_listening_check_button')}
                        </button>
                    </>
                ) : (
                    <div className="space-y-4">
                        <h4 className="font-bold text-lg text-center text-gray-900 dark:text-gray-100">{t('tool_english_pro_listening_results_title')}</h4>

                        {/* Similarity score */}
                        {renderResultCard(t('tool_english_pro_listening_similarity_score'), (
                            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                                {listeningResult.similarityScore}<span className="text-base font-normal text-gray-500 dark:text-gray-400">%</span>
                            </p>
                        ))}

                        {/* Side-by-side versions */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {renderResultCard(t('tool_english_pro_listening_your_version'), (
                                <p className="whitespace-pre-wrap text-sm">{listeningResult.diffView}</p>
                            ))}
                            {renderResultCard(t('tool_english_pro_listening_correct_version'), (
                                <p className="whitespace-pre-wrap text-sm">{listeningResult.originalTranscript}</p>
                            ))}
                        </div>

                        {/* Feedback on common errors */}
                        {listeningResult.feedbackOnCommonErrors.length > 0 && renderResultCard(t('tool_english_pro_listening_feedback'), (
                            <ul className="space-y-1 list-disc list-inside">
                                {listeningResult.feedbackOnCommonErrors.map((fb, i) => <li key={i}>{fb}</li>)}
                            </ul>
                        ))}

                        <button
                            onClick={() => {
                                const nextIndex = (clipIndex + 1) % LISTENING_CLIPS.length;
                                setCurrentClip(LISTENING_CLIPS[nextIndex]);
                                setUserTranscription('');
                                setListeningResult(null);
                            }}
                            className="w-full text-sm py-2 px-4 border-2 border-dashed dark:border-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                        >
                            {t('tool_english_pro_listening_try_another')}
                        </button>
                    </div>
                )}
                <button onClick={handleStartNewPractice} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">{t('tool_english_pro_back_to_hub')}</button>
            </div>
        );
    };

    // Main component return
    return (
        <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-lg animate-fade-in">
            {error && <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm mb-4">{error}</div>}
            {loading ? (
                <StagedLoader
                    icon={<Languages />}
                    accent="purple"
                    title="Analyzing your English"
                    steps={[
                        'Reading your submission…',
                        'Checking grammar & clarity…',
                        'Scoring against your target band…',
                        'Writing your feedback…',
                    ]}
                    onCancel={cancel}
                />
            ) : (
                <>
                    {practiceMode === 'hub' && renderPracticeHub()}
                    {practiceMode === 'written' && renderWrittenMode()}
                    {practiceMode === 'spoken' && renderSpokenMode()}
                    {practiceMode === 'reading' && renderReadingMode()}
                    {practiceMode === 'listening' && renderListeningMode()}
                </>
            )}
        </div>
    );
};

export default EnglishPro;
