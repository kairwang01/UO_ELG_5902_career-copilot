
import React, { useState, useEffect, useRef } from 'react';
import type { Chat } from '@google/genai';
import { startInterviewChat, saveInterviewExchange } from '../services/geminiService';
import type { Session } from '@supabase/supabase-js';

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

const InterviewSimulator: React.FC<InterviewSimulatorProps> = ({ resumeText, market, onClose, t, session }) => {
    const [stage, setStage] = useState<'setup' | 'interviewing' | 'finished'>('setup');
    const [jobDescription, setJobDescription] = useState('');
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [interviewSessionId, setInterviewSessionId] = useState<number | null>(null);
    const recognitionRef = useRef<any>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

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
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        setUserInput(prev => prev + event.results[i][0].transcript);
                    } else {
                        interimTranscript += event.results[i][0].transcript;
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
        setIsLoading(true);
        setError(null);
        
        try {
            const { chat: chatSession, sessionId } = await startInterviewChat(resumeText, jobDescription, market, session);
            setChat(chatSession);
            setInterviewSessionId(sessionId);
            
            const firstResponse = await chatSession.sendMessage({ message: "Start the interview." });
            const responseText = firstResponse.text.trim();
            const parsed = JSON.parse(responseText);

            setMessages([{ role: 'system', content: t('tool_mock_interview_system_start') }, { role: 'model_question', content: parsed.next_question }]);
            setStage('interviewing');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start interview session.");
        } finally {
            setIsLoading(false);
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
            if (!chat) throw new Error("Chat session not initialized.");
            
            const lastQuestion = [...messages].reverse().find(m => m.role === 'model_question')?.content;

            const response = await chat.sendMessage({ message: currentInput });
            const responseText = response.text.trim();
            const parsed = JSON.parse(responseText);
            
            if (interviewSessionId && lastQuestion) {
                await saveInterviewExchange({
                    sessionId: interviewSessionId,
                    question: lastQuestion,
                    answer: currentInput,
                    feedback: parsed.feedback || "N/A"
                });
            }

            const newMessages: Message[] = [];
            if(parsed.feedback) newMessages.push({ role: 'model_feedback', content: parsed.feedback });
            if(parsed.next_question) newMessages.push({ role: 'model_question', content: parsed.next_question });
            
            if(parsed.summary) {
                newMessages.push({ role: 'system', content: parsed.summary });
                setStage('finished');
            }
            
            setMessages(prev => [...prev, ...newMessages]);

        } catch (err) {
             setError(err instanceof Error ? err.message : "An error occurred during the interview.");
        } finally {
            setIsLoading(false);
        }
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
                return <div key={index} className="my-2 p-3 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-400 text-yellow-800 dark:text-yellow-200 rounded-r-lg text-sm max-w-lg">{msg.content}</div>;
            case 'system':
                return <div key={index} className="text-center my-4 text-sm text-gray-500 dark:text-gray-400 italic">{msg.content}</div>;
        }
    }
    
    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl shadow-2xl w-full flex flex-col h-full animate-fade-in">
            {stage === 'setup' && (
                <form onSubmit={handleStartInterview} className="p-6 space-y-4">
                    <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-100">{t('tool_mock_interview_setup_title')}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('tool_mock_interview_setup_desc')}</p>
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
                    {error && <div className="text-red-600 text-sm">{error}</div>}
                    <button type="submit" disabled={isLoading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg">
                        {isLoading ? t('tool_mock_interview_starting_button') : t('tool_mock_interview_start_button')}
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
                            {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
                        </div>
                    )}
                     {stage === 'finished' && (
                        <div className="flex-shrink-0 p-4 border-t bg-white dark:bg-slate-800 text-center">
                            <button onClick={onClose} className="px-6 py-2 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800">
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
