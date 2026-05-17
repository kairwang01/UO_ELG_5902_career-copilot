import React from 'react';

interface LoadingSpinnerProps {
  market?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ market }) => {
  const analyzingText = market ? `Our AI is analyzing your resume for the ${market} market...` : 'Our AI is analyzing your resume...';
  const descriptionText = market ? `This may take a few moments. We're checking for ATS compliance, standards for the ${market} market, and powerful keywords!` : "This may take a few moments. We're checking for ATS compliance, market standards, and powerful keywords!";

  return (
    <div className="flex flex-col items-center justify-center space-y-4 my-24 animate-fade-in">
      <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin"></div>
      <p className="text-xl text-gray-800 font-semibold">{analyzingText}</p>
      <p className="text-base text-gray-500 max-w-md text-center">{descriptionText}</p>
    </div>
  );
};

export default LoadingSpinner;