import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useSession } from '../lib/session';
import { PendingApprovalView } from '../components/PendingApprovalView';
export default function Pending() {
  const { error, retry } = useSession();
  return <PendingApprovalView error={error} retry={retry} onSignOut={() => void signOut(auth)}/>;
}
