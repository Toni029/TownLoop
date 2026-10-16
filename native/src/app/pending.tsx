import { signOutSafely } from '../notifications/signOut';
import { Alert } from 'react-native';
import { useSession } from '../lib/session';
import { Page, Card, Heading, Body, Button } from '../components/ui';
export default function Pending() { const { error, retry } = useSession(); return <Page><Card><Heading>{error ? 'Unable to load your account' : 'Awaiting approval'}</Heading><Body>{error || 'Your community office must approve your account before you can enter TownLoop.'}</Body><Button title="Try again" onPress={retry}/><Button title="Sign Out" onPress={() => void signOutSafely().catch(() => Alert.alert('Unable to sign out', 'Connect to the internet and try again so phone notifications can be safely disconnected.'))}/></Card></Page>; }
