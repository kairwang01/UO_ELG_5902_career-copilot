export interface InterviewFeedback {
  question: string;
  userAnswerSummary: string;
  starFeedback: {
    situation: string;
    task: string;
    action: string;
    result: string;
    missing: string;
  };
  clarityScore: number;
  nextDrill: string;
}

export const interviewFeedback: InterviewFeedback = {
  question: 'Tell me about a time you had to prioritize conflicting requests from stakeholders.',
  userAnswerSummary:
    'Described a sprint where sales and support wanted different fixes; chose support because tickets were spiking.',
  starFeedback: {
    situation: 'Clear — sprint pressure and two competing requests.',
    task: 'Partial — ownership as prioritizer is implied but not stated.',
    action: 'Good start — named the decision criteria (ticket volume).',
    result: 'Weak — no metric on ticket reduction or business outcome.',
    missing: 'Add how you communicated the tradeoff to sales and what you deferred.',
  },
  clarityScore: 71,
  nextDrill: 'Retry with one number in the Result line and a one-sentence stakeholder comms example.',
};
