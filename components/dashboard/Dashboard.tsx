
import React, { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile } from '../../types';
import Chart from './Chart';
import { supabase } from '../../lib/supabaseClient';
import { generateWeeklySummary } from '../../services/geminiService';
import { useSettings } from '../../contexts/SettingsContext';

interface DashboardProps {
    session: Session | null;
    profile: UserProfile | null;
    t: (key: string) => string;
}

interface ChartDataPoint {
  label: string;
  value: number;
}

interface ActivityItem {
    type: string;
    details: string;
    icon: string;
    color: string;
}

const toolMetadataMap: { [key: string]: { name: string; icon: string; color: string; } } = {
    'cover-letter': { name: 'Cover Letter', icon: '📝', color: 'bg-yellow-100 text-yellow-800' },
    'mock-interview': { name: 'Mock Interview', icon: '🎙️', color: 'bg-teal-100 text-teal-800' },
    'resume-analysis': { name: 'Resume Analysis', icon: '📊', color: 'bg-blue-100 text-blue-800' },
    'opportunity-finder': { name: 'Opportunity Finder', icon: '🔍', color: 'bg-purple-100 text-purple-800' },
    // Add other tools as needed
    'default': { name: 'Tool Usage', icon: '🔧', color: 'bg-gray-100 text-gray-800' }
};


const Dashboard: React.FC<DashboardProps> = ({ session, profile, t }) => {
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

            // 1. Fetch Resume Score History
            const { data: analyses, error: analysesError } = await supabase
                .from('resume_analyses')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: true })
                .limit(10);
            
            if (analysesError) throw analysesError;
            
            const chartData = analyses.map(a => ({
                label: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                value: a.score
            }));
            setScoreData(chartData);
            
            // 2. Fetch Top Skills from the LATEST analysis
            if (analyses.length > 0) {
                const latestAnalysis = analyses[analyses.length - 1];
                if (Array.isArray(latestAnalysis.keywords)) {
                    setTopSkills(latestAnalysis.keywords.slice(0, 5));
                }
            }

            // 3. Fetch Recent Activity
            const { data: activities, error: activitiesError } = await supabase
                .from('tool_usage_events')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(4);
            
            if (activitiesError) throw activitiesError;

            const feedData = activities.map(act => {
                const toolInfo = toolMetadataMap[act.tool_key] || toolMetadataMap.default;
                let details = `Used ${toolInfo.name}`;
                if(act.metadata && typeof act.metadata === 'object') {
                   const meta = act.metadata as { [key: string]: any };
                   if (meta.scoreChange && Array.isArray(meta.scoreChange)) details = `Score changed from ${meta.scoreChange[0]} to ${meta.scoreChange[1]}`;
                   if (meta.jobTitle && typeof meta.jobTitle === 'string') details = `For "${meta.jobTitle}"`;
                }
                return {
                    type: toolInfo.name,
                    details: details,
                    icon: toolInfo.icon,
                    color: toolInfo.color
                };
            });
            setActivityFeed(feedData);

            // 4. Generate or Fetch AI Weekly Summary (with caching)
            const getStartOfWeek = () => {
                const now = new Date();
                const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
                const diff = now.getDate() - day; // Adjust to Sunday
                const startOfWeek = new Date(now.setDate(diff));
                return startOfWeek.toISOString().split('T')[0];
            };

            const startOfWeek = getStartOfWeek();

            const { data: insight, error: insightError } = await supabase
                .from('weekly_insights')
                .select('summary_text')
                .eq('user_id', userId)
                .eq('week_start_date', startOfWeek)
                .single();
            
            if (insightError && insightError.code !== 'PGRST116') { // PGRST116 means 'no rows found'
                console.error("Error fetching weekly insight:", insightError);
            }

            if (insight) {
                setWeeklySummary(insight.summary_text);
            } else if (!isAIMode) {
                setWeeklySummary("Enable AI features from the top menu to view your personalized weekly insights and coaching summary.");
            } else if (analyses.length > 0 || activities.length > 0) {
                const { summary } = await generateWeeklySummary({
                    scores: chartData,
                    activities: activities.map(a => a.tool_key)
                });
                setWeeklySummary(summary);

                const { error: insertError } = await supabase
                    .from('weekly_insights')
                    .insert({
                        user_id: userId,
                        week_start_date: startOfWeek,
                        summary_text: summary,
                    });
                
                if (insertError) {
                    console.warn("Could not save new weekly insight:", insertError);
                }
            } else {
                setWeeklySummary(t('dashboard_welcome_summary'));
            }

        } catch (err: any) {
            console.error("Dashboard fetch error:", err);
            setError(err.message || "Failed to load dashboard data.");
            setWeeklySummary("Could not load your AI coaching summary at this time. Please try again later.");
        } finally {
            setLoading(false);
        }
    }, [session, t, isAIMode]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    if (loading) {
        return (
             <div className="flex flex-col items-center justify-center space-y-4 my-16">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin"></div>
                <p className="text-lg text-gray-600">{t('dashboard_loading_insights')}</p>
            </div>
        );
    }
    
    if (error) {
         return (
             <div className="bg-red-100 border-l-4 border-red-500 text-red-800 p-4 rounded-r-lg" role="alert">
                <p className="font-bold">{t('dashboard_error_loading')}</p>
                <p>{error}</p>
            </div>
         );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Resume Score Chart */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">{t('dashboard_score_history_title')}</h3>
                        <div className="h-64">
                             <Chart data={scoreData} width={550} height={250} t={t} />
                        </div>
                    </div>
                     {/* AI Coach's Summary */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span className="text-2xl">💡</span> {t('dashboard_ai_coach_summary_title')}
                        </h3>
                        <p className="text-gray-600 leading-relaxed">{weeklySummary}</p>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Top Skills */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">{t('dashboard_top_skills_title')}</h3>
                        {topSkills.length > 0 ? (
                            <div className="space-y-2">
                                {topSkills.map(skill => (
                                    <div key={skill} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">{skill}</span>
                                        <div className="w-1/2 bg-gray-200 rounded-full h-2">
                                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.random() * 40 + 60}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                             <p className="text-sm text-gray-500">{t('dashboard_top_skills_placeholder')}</p>
                        )}
                    </div>
                    {/* Recent Activity */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">{t('dashboard_recent_activity_title')}</h3>
                         {activityFeed.length > 0 ? (
                            <ul className="space-y-4">
                                {activityFeed.map((item, index) => (
                                    <li key={index} className="flex items-start">
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${item.color}`}>
                                            {item.icon}
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm font-semibold text-gray-800">{item.type}</p>
                                            <p className="text-sm text-gray-500">{item.details}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                             <p className="text-sm text-gray-500">{t('dashboard_recent_activity_placeholder')}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
