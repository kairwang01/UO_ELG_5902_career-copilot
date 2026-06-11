import React, { useState, useEffect } from 'react';
import type { AppSession as Session } from '../../../lib/data';
import { data } from '../../../lib/data';
import type { UserProfile } from '../../../types';
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

const COMPANY_SIZE_OPTIONS = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;

/*
  Inline version of CompanyProfileForm adapted as a full page (no modal wrapper).
  Wired to the shared Firebase profile adapter and CompanyLogo uploader.
*/
export function PortalOrgProfile({ session, profile, darkMode, onSaved, t }: PortalOrgProfileProps) {
  const dm = darkMode;
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companySize, setCompanySize] = useState('');
  const [industry, setIndustry] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setCompanyName(profile.company_name || '');
    setWebsite(profile.company_website || '');
    setDescription(profile.company_description || '');
    setLogoUrl(profile.company_logo_url || null);
    setCompanySize(profile.company_size || '');
    setIndustry(profile.industry || '');
    setFoundedYear(profile.founded_year || '');
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { error } = await data.profiles.update(session.user.id, {
        company_name: companyName,
        company_website: website,
        company_description: description,
        company_logo_url: logoUrl,
        company_size: companySize || undefined,
        industry: industry || undefined,
        founded_year: foundedYear || undefined,
      });

      if (error) throw error;
      await onSaved();
      setMessage({ type: 'success', text: t('portal_org_saved') });
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message || t('portal_org_save_failed') });
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
      <PortalTopBar title={t('portal_nav_org_profile')} darkMode={dm} />
      <div className="max-w-[1088px] mx-auto p-8">
        <p className={`mb-8 ${dm ? 'text-gray-400' : 'text-gray-600'}`}>
          {t('portal_org_subtitle')}
        </p>

        <form onSubmit={handleSave}>
          <div className={card}>
            <div className="flex items-center gap-2 mb-6">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${dm ? 'bg-gray-700' : 'bg-blue-50'}`}>
                <Building2 className="w-5 h-5 text-[#1d4ed8]" />
              </div>
              <h2 className={`text-xl font-semibold ${dm ? 'text-white' : 'text-gray-900'}`}>
                {t('portal_org_info_title')}
              </h2>
            </div>

            <div className="space-y-6">
              {/* Logo — reuses CompanyLogo which handles Firebase Storage upload */}
              <div>
                <label className={label}>{t('portal_org_logo')}</label>
                <CompanyLogo url={logoUrl} size={96} onUpload={(url) => setLogoUrl(url)} />
              </div>

              <div>
                <label className={label}>
                  {t('portal_org_name')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  placeholder={t('portal_org_name_ph')}
                  className={input}
                />
              </div>

              <div>
                <label className={label}>{t('portal_org_website')}</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.example.com"
                  className={input}
                />
              </div>

              {/* Company Size */}
              <div>
                <label className={label}>{t('org_company_size')}</label>
                <select
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value)}
                  className={`${input} appearance-none`}
                >
                  <option value="">—</option>
                  {COMPANY_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Industry */}
              <div>
                <label className={label}>{t('org_industry')}</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder={t('org_industry_ph')}
                  className={input}
                />
              </div>

              {/* Founded Year */}
              <div>
                <label className={label}>{t('org_founded_year')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={foundedYear}
                  onChange={(e) => setFoundedYear(e.target.value)}
                  placeholder={t('portal_org_founded_ph')}
                  className={input}
                />
              </div>

              <div>
                <label className={label}>{t('portal_org_desc')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('portal_org_desc_ph')}
                  rows={5}
                  className={input}
                />
              </div>

              {message && (
                <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                  {message.text}
                </p>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    // Reset to the original profile values
                    setCompanyName(profile.company_name || '');
                    setWebsite(profile.company_website || '');
                    setDescription(profile.company_description || '');
                    setLogoUrl(profile.company_logo_url || null);
                    setCompanySize(profile.company_size || '');
                    setIndustry(profile.industry || '');
                    setFoundedYear(profile.founded_year || '');
                    setMessage(null);
                  }}
                  className={`flex-1 px-6 py-3 border rounded-lg transition-colors ${
                    dm ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('portal_org_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-[#1d4ed8] text-white rounded-lg hover:bg-[#1a45c9] transition-colors disabled:opacity-60 font-medium"
                >
                  {saving ? t('portal_org_saving') : t('portal_org_save')}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
