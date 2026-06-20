import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import {
  type ApplicationMessage,
  type MessageTemplateKey,
  sendApplicationMessage,
  subscribeApplicationMessages,
} from '../services/messagesClient';

interface ApplicationMessageThreadProps {
  applicationId: string;
  /** The signed-in viewer's role on this application — controls bubble alignment + templates. */
  viewerRole: 'employer' | 'candidate';
  t: (key: string) => string;
}

// Employer-only quick presets; the i18n value is the editable default body.
const EMPLOYER_TEMPLATES: { key: Exclude<MessageTemplateKey, 'custom'>; labelKey: string; bodyKey: string }[] = [
  { key: 'interview_invite', labelKey: 'msg_tmpl_interview_invite', bodyKey: 'msg_tmpl_interview_invite_body' },
  { key: 'request_info', labelKey: 'msg_tmpl_request_info', bodyKey: 'msg_tmpl_request_info_body' },
  { key: 'rejection', labelKey: 'msg_tmpl_rejection', bodyKey: 'msg_tmpl_rejection_body' },
  { key: 'offer_followup', labelKey: 'msg_tmpl_offer_followup', bodyKey: 'msg_tmpl_offer_followup_body' },
];

/**
 * Shared in-application message thread used by BOTH the employer (Applicant Funnel)
 * and the candidate (My Applications). Reads live via Firestore; sends through the
 * server-only sendApplicationMessage callable.
 */
const ApplicationMessageThread: React.FC<ApplicationMessageThreadProps> = ({ applicationId, viewerRole, t }) => {
  const [messages, setMessages] = useState<ApplicationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [template, setTemplate] = useState<MessageTemplateKey>('custom');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!applicationId) return;
    const unsub = subscribeApplicationMessages(applicationId, setMessages, () => setError(t('msg_load_error')));
    return () => unsub();
  }, [applicationId, t]);

  useEffect(() => {
    // Only auto-scroll if the reader is already near the bottom — don't yank the
    // panel down while they're scrolled up re-reading an earlier message.
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    if (nearBottom) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const applyTemplate = (key: MessageTemplateKey) => {
    setTemplate(key);
    const tmpl = EMPLOYER_TEMPLATES.find((x) => x.key === key);
    if (tmpl) setDraft(t(tmpl.bodyKey));
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendApplicationMessage(applicationId, body, viewerRole === 'employer' ? template : undefined);
      setDraft('');
      setTemplate('custom');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('msg_send_error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100">
        {t('msg_thread_title')}
      </div>
      <div ref={scrollRef} className="max-h-72 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">{t('msg_thread_empty')}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_role === viewerRole;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-slate-100 p-3 dark:border-slate-700">
        {viewerRole === 'employer' && (
          <select
            value={template}
            onChange={(e) => applyTemplate(e.target.value as MessageTemplateKey)}
            className="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            aria-label={t('msg_template_label')}
          >
            <option value="custom">{t('msg_tmpl_custom')}</option>
            {EMPLOYER_TEMPLATES.map((tmpl) => (
              <option key={tmpl.key} value={tmpl.key}>
                {t(tmpl.labelKey)}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder={t('msg_compose_placeholder')}
            className="flex-1 resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {t('msg_send')}
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
};

export default ApplicationMessageThread;
