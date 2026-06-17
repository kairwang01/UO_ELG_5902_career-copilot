/**
 * talentProfile — load/save the candidate's reusable Talent Profile.
 * Stored at talent_profiles/{uid} (owner-only per firestore.rules). Employers
 * never read it directly; the Discover Talent / applicant flow reads it
 * server-side (Admin SDK).
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestoreDb } from '../lib/firebaseClient';
import { emptyTalentProfile, type TalentProfile } from '../lib/talentProfile';

export async function loadTalentProfile(uid: string): Promise<TalentProfile> {
  try {
    const snap = await getDoc(doc(firestoreDb, 'talent_profiles', uid));
    if (snap.exists()) {
      return { ...emptyTalentProfile(), ...(snap.data() as Partial<TalentProfile>) } as TalentProfile;
    }
  } catch (e) {
    console.error('loadTalentProfile failed:', e);
  }
  return emptyTalentProfile();
}

export async function saveTalentProfile(uid: string, profile: TalentProfile): Promise<void> {
  await setDoc(
    doc(firestoreDb, 'talent_profiles', uid),
    { ...profile, updated_at: new Date().toISOString() },
    { merge: false },
  );
}
