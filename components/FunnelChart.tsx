
import React from 'react';

interface FunnelDataPoint {
    stage: string;
    count: number;
}

interface FunnelChartProps {
    data: FunnelDataPoint[];
}

const FunnelChart: React.FC<FunnelChartProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return <div className="text-center p-4 text-gray-500">No data available for funnel.</div>;
    }
    
    const colors = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
    const maxCount = data[0]?.count || 1;

    return (
        <div className="flex flex-col items-center w-full space-y-1">
            {data.map(({ stage, count }, index) => {
                const widthPercentage = (count / maxCount) * 100;
                const conversionRate = index > 0 && data[index - 1].count > 0 
                    ? ((count / data[index - 1].count) * 100).toFixed(1)
                    : null;

                return (
                    <div key={stage} className="w-full flex flex-col items-center">
                        {index > 0 && (
                            <div className="flex items-center text-xs text-gray-500 font-semibold my-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                {conversionRate && <span>{conversionRate}%</span>}
                            </div>
                        )}
                        <div className="relative group w-full flex justify-center">
                            <div
                                className="h-12 rounded-md flex items-center justify-center text-white font-bold text-sm px-4 transition-all duration-300"
                                style={{
                                    width: `${Math.max(widthPercentage, 15)}%`, // Minimum width for visibility
                                    backgroundColor: colors[index % colors.length],
                                }}
                            >
                               <div className="text-center">
                                    <p>{stage}</p>
                                    <p className="text-base font-extrabold">{count}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default FunnelChart;
