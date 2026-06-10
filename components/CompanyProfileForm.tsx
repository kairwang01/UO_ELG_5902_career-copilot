import React, { useState, useEffect } from 'react';
import type { AppSession as Session } from '../lib/data';
import { data } from '../lib/data';
import CompanyLogo from './CompanyLogo';
import { useModalBehavior } from '../hooks/useModalBehavior';

type CompanyProfileData = {
    company_name?: string | null;
    company_website?: string | null;
    company_description?: string | null;
    company_logo_url?: string | null;
};

interface CompanyProfileFormProps {
    session: Session;
    existingProfile: CompanyProfileData | null;
    onClose: () => void;
    onSave: () => Promise<void>;
    t: (key: string) => string;
}

const CompanyProfileForm: React.FC<CompanyProfileFormProps> = ({ session, existingProfile, onClose, onSave, t }) => {
    useModalBehavior(onClose);
    const [loading, setLoading] = useState(false);
    const [companyName, setCompanyName] = useState('');
    const [companyWebsite, setCompanyWebsite] = useState('');
    const [companyDescription, setCompanyDescription] = useState('');
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (existingProfile) {
            setCompanyName(existingProfile.company_name || '');
            setCompanyWebsite(existingProfile.company_website || '');
            setCompanyDescription(existingProfile.company_description || '');
            setCompanyLogoUrl(existingProfile.company_logo_url || null);
        }
    }, [existingProfile]);

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const updates = {
                company_name: companyName,
                company_website: companyWebsite,
                company_description: companyDescription,
                company_logo_url: companyLogoUrl,
                updated_at: new Date().toISOString(),
            };

            const { error } = await data.profiles.update(session.user.id, updates);

            if (error) throw error;
            
            await onSave(); // Refresh dashboard data
            onClose(); // Close modal on success

        } catch (err: any) {
            let message = 'An unknown error occurred while saving the profile.';
            if (err) {
                if (typeof err.details === 'string' && err.details) {
                    message = err.details;
                } else if (typeof err.message === 'string' && err.message) {
                    message = err.message;
                }
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };
    

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={handleOverlayClick}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <div className="flex-shrink-0 flex items-center justify-between p-4 border-b">
                    <h3 className="text-xl font-bold text-gray-800">Company Profile</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 transition-colors hover:bg-gray-100" aria-label="Close modal">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <form id="company-profile-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-4">
                    <div className="flex flex-col items-center space-y-4">
                        <CompanyLogo
                            url={companyLogoUrl}
                            size={128}
                            onUpload={(url) => {
                                setCompanyLogoUrl(url);
                            }}
                        />
                    </div>
                    {error && <div className="text-red-600 bg-red-100 p-3 rounded-md text-sm text-center">{error}</div>}
                    <div>
                        <label htmlFor="company-name" className="block text-sm font-medium text-gray-700">Company Name</label>
                        <input type="text" id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                     <div>
                        <label htmlFor="company-website" className="block text-sm font-medium text-gray-700">Company Website</label>
                        <input type="url" id="company-website" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://yourcompany.com" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                     <div>
                        <label htmlFor="company-description" className="block text-sm font-medium text-gray-700">Company Description</label>
                        <textarea id="company-description" value={companyDescription} onChange={(e) => setCompanyDescription(e.target.value)} rows={5} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                </form>
                <div className="flex-shrink-0 flex justify-end items-center p-4 border-t bg-gray-50 rounded-b-xl space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Cancel</button>
                    <button type="submit" form="company-profile-form" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:bg-blue-400">
                        {loading ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompanyProfileForm;
