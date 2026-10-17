import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useSession } from '../lib/session';
import { Page, Card, Heading, Body, Button } from '../components/ui';
export default function Pending() { const { error, retry } = useSession(); return <Page><Card><Heading>{error ? 'Unable to load your account' : 'Awaiting approval'}</Heading><Body>{error || 'Your community office must approve your account before you can enter TownLoop.'}</Body><Button title="Try again" onPress={retry}/><Button title="Sign Out" onPress={() => void signOut(auth)}/></Card></Page>; }
