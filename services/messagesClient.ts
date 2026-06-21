/**
 * application-messages client — send via the server-only callable, read the thread
 * live via Firestore (rules allow each party to read their own application's thread).
 */
import { httpsCallable } from 'firebase/functions';
import { collection, onSnapshot, orderBy, query, where, type Timestamp } from 'firebase/firestore';
import { firebaseFunctions, firestoreDb } from '../lib/firebaseClient';

export type MessageTemplateKey =
  | 'interview_invite'
  | 'request_info'
  | 'rejection'
  | 'offer_followup'
  | 'custom';

export interface ApplicationMessage {
  id: string;
  application_id: string;
  sender_role: 'employer' | 'candidate';
  sender_uid: string;
  body: string;
  template_key: MessageTemplateKey;
  created_at: Timestamp | null;
}

const sendCallable = httpsCallable<
  { applicationId: string; body: string; templateKey?: string },
  { messageId: string; senderRole: 'employer' | 'candidate' }
>(firebaseFunctions, 'sendApplicationMessage');

export async function sendApplicationMessage(
  applicationId: string,
  body: string,
  templateKey?: MessageTemplateKey,
): Promise<{ messageId: string; senderRole: 'employer' | 'candidate' }> {
  const { data } = await sendCallable({ applicationId, body, templateKey });
  return data;
}

/** Live subscription to an application's message thread (oldest → newest). */
export function subscribeApplicationMessages(
  applicationId: string,
  onMessages: (messages: ApplicationMessage[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const q = query(
    collection(firestoreDb, 'application_messages'),
    where('application_id', '==', applicationId),
    orderBy('created_at', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => onMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ApplicationMessage, 'id'>) }))),
    (error) => onError?.(error),
  );
}
