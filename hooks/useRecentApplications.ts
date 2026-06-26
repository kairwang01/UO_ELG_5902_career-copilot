import { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, query, where, type DocumentData } from 'firebase/firestore';
import { firestoreDb } from '../lib/firebaseClient';

export interface RecentApplication {
  id: string;
  job_id: string;
  job_title: string;
  company_name: string;
  location: string;
  description: string;
  responsibilities: string;
  required_qualifications: string;
  status: string;
  application_date: string;
}

const toStringValue = (value: unknown) => (typeof value === 'string' ? value : '');

const toIsoDate = (value: unknown) => {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value != null ? String(value) : '';
};

const readPostingSnapshot = async (jobId: string): Promise<Partial<RecentApplication>> => {
  if (!jobId) return {};
  try {
    const snap = await getDoc(doc(firestoreDb, 'job_postings', jobId));
    if (!snap.exists()) return {};
    const data = snap.data() as DocumentData;
    return {
      job_title: toStringValue(data.title),
      company_name: toStringValue(data.company_name),
      location: toStringValue(data.location),
      description: toStringValue(data.description),
      responsibilities: toStringValue(data.responsibilities),
      required_qualifications: toStringValue(data.required_qualifications),
    };
  } catch {
    return {};
  }
};

export function useRecentApplications(
  session: { user?: { id?: string } } | null,
): { applications: RecentApplication[]; loading: boolean } {
  const [applications, setApplications] = useState<RecentApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Extract the primitive id so this effect only re-fires when the id changes,
  // not when the session object reference changes (Rule 5: input-set-idempotent).
  const uid = session?.user?.id ?? null;

  useEffect(() => {
    if (!uid) {
      setApplications([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchApps = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(firestoreDb, 'job_applications'),
          where('candidate_id', '==', uid),
        );
        const snap = await getDocs(q);
        if (cancelled) return;

        const rows: RecentApplication[] = snap.docs.map((doc) => {
          const d = doc.data() as Record<string, unknown>;
          return {
            id: doc.id,
            job_id: toStringValue(d['job_id']),
            job_title: toStringValue(d['job_title']),
            company_name: '',
            location: '',
            description: '',
            responsibilities: '',
            required_qualifications: '',
            status: toStringValue(d['status']),
            application_date: toIsoDate(d['application_date']),
          };
        });

        const postingEntries = await Promise.all(
          Array.from(new Set(rows.map((row) => row.job_id).filter(Boolean))).map(async (jobId) => [
            jobId,
            await readPostingSnapshot(jobId),
          ] as const),
        );
        const postingsById = new Map(postingEntries);
        const enrichedRows = rows.map((row) => {
          const posting = postingsById.get(row.job_id) ?? {};
          return {
            ...row,
            ...posting,
            job_title: posting.job_title || row.job_title,
          };
        });

        // Client-sort: most recent first
        enrichedRows.sort((a, b) => {
          const ta = a.application_date ? new Date(a.application_date).getTime() : 0;
          const tb = b.application_date ? new Date(b.application_date).getTime() : 0;
          return tb - ta;
        });

        setApplications(enrichedRows);
      } catch {
        // Silent-fail to []
        if (!cancelled) setApplications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchApps();

    return () => {
      cancelled = true;
    };
  }, [uid]); // uid is a primitive — stable reference, no t() in deps

  return { applications, loading };
}
