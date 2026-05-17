
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { useToast } from './Toast';

interface ApiKeyManagerProps {
  session: Session;
  onViewDocs: () => void;
}

interface ApiKey {
  id: number;
  key_name: string;
  created_at: string;
  last_used_at: string | null;
  request_count: number;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ session, onViewDocs }) => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, key_name, created_at, last_used_at, request_count')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      addToast('Failed to fetch API keys.', 'error');
    } else {
      setKeys(data as ApiKey[]);
    }
    setLoading(false);
  }, [session.user.id, addToast]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      addToast('Please provide a name for your key.', 'error');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('create_api_key', {
      p_user_id: session.user.id,
      p_key_name: newKeyName.trim(),
    });

    if (error) {
      addToast(`Failed to create key: ${error.message}`, 'error');
    } else {
      setGeneratedKey(data);
      addToast('API key created successfully!', 'success');
      setNewKeyName('');
      fetchKeys();
    }
    setLoading(false);
  };

  const handleDeleteKey = async (keyId: number) => {
    if (!window.confirm('Are you sure you want to delete this key? This action cannot be undone.')) {
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc('delete_api_key', {
      p_key_id: keyId,
      p_user_id: session.user.id,
    });

    if (error) {
      addToast(`Failed to delete key: ${error.message}`, 'error');
    } else {
      addToast('API key deleted.', 'success');
      fetchKeys();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Generate API keys to integrate Career CoPilot's features into your own applications. Refer to the <button onClick={onViewDocs} className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">API documentation</button> for usage details.
      </p>
      
      {generatedKey && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4 animate-fade-in" onClick={() => setGeneratedKey(null)}>
              <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Your New API Key</h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md my-4">
                      Please copy your new API key now. You won’t be able to see it again!
                  </p>
                  <div className="relative">
                      <input
                          readOnly
                          value={generatedKey}
                          className="w-full bg-gray-100 dark:bg-slate-900/50 p-3 rounded-md font-mono text-sm border border-gray-300 dark:border-slate-600"
                      />
                      <button 
                          onClick={() => { navigator.clipboard.writeText(generatedKey); addToast('Key copied!', 'success'); }} 
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-800"
                          aria-label="Copy API Key"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                      </button>
                  </div>
                  <button onClick={() => setGeneratedKey(null)} className="mt-4 w-full bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700">
                      I have copied my key
                  </button>
              </div>
          </div>
      )}
      
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Enter a name for your key..."
          className="flex-grow border border-gray-300 dark:border-slate-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900"
          disabled={loading}
        />
        <button onClick={handleCreateKey} disabled={loading || !newKeyName.trim()} className="px-4 py-2 bg-gray-800 text-white font-semibold rounded-md shadow-sm hover:bg-black disabled:bg-gray-400">
          {loading ? 'Creating...' : 'Create New Key'}
        </button>
      </div>
      
      <div className="space-y-4">
        {keys.map(key => (
          <div key={key.id} className="p-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100">{key.key_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                Created: {new Date(key.created_at).toLocaleDateString()} | Last used: {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
              </p>
            </div>
            <button onClick={() => handleDeleteKey(key.id)} disabled={loading} className="text-sm text-red-600 hover:text-red-800 font-semibold disabled:opacity-50">
              Delete
            </button>
          </div>
        ))}
        {loading && !keys.length && <p className="text-sm text-gray-500">Loading keys...</p>}
        {!loading && keys.length === 0 && <p className="text-sm text-gray-500">You have no API keys yet.</p>}
      </div>
    </div>
  );
};

export default ApiKeyManager;
