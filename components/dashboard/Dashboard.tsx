import React, { useState, useEffect, useCallback } from 'react';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Timestamp,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  FileText,
  ListChecks,
  MessageSquare,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import Chart from './Chart';
import { firestoreDb } from '../../lib/firebaseClient';
import type { AppSession as Session } from '../../lib/data';
import { generateWeeklySummary } from '../../services/aiClient';
import { useSettings } from '../../contexts/SettingsContext';

type DashboardDestination = 'resume' | 'jobs' | 'interview' | 'plan';

interface DashboardProps {
  session: Session | null;
  profile: UserProfile | null;
  t: (key: string) => string;
  hasResume?: boolean;
  onNavigate?: (view: DashboardDestination) => void;
}

interface ChartDataPoint {
  label: string;
  value: number;
}

interface ActivityItem {
  type: string;
  details: string;
}

const toolMetadataMap: { [key: string]: { name: string } } = {
  'cover-letter': { name: 'Cover Letter' },
  'mock-interview': { name: 'Mock Interview' },
  'resume-analysis': { name: 'Resume Analysis' },
  'opportunity-finder': { name: 'Opportunity Finder' },
  'career-path-planner': { name: 'Career Path Planner' },
  default: { name: 'Tool Usage' },
};

const fallbackScores: ChartDataPoint[] = [
  { label: 'May 12', value: 58 },
  { label: 'May 19', value: 64 },
  { label: 'May 26', value: 71 },
  { label: 'Jun 2', value: 76 },
];

const fallbackSkills = ['Product discovery', 'Stakeholder alignment', 'Roadmap prioritization', 'ATS formatting'];

const toDate = (value: unknown): Date => {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as Timestamp).toDate();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

const ProgressLine: React.FC<{ value: number; tone?: 'ready' | 'gap' | 'risk' }> = ({ value, tone = 'ready' }) => {
  const toneClass =
    tone === 'risk' ? 'bg-red-600' : tone === 'gap' ? 'bg-amber-500' : 'bg-emerald-600';

  return (
    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
      <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'amber' | 'slate';
}> = ({ label, value, helper, icon: Icon, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50',
    amber: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50',
    slate: 'bg-slate-50 text-slate-700 dark:text-slate-300 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{value}</p>
        </div>
        <div className={`rounded-lg border p-2.5 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{helper}</p>
    </div>
  );
};

const PriorityItem: React.FC<{
  title: string;
  detail: string;
  status: 'High' | 'Medium' | 'Ready';
  onClick?: () => void;
}> = ({ title, detail, status, onClick }) => {
  const tone =
    status === 'High'
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-900/30 dark:text-red-300'
      : status === 'Medium'
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-300'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-300';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/30 dark:hover:border-blue-800 dark:hover:bg-blue-900/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-950 dark:text-slate-100">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{detail}</p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-1 text-[11px] font-semibold ${tone}`}>{status}</span>
      </div>
    </button>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ session, profile, t, hasResume = false, onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<ChartDataPoint[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<string>('');
  const [topSkills, setTopSkills] = useState<string[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const { isAIMode } = useSettings();

  const fetchDashboardData = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userId = session.user.id;

      const analysesSnap = await getDocs(query(
        collection(firestoreDb, 'users', userId, 'resume_analyses'),
        orderBy('created_at', 'asc'),
        limit(10),
      ));
      const analyses = analysesSnap.docs.map((doc) => doc.data());

      const chartData = analyses.map((a) => ({
        label: toDate(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Number(a.score) || 0,
      }));
      setScoreData(chartData);

      if (analyses.length > 0) {
        const latestAnalysis = analyses[analyses.length - 1];
        if (Array.isArray(latestAnalysis.keywords)) {
          setTopSkills(latestAnalysis.keywords.slice(0, 5));
        }
      }

      const activitiesSnap = await getDocs(query(
        collection(firestoreDb, 'users', userId, 'tool_events'),
        orderBy('created_at', 'desc'),
        limit(4),
      ));
      const activities = activitiesSnap.docs.map((doc) => doc.data());

      const feedData = activities.map((act) => {
        const toolKey = typeof act.tool_key === 'string' ? act.tool_key : 'default';
        const toolInfo = toolMetadataMap[toolKey] || toolMetadataMap.default;
        let details = `Used ${toolInfo.name}`;
        if (act.metadata && typeof act.metadata === 'object') {
          const meta = act.metadata as { [key: string]: unknown };
          if (Array.isArray(meta.scoreChange)) details = `Score changed from ${meta.scoreChange[0]} to ${meta.scoreChange[1]}`;
          if (typeof meta.jobTitle === 'string') details = `For "${meta.jobTitle}"`;
        }
        return {
          type: toolInfo.name,
          details,
        };
      });
      setActivityFeed(feedData);

      const getStartOfWeek = () => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day;
        const startOfWeek = new Date(now.setDate(diff));
        return startOfWeek.toISOString().split('T')[0];
      };

      const startOfWeek = getStartOfWeek();

      const insightSnap = await getDocs(query(
        collection(firestoreDb, 'users', userId, 'weekly_insights'),
        where('week_start_date', '==', startOfWeek),
        limit(1),
      ));
      const insight = insightSnap.docs[0]?.data();

      if (insight) {
        setWeeklySummary(insight.summary_text);
      } else if (!isAIMode) {
        setWeeklySummary('Turn on assisted tools when you want generated coaching. Your workbench still tracks resume, match, interview, and plan progress.');
      } else if (analyses.length > 0 || activities.length > 0) {
        const { summary } = await generateWeeklySummary({
          scores: chartData,
                activities: activities.map((a) => a.tool_key),
        });
        // Guard: a truncated/unparseable AI response can yield summary === undefined.
        // Persisting that crashed addDoc ("Unsupported field value: undefined") and
        // the outer catch then masked ALL dashboard history behind the sample-data
        // fallback. Only persist a real string; otherwise show the welcome copy.
        if (typeof summary === 'string' && summary.trim().length > 0) {
          setWeeklySummary(summary);
          try {
            await addDoc(collection(firestoreDb, 'users', userId, 'weekly_insights'), {
              week_start_date: startOfWeek,
              summary_text: summary,
              created_at: serverTimestamp(),
            });
          } catch (persistErr) {
            // Persistence is best-effort — never let it take down the dashboard.
            console.error('weekly_insights persist failed:', persistErr);
          }
        } else {
          setWeeklySummary(t('dashboard_welcome_summary'));
        }
      } else {
        setWeeklySummary(t('dashboard_welcome_summary'));
      }
    } catch (err: unknown) {
      console.error('Dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'Some workspace history could not be loaded.');
      setWeeklySummary('Use today to tighten your resume, review the strongest matches, and complete one interview practice round.');
    } finally {
      setLoading(false);
    }
    // Depend on the user id PRIMITIVE, not the session object: Firebase auth
    // events (token refresh / tab refocus) recreate the session object without
    // changing the user, and the object identity would re-fire the auto-fetch
    // (incl. the weekly-summary AI call) on every such event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, t, isAIMode]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const displayScores = scoreData.length > 0 ? scoreData : fallbackScores;
  const latestScore = displayScores[displayScores.length - 1]?.value ?? (hasResume ? 72 : 0);
  const readinessScore = hasResume ? latestScore : 0;
  const skills = topSkills.length > 0 ? topSkills : fallbackSkills;
  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const nextCtaLabel = hasResume ? 'Review priority fixes' : 'Upload resume';

  const priorities = hasResume
    ? [
        {
          title: 'Rewrite top 3 resume bullets with outcomes',
          detail: 'Add one measurable result to each bullet before applying to product roles.',
          status: 'High' as const,
          view: 'resume' as const,
        },
        {
          title: 'Review 12 high-fit job matches',
          detail: 'Two roles have strong evidence from your current experience and low skill gaps.',
          status: 'Medium' as const,
          view: 'jobs' as const,
        },
        {
          title: 'Run one STAR answer practice',
          detail: 'Your last practice needs a clearer Result line and stakeholder communication example.',
          status: 'Medium' as const,
          view: 'interview' as const,
        },
      ]
    : [
        {
          title: 'Add your resume to unlock the workbench',
          detail: 'The report, job matches, interview prompts, and career plan use your resume as the baseline.',
          status: 'High' as const,
          view: 'resume' as const,
        },
        {
          title: 'Preview the target role plan',
          detail: 'Set a role target after upload to turn gaps into weekly actions.',
          status: 'Medium' as const,
          view: 'plan' as const,
        },
      ];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Today&apos;s search workbench</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-3xl">
              Welcome back, {firstName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Keep the search moving through a simple loop: fix the resume evidence, compare fit, practice the likely interview, then update the plan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('resume')}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            {nextCtaLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {error && (
          <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Live history is unavailable, so sample readiness data is shown. {error}</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Resume readiness"
          value={hasResume ? `${readinessScore}` : '--'}
          helper={hasResume ? 'Score from the latest readiness pass.' : 'Upload a resume to generate the baseline.'}
          icon={FileText}
          tone="blue"
        />
        <MetricCard
          label="Priority fixes"
          value={hasResume ? '4' : '--'}
          helper={hasResume ? 'ATS, title alignment, and evidence gaps.' : 'Fix list appears after analysis.'}
          icon={ListChecks}
          tone="amber"
        />
        <MetricCard
          label="Matched roles"
          value={hasResume ? '12' : '--'}
          helper={hasResume ? 'Ranked by evidence and missing skill risk.' : 'Matches need a resume baseline.'}
          icon={Briefcase}
          tone="green"
        />
        <MetricCard
          label="This week"
          value={hasResume ? '5 tasks' : 'Start'}
          helper={hasResume ? 'Two resume edits, two applications, one practice.' : 'Create the first weekly plan.'}
          icon={CalendarCheck}
          tone="slate"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Readiness trend</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Track whether resume changes are improving role readiness before applying.</p>
            </div>
            {loading && <span className="text-xs font-medium text-slate-500 dark:text-slate-500">Loading history...</span>}
          </div>
          <div className="h-64 overflow-hidden">
            <Chart data={displayScores} width={620} height={250} t={t} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Current skill evidence</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Strongest signals to carry into job matching and interviews.</p>
          <div className="mt-5 space-y-4">
            {skills.slice(0, 4).map((skill, index) => (
              <div key={skill} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{skill}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-500">{82 - index * 9}%</span>
                </div>
                <ProgressLine value={82 - index * 9} tone={index > 1 ? 'gap' : 'ready'} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Priority queue</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Work items ranked by impact on applications this week.</p>
            </div>
            <Target className="h-5 w-5 text-blue-700 dark:text-blue-400" />
          </div>
          <div className="space-y-3">
            {priorities.map((item) => (
              <PriorityItem
                key={item.title}
                title={item.title}
                detail={item.detail}
                status={item.status}
                onClick={() => onNavigate?.(item.view)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Best match to review</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Technical Product Owner · B2B SaaS</p>
              </div>
              <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/30 dark:text-emerald-300">
                84%
              </span>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 p-3 text-sm text-slate-700 dark:text-slate-300">
              Evidence: led billing workflow redesign, prioritized backlog with engineering and design, reduced support tickets.
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('jobs')}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Open job matches
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/30 dark:text-blue-300">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Next interview drill</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Practice stakeholder prioritization and add one measurable Result line.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('interview')}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Open practice room
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Weekly coaching summary</h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{weeklySummary}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {['Resume evidence', 'Bridge applications', 'Interview result line'].map((label, index) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className={`h-4 w-4 ${index === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600'}`} />
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-100">Recent activity</h3>
          <div className="mt-4 space-y-3">
            {(activityFeed.length > 0
              ? activityFeed
              : [
                  { type: 'Resume Analysis', details: hasResume ? 'Readiness score updated to 76' : 'Waiting for first upload' },
                  { type: 'Job Match', details: 'Example match queue ready after resume analysis' },
                  { type: 'Career Plan', details: 'Weekly plan starts with role target selection' },
                ]
            ).map((item) => (
              <div key={`${item.type}-${item.details}`} className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 p-3">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{item.type}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.details}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
