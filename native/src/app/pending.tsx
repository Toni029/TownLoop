import {registrationMessage, terminalRegistration} from '../lib/registrationModel';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useSession } from '../lib/session';
import { PendingApprovalView } from '../components/PendingApprovalView';
export default function Pending() {
  const { error, retry, profile } = useSession();
  return <PendingApprovalView message={profile?.source ? registrationMessage(profile.source) : undefined} terminal={profile?.source ? terminalRegistration(profile.source) : false} error={error} retry={retry} onSignOut={() => void signOut(auth)}/>;
}
