import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { UserProfile } from '../../../types';
import { supabase } from '../../../lib/supabaseClient';
import CompanyLogo from '../../CompanyLogo';
import { Building2 } from 'lucide-react';
import { PortalTopBar } from '../PortalTopBar';

interface PortalOrgProfileProps {
  session: Session;
  profile: UserProfile;
  darkMode: boolean;
  onSaved: () => Promise<void>;
  t: (key: string) => string;
}

/*
  Inline version of CompanyProfileForm adapted as a full page (no modal wrapper).
  Wired to the same Supabase 'profiles' table and CompanyLogo uploader.
*/
export function PortalOrgProfile({ session, profile, darkMode, onSaved }: PortalOrgProfileProps) {
  const dm = darkMode;
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setCompanyName(profile.company_name || '');
    setWebsite(profile.company_website || '');
    setDescription(profile.company_description || '');
    setLogoUrl(profile.company_logo_url || null);
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          company_name: companyName,
          company_website: website,
          company_description: description,
          company_logo_url: logoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) throw error;
      await onSaved();
      setMessage('Profile saved.');
    } catch (err) {
      setMessage((err as Error).message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const card = `rounded-xl border p-6 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`;
  const input = `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d4ed8] focus:border-transparent ${
    dm ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
  }`;
  const label = `block text-sm font-medium mb-2 ${dm ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <>
      <PortalTopBar title="Organization Profile" darkMode={dm} />
      <div className="max-w-[1088px] mx-auto p-8">
        <p className={`mb-8 ${dm ? 'text-gray-400' : 'text-gray-600'}`}>
          Manage your organization's information and branding.
        </p>

        <form onSubmit={handleSave}>
          <div className={card}>
            <div className="flex items-center gap-2 mb-6">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dm ? 'bg-gray-700' : 'bg-blue-50'}`}>
                <Building2 className="w-5 h-5 text-[#1d4ed8]" />
              </div>
              <h2 className={`text-xl font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>
                Organization Information
              </h2>
            </div>

            <div className="space-y-6">
              {/* Logo — reuses CompanyLogo which handles Supabase Storage upload */}
              <div>
                <label className={label}>Organization Logo</label>
                <CompanyLogo url={logoUrl} size={96} onUpload={(url) => setLogoUrl(url)} />
              </div>

              <div>
                <label className={label}>
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  placeholder="e.g. Acme Corporation"
                  className={input}
                />
              </div>

              <div>
                <label className={label}>Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.example.com"
                  className={input}
                />
              </div>

              <div>
                <label className={label}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of your organization…"
                  rows={5}
                  className={input}
                />
              </div>

              {message && (
                <p className={`text-sm ${message === 'Profile saved.' ? 'text-green-600' : 'text-red-500'}`}>
                  {message}
                </p>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-[#1d4ed8] text-white rounded-lg hover:bg-[#1a45c9] transition-colors disabled:opacity-60 font-medium"
                >
                  {saving ? 'Saving…' : 'Save Profile'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
