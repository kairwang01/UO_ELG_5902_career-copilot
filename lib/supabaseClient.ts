
import { createClient } from '@supabase/supabase-js';

// Define the database schema to provide strong types for the client.
// This is based on the usage of the 'profiles' table in the app.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string,
          updated_at: string,
          full_name: string | null,
          avatar_url: string | null,
          subscription_status: string,
          resume_text: string | null,
          role: 'employer' | 'candidate',
          // Company fields are now part of the main profile for employers
          company_name: string | null,
          company_website: string | null,
          company_description: string | null,
          company_logo_url: string | null,
          preferred_language: string | null,
          wallet_address: string | null,
          nft_minted: boolean | null,
          nft_staked: boolean | null,
          nft_earnings: number | null,
          nft_token_id: number | null,
          english_pro_streak: number | null,
          english_pro_last_practice: string | null,
          credits: number | null,
        },
        Insert: {
          id: string,
          updated_at?: string,
          full_name?: string | null,
          avatar_url?: string | null,
          subscription_status?: string,
          resume_text?: string | null,
          role?: 'employer' | 'candidate',
          company_name?: string | null,
          company_website?: string | null,
          company_description?: string | null,
          company_logo_url?: string | null,
          preferred_language?: string | null,
          wallet_address?: string | null,
          nft_minted?: boolean | null,
          nft_staked?: boolean | null,
          nft_earnings?: number | null,
          nft_token_id?: number | null,
          english_pro_streak?: number | null,
          english_pro_last_practice?: string | null,
          credits?: number | null,
        },
        Update: {
          id?: string,
          updated_at?: string,
          full_name?: string | null,
          avatar_url?: string | null,
          subscription_status?: string,
          resume_text?: string | null,
          role?: 'employer' | 'candidate',
          company_name?: string | null,
          company_website?: string | null,
          company_description?: string | null,
          company_logo_url?: string | null,
          preferred_language?: string | null,
          wallet_address?: string | null,
          nft_minted?: boolean | null,
          nft_staked?: boolean | null,
          nft_earnings?: number | null,
          nft_token_id?: number | null,
          english_pro_streak?: number | null,
          english_pro_last_practice?: string | null,
          credits?: number | null,
        },
        Relationships: [],
      },
      job_postings: {
        Row: {
          id: number,
          employer_id: string,
          title: string,
          description: string | null,
          location: string | null,
          salary_range: string | null,
          is_active: boolean,
          created_at: string,
          updated_at: string,
        },
        Insert: {
          id?: number,
          employer_id: string,
          title: string,
          description?: string | null,
          location?: string | null,
          salary_range?: string | null,
          is_active?: boolean,
          created_at?: string,
          updated_at?: string,
        },
        Update: {
          id?: number,
          employer_id?: string,
          title?: string,
          description?: string | null,
          location?: string | null,
          salary_range?: string | null,
          is_active?: boolean,
          created_at?: string,
          updated_at?: string,
        },
        Relationships: [],
      },
      job_applications: {
        Row: {
          id: number,
          job_id: number,
          candidate_id: string,
          application_date: string,
          status: string,
          notes: string | null,
          compatibility_score: number | null,
        },
        Insert: {
          id?: number,
          job_id: number,
          candidate_id: string,
          application_date?: string,
          status?: string,
          notes?: string | null,
          compatibility_score?: number | null,
        },
        Update: {
          id?: number,
          job_id?: number,
          candidate_id?: string,
          application_date?: string,
          status?: string,
          notes?: string | null,
          compatibility_score?: number | null,
        },
        Relationships: [],
      },
      tool_usage_events: {
        Row: {
          event_id: number,
          user_id: string,
          tool_key: string,
          created_at: string,
          metadata: Json | null,
        },
        Insert: {
          event_id?: number,
          user_id: string,
          tool_key: string,
          created_at?: string,
          metadata?: Json | null,
        },
        Update: {
          event_id?: number,
          user_id?: string,
          tool_key?: string,
          created_at?: string,
          metadata?: Json | null,
        },
        Relationships: [],
      },
      resume_analyses: {
        Row: {
          analysis_id: number,
          user_id: string,
          event_id: number | null,
          score: number,
          market_name: string,
          summary: string | null,
          strengths: string[] | null,
          improvements: Json | null,
          keywords: string[] | null,
          created_at: string,
        },
        Insert: {
          analysis_id?: number,
          user_id: string,
          event_id?: number | null,
          score: number,
          market_name: string,
          summary?: string | null,
          strengths?: string[] | null,
          improvements?: Json | null,
          keywords?: string[] | null,
          created_at?: string,
        },
        Update: {
          analysis_id?: number,
          user_id?: string,
          event_id?: number | null,
          score?: number,
          market_name?: string,
          summary?: string | null,
          strengths?: string[] | null,
          improvements?: Json | null,
          keywords?: string[] | null,
          created_at?: string,
        },
        Relationships: [],
      },
      job_opportunities: {
        Row: {
          opportunity_id: number,
          user_id: string,
          job_title: string,
          company: string,
          location: string | null,
          url: string,
          ai_summary: string | null,
          compatibility_score: number | null,
          missing_skills: Json | null,
          is_saved: boolean,
          created_at: string,
        },
        Insert: {
          opportunity_id?: number,
          user_id: string,
          job_title: string,
          company: string,
          location?: string | null,
          url: string,
          ai_summary?: string | null,
          compatibility_score?: number | null,
          missing_skills?: Json | null,
          is_saved?: boolean,
          created_at?: string,
        },
        Update: {
          opportunity_id?: number,
          user_id?: string,
          job_title?: string,
          company?: string,
          location?: string | null,
          url?: string,
          ai_summary?: string | null,
          compatibility_score?: number | null,
          missing_skills?: Json | null,
          is_saved?: boolean,
          created_at?: string,
        },
        Relationships: [],
      },
      interview_sessions: {
        Row: {
          session_id: number,
          user_id: string,
          job_description: string | null,
          market_name: string | null,
          started_at: string,
          overall_summary: string | null,
        },
        Insert: {
          session_id?: number,
          user_id: string,
          job_description?: string | null,
          market_name?: string | null,
          started_at?: string,
          overall_summary?: string | null,
        },
        Update: {
          session_id?: number,
          user_id?: string,
          job_description?: string | null,
          market_name?: string | null,
          started_at?: string,
          overall_summary?: string | null,
        },
        Relationships: [],
      },
      interview_exchanges: {
        Row: {
          exchange_id: number,
          session_id: number,
          question_text: string,
          user_answer: string | null,
          ai_feedback: string | null,
          feedback_themes: Json | null,
          created_at: string,
        },
        Insert: {
          exchange_id?: number,
          session_id: number,
          question_text: string,
          user_answer?: string | null,
          ai_feedback?: string | null,
          feedback_themes?: Json | null,
          created_at?: string,
        },
        Update: {
          exchange_id?: number,
          session_id?: number,
          question_text?: string,
          user_answer?: string | null,
          ai_feedback?: string | null,
          feedback_themes?: Json | null,
          created_at?: string,
        },
        Relationships: [],
      },
      career_path_analyses: {
          Row: {
              path_id: number,
              user_id: string,
              desired_role: string,
              summary: string | null,
              skill_gaps: Json | null,
              actionable_steps: Json | null,
              bridge_roles: Json | null,
              created_at: string,
          },
          Insert: {
              path_id?: number,
              user_id: string,
              desired_role: string,
              summary?: string | null,
              skill_gaps?: Json | null,
              actionable_steps?: Json | null,
              bridge_roles?: Json | null,
              created_at?: string,
          },
          Update: {
              path_id?: number,
              user_id?: string,
              desired_role?: string,
              summary?: string | null,
              skill_gaps?: Json | null,
              actionable_steps?: Json | null,
              bridge_roles?: Json | null,
              created_at?: string,
          },
          Relationships: [],
      },
      weekly_insights: {
        Row: {
          insight_id: number,
          user_id: string,
          week_start_date: string,
          summary_text: string,
          actionable_tip: string | null,
          created_at: string,
        },
        Insert: {
          insight_id?: number,
          user_id: string,
          week_start_date: string,
          summary_text: string,
          actionable_tip?: string | null,
          created_at?: string,
        },
        Update: {
          insight_id?: number,
          user_id?: string,
          week_start_date?: string,
          summary_text?: string,
          actionable_tip?: string | null,
          created_at?: string,
        },
        Relationships: [],
      }
    },
    Views: {
      [_ in never]: never,
    },
    Functions: {
      [_ in never]: never,
    },
    Enums: {
      [_ in never]: never,
    },
    CompositeTypes: {
      [_ in never]: never,
    }
  }
};


// These variables should be configured in your environment.
// Using placeholders to prevent the app from crashing if they are not set.
const supabaseUrl = process.env.SUPABASE_URL || 'https://tchwdtylvdijcqfcuenf.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjaHdkdHlsdmRpamNxZmN1ZW5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NTgyNTMsImV4cCI6MjA3MTEzNDI1M30.aMf8wCCTP0pO94YJTBg3cwNYC3U8QIxVkivZ7YUMFMg';

// Check if the environment variables are not set and log a warning for developers.
// The app will proceed with placeholder values, and auth features will fail gracefully
// within their respective components, rather than showing a persistent banner.
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables are not set. Authentication and user features will not work with placeholder credentials.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
