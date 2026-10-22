import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
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
        const stopAuth = onAuthStateChanged(auth, user => {
            const current = ++generation;
            stopProfile();
            stopProfile = () => { };
            setState({ user, profile: null, loading: !!user, error: null });
            if (!user)
                return;
            stopProfile = onSnapshot(doc(db, 'users', user.uid), snapshot => {
                if (current !== generation)
                    return;
                setState({ user, profile: snapshot.exists() ? readProfile(snapshot.data()) : null, loading: false,
                    error: snapshot.exists() ? null : MISSING_REGISTRATION_MESSAGE });
            }, error => {
                if (current === generation)
                    setState({ user, profile: null, loading: false, error: friendlyError(error) });
            });
        }, error => setState({ ...initial, loading: false, error: friendlyError(error) }));
        return () => { generation++; stopProfile(); stopAuth(); };
    }, [attempt]);
    return <Context.Provider value={{ ...state, registrationInProgress, setRegistrationInProgress, retry: () => { setState(initial); setAttempt(n => n + 1); } }}>{children}</Context.Provider>;
}
export const useSession = () => useContext(Context);
