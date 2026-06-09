/**
* TypeScript 接口定义 - Firestore 数据结构
* 
* 大家注意，我们现在的数据库正在迁移到 Firestore (NoSQL)。
* 以前的 jsonb 字段现在直接存为标准的 JS Object 或 Array 即可。
* 原来独立的 interview_exchanges 问答记录，现在直接作为 exchanges 数组嵌套在 session 里面了，大家查面试记录的时候一次就能全拉出来。
* 另外，求职申请里加上了几个冗余字段（比如 job_title），列表渲染时直接用，不要去二次查询。具体的字段看 types/database.ts 即可！
*/

import { Timestamp } from 'firebase/firestore';

/**
 * 💡 数据结构总览 (对应原 10 张 SQL 表)：
 * * [根集合] users (原 profiles + auth.users)
 * ├── [子集合] career_paths (原 career_path_analyses)
 * ├── [子集合] interview_sessions (原 interview_sessions + interview_exchanges 内嵌)
 * ├── [子集合] job_opportunities (原 job_opportunities)
 * ├── [子集合] resume_analyses (原 resume_analyses)
 * ├── [子集合] tool_events (原 tool_usage_events)
 * └── [子集合] weekly_insights (原 weekly_insights)
 * * [根集合] job_postings (原 job_postings)
 * [根集合] job_applications (原 job_applications)
 */


// ==========================================
// 1. 根集合: users (用户主表)
// 路径: /users/{uid}
// ==========================================
export interface UserDocument {
  role: 'candidate' | 'employer'; // 默认 'candidate'
  full_name?: string;
  avatar_url?: string;
  subscription_status?: string;
  resume_text?: string;
  
  // 雇主专属字段
  company_name?: string;
  company_description?: string;
  company_logo_url?: string;
  company_website?: string;
  
  // 业务状态字段
  english_pro_streak: number; // 默认 0
  english_pro_last_practice?: Timestamp;
  wallet_address?: string;
  credits: number; // 默认 0
  
  created_at: Timestamp;
  updated_at?: Timestamp;
}

// ==========================================
// 2. 子集合 (归属于特定 User)
// ==========================================

// 路径: /users/{uid}/career_paths
export interface CareerPathDocument {
  desired_role: string;
  summary?: string;
  // 原 jsonb 字段转换为 TS 的 Record 或数组
  skill_gaps?: Record<string, any>; 
  actionable_steps?: any[]; 
  bridge_roles?: any[]; 
  created_at: Timestamp;
}

// 路径: /users/{uid}/interview_sessions
// 💡 原 interview_exchanges 表被内嵌到这里作为 exchanges 数组，避免多余的读取费用
export interface InterviewExchange {
  question_text: string;
  user_answer?: string;
  ai_feedback?: string;
  feedback_themes?: string[];
  created_at: Timestamp;
}

export interface InterviewSessionDocument {
  job_description?: string;
  market_name?: string;
  overall_summary?: string;
  started_at: Timestamp;
  exchanges: InterviewExchange[]; // 内嵌问答记录
}

// 路径: /users/{uid}/job_opportunities
export interface JobOpportunityDocument {
  job_title: string;
  company: string;
  location?: string;
  url: string; // 原来是 UNIQUE，Firestore 中需在代码层校验
  ai_summary?: string;
  compatibility_score?: number;
  missing_skills?: Record<string, any>; // 原 jsonb
  is_saved: boolean; // 默认 true
  created_at: Timestamp;
}

// 路径: /users/{uid}/resume_analyses
export interface ResumeAnalysisDocument {
  event_id?: string; // 关联的 tool_event ID
  score: number; // 0 - 100
  market_name: string;
  summary?: string;
  strengths?: any[]; // 原 jsonb
  improvements?: any[]; // 原 jsonb
  keywords?: string[]; // 原 jsonb
  created_at: Timestamp;
}

// 路径: /users/{uid}/tool_events
export interface ToolEventDocument {
  tool_key: string;
  metadata?: Record<string, any>; // 原 jsonb
  created_at: Timestamp;
}

// 路径: /users/{uid}/weekly_insights
export interface WeeklyInsightDocument {
  week_start_date: Timestamp;
  summary_text: string;
  actionable_tip?: string;
  created_at: Timestamp;
}


// ==========================================
// 3. 根集合: 职位与申请
// ==========================================

// 路径: /job_postings/{job_id}
export interface JobPostingDocument {
  employer_id: string; // 关联 User UID
  title: string;
  description?: string;
  location?: string;
  salary_range?: string;
  is_active: boolean; // 默认 true
  created_at: Timestamp;
  updated_at: Timestamp;
}

// 路径: /job_applications/{application_id}
export interface JobApplicationDocument {
  job_id: string; // 关联 JobPosting ID
  candidate_id: string; // 关联 User UID (候选人)
  
  // 💡 重点：以下为 NoSQL 独有的【冗余字段】
  // 为了避免前端同时去查 users 表和 job_postings 表，这里冗余存储常用信息
  employer_id: string; 
  job_title: string;
  candidate_name: string;
  
  status: 'Applied' | 'Interviewing' | 'Rejected' | 'Hired'; // 原默认 'Applied'
  notes?: string;
  application_date: Timestamp;
}