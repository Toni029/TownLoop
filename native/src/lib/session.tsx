import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { reload, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { AppState } from 'react-native';
import { clearDeletedAccountCaches } from './accountDeletion';
import { auth, db } from './firebase';
import { MISSING_REGISTRATION_MESSAGE } from '../../../src/services/registrationRecovery';
import { friendlyError, readProfile, type ResidentProfile } from './profile';
type Session = {
    user: User | null;
    profile: ResidentProfile | null;
    loading: boolean;
    error: string | null;
};
const initial: Session = { user: null, profile: null, loading: true, error: null };
const Context = createContext<Session & {
    retry: () => void;
    registrationInProgress: boolean;
    setRegistrationInProgress: (value: boolean) => void;
}>({ ...initial, retry: () => { }, registrationInProgress: false, setRegistrationInProgress: () => {} });
export function SessionProvider({ children }: PropsWithChildren) {
    const [state, setState] = useState(initial);
    const [registrationInProgress, setRegistrationInProgress] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let generation = 0;
        let stopProfile = () => { };
        async function clearConfirmedDeletion(user: User) {
            try {
                await clearDeletedAccountCaches(user.uid);
                if(auth.currentUser?.uid===user.uid)await signOut(auth);
            } catch { if(auth.currentUser?.uid===user.uid)setState(s=>({...s,loading:false,error:'Account data cleanup could not finish. Reconnect and retry.'})); }
        }
        const checkDeletedIdentity = () => {
            const user=auth.currentUser;
            if(user)void reload(user).catch(error=>{
                // Offline, expired tokens, permission errors and ordinary sign-out
                // are NOT proof of deletion and must never erase local reminders.
                if(error?.code==='auth/user-not-found')void clearConfirmedDeletion(user);
            });
        };
        const foreground=AppState.addEventListener('change', state=>{if(state==='active')checkDeletedIdentity();});
        const stopAuth = onAuthStateChanged(auth, user => {
            const current = ++generation;
            stopProfile();
            stopProfile = () => { };
            setState({ user, profile: null, loading: !!user, error: null });
            if (!user)
                return;
            checkDeletedIdentity();
            stopProfile = onSnapshot(doc(db, 'users', user.uid), snapshot => {
                if (current !== generation)
                    return;
                if(snapshot.exists() && !snapshot.metadata.fromCache && snapshot.data().deletionPending===true) {
                    setState({user,profile:null,loading:true,error:null});
                    void clearConfirmedDeletion(user);
                    return;
                }
                setState({ user, profile: snapshot.exists() ? readProfile(snapshot.data()) : null, loading: false,
                    error: snapshot.exists() ? null : MISSING_REGISTRATION_MESSAGE });
            }, error => {
                if (current === generation)
                    setState({ user, profile: null, loading: false, error: friendlyError(error) });
            });
        }, error => setState({ ...initial, loading: false, error: friendlyError(error) }));
        return () => { foreground.remove(); generation++; stopProfile(); stopAuth(); };
    }, [attempt]);
    return <Context.Provider value={{ ...state, registrationInProgress, setRegistrationInProgress, retry: () => { setState(initial); setAttempt(n => n + 1); } }}>{children}</Context.Provider>;
}
export const useSession = () => useContext(Context);
