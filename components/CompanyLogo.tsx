import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CompanyLogoProps {
  url: string | null;
  size: number;
  onUpload?: (url: string) => void;
}

const CompanyLogo: React.FC<CompanyLogoProps> = ({ url, size, onUpload }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (url) {
      const { data } = supabase.storage.from('company-logos').getPublicUrl(url);
      setLogoUrl(`${data.publicUrl}?t=${new Date().getTime()}`);
    }
  }, [url]);

  const uploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
        setUploading(true);
        if (!event.target.files || event.target.files.length === 0) {
            throw new Error('You must select an image to upload.');
        }

        const file = event.target.files[0];
        const fileExt = file.name.split('.').pop();
        const filePath = `${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('company-logos')
            .upload(filePath, file);

        if (uploadError) throw uploadError;
        if (onUpload) onUpload(filePath);
    } catch (error) {
        alert((error as Error).message);
    } finally {
        setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div
        className="relative rounded-lg bg-gray-200 border border-gray-300"
        style={{ height: size, width: size }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Company Logo"
            className="rounded-lg object-contain"
            style={{ height: size, width: size }}
          />
        ) : (
          <div className="flex items-center justify-center rounded-lg bg-gray-100" style={{ height: size, width: size }}>
             <svg xmlns="http://www.w3.org/2000/svg" className="h-1/2 w-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
             </svg>
          </div>
        )}
        {onUpload && (
            <div className="absolute -bottom-3 -right-3">
                <label htmlFor="logo-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-md inline-block">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                </label>
                <input
                    style={{ visibility: 'hidden', position: 'absolute' }}
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    onChange={uploadLogo}
                    disabled={uploading}
                />
            </div>
        )}
      </div>
       {onUpload && (
         <p className="text-sm text-gray-500">{uploading ? 'Uploading...' : 'Upload your company logo'}</p>
      )}
    </div>
  );
};

export default CompanyLogo;
