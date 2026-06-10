
import React, { useState, useEffect, useRef } from 'react';
import {
    MessageSquare,
    Target,
    FileSearch,
    ClipboardCheck,
    TrendingUp,
    Wallet,
    ShieldCheck,
    SlidersHorizontal,
    Flame,
    ChevronDown,
    FileText,
    Building2,
    HelpCircle,
} from 'lucide-react';
import { generateInterviewQuestions, evaluateInterviewAnswer, type InterviewQuestion, type InterviewEvaluation } from '../services/aiClient';
import type { AppSession as Session } from '../lib/data';
import StagedLoader from './StagedLoader';
import { useRecentApplications } from '../hooks/useRecentApplications';
import { listAllActiveJobPostings, type JobPosting } from '../lib/recruitingData';

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

// ── Promo feature grid (8 selling points, i18n via mi_feat_* keys) ────────────
const PROMO_FEATURES: { icon: React.ReactNode; titleKey: string; descKey: string; tint: string }[] = [
    { icon: <Target className="h-4 w-4" />,            titleKey: 'mi_feat_1_title', descKey: 'mi_feat_1_desc', tint: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300' },
    { icon: <FileSearch className="h-4 w-4" />,        titleKey: 'mi_feat_2_title', descKey: 'mi_feat_2_desc', tint: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
    { icon: <ClipboardCheck className="h-4 w-4" />,    titleKey: 'mi_feat_3_title', descKey: 'mi_feat_3_desc', tint: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300' },
    { icon: <TrendingUp className="h-4 w-4" />,        titleKey: 'mi_feat_4_title', descKey: 'mi_feat_4_desc', tint: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300' },
    { icon: <Wallet className="h-4 w-4" />,            titleKey: 'mi_feat_5_title', descKey: 'mi_feat_5_desc', tint: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300' },
    { icon: <ShieldCheck className="h-4 w-4" />,       titleKey: 'mi_feat_6_title', descKey: 'mi_feat_6_desc', tint: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-300' },
    { icon: <SlidersHorizontal className="h-4 w-4" />, titleKey: 'mi_feat_7_title', descKey: 'mi_feat_7_desc', tint: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300' },
    { icon: <Flame className="h-4 w-4" />,             titleKey: 'mi_feat_8_title', descKey: 'mi_feat_8_desc', tint: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300' },
];

// ── FAQ (positioning copy — why this beats generic chatbots) ──────────────────
const FAQ_ITEMS: { qKey: string; aKey: string }[] = [
    { qKey: 'mi_faq_q1', aKey: 'mi_faq_a1' },
    { qKey: 'mi_faq_q2', aKey: 'mi_faq_a2' },
    { qKey: 'mi_faq_q3', aKey: 'mi_faq_a3' },
];

// ── Interview type ─────────────────────────────────────────────────────────────
type InterviewType = 'comprehensive' | 'technical' | 'behavioral' | 'hr';
const INTERVIEW_TYPES: { id: InterviewType; labelKey: string; descKey: string }[] = [
    { id: 'comprehensive', labelKey: 'mi_type_comprehensive', descKey: 'mi_type_comprehensive_desc' },
    { id: 'technical',     labelKey: 'mi_type_technical',     descKey: 'mi_type_technical_desc' },
    { id: 'behavioral',    labelKey: 'mi_type_behavioral',    descKey: 'mi_type_behavioral_desc' },
    { id: 'hr',            labelKey: 'mi_type_hr',            descKey: 'mi_type_hr_desc' },
];
const INTERVIEW_TYPE_DIRECTIVES: Record<InterviewType, string> = {
    comprehensive: 'Interview type: COMPREHENSIVE — mix technical depth, behavioral (STAR) and role-fit questions in realistic proportion.',
    technical:     'Interview type: TECHNICAL — focus on hands-on technical depth: concepts, system/solution design, debugging scenarios and trade-offs drawn from the role requirements.',
    behavioral:    'Interview type: BEHAVIORAL — STAR-format questions on teamwork, conflict, leadership, failure and delivery; evaluate structure and specificity of examples.',
    hr:            'Interview type: HR — motivation, culture fit, career plans, strengths/weaknesses, salary expectations and logistics.',
};

// ── Experience levels (工作年限) ───────────────────────────────────────────────
type Experience = 'new_grad' | 'y1_3' | 'y3_5' | 'y5_10' | 'y10p';
const EXPERIENCE_OPTIONS: { id: Experience; labelKey: string; directive: string }[] = [
    { id: 'new_grad', labelKey: 'mi_exp_new_grad', directive: 'New graduate / campus hire with 0 years of professional experience — calibrate to fundamentals, internships and projects.' },
    { id: 'y1_3',     labelKey: 'mi_exp_1_3',      directive: '1-3 years of professional experience.' },
    { id: 'y3_5',     labelKey: 'mi_exp_3_5',      directive: '3-5 years of professional experience.' },
    { id: 'y5_10',    labelKey: 'mi_exp_5_10',     directive: '5-10 years of professional experience — include ownership and mentoring angles.' },
    { id: 'y10p',     labelKey: 'mi_exp_10p',      directive: '10+ years of professional experience — include leadership, architecture and strategy angles.' },
];

// ── Salary currencies — mirror the supported language markets ─────────────────
const SALARY_CURRENCIES = ['CAD', 'USD', 'GBP', 'EUR', 'JPY', 'CNY', 'VND', 'SGD', 'AUD'] as const;

// ── Company profile selects (optional 公司信息配置) ────────────────────────────
const COMPANY_TYPES: { id: string; labelKey: string }[] = [
    { id: 'bigtech',    labelKey: 'mi_ctype_bigtech' },
    { id: 'foreign',    labelKey: 'mi_ctype_foreign' },
    { id: 'soe',        labelKey: 'mi_ctype_soe' },
    { id: 'startup',    labelKey: 'mi_ctype_startup' },
    { id: 'consulting', labelKey: 'mi_ctype_consulting' },
    { id: 'finance',    labelKey: 'mi_ctype_finance' },
    { id: 'other',      labelKey: 'mi_ctype_other' },
];
const COMPANY_INDUSTRIES: { id: string; labelKey: string }[] = [
    { id: 'internet',      labelKey: 'mi_cind_internet' },
    { id: 'ai',            labelKey: 'mi_cind_ai' },
    { id: 'finance',       labelKey: 'mi_cind_finance' },
    { id: 'healthcare',    labelKey: 'mi_cind_healthcare' },
    { id: 'education',     labelKey: 'mi_cind_education' },
    { id: 'manufacturing', labelKey: 'mi_cind_manufacturing' },
    { id: 'retail',        labelKey: 'mi_cind_retail' },
    { id: 'gaming',        labelKey: 'mi_cind_gaming' },
    { id: 'other',         labelKey: 'mi_cind_other' },
];

// ── Difficulty levels (the promo promises 难度自由切换 — so it must be real) ───
type Difficulty = 'entry' | 'advanced' | 'challenge';
const DIFFICULTY_DIRECTIVES: Record<Difficulty, string> = {
    entry:
        '[Interview difficulty: ENTRY. Ask foundational, beginner-friendly questions. Be encouraging in evaluations and weight fundamentals over depth.]',
    advanced:
        '[Interview difficulty: ADVANCED. Ask standard professional-level questions with realistic depth and one follow-up angle per topic.]',
    challenge:
        '[Interview difficulty: CHALLENGE. Ask demanding senior-level questions with high-pressure follow-ups, edge cases, and trade-off probing. Evaluate against a strong-hire bar.]',
};
const DIFFICULTY_OPTIONS: { id: Difficulty; labelKey: string }[] = [
    { id: 'entry',     labelKey: 'mi_difficulty_entry' },
    { id: 'advanced',  labelKey: 'mi_difficulty_advanced' },
    { id: 'challenge', labelKey: 'mi_difficulty_challenge' },
];

// Sample for "Try an example"
const SAMPLE = {
    title: 'Software Engineer II',
    description: 'Join the AWS team building distributed systems that handle millions of requests per day.',
    responsibilities: 'Design and build distributed services; work with senior engineers on complex technical challenges; participate in on-call rotations.',
    requirements: '2+ years of professional software development; strong command of a compiled language (Java, C++, Go); solid data structures, algorithms and system design; AWS experience preferred; excellent communication.',
    companyName: 'Amazon',
};

const InterviewSimulator: React.FC<InterviewSimulatorProps> = ({ resumeText, market, onClose, t, session }) => {
    const [stage, setStage] = useState<'setup' | 'loading' | 'interviewing' | 'finished'>('setup');

    // ── Section 1: interview type ──
    const [interviewType, setInterviewType] = useState<InterviewType>('comprehensive');
    // ── Section 2: target role ──
    const [jobTitle, setJobTitle] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [jobResponsibilities, setJobResponsibilities] = useState('');
    const [jobRequirements, setJobRequirements] = useState('');
    // ── Section 3: profile ──
    const [experience, setExperience] = useState<Experience>('new_grad');
    const [salaryMin, setSalaryMin] = useState('');
    const [salaryMax, setSalaryMax] = useState('');
    const [salaryCurrency, setSalaryCurrency] = useState<string>('CAD');
    // ── Section 4: settings ──
    const [difficulty, setDifficulty] = useState<Difficulty>('advanced');
    const [companyOpen, setCompanyOpen] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [companyType, setCompanyType] = useState('');
    const [companyIndustry, setCompanyIndustry] = useState('');
    // ── FAQ accordion ──
    const [openFaq, setOpenFaq] = useState<string | null>(null);

    const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Job sources: recent applications + platform postings (one fetch on mount)
    const { applications } = useRecentApplications(session);
    const [postings, setPostings] = useState<JobPosting[]>([]);
    useEffect(() => {
        let cancelled = false;
        listAllActiveJobPostings()
            .then((rows) => { if (!cancelled) setPostings(rows); })
            .catch(() => { /* signed-out or rules — selector just hides */ });
        return () => { cancelled = true; };
    }, []);

    const companyNameSuggestions = Array.from(
        new Set(postings.map((p) => p.company_name).filter((n): n is string => !!n)),
    );

    const handleJobSourcePick = (value: string) => {
        if (!value) return;
        if (value.startsWith('job:')) {
            const posting = postings.find((p) => p.id === value.slice(4));
            if (!posting) return;
            setJobTitle(posting.title);
            if (posting.description) setJobDescription(posting.description);
            if (posting.company_name) setCompanyName(posting.company_name);
        } else if (value.startsWith('app:')) {
            const app = applications.find((a) => a.id === value.slice(4));
            if (!app) return;
            setJobTitle(app.job_title);
        }
    };

    const fillSample = () => {
        setInterviewType('technical');
        setJobTitle(SAMPLE.title);
        setJobDescription(SAMPLE.description);
        setJobResponsibilities(SAMPLE.responsibilities);
        setJobRequirements(SAMPLE.requirements);
        setExperience('y1_3');
        setCompanyName(SAMPLE.companyName);
        setCompanyType('bigtech');
        setCompanyIndustry('internet');
        setCompanyOpen(true);
    };

    /**
     * Assemble the structured setup into the context string consumed by BOTH
     * question generation and answer evaluation — the whole session honours
     * type, role, profile, company and difficulty.
     */
    const assembleContext = (): string => {
        const lines: string[] = [];
        lines.push(INTERVIEW_TYPE_DIRECTIVES[interviewType]);
        lines.push(`Job Title: ${jobTitle.trim()}`);
        const exp = EXPERIENCE_OPTIONS.find((e) => e.id === experience);
        if (exp) lines.push(`Candidate experience level: ${exp.directive}`);
        if (salaryMin.trim() || salaryMax.trim()) {
            lines.push(`Target salary range: ${salaryMin.trim() || '?'}–${salaryMax.trim() || '?'} ${salaryCurrency}`);
        }
        if (companyName.trim() || companyType || companyIndustry) {
            const typeLabel = COMPANY_TYPES.find((c) => c.id === companyType);
            const indLabel = COMPANY_INDUSTRIES.find((c) => c.id === companyIndustry);
            lines.push(
                `Company: ${companyName.trim() || 'unspecified'}` +
                (typeLabel ? ` | type: ${typeLabel.id}` : '') +
                (indLabel ? ` | industry: ${indLabel.id}` : ''),
            );
        }
        if (jobDescription.trim()) lines.push(`Job Description:\n${jobDescription.trim()}`);
        if (jobResponsibilities.trim()) lines.push(`Responsibilities:\n${jobResponsibilities.trim()}`);
        if (jobRequirements.trim()) lines.push(`Requirements:\n${jobRequirements.trim()}`);
        lines.push(DIFFICULTY_DIRECTIVES[difficulty]);
        return lines.join('\n\n');
    };

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
        if (!jobTitle.trim()) {
            setError(t('mi_error_title_required'));
            return;
        }
        if (!jobDescription.trim() && !jobResponsibilities.trim() && !jobRequirements.trim()) {
            setError(t('mi_error_context_required'));
            return;
        }
        if (!session) {
            setError("You must be logged in to start an interview.");
            return;
        }
        setStage('loading');
        setError(null);

        try {
            const generated = await generateInterviewQuestions(resumeText, assembleContext(), market);
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

            const evaluation = await evaluateInterviewAnswer(currentQuestion, currentInput, assembleContext());

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

    // Numbered section header chip
    const SectionHeader: React.FC<{ n: number; titleKey: string; optional?: boolean }> = ({ n, titleKey, optional }) => (
        <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-700 text-white text-xs font-bold shrink-0">{n}</span>
            <h4 className="font-semibold text-gray-800 dark:text-gray-100">{t(titleKey)}</h4>
            {optional && <span className="text-xs text-gray-400 dark:text-slate-500">{t('mi_optional_tag')}</span>}
        </div>
    );

    const inputCls = "w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 transition shadow-sm";
    const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1";

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
                <form onSubmit={handleStartInterview} className="p-6 space-y-5">
                    {/* Promo feature grid — the 8 selling points */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-blue-50/40 dark:from-slate-800/60 dark:to-blue-900/10 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Flame className="h-4 w-4 text-orange-500" />
                                {t('mi_promo_title')}
                            </p>
                            <button
                                type="button"
                                onClick={fillSample}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                {t('tool_mock_interview_try_example')}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {PROMO_FEATURES.map((f) => (
                                <div
                                    key={f.titleKey}
                                    className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 shadow-sm"
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-md shrink-0 ${f.tint}`}>
                                            {f.icon}
                                        </span>
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                                            {t(f.titleKey)}
                                        </span>
                                    </div>
                                    <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                                        {t(f.descKey)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ① Interview type */}
                    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <SectionHeader n={1} titleKey="mi_section_1_title" />
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            {INTERVIEW_TYPES.map((it) => (
                                <button
                                    key={it.id}
                                    type="button"
                                    onClick={() => setInterviewType(it.id)}
                                    aria-pressed={interviewType === it.id}
                                    className={`rounded-lg border p-3 text-left transition-colors ${
                                        interviewType === it.id
                                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-600'
                                            : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                                    }`}
                                >
                                    <span className={`block text-sm font-semibold ${interviewType === it.id ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-100'}`}>
                                        {t(it.labelKey)}
                                    </span>
                                    <span className="block text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">{t(it.descKey)}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* ② Target role */}
                    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                        <SectionHeader n={2} titleKey="mi_section_2_title" />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="mi-job-title" className={labelCls}>{t('mi_job_title_label')}</label>
                                <input
                                    id="mi-job-title"
                                    type="text"
                                    className={inputCls}
                                    placeholder={t('mi_job_title_placeholder')}
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                />
                            </div>
                            {(postings.length > 0 || applications.length > 0) && (
                                <div>
                                    <label htmlFor="mi-job-source" className={labelCls}>{t('mi_job_source_label')}</label>
                                    <select
                                        id="mi-job-source"
                                        defaultValue=""
                                        onChange={(e) => handleJobSourcePick(e.target.value)}
                                        className={inputCls}
                                    >
                                        <option value="" disabled>{t('mi_job_source_placeholder')}</option>
                                        {applications.length > 0 && (
                                            <optgroup label={t('mi_job_group_applied')}>
                                                {applications.map((app) => (
                                                    <option key={`app-${app.id}`} value={`app:${app.id}`}>
                                                        {app.job_title}{app.status ? ` — ${app.status}` : ''}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {postings.length > 0 && (
                                            <optgroup label={t('mi_job_group_platform')}>
                                                {postings.map((p) => (
                                                    <option key={`job-${p.id}`} value={`job:${p.id}`}>
                                                        {p.title}{p.company_name ? ` · ${p.company_name}` : ''}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="mi-job-desc" className={labelCls}>{t('mi_job_desc_label')}</label>
                            <textarea
                                id="mi-job-desc"
                                rows={3}
                                className={inputCls}
                                placeholder={t('mi_job_desc_placeholder')}
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="mi-job-resp" className={labelCls}>{t('mi_job_resp_label')}</label>
                                <textarea
                                    id="mi-job-resp"
                                    rows={3}
                                    className={inputCls}
                                    placeholder={t('mi_job_resp_placeholder')}
                                    value={jobResponsibilities}
                                    onChange={(e) => setJobResponsibilities(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="mi-job-req" className={labelCls}>{t('mi_job_req_label')}</label>
                                <textarea
                                    id="mi-job-req"
                                    rows={3}
                                    className={inputCls}
                                    placeholder={t('mi_job_req_placeholder')}
                                    value={jobRequirements}
                                    onChange={(e) => setJobRequirements(e.target.value)}
                                />
                            </div>
                        </div>
                    </section>

                    {/* ③ Profile */}
                    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                        <SectionHeader n={3} titleKey="mi_section_3_title" />

                        {/* Resume status */}
                        <div className={`rounded-lg px-3 py-2 flex items-center gap-2 text-sm ${
                            resumeText
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                        }`}>
                            <FileText className="h-4 w-4 shrink-0" />
                            <span>{resumeText ? t('mi_resume_attached') : t('mi_resume_missing')}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="mi-experience" className={labelCls}>{t('mi_experience_label')}</label>
                                <select
                                    id="mi-experience"
                                    value={experience}
                                    onChange={(e) => setExperience(e.target.value as Experience)}
                                    className={inputCls}
                                >
                                    {EXPERIENCE_OPTIONS.map((opt) => (
                                        <option key={opt.id} value={opt.id}>{t(opt.labelKey)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>{t('mi_salary_label')}</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        className={inputCls}
                                        placeholder={t('mi_salary_min_ph')}
                                        value={salaryMin}
                                        onChange={(e) => setSalaryMin(e.target.value)}
                                        aria-label={t('mi_salary_min_ph')}
                                    />
                                    <span className="text-gray-400 shrink-0">–</span>
                                    <input
                                        type="number"
                                        min="0"
                                        className={inputCls}
                                        placeholder={t('mi_salary_max_ph')}
                                        value={salaryMax}
                                        onChange={(e) => setSalaryMax(e.target.value)}
                                        aria-label={t('mi_salary_max_ph')}
                                    />
                                    <select
                                        value={salaryCurrency}
                                        onChange={(e) => setSalaryCurrency(e.target.value)}
                                        className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 shrink-0"
                                        aria-label={t('mi_salary_currency_label')}
                                    >
                                        {SALARY_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ④ Interview settings */}
                    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
                        <SectionHeader n={4} titleKey="mi_section_4_title" />

                        {/* Difficulty switcher — the promo's 难度自由切换, for real */}
                        <div>
                            <span className={labelCls}>{t('mi_difficulty_label')}</span>
                            <div className="inline-flex rounded-lg border border-gray-300 dark:border-slate-600 overflow-hidden" role="group" aria-label={t('mi_difficulty_label')}>
                                {DIFFICULTY_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setDifficulty(opt.id)}
                                        aria-pressed={difficulty === opt.id}
                                        className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                                            difficulty === opt.id
                                                ? 'bg-blue-700 text-white'
                                                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {t(opt.labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Company info (optional, collapsible) */}
                        <div className="rounded-lg border border-gray-200 dark:border-slate-600">
                            <button
                                type="button"
                                onClick={() => setCompanyOpen((v) => !v)}
                                aria-expanded={companyOpen}
                                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg"
                            >
                                <span className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-gray-400" />
                                    {t('mi_company_section')}
                                </span>
                                <ChevronDown className={`h-4 w-4 transition-transform ${companyOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {companyOpen && (
                                <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label htmlFor="mi-company-name" className={labelCls}>{t('mi_company_name_label')}</label>
                                        <input
                                            id="mi-company-name"
                                            type="text"
                                            list="mi-company-names"
                                            className={inputCls}
                                            placeholder={t('mi_company_name_ph')}
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                        />
                                        <datalist id="mi-company-names">
                                            {companyNameSuggestions.map((n) => <option key={n} value={n} />)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label htmlFor="mi-company-type" className={labelCls}>{t('mi_company_type_label')}</label>
                                        <select
                                            id="mi-company-type"
                                            value={companyType}
                                            onChange={(e) => setCompanyType(e.target.value)}
                                            className={inputCls}
                                        >
                                            <option value="">{t('mi_company_type_ph')}</option>
                                            {COMPANY_TYPES.map((c) => <option key={c.id} value={c.id}>{t(c.labelKey)}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="mi-company-industry" className={labelCls}>{t('mi_company_industry_label')}</label>
                                        <select
                                            id="mi-company-industry"
                                            value={companyIndustry}
                                            onChange={(e) => setCompanyIndustry(e.target.value)}
                                            className={inputCls}
                                        >
                                            <option value="">{t('mi_company_industry_ph')}</option>
                                            {COMPANY_INDUSTRIES.map((c) => <option key={c.id} value={c.id}>{t(c.labelKey)}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

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

                    <button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-lg text-base shadow-lg shadow-blue-700/20">
                        {t('tool_mock_interview_start_button')}
                    </button>

                    {/* FAQ — positioning (why not a generic chatbot) */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <p className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-2">
                            <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            {t('mi_faq_title')}
                        </p>
                        <div className="divide-y divide-gray-100 dark:divide-slate-700">
                            {FAQ_ITEMS.map((f) => (
                                <div key={f.qKey} className="py-2">
                                    <button
                                        type="button"
                                        onClick={() => setOpenFaq(openFaq === f.qKey ? null : f.qKey)}
                                        aria-expanded={openFaq === f.qKey}
                                        className="w-full flex items-center justify-between text-left text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-700 dark:hover:text-blue-300"
                                    >
                                        <span>{t(f.qKey)}</span>
                                        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openFaq === f.qKey ? 'rotate-180' : ''}`} />
                                    </button>
                                    {openFaq === f.qKey && (
                                        <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-slate-400 whitespace-pre-line">
                                            {t(f.aKey)}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
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
