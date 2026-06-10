import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestoreDb } from '../lib/firebaseClient';

export interface RecentApplication {
  id: string;
  job_id: string;
  job_title: string;
  status: string;
  application_date: string;
}

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
          // Coerce application_date: Firestore Timestamp → ISO string, fallback to String()
          let appDate = '';
          const raw = d['application_date'];
          if (raw && typeof (raw as { toDate?: unknown }).toDate === 'function') {
            appDate = (raw as { toDate: () => Date }).toDate().toISOString();
          } else if (raw != null) {
            appDate = String(raw);
          }

          return {
            id: doc.id,
            job_id: String(d['job_id'] ?? ''),
            job_title: String(d['job_title'] ?? ''),
            status: String(d['status'] ?? ''),
            application_date: appDate,
          };
        });

        // Client-sort: most recent first
        rows.sort((a, b) => {
          const ta = a.application_date ? new Date(a.application_date).getTime() : 0;
          const tb = b.application_date ? new Date(b.application_date).getTime() : 0;
          return tb - ta;
        });

        setApplications(rows);
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
