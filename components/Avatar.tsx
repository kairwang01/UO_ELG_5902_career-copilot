import React, { useEffect, useRef, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { app } from '../lib/firebaseClient';
import { useToast } from './Toast';

interface AvatarProps {
  url: string | null;
  size: number;
  onUpload?: (url: string) => void;
}

const Avatar: React.FC<AvatarProps> = ({ url, size, onUpload }) => {
  const { addToast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarUrl(url && url.startsWith('http') ? url : null);
  }, [url]);

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const auth = getAuth(app);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('You must be signed in to upload an avatar.');

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}.${fileExt}`;
      const storage = getStorage(app);
      const storageRef = ref(storage, `avatars/${uid}/${fileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      setAvatarUrl(downloadUrl);
      onUpload?.(downloadUrl);
    } catch (error) {
      addToast((error as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <span className="flex flex-col items-center space-y-4">
      <span
        className="relative rounded-full bg-gray-200 block"
        style={{ height: size, width: size }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="rounded-full object-cover"
            style={{ height: size, width: size }}
          />
        ) : (
          <span className="flex items-center justify-center rounded-full bg-gray-300" style={{ height: size, width: size }}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-1/2 w-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </span>
        )}
        {onUpload && (
          <span className="absolute bottom-0 right-0">
            <label htmlFor="avatar-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-md inline-block">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </label>
            <input
              ref={fileInputRef}
              style={{ visibility: 'hidden', position: 'absolute' }}
              type="file"
              id="avatar-upload"
              accept="image/*"
              onChange={uploadAvatar}
              disabled={uploading}
            />
          </span>
        )}
      </span>
      {onUpload && (
        <p className="text-sm text-gray-500">{uploading ? 'Uploading...' : 'Upload a new photo'}</p>
      )}
    </span>
  );
};

export default Avatar;
