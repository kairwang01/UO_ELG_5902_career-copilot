import React from 'react';

interface Step {
  title: string;
  description: string;
}

interface WorkflowStepsProps {
  steps: Step[];
}

export const WorkflowSteps: React.FC<WorkflowStepsProps> = ({ steps }) => (
  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {steps.map((step, i) => (
      <div key={step.title} className="relative">
        <span className="text-xs font-medium text-[var(--beta-action)]">Step {i + 1}</span>
        <h3 className="font-semibold mt-1 mb-2">{step.title}</h3>
        <p className="text-sm text-[var(--beta-text-muted)]">{step.description}</p>
      </div>
    ))}
  </div>
);
