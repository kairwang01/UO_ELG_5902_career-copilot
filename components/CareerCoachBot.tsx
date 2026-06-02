
import React, { useState, useEffect, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile } from '../types';
import { GoogleGenAI, Chat } from '@google/genai';
import Avatar from './Avatar';

interface CareerCoachBotProps {
    isOpen: boolean;
    onClose: () => void;
    session: Session | null;
    profile: UserProfile | null;
    resumeText: string;
    t: (key: string) => string;
}

interface Message {
    role: 'user' | 'model';
    content: string;
}

const renderFormattedMessage = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let ulistItems: string[] = [];
    let olistItems: string[] = [];
    let paragraphLines: string[] = [];

    const renderInlineFormatting = (line: string): React.ReactNode => {
        const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };
    
    const flushParagraph = () => {
        if (paragraphLines.length > 0) {
            elements.push(
                <p key={`p-${elements.length}`} className="mb-2 last:mb-0">
                    {paragraphLines.map((line, lineIndex) => (
                        <React.Fragment key={lineIndex}>
                            {renderInlineFormatting(line)}
                            {lineIndex < paragraphLines.length - 1 && <br />}
                        </React.Fragment>
                    ))}
                </p>
            );
            paragraphLines = [];
        }
    };

    const flushLists = () => {
        if (ulistItems.length > 0) {
            elements.push(
                <ul key={`ul-${elements.length}`} className="list-disc list-outside ml-5 my-2 space-y-1">
                    {ulistItems.map((item, index) => (
                        <li key={index}>{renderInlineFormatting(item)}</li>
                    ))}
                </ul>
            );
            ulistItems = [];
        }
        if (olistItems.length > 0) {
            elements.push(
                <ol key={`ol-${elements.length}`} className="list-decimal list-outside ml-5 my-2 space-y-1">
                    {olistItems.map((item, index) => (
                        <li key={index}>{renderInlineFormatting(item)}</li>
                    ))}
                </ol>
            );
            olistItems = [];
        }
    };

    const flushAll = () => {
        flushParagraph();
        flushLists();
    };

    lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
            flushParagraph();
            if (olistItems.length > 0) flushLists();
            ulistItems.push(trimmedLine.substring(2));
        } else if (trimmedLine.match(/^\d+\.\s/)) {
            flushParagraph();
            if (ulistItems.length > 0) flushLists();
            olistItems.push(trimmedLine.replace(/^\d+\.\s/, ''));
        } else if (trimmedLine === '') {
            flushAll();
        } else {
            flushLists();
            paragraphLines.push(line);
        }
    });

    flushAll();

    return elements.length > 0 ? elements : <p>{text}</p>;
};


const CareerCoachBot: React.FC<CareerCoachBotProps> = ({ isOpen, onClose, session, profile, resumeText, t }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
            
            let systemInstruction = "You are 'Alex', an empathetic and encouraging AI career coach. Your tone is warm, friendly, and professional yet conversational. Avoid being overly robotic. Use natural language, ask clarifying questions, and use markdown for formatting like **bolding** key terms. Start by asking the user if they are a job seeker or an employer to tailor your advice.";
            
            if (profile?.role === 'candidate') {
                systemInstruction = `You are 'Alex', an empathetic and expert AI career coach for a job seeker. Your tone is warm, friendly, and professional yet conversational. Use natural language, ask clarifying questions to understand their situation better, and offer encouragement. Avoid being overly robotic. Use markdown for formatting like **bolding** key terms, and use lists where appropriate. Here is the user's resume for context if they ask questions related to it:\n\n${resumeText}`;
            } else if (profile?.role === 'employer') {
                systemInstruction = `You are 'Alex', a professional and insightful AI HR assistant for an employer. Your tone is helpful, collaborative, and professional yet conversational. Use natural language and avoid overly formal or robotic phrasing. Use markdown for formatting like **bolding** key terms, and use lists where appropriate. Here is the employer's company profile for context: Name: ${profile.company_name || 'N/A'}, Website: ${profile.company_website || 'N/A'}, Description: ${profile.company_description || 'N/A'}`;
            }

            const chatSession = ai.chats.create({
                model: 'gemini-flash-latest',
                config: { systemInstruction }
            });

            setChat(chatSession);
            setMessages([{ role: 'model', content: "Hi there! I'm Alex, your AI-powered career coach. Whether you're looking for resume feedback, interview practice, or career advice, I'm here to help. What's on your mind today?" }]);
        }
    }, [isOpen, profile, resumeText]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading || !chat) return;

        const userMessage: Message = { role: 'user', content: userInput };
        setMessages(prev => [...prev, userMessage]);
        setUserInput('');
        setIsLoading(true);

        try {
            const responseStream = await chat.sendMessageStream({ message: userInput });
            
            let currentResponse = '';
            setMessages(prev => [...prev, { role: 'model', content: '' }]);

            for await (const chunk of responseStream) {
                currentResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { role: 'model', content: currentResponse };
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Error sending message:", error);
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end justify-center z-50 p-0 sm:p-4" onClick={handleOverlayClick}>
            <div className={`bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] sm:max-h-[700px] animate-slide-in-up`} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
                     <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white w-10 h-10 rounded-full flex items-center justify-center">
                             <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16.82 7.18002C16.82 5.58002 15.42 4.18002 13.82 4.18002C12.22 4.18002 10.82 5.58002 10.82 7.18002C10.82 8.78002 12.22 10.18 13.82 10.18C15.42 10.18 16.82 8.78002 16.82 7.18002Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M12 14.63H15.63" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M19.13 9.32002C20.94 11.52 20.73 14.6 18.6 16.59C16.47 18.58 13.06 18.74 11.02 16.94L7.52002 20.44C7.14002 20.82 6.51002 20.82 6.13002 20.44L4.21002 18.52C3.83002 18.14 3.83002 17.51 4.21002 17.13L7.71002 13.63C5.91002 11.59 5.75002 8.43002 7.74002 6.30002" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">AI Career Coach</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Powered by Gemini</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full p-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Close modal">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Chat Body */}
                <div className="flex-grow overflow-y-auto p-4 bg-gray-50/50 dark:bg-slate-900/50">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-end gap-3 my-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && (
                                <div className="flex-shrink-0 bg-gray-200 dark:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.82 7.18002C16.82 5.58002 15.42 4.18002 13.82 4.18002C12.22 4.18002 10.82 5.58002 10.82 7.18002C10.82 8.78002 12.22 10.18 13.82 10.18C15.42 10.18 16.82 8.78002 16.82 7.18002Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 14.63H15.63" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M19.13 9.32002C20.94 11.52 20.73 14.6 18.6 16.59C16.47 18.58 13.06 18.74 11.02 16.94L7.52002 20.44C7.14002 20.82 6.51002 20.82 6.13002 20.44L4.21002 18.52C3.83002 18.14 3.83002 17.51 4.21002 17.13L7.71002 13.63C5.91002 11.59 5.75002 8.43002 7.74002 6.30002" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                            )}
                            <div className={`px-4 py-3 rounded-2xl max-w-sm sm:max-w-md text-sm shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-200 dark:border-slate-600'}`}>
                                {msg.role === 'model' ? renderFormattedMessage(msg.content) : msg.content}
                            </div>
                             {msg.role === 'user' && (
                                 <div className="flex-shrink-0 w-8 h-8 rounded-full">
                                    <Avatar url={profile?.avatar_url} size={32} />
                                 </div>
                            )}
                        </div>
                    ))}
                    {isLoading && messages[messages.length - 1]?.role !== 'model' && (
                         <div className="flex items-end gap-3 my-4 justify-start">
                             <div className="flex-shrink-0 bg-gray-200 dark:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center">
                                 <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.82 7.18002C16.82 5.58002 15.42 4.18002 13.82 4.18002C12.22 4.18002 10.82 5.58002 10.82 7.18002C10.82 8.78002 12.22 10.18 13.82 10.18C15.42 10.18 16.82 8.78002 16.82 7.18002Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 14.63H15.63" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M19.13 9.32002C20.94 11.52 20.73 14.6 18.6 16.59C16.47 18.58 13.06 18.74 11.02 16.94L7.52002 20.44C7.14002 20.82 6.51002 20.82 6.13002 20.44L4.21002 18.52C3.83002 18.14 3.83002 17.51 4.21002 17.13L7.71002 13.63C5.91002 11.59 5.75002 8.43002 7.74002 6.30002" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                             </div>
                             <div className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-700 rounded-bl-none border border-gray-200 dark:border-slate-600">
                                 <div className="flex items-center justify-center space-x-1">
                                     <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                                     <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                                     <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></div>
                                 </div>
                             </div>
                         </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="Ask your career question..."
                            className="flex-grow w-full px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || !userInput.trim()} className="p-2 bg-blue-700 text-white rounded-full hover:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CareerCoachBot;
