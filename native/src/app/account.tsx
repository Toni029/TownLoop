import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useSession } from '../lib/session';
import { Page, Card, Heading, Body, Button } from '../components/ui';
export default function Account() { const { profile } = useSession(); return <Page><Card><Heading>{profile?.name}</Heading><Body>{profile?.email}</Body><Body>{profile?.address}</Body><Body>{profile?.role}</Body><Button title="Sign Out" onPress={() => void signOut(auth)}/></Card></Page>; }
