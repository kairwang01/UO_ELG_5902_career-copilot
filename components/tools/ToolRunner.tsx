
import React from 'react';
import type { AppSession as Session } from '../../lib/data';
import type { UserProfile } from '../../types';
import AgileCoach from './AgileCoach';
import CareerPathPlanner from './CareerPathPlanner';
import CoverLetterGenerator from './CoverLetterGenerator';
import EmailCrafter from './EmailCrafter';
import EnglishPro from './EnglishPro';
import LinkedInOptimizer from './LinkedInOptimizer';
import OpportunityFinder from './OpportunityFinder';
import PortfolioWebsiteBuilder from './PortfolioWebsiteBuilder';
import ResumeFormatter from './ResumeFormatter';
import SalaryNegotiator from './SalaryNegotiator';
import NetworkingAssistant from './NetworkingAssistant';
import PerformanceReviewPrep from './PerformanceReviewPrep';
import SkillLearningPlanner from './SkillLearningPlanner';
import IndustryEventScout from './IndustryEventScout';

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

const ToolRunner: React.FC<ToolRunnerProps> = ({ tool, resumeText, initialInput, onClose, openTool, market, session, profile, refreshProfile, t }) => {
  const ActiveTool = toolMap[tool];

  if (!ActiveTool) {
      return <div className="text-red-600 bg-red-100 p-4 rounded-lg">Tool "{tool}" not found.</div>;
  }

  return (
    <div className="h-full animate-fade-in">
        <ActiveTool
            resumeText={resumeText}
            initialInput={initialInput}
            onClose={onClose}
            openTool={openTool}
            market={market}
            session={session}
            profile={profile}
            refreshProfile={refreshProfile}
            t={t}
        />
    </div>
  );
};

export default ToolRunner;
