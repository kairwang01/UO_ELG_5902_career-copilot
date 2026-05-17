
import React from 'react';
import { useApiStatus } from '../contexts/ApiStatusContext';

const ApiStatusBanner: React.FC = () => {
  const { apiStatus, lastError } = useApiStatus();

  if (apiStatus === 'online') {
    return null;
  }

  const isDegraded = apiStatus === 'degraded';
  const bgColor = isDegraded ? 'bg-yellow-500' : 'bg-red-600';
  const icon = isDegraded ? '⚠️' : '❌';
  const defaultMessage = isDegraded
    ? 'AI services are currently experiencing high demand. Some features may be limited or slow.'
    : 'AI services are temporarily offline. You may see cached data or templates.';

  return (
    <div className={`w-full p-2 text-center text-white text-sm font-medium ${bgColor}`}>
      {icon} {lastError || defaultMessage}
    </div>
  );
};

export default ApiStatusBanner;
