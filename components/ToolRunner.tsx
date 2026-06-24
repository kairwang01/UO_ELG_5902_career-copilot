
import React, { Suspense } from 'react';
import type { AppSession as Session } from '../lib/data';
import type { UserProfile } from '../types';
import { ToolResultsProvider } from '../contexts/ToolResultsContext';

// Each tool is code-split into its own chunk (React.lazy) so the candidate
// workspace shell stays small and a tool's code is fetched only when opened,
// instead of all 14 tools bloating the main CareerApp bundle.
const AgileCoach = React.lazy(() => import('./tools/AgileCoach'));
const CareerPathPlanner = React.lazy(() => import('./tools/CareerPathPlanner'));
const CoverLetterGenerator = React.lazy(() => import('./tools/CoverLetterGenerator'));
const EmailCrafter = React.lazy(() => import('./tools/EmailCrafter'));
const EnglishPro = React.lazy(() => import('./tools/EnglishPro'));
const LinkedInOptimizer = React.lazy(() => import('./tools/LinkedInOptimizer'));
const OpportunityFinder = React.lazy(() => import('./tools/OpportunityFinder'));
const PortfolioWebsiteBuilder = React.lazy(() => import('./tools/PortfolioWebsiteBuilder'));
const ResumeFormatter = React.lazy(() => import('./tools/ResumeFormatter'));
const SalaryNegotiator = React.lazy(() => import('./tools/SalaryNegotiator'));
const NetworkingAssistant = React.lazy(() => import('./tools/NetworkingAssistant'));
const PerformanceReviewPrep = React.lazy(() => import('./tools/PerformanceReviewPrep'));
const SkillLearningPlanner = React.lazy(() => import('./tools/SkillLearningPlanner'));
const IndustryEventScout = React.lazy(() => import('./tools/IndustryEventScout'));

interface ToolRunnerProps {
  tool: string;
  resumeText: string;
  initialInput: string;
  onClose: () => void;
  openTool: (tool: string, input?: string) => void;
  market: string;
  session: Session | null;
  profile: UserProfile | null;
  refreshProfile: () => void;
  t: (key: string) => string;
}

const toolMap: { [key: string]: React.FC<any> } = {
  'resume-formatter': ResumeFormatter,
  'opportunity-finder': OpportunityFinder,
  'linkedin-optimizer': LinkedInOptimizer,
  'cover-letter': CoverLetterGenerator,
  'career-path': CareerPathPlanner,
  'agile-coach': AgileCoach,
  'salary-negotiation': SalaryNegotiator,
  'english-pro': EnglishPro,
  'email-crafter': EmailCrafter,
  'website-builder': PortfolioWebsiteBuilder,
  'networking-assistant': NetworkingAssistant,
  'performance-review-prep': PerformanceReviewPrep,
  'skill-learning-plan': SkillLearningPlanner,
  'industry-event-scout': IndustryEventScout,
};

/** Brief fallback while a lazily-loaded tool chunk is fetched. */
const ToolChunkFallback: React.FC = () => (
  <div className="flex items-center justify-center py-24" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
  </div>
);

const ToolRunner: React.FC<ToolRunnerProps> = ({ tool, ...props }) => {
  const ActiveTool = toolMap[tool];
  const uid = props.session?.user?.id ?? null;
  const subscriptionStatus = props.profile?.subscription_status ?? null;

  if (!ActiveTool) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <p className="font-semibold">{props.t('tool_runner_unavailable_title')}</p>
          <p className="mt-1 text-sm">{props.t('tool_runner_unavailable_desc')}</p>
          <button
            type="button"
            onClick={props.onClose}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
          >
            {props.t('tool_runner_back_to_tools')}
          </button>
        </div>
      );
  }

  return (
    <div className="h-full animate-fade-in">
        <ToolResultsProvider toolKey={tool} uid={uid} subscriptionStatus={subscriptionStatus}>
          <Suspense fallback={<ToolChunkFallback />}>
            <ActiveTool {...props} tool={tool} />
          </Suspense>
        </ToolResultsProvider>
    </div>
  );
};

export default ToolRunner;
