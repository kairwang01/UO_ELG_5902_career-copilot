
import React from 'react';
import type { AppSession as Session } from '../lib/data';
import type { UserProfile } from '../types';
import { ToolResultsProvider } from '../contexts/ToolResultsContext';
import AgileCoach from './tools/AgileCoach';
import CareerPathPlanner from './tools/CareerPathPlanner';
import CoverLetterGenerator from './tools/CoverLetterGenerator';
import EmailCrafter from './tools/EmailCrafter';
import EnglishPro from './tools/EnglishPro';
import LinkedInOptimizer from './tools/LinkedInOptimizer';
import OpportunityFinder from './tools/OpportunityFinder';
import PortfolioWebsiteBuilder from './tools/PortfolioWebsiteBuilder';
import ResumeFormatter from './tools/ResumeFormatter';
import SalaryNegotiator from './tools/SalaryNegotiator';
import NetworkingAssistant from './tools/NetworkingAssistant';
import PerformanceReviewPrep from './tools/PerformanceReviewPrep';
import SkillLearningPlanner from './tools/SkillLearningPlanner';
import IndustryEventScout from './tools/IndustryEventScout';

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
          <ActiveTool {...props} tool={tool} />
        </ToolResultsProvider>
    </div>
  );
};

export default ToolRunner;
