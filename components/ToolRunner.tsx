
import React from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile } from '../../types';
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

  if (!ActiveTool) {
      return <div className="text-red-600 bg-red-100 p-4 rounded-lg">Tool "{tool}" not found.</div>;
  }

  return (
    <div className="h-full animate-fade-in">
        <ActiveTool {...props} tool={tool} />
    </div>
  );
};

export default ToolRunner;
