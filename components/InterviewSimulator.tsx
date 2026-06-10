
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { generateInterviewQuestions, evaluateInterviewAnswer, type InterviewQuestion, type InterviewEvaluation } from '../services/aiClient';
import type { AppSession as Session } from '../lib/data';
import StagedLoader from './StagedLoader';
import { useRecentApplications } from '../hooks/useRecentApplications';

interface InterviewSimulatorProps {
  resumeText: string;
  market: string;
  onClose: () => void;
  t: (key: string) => string;
  session: Session | null;
}

interface Message {
    role: 'user' | 'model_question' | 'model_feedback' | 'system';
    content: string;
}

// Check for SpeechRecognition API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

// Sample job description for "Try an example"
const SAMPLE_JOB_DESC = `Job Title: Software Engineer II
Company: Amazon
Location: Ottawa, ON

We are looking for a Software Engineer to join our AWS team. You will design and build distributed systems handling millions of requests per day, work closely with senior engineers on complex technical challenges, and participate in on-call rotations.

Requirements:
- 2+ years of professional software development experience
- Strong command of at least one compiled language (Java, C++, Go)
- Solid understanding of data structures, algorithms, and system design
- Experience with cloud platforms (AWS preferred)
- Excellent verbal and written communication skills`;

const InterviewSimulator: React.FC<InterviewSimulatorProps> = ({ resumeText, market, onClose, t, session }) => {
    const [stage, setStage] = useState<'setup' | 'loading' | 'interviewing' | 'finished'>('setup');
    const [jobDescription, setJobDescription] = useState('');
    const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Recent applications for the job-context selector
    const { applications } = useRecentApplications(session);

    const formatEvaluation = (e: InterviewEvaluation): string => {
        const strengths = e.strengths?.length ? `\n\n✅ Strengths:\n• ${e.strengths.join('\n• ')}` : '';
        const improvements = e.improvements?.length ? `\n\n🔧 To improve:\n• ${e.improvements.join('\n• ')}` : '';
        const model = e.modelAnswer ? `\n\n💡 Model answer:\n${e.modelAnswer}` : '';
        return `Score: ${e.score}/100${strengths}${improvements}${model}`;
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isSpeechSupported) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        setUserInput(prev => prev + event.results[i][0].transcript);
                    }
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error:", event.error);
                setError(`${t('tool_mock_interview_speech_error')} ${event.error}`);
                setIsListening(false);
            };
        }
    }, [t]);

    const handleStartInterview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!jobDescription.trim()) {
            setError(t('tool_mock_interview_error_required'));
            return;
        }
        if (!session) {
            setError("You must be logged in to start an interview.");
            return;
        }
        setStage('loading');
        setError(null);

        try {
            const generated = await generateInterviewQuestions(resumeText, jobDescription, market);
            if (!generated.length) {
                throw new Error("No interview questions were generated. Please try again.");
            }
            setQuestions(generated);
            setCurrentIndex(0);
            setMessages([
                { role: 'system', content: t('tool_mock_interview_system_start') },
                { role: 'model_question', content: generated[0].question },
            ]);
            setStage('interviewing');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start interview session.");
            setStage('setup');
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading) return;

        const newUserMessage: Message = { role: 'user', content: userInput };
        setMessages(prev => [...prev, newUserMessage]);
        const currentInput = userInput;
        setUserInput('');
        setIsLoading(true);

        try {
            const currentQuestion = questions[currentIndex]?.question;
            if (!currentQuestion) throw new Error("Interview session not initialized.");

            const evaluation = await evaluateInterviewAnswer(currentQuestion, currentInput, jobDescription);

            const newMessages: Message[] = [{ role: 'model_feedback', content: formatEvaluation(evaluation) }];

            const nextIndex = currentIndex + 1;
            if (nextIndex >= questions.length) {
                newMessages.push({ role: 'system', content: 'Interview complete — review the feedback above. Great work!' });
                setStage('finished');
            } else {
                newMessages.push({ role: 'model_question', content: questions[nextIndex].question });
                setCurrentIndex(nextIndex);
            }

            setMessages(prev => [...prev, ...newMessages]);

        } catch (err) {
             setError(err instanceof Error ? err.message : "An error occurred during the interview.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestart = () => {
        setStage('setup');
        setMessages([]);
        setQuestions([]);
        setCurrentIndex(0);
        setUserInput('');
        setError(null);
        setJobDescription('');
    };

    const toggleListening = () => {
        if (!isSpeechSupported) {
            setError(t('tool_mock_interview_speech_error'));
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const renderMessage = (msg: Message, index: number) => {
        switch(msg.role) {
            case 'user':
                return <div key={index} className="flex justify-end mb-4"><div className="bg-blue-600 text-white rounded-lg py-2 px-4 max-w-lg">{msg.content}</div></div>;
            case 'model_question':
                return <div key={index} className="flex justify-start mb-4"><div className="bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-lg py-2 px-4 max-w-lg">{msg.content}</div></div>;
            case 'model_feedback':
                return <div key={index} className="my-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-400 text-yellow-800 dark:text-yellow-200 rounded-r-lg text-sm max-w-lg whitespace-pre-line">{msg.content}</div>;
            case 'system':
                return <div key={index} className="text-center my-4 text-sm text-gray-500 dark:text-gray-400 italic">{msg.content}</div>;
        }
    };

    // (c) Staged loader while generating questions
    if (stage === 'loading') {
        return (
            <StagedLoader
                title={t('tool_mock_interview_starting_button')}
                steps={[
                    t('tool_mock_interview_loader_step1'),
                    t('tool_mock_interview_loader_step2'),
                    t('tool_mock_interview_loader_step3'),
                ]}
                onCancel={() => setStage('setup')}
                icon={<MessageSquare />}
                accent="violet"
            />
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl shadow-2xl w-full flex flex-col h-full animate-fade-in">
            {stage === 'setup' && (
                <form onSubmit={handleStartInterview} className="p-6 space-y-4">
                    {/* (a) Intro card */}
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-600 dark:text-slate-300 space-y-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{t('tool_mock_interview_intro_title')}</p>
                        <p>{t('tool_mock_interview_intro_desc')}</p>
                    </div>

                    <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-100">{t('tool_mock_interview_setup_title')}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('tool_mock_interview_setup_desc')}</p>

                    {/* Recent applications selector + sample fill */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        {/* (b) Try an example */}
                        <button
                            type="button"
                            onClick={() => setJobDescription(SAMPLE_JOB_DESC)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline self-start"
                        >
                            {t('tool_mock_interview_try_example')}
                        </button>
                        {/* Recent applications — hidden when none */}
                        {applications.length > 0 && (
                            <div className="flex-1 sm:max-w-xs">
                                <select
                                    defaultValue=""
                                    onChange={(e) => {
                                        if (!e.target.value) return;
                                        const app = applications.find(a => a.id === e.target.value);
                                        if (!app) return;
                                        setJobDescription(prev => {
                                            const titleLine = `Job Title: ${app.job_title}`;
                                            if (prev.includes(titleLine)) return prev;
                                            return titleLine + (prev ? '\n\n' + prev : '');
                                        });
                                    }}
                                    className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="" disabled>{t('tool_mock_interview_recent_apps_placeholder')}</option>
                                    {applications.map((app) => (
                                        <option key={app.id} value={app.id}>
                                            {app.job_title}{app.status ? ` — ${app.status}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="job-description" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('tool_mock_interview_job_desc_label')}</label>
                        <textarea
                            id="job-description"
                            rows={10}
                            className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition shadow-sm"
                            placeholder={t('tool_mock_interview_job_desc_placeholder')}
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                        />
                    </div>

                    {/* (e) Error box with retry */}
                    {error && (
                        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-3">
                            <svg className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                            <div className="flex-1">
                                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                                <button
                                    type="submit"
                                    className="mt-2 text-sm font-semibold text-red-700 dark:text-red-300 hover:underline"
                                >
                                    {t('tool_mock_interview_retry')}
                                </button>
                            </div>
                        </div>
                    )}

                    <button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 px-4 rounded-lg">
                        {t('tool_mock_interview_start_button')}
                    </button>
                </form>
            )}

            {(stage === 'interviewing' || stage === 'finished') && (
                <>
                    <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-slate-900/50">
                        {messages.map(renderMessage)}
                        {isLoading && <div className="flex justify-start mb-4"><div className="bg-gray-200 dark:bg-slate-700 text-gray-800 rounded-lg py-2 px-4 max-w-lg animate-pulse">...</div></div>}
                        <div ref={chatEndRef} />
                    </div>
                    {stage === 'interviewing' && (
                        <div className="flex-shrink-0 p-4 border-t bg-white dark:bg-slate-800">
                            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                                <input
                                    type="text"
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder={t('tool_mock_interview_input_placeholder')}
                                    className="flex-grow w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700"
                                    disabled={isLoading}
                                />
                                {isSpeechSupported && (
                                    <button type="button" onClick={toggleListening} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse-mic' : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-200 hover:bg-gray-300'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                    </button>
                                )}
                                <button type="submit" disabled={isLoading || !userInput.trim()} className="px-4 py-2 bg-blue-700 text-white font-semibold rounded-full hover:bg-blue-800 disabled:bg-blue-400">
                                    {t('tool_mock_interview_send_button')}
                                </button>
                            </form>
                            {/* (e) Inline error with retry during interview */}
                            {error && (
                                <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 flex items-center gap-2">
                                    <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
                                    <button
                                        type="button"
                                        onClick={() => setError(null)}
                                        className="text-xs font-semibold text-red-700 dark:text-red-300 hover:underline shrink-0"
                                    >
                                        {t('tool_mock_interview_dismiss_error')}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                     {stage === 'finished' && (
                        <div className="flex-shrink-0 p-4 border-t bg-white dark:bg-slate-800 flex flex-wrap gap-3 justify-center">
                            {/* (d) Start over affordance */}
                            <button
                                type="button"
                                onClick={handleRestart}
                                className="px-6 py-2 border-2 border-dashed border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                            >
                                {t('tool_mock_interview_restart_button')}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800"
                            >
                                {t('tool_mock_interview_close_button')}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default InterviewSimulator;
