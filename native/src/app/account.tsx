import { signOutSafely } from '../notifications/signOut';
import { Alert } from 'react-native';
import { useSession } from '../lib/session';
import { Page, Card, Heading, Body, Button } from '../components/ui';
export default function Account() { const { profile } = useSession(); return <Page><Card><Heading>{profile?.name}</Heading><Body>{profile?.email}</Body><Body>{profile?.address}</Body><Body>{profile?.role}</Body><Button title="Sign Out" onPress={() => void signOutSafely().catch(() => Alert.alert('Unable to sign out', 'Connect to the internet and try again so phone notifications can be safely disconnected.'))}/></Card></Page>; }
