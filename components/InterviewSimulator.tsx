
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
    Timer,
    Mic,
    AlertTriangle,
    Award,
} from 'lucide-react';
import {
    generateInterviewQuestions,
    evaluateInterviewSession,
    type InterviewQuestion,
    type InterviewSessionReport,
} from '../services/aiClient';
import type { AppSession as Session } from '../lib/data';
import StagedLoader from './StagedLoader';
import { useRecentApplications } from '../hooks/useRecentApplications';
import { listAllActiveJobPostings, type JobPosting } from '../lib/recruitingData';
import InterviewerAvatar from './InterviewerAvatar';
import { DownloadButtons } from './tools/ToolUtils';

interface InterviewSimulatorProps {
  resumeText: string;
  market: string;
  onClose: () => void;
  t: (key: string) => string;
  session: Session | null;
}

// Check for SpeechRecognition API
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const isSpeechSupported = !!SpeechRecognition;

// ── Real-interview pacing (per requirements) ──────────────────────────────────
const PREP_SECONDS = 15;
const ANSWER_SECONDS = 180;

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

// ── Difficulty levels ──────────────────────────────────────────────────────────
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

// ── Verdict display map (AI returns the English verdict string) ───────────────
const VERDICT_META: Record<string, { labelKey: string; cls: string }> = {
    'strong hire':      { labelKey: 'mi_verdict_strong_hire', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    'hire':             { labelKey: 'mi_verdict_hire',        cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    'leaning hire':     { labelKey: 'mi_verdict_leaning_hire', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
    'leaning no hire':  { labelKey: 'mi_verdict_leaning_no',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    'no hire':          { labelKey: 'mi_verdict_no',          cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

// Sample for "Try an example"
const SAMPLE = {
    title: 'Software Engineer II',
    description: 'Join the AWS team building distributed systems that handle millions of requests per day.',
    responsibilities: 'Design and build distributed services; work with senior engineers on complex technical challenges; participate in on-call rotations.',
    requirements: '2+ years of professional software development; strong command of a compiled language (Java, C++, Go); solid data structures, algorithms and system design; AWS experience preferred; excellent communication.',
    companyName: 'Amazon',
};

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const InterviewSimulator: React.FC<InterviewSimulatorProps> = ({ resumeText, market, onClose, t, session }) => {
    const [stage, setStage] = useState<'setup' | 'loading' | 'interviewing' | 'evaluating' | 'report'>('setup');
    const [showDisclaimer, setShowDisclaimer] = useState(false);
    const [disclaimerChecked, setDisclaimerChecked] = useState(false);

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

    // ── Timed interview state ──
    const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [phase, setPhase] = useState<'prep' | 'answer'>('prep');
    const [prepLeft, setPrepLeft] = useState(PREP_SECONDS);
    const [answerLeft, setAnswerLeft] = useState(ANSWER_SECONDS);
    const [answerDraft, setAnswerDraft] = useState('');
    const answersRef = useRef<string[]>([]);
    const submittingRef = useRef(false);
    const [avatarSpeaking, setAvatarSpeaking] = useState(false);
    const [report, setReport] = useState<InterviewSessionReport | null>(null);
    const [openBreakdown, setOpenBreakdown] = useState<number | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const answerBoxRef = useRef<HTMLTextAreaElement>(null);

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

    // ── TTS: the avatar "speaks" each question (approximate mouth animation is
    //    driven by these lifecycle events — see InterviewerAvatar for the
    //    lip-sync design note) ──
    const speak = (text: string) => {
        try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'en-US';
            u.rate = 1;
            u.onstart = () => setAvatarSpeaking(true);
            u.onend = () => setAvatarSpeaking(false);
            u.onerror = () => setAvatarSpeaking(false);
            window.speechSynthesis.speak(u);
        } catch { /* TTS unsupported — avatar just stays idle */ }
    };
    const cancelSpeech = () => {
        try { window.speechSynthesis.cancel(); } catch { /* noop */ }
        setAvatarSpeaking(false);
    };
    useEffect(() => () => cancelSpeech(), []);

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

    /** Assemble the structured setup into the context consumed by generation AND the final report. */
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

    // ── Speech recognition (answers can be dictated) ──
    useEffect(() => {
        if (isSpeechSupported) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event: any) => {
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        setAnswerDraft(prev => prev + event.results[i][0].transcript);
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

    const stopListening = () => {
        if (isListening) {
            try { recognitionRef.current?.stop(); } catch { /* noop */ }
            setIsListening(false);
        }
    };
    const toggleListening = () => {
        if (!isSpeechSupported) {
            setError(t('tool_mock_interview_speech_error'));
            return;
        }
        if (isListening) {
            stopListening();
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    // ── Flow: setup → disclaimer → generate → timed questions → session report ──
    const handleStartClicked = (e: React.FormEvent) => {
        e.preventDefault();
        if (!jobTitle.trim()) { setError(t('mi_error_title_required')); return; }
        if (!jobDescription.trim() && !jobResponsibilities.trim() && !jobRequirements.trim()) {
            setError(t('mi_error_context_required')); return;
        }
        if (!session) { setError("You must be logged in to start an interview."); return; }
        setError(null);
        setDisclaimerChecked(false);
        setShowDisclaimer(true);
    };

    const beginInterview = async () => {
        setShowDisclaimer(false);
        setStage('loading');
        setError(null);
        try {
            const generated = await generateInterviewQuestions(resumeText, assembleContext(), market);
            if (!generated.length) throw new Error("No interview questions were generated. Please try again.");
            answersRef.current = [];
            submittingRef.current = false;
            setQuestions(generated);
            setCurrentIndex(0);
            setAnswerDraft('');
            setPhase('prep');
            setPrepLeft(PREP_SECONDS);
            setStage('interviewing');
            speak(generated[0].question);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start interview session.");
            setStage('setup');
        }
    };

    // Prep countdown → auto-start answering
    useEffect(() => {
        if (stage !== 'interviewing' || phase !== 'prep') return;
        if (prepLeft <= 0) {
            setPhase('answer');
            setAnswerLeft(ANSWER_SECONDS);
            setTimeout(() => answerBoxRef.current?.focus(), 50);
            return;
        }
        const id = setTimeout(() => setPrepLeft((s) => s - 1), 1000);
        return () => clearTimeout(id);
    }, [stage, phase, prepLeft]);

    // Answer countdown → auto-submit
    useEffect(() => {
        if (stage !== 'interviewing' || phase !== 'answer') return;
        if (answerLeft <= 0) {
            submitAnswer();
            return;
        }
        const id = setTimeout(() => setAnswerLeft((s) => s - 1), 1000);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stage, phase, answerLeft]);

    const startAnsweringNow = () => {
        cancelSpeech();
        setPhase('answer');
        setAnswerLeft(ANSWER_SECONDS);
        setTimeout(() => answerBoxRef.current?.focus(), 50);
    };

    const finishAndEvaluate = async (qa: { question: string; answer: string }[]) => {
        setStage('evaluating');
        try {
            const rep = await evaluateInterviewSession(qa, assembleContext(), resumeText);
            setReport(rep);
            setStage('report');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to evaluate the interview.");
            setReport(null);
            setStage('report'); // report stage renders the error + retry
        }
    };

    const submitAnswer = () => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        stopListening();
        cancelSpeech();

        answersRef.current = [...answersRef.current, answerDraft.trim()];
        const next = currentIndex + 1;
        if (next < questions.length) {
            setAnswerDraft('');
            setCurrentIndex(next);
            setPhase('prep');
            setPrepLeft(PREP_SECONDS);
            speak(questions[next].question);
            submittingRef.current = false;
        } else {
            const qa = questions.map((q, i) => ({ question: q.question, answer: answersRef.current[i] ?? '' }));
            finishAndEvaluate(qa);
        }
    };

    const endInterviewEarly = () => {
        if (!window.confirm(t('mi_end_confirm'))) return;
        stopListening();
        cancelSpeech();
        // Count the current draft, mark the rest unanswered, evaluate what we have.
        const answered = [...answersRef.current];
        answered[currentIndex] = answerDraft.trim();
        const qa = questions.map((q, i) => ({ question: q.question, answer: answered[i] ?? '' }));
        finishAndEvaluate(qa);
    };

    const handleRestart = () => {
        cancelSpeech();
        stopListening();
        setStage('setup');
        setQuestions([]);
        setCurrentIndex(0);
        setAnswerDraft('');
        answersRef.current = [];
        submittingRef.current = false;
        setReport(null);
        setOpenBreakdown(null);
        setError(null);
    };

    const formatReportForDownload = (rep: InterviewSessionReport): string => {
        let s = `# Interview Report — ${jobTitle}\n\n`;
        s += `Overall score: ${rep.overallScore}/100\nVerdict: ${rep.verdict}\n\n## Summary\n${rep.summary}\n\n`;
        s += `## Strengths\n${rep.strengths.map((x) => `* ${x}`).join('\n')}\n\n`;
        s += `## Improvements\n${rep.improvements.map((x) => `* ${x}`).join('\n')}\n\n## Question breakdown\n`;
        rep.perQuestion.forEach((pq, i) => {
            s += `\n### Q${i + 1} (${pq.score}/100): ${pq.question}\nYour answer: ${answersRef.current[i] || '(no answer)'}\nFeedback: ${pq.feedback}\n`;
        });
        return s;
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

    if (stage === 'evaluating') {
        return (
            <StagedLoader
                title={t('mi_report_title')}
                steps={[t('mi_eval_step1'), t('mi_eval_step2'), t('mi_eval_step3')]}
                icon={<ClipboardCheck />}
                accent="violet"
            />
        );
    }

    // ── Timed interview room ──────────────────────────────────────────────────
    if (stage === 'interviewing') {
        const q = questions[currentIndex];
        const isLast = currentIndex === questions.length - 1;
        const timeLeft = phase === 'prep' ? prepLeft : answerLeft;
        const timeMax = phase === 'prep' ? PREP_SECONDS : ANSWER_SECONDS;
        const urgent = phase === 'answer' && answerLeft <= 30;
        return (
            <div className="bg-white dark:bg-slate-800/50 rounded-xl shadow-2xl w-full flex flex-col lg:flex-row h-full animate-fade-in overflow-hidden">
                {/* Left: the interviewer */}
                <div className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-6 flex flex-col items-center gap-4">
                    <InterviewerAvatar
                        speaking={avatarSpeaking}
                        name={t('mi_avatar_name')}
                        roleLabel={t('mi_avatar_role')}
                    />
                    <div className="text-center">
                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                            {t('mi_q_progress').replace('{n}', String(currentIndex + 1)).replace('{total}', String(questions.length))}
                        </p>
                        <div className="mt-2 flex items-center justify-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                phase === 'prep'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                                <Timer className="h-3 w-3" />
                                {phase === 'prep' ? t('mi_phase_prep') : t('mi_phase_answer')}
                            </span>
                        </div>
                        <p className={`mt-2 text-4xl font-mono font-bold tabular-nums ${urgent ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-800 dark:text-gray-100'}`}>
                            {fmtTime(timeLeft)}
                        </p>
                        {/* time progress */}
                        <div className="mt-2 h-1.5 w-40 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${urgent ? 'bg-red-500' : phase === 'prep' ? 'bg-amber-500' : 'bg-blue-600'}`}
                                style={{ width: `${(timeLeft / timeMax) * 100}%` }}
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={endInterviewEarly}
                        className="mt-auto text-xs text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 underline"
                    >
                        {t('mi_end_interview')}
                    </button>
                </div>

                {/* Right: question + answer area */}
                <div className="flex-1 flex flex-col p-6 gap-4 min-h-[420px]">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-5">
                        <span className="inline-block mb-2 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                            {q?.category}
                        </span>
                        <p className="text-lg font-semibold text-gray-800 dark:text-gray-100 leading-relaxed">{q?.question}</p>
                    </div>

                    {phase === 'prep' ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-900/10 p-6 text-center">
                            <p className="text-sm text-amber-700 dark:text-amber-300 max-w-md">{t('mi_prep_hint')}</p>
                            <button
                                type="button"
                                onClick={startAnsweringNow}
                                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
                            >
                                {t('mi_start_now')}
                            </button>
                        </div>
                    ) : (
                        <>
                            <textarea
                                ref={answerBoxRef}
                                value={answerDraft}
                                onChange={(e) => setAnswerDraft(e.target.value)}
                                placeholder={t('mi_answer_placeholder')}
                                className="flex-1 min-h-[160px] w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-gray-100 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 p-4 transition shadow-sm resize-none"
                            />
                            <div className="flex items-center gap-3">
                                {isSpeechSupported && (
                                    <button
                                        type="button"
                                        onClick={toggleListening}
                                        aria-pressed={isListening}
                                        className={`p-2.5 rounded-full transition-colors shrink-0 ${isListening ? 'bg-red-500 text-white animate-pulse-mic' : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-slate-500'}`}
                                        title={t('mi_answer_placeholder')}
                                    >
                                        <Mic className="h-5 w-5" />
                                    </button>
                                )}
                                <p className="text-xs text-gray-400 dark:text-slate-500 flex-1">{t('mi_autosubmit_note')}</p>
                                <button
                                    type="button"
                                    onClick={submitAnswer}
                                    className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold rounded-lg shrink-0"
                                >
                                    {isLast ? t('mi_submit_last') : t('mi_submit_answer')}
                                </button>
                            </div>
                        </>
                    )}

                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    )}
                </div>
            </div>
        );
    }

    // ── Final report ──────────────────────────────────────────────────────────
    if (stage === 'report') {
        if (!report) {
            return (
                <div className="bg-white dark:bg-slate-800/50 rounded-xl shadow-2xl w-full p-8 animate-fade-in text-center space-y-4">
                    <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    <div className="flex justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => finishAndEvaluate(questions.map((q, i) => ({ question: q.question, answer: answersRef.current[i] ?? '' })))}
                            className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg"
                        >
                            {t('tool_mock_interview_retry')}
                        </button>
                        <button type="button" onClick={handleRestart} className="px-5 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-lg">
                            {t('mi_practice_again')}
                        </button>
                    </div>
                </div>
            );
        }
        const verdictMeta = VERDICT_META[report.verdict?.toLowerCase?.() ?? ''] ?? VERDICT_META['leaning hire'];
        return (
            <div className="bg-white dark:bg-slate-800/50 rounded-xl shadow-2xl w-full p-6 sm:p-8 animate-fade-in space-y-6 overflow-y-auto">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* score ring */}
                    <div className="relative h-28 w-28 shrink-0">
                        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                            <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-gray-200 dark:stroke-slate-700" strokeWidth="3.5" />
                            <circle
                                cx="18" cy="18" r="15.9" fill="none"
                                className={report.overallScore >= 75 ? 'stroke-emerald-500' : report.overallScore >= 50 ? 'stroke-amber-500' : 'stroke-red-500'}
                                strokeWidth="3.5" strokeLinecap="round"
                                strokeDasharray={`${Math.max(0, Math.min(100, report.overallScore))} 100`}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-gray-800 dark:text-gray-100">{Math.round(report.overallScore)}</span>
                            <span className="text-[10px] text-gray-400 dark:text-slate-500">/100</span>
                        </div>
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center sm:justify-start gap-2">
                            <Award className="h-5 w-5 text-violet-500" />
                            {t('mi_report_title')}
                        </h3>
                        <div className="mt-2 flex items-center justify-center sm:justify-start gap-2">
                            <span className="text-xs text-gray-500 dark:text-slate-400">{t('mi_verdict_label')}:</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${verdictMeta.cls}`}>
                                {t(verdictMeta.labelKey)}
                            </span>
                        </div>
                        <p className="mt-3 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">{report.summary}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40 p-4">
                        <h5 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm mb-2">{t('mi_report_strengths')}</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-emerald-900/80 dark:text-emerald-200/80">
                            {report.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                    </div>
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 p-4">
                        <h5 className="font-bold text-amber-800 dark:text-amber-300 text-sm mb-2">{t('mi_report_improvements')}</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-amber-900/80 dark:text-amber-200/80">
                            {report.improvements.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                    </div>
                </div>

                <div>
                    <h5 className="font-bold text-gray-800 dark:text-gray-100 text-sm mb-2">{t('mi_report_breakdown')}</h5>
                    <div className="divide-y divide-gray-100 dark:divide-slate-700 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                        {report.perQuestion.map((pq, i) => (
                            <div key={i} className="bg-white dark:bg-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setOpenBreakdown(openBreakdown === i ? null : i)}
                                    aria-expanded={openBreakdown === i}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-700/40"
                                >
                                    <span className={`shrink-0 inline-flex items-center justify-center h-8 w-10 rounded-md text-xs font-bold ${
                                        pq.score >= 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                        : pq.score >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                                        {Math.round(pq.score)}
                                    </span>
                                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 line-clamp-2">{pq.question}</span>
                                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${openBreakdown === i ? 'rotate-180' : ''}`} />
                                </button>
                                {openBreakdown === i && (
                                    <div className="px-4 pb-4 space-y-2 text-sm">
                                        <p className="text-gray-500 dark:text-slate-400">
                                            <span className="font-semibold text-gray-600 dark:text-slate-300">{t('mi_report_your_answer')}: </span>
                                            {answersRef.current[i]?.trim() ? answersRef.current[i] : <em>{t('mi_no_answer')}</em>}
                                        </p>
                                        <p className="text-gray-700 dark:text-gray-200 bg-violet-50 dark:bg-violet-900/15 border border-violet-100 dark:border-violet-800/30 rounded-lg p-3">{pq.feedback}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <DownloadButtons textContent={formatReportForDownload(report)} baseFilename={`interview_report_${jobTitle.replace(/\s+/g, '_') || 'session'}`} />
                    <button
                        type="button"
                        onClick={handleRestart}
                        className="px-6 py-2 border-2 border-dashed border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                        {t('mi_practice_again')}
                    </button>
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-blue-700 text-white font-semibold rounded-lg hover:bg-blue-800">
                        {t('tool_mock_interview_close_button')}
                    </button>
                </div>
            </div>
        );
    }

    // ── Setup stage ───────────────────────────────────────────────────────────
    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl shadow-2xl w-full flex flex-col h-full animate-fade-in relative">
            {/* Disclaimer modal — must be accepted before the interview starts */}
            {showDisclaimer && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl p-4">
                    <div className="max-w-lg w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
                        <h4 className="font-bold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            {t('mi_disclaimer_title')}
                        </h4>
                        <ul className="space-y-2 text-sm text-gray-600 dark:text-slate-300 list-disc list-inside">
                            <li>{t('mi_disclaimer_p1')}</li>
                            <li>{t('mi_disclaimer_p2')}</li>
                            <li>{t('mi_disclaimer_p3')}</li>
                            <li>{t('mi_disclaimer_p4')}</li>
                        </ul>
                        <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={disclaimerChecked}
                                onChange={(e) => setDisclaimerChecked(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-700 focus:ring-blue-500"
                            />
                            <span>{t('mi_disclaimer_check')}</span>
                        </label>
                        <div className="flex justify-end gap-3 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowDisclaimer(false)}
                                className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                            >
                                {t('mi_disclaimer_cancel')}
                            </button>
                            <button
                                type="button"
                                disabled={!disclaimerChecked}
                                onClick={beginInterview}
                                className="px-4 py-2 text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 dark:disabled:bg-blue-900/50 rounded-lg"
                            >
                                {t('mi_disclaimer_accept')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleStartClicked} className="p-6 space-y-5">
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
                        {/* real-flow pacing note */}
                        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Timer className="h-3.5 w-3.5 shrink-0" />
                            {t('mi_flow_note')}
                        </p>
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

                        {/* Difficulty switcher */}
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
        </div>
    );
};

export default InterviewSimulator;
